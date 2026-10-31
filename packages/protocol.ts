import { z } from "zod";

export const vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
export const featureSchema = z.object({
  kind: z.enum(["box", "cylinder", "arc"]),
  operation: z.enum(["add", "cut"]),
  position: vector,
  rotation: vector,
  size: vector,
  radius: z.number().min(0).max(500),
  thickness: z.number().min(0).max(100),
  startAngle: z.number().min(-360).max(360),
  endAngle: z.number().min(-360).max(360),
});
export const partSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  features: z.array(featureSchema).min(1).max(32),
});
export const editSchema = z.object({
  baseRevision: z.number().int().min(0),
  summary: z.string().min(1).max(1000),
  upsertParts: z.array(partSchema).max(16),
  removePartIds: z.array(z.string()).max(16),
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
  status: "running" | "complete" | "error";
  message: string;
};
export type Project = {
  revision: number;
  sequence: number;
  parts: Part[];
  history: LogEntry[];
  requests: string[];
  jobs: Job[];
};
export const initialProject = (): Project => ({
  revision: 0,
  sequence: 0,
  parts: [],
  history: [],
  requests: [],
  jobs: [],
});

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
  if (parts.length > 40) throw new Error("Project limit: 40 editable parts");
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

export const geometryHelp = `Units mm. World coordinates: X left/right, Y front/back, Z up. Origin is near the center of the head. Imported meshes are references and cannot be edited with these tools. Create new editable solids rather than claim to change the reference.
Each part combines features in order. First feature MUST be add. box size=[width X,depth Y,height Z], centered at origin before transforms. cylinder radius and size[2]=height, along Z centered about origin. arc is an annular circular sector in XY, radius=outer radius, thickness=radial band thickness, size[2]=extrusion width, startAngle/endAngle in degrees CCW; arc span must be >0 and <=180. It starts centered on Z before transforms. rotation=[X,Y,Z] degrees applied in that order about global origin; position translation is applied last. Use rotation [90,0,0] to put an XY arc in XZ for an over-head band. All dimensions must be positive where used. Unused numeric fields should be zero. Each subsequent add is fused; cut is subtracted. Keep each physically disconnected item as a separate part. Colors #RRGGBB. For electrodes, create a supporting pad and separate silver cylinders for contacts. Stable part IDs allow targeted replacement. Read current parts before changing attachments; do not overwrite unrelated parts. Generated geometry is a mechanical concept, not a validated medical device.`;
