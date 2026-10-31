import { z } from "zod";

export const vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
export const featureSchema = z.object({
  kind: z.enum(["box", "cylinder", "arc", "sphere", "polygon"]),
  operation: z.enum(["add", "cut", "intersect"]),
  position: vector,
  rotation: vector,
  size: vector,
  radius: z.number().min(0).max(500),
  thickness: z.number().min(0).max(100),
  startAngle: z.number().min(-360).max(360),
  endAngle: z.number().min(-360).max(360),
  points: z
    .array(z.tuple([z.number().finite(), z.number().finite()]))
    .min(3)
    .max(100)
    .optional(),
});
export const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("translate"), vector }),
  z.object({
    type: z.literal("rotate"),
    angle: z.number().finite(),
    axis: vector,
    origin: vector,
  }),
  z.object({
    type: z.literal("scale"),
    factor: z.number().positive().max(100),
    origin: vector,
  }),
  z.object({
    type: z.literal("fillet"),
    radius: z.number().positive().max(100),
    edgeIndices: z.array(z.number().int().min(0)).max(300),
  }),
  z.object({
    type: z.literal("chamfer"),
    radius: z.number().positive().max(100),
    edgeIndices: z.array(z.number().int().min(0)).max(300),
  }),
  z.object({
    type: z.literal("shell"),
    thickness: z.number().finite(),
    faceIndices: z.array(z.number().int().min(0)).min(1).max(100),
  }),
  z.object({
    type: z.literal("clip"),
    normal: vector,
    origin: vector,
    keep: z.enum(["positive", "negative"]),
  }),
  z.object({ type: z.literal("boolean"), feature: featureSchema }),
]);
export const partSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  features: z.array(featureSchema).max(64),
  source: z
    .object({
      assetId: z.string().regex(/^[a-f0-9]{64}$/),
      fileName: z.string().max(200),
      bodyName: z.string().max(200),
      bodyIndex: z.number().int().min(0),
    })
    .optional(),
  operations: z.array(operationSchema).max(100).optional(),
});
export const editSchema = z.object({
  baseRevision: z.number().int().min(0),
  summary: z.string().min(1).max(1000),
  upsertParts: z.array(partSchema).max(100),
  removePartIds: z.array(z.string()).max(100),
});
export type Part = z.infer<typeof partSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type Edit = z.infer<typeof editSchema>;
export type LogEntry = {
  id: string;
  at: string;
  author: string;
  text: string;
  kind: "commit" | "agent" | "conflict" | "error";
};
export type Job = {
  id: string;
  author: string;
  task: string;
  status: "running" | "complete" | "needs_reply" | "error";
  message: string;
  threadId?: string;
  committed?: boolean;
};
export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
export type AgentThread = {
  id: string;
  name: string;
  messages: ThreadMessage[];
};
export type Project = {
  revision: number;
  sequence: number;
  parts: Part[];
  history: LogEntry[];
  requests: string[];
  jobs: Job[];
  threads?: AgentThread[];
};
export const initialProject = (): Project => ({
  revision: 0,
  sequence: 0,
  parts: [],
  history: [],
  requests: [],
  jobs: [],
  threads: [],
});

// Preserve existing conversations by their explicit author identity; no text/intent classification.
export function projectThreads(project: Project): AgentThread[] {
  const threads = structuredClone(project.threads ?? []);
  for (const job of project.jobs.filter((j) => !j.threadId)) {
    const id = `legacy:${job.author}`;
    let thread = threads.find((t) => t.id === id);
    if (!thread) {
      thread = { id, name: job.author, messages: [] };
      threads.push(thread);
    }
    if (!thread.messages.some((m) => m.id === `${job.id}:user`))
      thread.messages.push({
        id: `${job.id}:user`,
        role: "user",
        text: job.task,
      });
    if (
      job.status !== "running" &&
      !thread.messages.some((m) => m.id === `${job.id}:assistant`)
    )
      thread.messages.push({
        id: `${job.id}:assistant`,
        role: "assistant",
        text: job.message,
      });
  }
  return threads;
}

export function startThreadJob(project: Project, job: Job): Project {
  const threads = projectThreads(project);
  const thread = threads.find((t) => t.id === job.threadId);
  if (!thread) throw new Error("Unknown agent thread");
  if (
    project.jobs.some(
      (j) =>
        j.status === "running" &&
        (j.threadId ?? `legacy:${j.author}`) === thread.id,
    )
  )
    throw new Error("This agent is still working. Wait for its reply.");
  if (project.jobs.filter((j) => j.status === "running").length >= 4)
    throw new Error("At most four agents can work at once");
  if (thread.messages.length >= 200)
    throw new Error(
      "This conversation is full. Add an agent to start a new thread.",
    );
  thread.messages.push({ id: `${job.id}:user`, role: "user", text: job.task });
  return {
    ...project,
    threads,
    jobs: [...project.jobs, job],
    sequence: project.sequence + 1,
  };
}

export function updateThreadJob(project: Project, job: Job): Project {
  const threads = projectThreads(project);
  const thread = threads.find((t) => t.id === job.threadId);
  if (thread && job.status !== "running") {
    const message = {
      id: `${job.id}:assistant`,
      role: "assistant" as const,
      text: job.message,
    };
    const previous = thread.messages.findIndex((m) => m.id === message.id);
    if (previous < 0) thread.messages.push(message);
    else thread.messages[previous] = message;
  }
  return {
    ...project,
    threads,
    jobs: [...project.jobs.filter((j) => j.id !== job.id), job],
    sequence: project.sequence + 1,
  };
}

export function applyEdit(
  project: Project,
  edit: Edit,
  author: string,
  requestId: string,
): Project {
  if (project.requests.includes(requestId)) return project;
  if (project.revision !== edit.baseRevision)
    throw new Error(
      `STALE_REVISION: proposal used ${edit.baseRevision}; current revision is ${project.revision}. Read the latest assembly and regenerate your proposal.`,
    );
  if (
    new Set(edit.upsertParts.map((p) => p.id)).size !== edit.upsertParts.length
  )
    throw new Error("Duplicate part IDs in proposal");
  if (edit.upsertParts.some((p) => edit.removePartIds.includes(p.id)))
    throw new Error("Cannot remove and replace the same part");
  for (const id of edit.removePartIds)
    if (!project.parts.some((p) => p.id === id))
      throw new Error(`Unknown part: ${id}`);
  const replaced = new Set([
    ...edit.upsertParts.map((p) => p.id),
    ...edit.removePartIds,
  ]);
  const parts = [
    ...project.parts.filter((p) => !replaced.has(p.id)),
    ...edit.upsertParts,
  ];
  if (parts.length > 100) throw new Error("Project limit: 100 editable parts");
  return {
    ...project,
    revision: project.revision + 1,
    sequence: (project.sequence ?? 0) + 1,
    parts,
    requests: [...project.requests, requestId],
    history: [
      ...project.history,
      {
        id: requestId,
        at: new Date().toISOString(),
        author,
        text: edit.summary,
        kind: "commit" as const,
      },
    ].slice(-200),
  };
}

export const geometryHelp = `CAD SDK, units millimeters, Z up. Read current geometry; do not assume anatomical axes or dimensions. Imported STEP parts have immutable exact BRep source assets and can be edited with features and operations. source.assetId references a real imported solid; preserve it for edits to existing geometry. Never invent asset IDs. To replace an entire body with newly constructed geometry, keep its part ID and omit source explicitly. Preserve all unrelated part records.
Evaluation: load source (if present), apply features in order, then operations in order. Without source the first feature must add a solid. box size=[X,Y,Z], centered at local origin. cylinder radius and size[2]=height, along local Z centered at origin. sphere radius, centered at origin. polygon points are XY vertices of a closed planar profile, extruded by size[2] and centered along Z. arc is an annular sector in XY: radius=outer radius, thickness=radial thickness, size[2]=extrusion depth, startAngle/endAngle in degrees CCW (span >0 and <=180). Feature rotation [X,Y,Z] degrees applies in that order about the origin, then position translation. Positive dimensions where used; unused scalar fields zero. Features combine via add (union), cut (difference), or intersect.
Operations: translate by vector; rotate by angle degrees about arbitrary axis through origin; scale uniformly about origin; fillet/chamfer specified edgeIndices (empty means all edges); shell removes specified faceIndices with signed thickness; clip keeps one half of a plane through origin with normal; boolean appends a transformed primitive operation in current world coordinates. Use inspect_part to get exact edge/face indices at the current revision. Indices are scoped to the current geometry; inspect again after topology changes. Keep each disconnected component as a separate part. Use preview_design to validate and inspect a candidate before committing. Geometric measurements do not establish manufacturing suitability, ergonomic fit, or electrical performance.`;
