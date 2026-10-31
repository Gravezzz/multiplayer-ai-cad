// Exercises the running real Terse/CAD server; no mocked actors or model outputs.
import assert from "node:assert/strict";
const base = `http://127.0.0.1:3100/api/rooms/test-${crypto.randomUUID()}`;
async function request(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  return { status: response.status, body: await response.json() };
}
const part = {
  id: "test-band",
  name: "Test band",
  color: "#578066",
  features: [
    {
      kind: "arc",
      operation: "add",
      position: [0, 0, 0],
      rotation: [90, 0, 0],
      size: [0, 0, 16],
      radius: 85,
      thickness: 3,
      startAngle: 0,
      endAngle: 180,
    },
  ],
};
const body = {
  author: "Integration test",
  requestId: crypto.randomUUID(),
  edit: {
    baseRevision: 0,
    summary: "Test solid arc",
    upsertParts: [part],
    removePartIds: [],
  },
};
const created = await request(`${base}/edit`, body);
assert.equal(created.status, 200, JSON.stringify(created));
assert.equal(created.body.revision, 1);
const duplicate = await request(`${base}/edit`, body);
assert.equal(duplicate.body.revision, 1);
const stale = await request(`${base}/edit`, {
  ...body,
  requestId: crypto.randomUUID(),
});
assert.equal(stale.status, 409);
const meshes = await request(`${base}/meshes`);
assert.ok(meshes.body.meshes[0].vertices.length > 0);
assert.ok(meshes.body.meshes[0].volume > 0);
const invalid = structuredClone(body);
invalid.requestId = crypto.randomUUID();
invalid.edit.baseRevision = 1;
invalid.edit.upsertParts[0].features[0].thickness = 100;
const rejected = await request(`${base}/edit`, invalid);
assert.equal(rejected.status, 400);
assert.equal((await request(base)).body.revision, 1);
const exported = await fetch(`${base}/export.step`);
assert.equal(exported.status, 200);
const step = await exported.text();
assert.ok(step.includes("ISO-10303-21"));
console.log(
  JSON.stringify({
    passed: true,
    room: base,
    revision: 1,
    vertices: meshes.body.meshes[0].vertices.length / 3,
    stepBytes: step.length,
    checks: [
      "real actor commit",
      "duplicate delivery",
      "stale proposal rejected",
      "invalid geometry rejected",
      "mesh generated",
      "STEP exported",
    ],
  }),
);
