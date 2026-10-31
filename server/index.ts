import express from "express";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connectActors } from "./runtime";
import { GeometryService } from "./geometry";
import { runAgent } from "./agents";
import type { ModelConfig } from "./agents";
import { editSchema, applyEdit } from "../packages/protocol";
import type { Project, Edit, Job } from "../packages/protocol";

const { invoke, runtime } = await connectActors();
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
        author: z.string().min(1).max(60),
      })
      .parse(req.body);
  const state = await snapshot(room);
  if (state.jobs.filter((j) => j.status === "running").length >= 4) {
    res.status(409).json({ error: "At most four agent runs at once" });
    return;
  }
  const id = randomUUID();
  const job = async (value: Job) => {
    const state = await invoke(room, "setJob", [JSON.stringify(value)]);
    broadcast(room, state);
  };
  await job({ id, ...body, status: "running", message: "Starting model run" });
  void runAgent(
    body.task,
    body.author,
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
        const candidate = applyEdit(state, edit, body.author, randomUUID());
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
  ).catch((error) => console.error("Agent persistence error:", error.message));
  res.status(202).json({ id });
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
