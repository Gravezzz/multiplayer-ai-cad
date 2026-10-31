import express from "express";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connectActors } from "./runtime";
import { GeometryService } from "./geometry";
import { runAgent } from "./agents";
import type { ModelConfig } from "./agents";
import { editSchema, applyEdit } from "../packages/protocol";
import type { Project, Edit, Job, RoomInfo } from "../packages/protocol";

const { invoke, runtime, directory } = await connectActors();
const geometry = new GeometryService();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
// Local-only demo. No browser CORS grants and no publicly exposed credential configuration.
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (
    origin &&
    ![
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:3100",
    ].includes(origin)
  ) {
    res.status(403).json({ error: "Origin not allowed" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});
let config: ModelConfig = {
  apiKey: process.env.OPENAI_API_KEY || "",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
};
const clients = new Map<string, Set<Response>>();
const meshes = new Map<string, { revision: number; meshes: unknown[] }>();
const roomSchema = z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/);
const roomOf = (req: express.Request) => roomSchema.parse(req.params.room);
const snapshot = (room: string) => invoke(room, "snapshot");
const registerRoom = (id: string, name?: string) =>
  directory("register", [JSON.stringify({ id, name })]) as Promise<RoomInfo>;
const thumbnails = new Map<string, { revision: number; bytes: Buffer }>();
function broadcast(room: string, state: Project) {
  for (const res of clients.get(room) || [])
    res.write(`event: project\ndata: ${JSON.stringify(state)}\n\n`);
}
async function commit(
  room: string,
  edit: Edit,
  author: string,
  requestId: string = randomUUID(),
) {
  // Expensive work happens outside the serialized actor. Its revision check runs after validation.
  await geometry.run("mesh", edit.upsertParts);
  const state = await invoke(room, "commit", [
    JSON.stringify(edit),
    author,
    requestId,
  ]);
  meshes.delete(room);
  broadcast(room, state);
  return state;
}
async function activity(
  room: string,
  author: string,
  text: string,
  kind: "agent" | "error" | "conflict",
) {
  const state = await invoke(room, "addActivity", [
    JSON.stringify({
      id: randomUUID(),
      at: new Date().toISOString(),
      author,
      text,
      kind,
    }),
  ]);
  broadcast(room, state);
}
app.get("/api/health", (_req, res) =>
  res.json({
    actors: true,
    providerConfigured: !!config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  }),
);
app.post("/api/settings", (req, res) => {
  const data = z
    .object({
      apiKey: z.string().min(1),
      baseUrl: z.string().url(),
      model: z.string().min(1),
    })
    .parse(req.body);
  const url = new URL(data.baseUrl);
  if (url.protocol !== "https:")
    throw new Error("Model endpoint must use HTTPS");
  config = data;
  res.json({ configured: true, model: config.model });
});
app.get("/api/rooms", async (_req, res) => {
  const rooms = (await directory("list")) as RoomInfo[];
  const summaries = await Promise.all(
    rooms.map(async (room) => {
      const state = await snapshot(room.id);
      return {
        ...room,
        revision: state.revision,
        parts: state.parts.length,
        agents: state.threads?.length ?? 0,
        working: state.jobs.filter((j) => j.status === "running").length,
        connections: clients.get(room.id)?.size ?? 0,
      };
    }),
  );
  res.json(summaries);
});
app.post("/api/rooms", async (req, res) => {
  const body = z
    .object({
      id: roomSchema.optional(),
      name: z.string().trim().min(1).max(80),
    })
    .parse(req.body);
  res.json(await registerRoom(body.id ?? randomUUID(), body.name));
});
app.get("/api/rooms/:room/info", async (req, res) =>
  res.json(await registerRoom(roomOf(req))),
);
app.get("/api/rooms/:room/thumbnail", async (req, res) => {
  const room = roomOf(req),
    state = await snapshot(room);
  if (!state.parts.length) {
    res.status(404).end();
    return;
  }
  let thumbnail = thumbnails.get(room);
  if (!thumbnail || thumbnail.revision !== state.revision) {
    const result = await geometry.run("render", state.parts, {
      view: "isometric",
    });
    thumbnail = {
      revision: state.revision,
      bytes: Buffer.from(result.image.split(",")[1], "base64"),
    };
    thumbnails.set(room, thumbnail);
  }
  res.type("png").send(thumbnail.bytes);
});
app.get("/api/rooms/:room", async (req, res) =>
  res.json(await snapshot(roomOf(req))),
);
app.get("/api/rooms/:room/events", async (req, res) => {
  const room = roomOf(req);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  if (!clients.has(room)) clients.set(room, new Set());
  clients.get(room)!.add(res);
  const presence = () => {
    for (const client of clients.get(room) || [])
      client.write(
        `event: presence\ndata: ${JSON.stringify({ count: clients.get(room)?.size || 0 })}\n\n`,
      );
  };
  presence();
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.get(room)?.delete(res);
    presence();
  });
  try {
    await registerRoom(room);
    const state = await snapshot(room);
    res.write(`event: project\ndata: ${JSON.stringify(state)}\n\n`);
  } catch (error) {
    res.write(
      `event: failure\ndata: ${JSON.stringify({ error: (error as Error).message })}\n\n`,
    );
    res.end();
  }
});
app.post("/api/rooms/:room/edit", async (req, res) => {
  const body = z
    .object({
      edit: editSchema,
      author: z.string().min(1).max(60),
      requestId: z.string().uuid(),
    })
    .parse(req.body);
  res.json(await commit(roomOf(req), body.edit, body.author, body.requestId));
});
app.post("/api/rooms/:room/undo", async (req, res) => {
  const body = z
    .object({
      baseRevision: z.number().int().min(0),
      author: z.string().min(1).max(60),
      requestId: z.string().uuid(),
    })
    .parse(req.body);
  const room = roomOf(req);
  const state = await invoke(room, "undo", [
    body.baseRevision,
    body.author,
    body.requestId,
  ]);
  meshes.delete(room);
  broadcast(room, state);
  res.json(state);
});
app.get("/api/rooms/:room/meshes", async (req, res) => {
  const room = roomOf(req),
    state = await snapshot(room);
  let cache = meshes.get(room);
  if (!cache || cache.revision !== state.revision) {
    cache = {
      revision: state.revision,
      meshes: await geometry.run("mesh", state.parts),
    };
    meshes.set(room, cache);
  }
  res.json(cache);
});
app.post("/api/rooms/:room/import-step", async (req, res) => {
  const body = z
    .object({
      text: z.string().max(18_000_000),
      fileName: z.string().min(1).max(200),
      baseRevision: z.number().int().min(0),
      author: z.string().min(1).max(60),
    })
    .parse(req.body);
  const imported = await geometry.run("import", [], {
    text: body.text,
    fileName: body.fileName,
  });
  const state = await commit(
    roomOf(req),
    {
      baseRevision: body.baseRevision,
      summary: `Imported ${body.fileName}: ${imported.bodyCount} editable solid bodies`,
      upsertParts: imported.parts,
      removePartIds: [],
    },
    body.author,
  );
  res.json({
    state,
    imported: {
      bodyCount: imported.bodyCount,
      matchedNames: imported.matchedNames,
      translation: imported.translation,
    },
  });
});
app.get("/api/rooms/:room/parts/:part/inspect", async (req, res) => {
  const state = await snapshot(roomOf(req));
  const part = state.parts.find((p) => p.id === req.params.part);
  if (!part) throw new Error("Unknown body");
  res.json({
    revision: state.revision,
    ...(await geometry.run("inspect", [part])),
  });
});
app.get("/api/rooms/:room/export.step", async (req, res) => {
  const state = await snapshot(roomOf(req));
  if (!state.parts.length) {
    res.status(400).json({ error: "No editable solids to export" });
    return;
  }
  const bytes = await geometry.run("step", state.parts);
  res.setHeader("Content-Type", "application/step");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="assembly-r${state.revision}.step"`,
  );
  res.send(Buffer.from(bytes));
});
app.post("/api/rooms/:room/threads", async (req, res) => {
  const body = z
    .object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) })
    .parse(req.body);
  const room = roomOf(req);
  const state = await invoke(room, "createThread", [JSON.stringify(body)]);
  broadcast(room, state);
  res.json(state);
});
app.post("/api/rooms/:room/agents", async (req, res) => {
  if (!config.apiKey) {
    res
      .status(400)
      .json({ error: "Configure your OpenAI key in Settings first" });
    return;
  }
  const room = roomOf(req),
    body = z
      .object({
        task: z.string().min(1).max(8000),
        author: z.string().min(1).max(60).optional(),
        threadId: z.string().min(1).max(100).optional(),
      })
      .parse(req.body);
  let state = await snapshot(room);
  // Existing SDK callers may omit a thread; give each such run its own conversation.
  if (!body.threadId) {
    body.threadId = randomUUID();
    state = await invoke(room, "createThread", [
      JSON.stringify({ id: body.threadId, name: body.author || "Agent" }),
    ]);
  }
  const thread = state.threads?.find((t) => t.id === body.threadId);
  if (!thread) throw new Error("Unknown agent thread");
  const agentName = thread.name;
  const id = randomUUID();
  const job = async (value: Job) => {
    const state = await invoke(room, "setJob", [JSON.stringify(value)]);
    broadcast(room, state);
  };
  const started = await invoke(room, "startJob", [
    JSON.stringify({
      id,
      threadId: thread.id,
      author: agentName,
      task: body.task,
      status: "running",
      message: "Starting model run",
    }),
  ]);
  broadcast(room, started);
  void runAgent(
    body.task,
    agentName,
    id,
    { ...config },
    {
      snapshot: () => snapshot(room),
      inspect: async (partId) => {
        const state = await snapshot(room);
        const part = state.parts.find((p) => p.id === partId);
        if (!part) throw new Error("Unknown body");
        return {
          revision: state.revision,
          ...(await geometry.run("inspect", [part])),
        };
      },
      render: async (ids, view) => {
        const state = await snapshot(room);
        const parts = ids.length
          ? ids.map((id) => {
              const part = state.parts.find((p) => p.id === id);
              if (!part) throw new Error(`Unknown body ${id}`);
              return part;
            })
          : state.parts;
        return {
          revision: state.revision,
          ...(await geometry.run("render", parts, { view })),
        };
      },
      distance: async (ids) => {
        const state = await snapshot(room);
        const parts = ids.map((id) => {
          const part = state.parts.find((p) => p.id === id);
          if (!part) throw new Error(`Unknown body ${id}`);
          return part;
        });
        return {
          revision: state.revision,
          ...(await geometry.run("distance", parts)),
        };
      },
      preview: async (edit) => {
        const state = await snapshot(room);
        const candidate = applyEdit(state, edit, agentName, randomUUID());
        return {
          baseRevision: state.revision,
          changedPartIds: edit.upsertParts.map((p) => p.id),
          removedPartIds: edit.removePartIds,
          ...(await geometry.run("render", candidate.parts, {
            view: "isometric",
          })),
        };
      },
      measure: async () => {
        const state = await snapshot(room);
        const result = await geometry.run("mesh", state.parts);
        return {
          revision: state.revision,
          parts: result.map((p: any) => ({
            id: p.id,
            bounds: p.bounds,
            volume: p.volume,
          })),
        };
      },
      commit: (edit, author) => commit(room, edit, author),
      job,
      activity: (author, text, kind) => activity(room, author, text, kind),
    },
    started.threads!.find((t) => t.id === thread.id)!.messages.slice(0, -1),
    thread.id,
  ).catch((error) => console.error("Agent persistence error:", error.message));
  res.status(202).json({ id, threadId: thread.id });
});
app.use(
  (
    error: Error,
    _req: express.Request,
    res: Response,
    _next: express.NextFunction,
  ) =>
    res
      .status(error.message.includes("STALE_REVISION") ? 409 : 400)
      .json({ error: error.message }),
);
app.listen(3100, "127.0.0.1", () =>
  console.log("Assembly API ready at http://127.0.0.1:3100"),
);
runtime.closed.catch((error) => {
  console.error("Actor runtime failed:", error.message);
  process.exit(1);
});
process.on("SIGINT", async () => {
  await runtime.stop();
  process.exit(0);
});
