import assert from "node:assert/strict";
import { AssemblyClient } from "../packages/sdk";
import type { Project } from "../packages/protocol";
const origin = "http://127.0.0.1:3100";
const room = `step-test-${crypto.randomUUID()}`;
const client = new AssemblyClient(origin, room, "Integration test");
const original = await new AssemblyClient(
  origin,
  "wearable-editable-2026",
  "Reader",
).readAssembly();
assert.equal(original.parts.length, 8);
let state = await client.commit({
  baseRevision: 0,
  summary: "Load editable STEP test copy",
  upsertParts: original.parts,
  removePartIds: [],
});
const band = state.parts.find((p) => p.name === "Band")!;
const before = await client.mesh();
const moved = {
  ...band,
  operations: [
    {
      type: "translate" as const,
      vector: [10, 0, 0] as [number, number, number],
    },
  ],
};
state = await client.commit({
  baseRevision: state.revision,
  summary: "Move existing band only",
  upsertParts: [moved],
  removePartIds: [],
});
assert.equal(state.parts.length, 8);
for (const part of original.parts.filter((p) => p.id !== band.id))
  assert.deepEqual(
    state.parts.find((p) => p.id === part.id),
    part,
  );
const after = await client.mesh();
for (const mesh of before.meshes as any[])
  if (mesh.id !== band.id) {
    const updated = (after.meshes as any[]).find((m) => m.id === mesh.id);
    for (const field of [
      "vertices",
      "triangles",
      "normals",
      "bounds",
      "volume",
    ])
      assert.deepEqual(updated[field], mesh[field]);
  }
await assert.rejects(
  () =>
    client.commit({
      baseRevision: 1,
      summary: "Stale overwrite",
      upsertParts: [band],
      removePartIds: [],
    }),
  /STALE_REVISION/,
);
state = await client.undo(2);
assert.deepEqual(state.parts, original.parts);
assert.equal(state.revision, 3);
const inspection: any = await client.inspectPart(band.id);
assert.equal(inspection.faces.length, 17);
assert.equal(inspection.edges.length, 45);
const exported = await fetch(client.stepURL);
assert.equal(exported.status, 200);
assert.ok((await exported.text()).includes("ISO-10303-21"));
console.log(
  JSON.stringify({
    room,
    bodyCount: state.parts.length,
    untouchedBodies:
      "identical vertices, triangles, normals, bounds and volume",
    sourceTransform: true,
    staleRejected: true,
    undo: true,
    STEP: true,
  }),
);
