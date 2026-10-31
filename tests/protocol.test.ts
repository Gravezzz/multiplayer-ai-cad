import test from "node:test";
import assert from "node:assert/strict";
import { applyEdit, initialProject } from "../packages/protocol";
import type { Part } from "../packages/protocol";
const part: Part = {
  id: "band",
  name: "Band",
  color: "#556677",
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
test("concurrent stale proposal cannot overwrite a newer human revision", () => {
  const first = applyEdit(
    initialProject(),
    {
      baseRevision: 0,
      summary: "Create band",
      upsertParts: [part],
      removePartIds: [],
    },
    "agent",
    "one",
  );
  const humanPart = structuredClone(part);
  humanPart.features[0].radius = 90;
  const human = applyEdit(
    first,
    {
      baseRevision: 1,
      summary: "Widen band",
      upsertParts: [humanPart],
      removePartIds: [],
    },
    "human",
    "two",
  );
  assert.throws(
    () =>
      applyEdit(
        human,
        {
          baseRevision: 1,
          summary: "Old proposal",
          upsertParts: [part],
          removePartIds: [],
        },
        "agent",
        "three",
      ),
    /STALE_REVISION/,
  );
  assert.equal(human.parts[0].features[0].radius, 90);
});
test("duplicate operation is idempotent even after newer writes", () => {
  const edit = {
    baseRevision: 0,
    summary: "Create band",
    upsertParts: [part],
    removePartIds: [],
  };
  const first = applyEdit(initialProject(), edit, "agent", "one");
  assert.equal(applyEdit(first, edit, "agent", "one"), first);
});
test("targeted edit preserves a different agent’s accepted part", () => {
  const first = applyEdit(
    initialProject(),
    {
      baseRevision: 0,
      summary: "Band",
      upsertParts: [part],
      removePartIds: [],
    },
    "agent",
    "one",
  );
  const next = applyEdit(
    first,
    {
      baseRevision: 1,
      summary: "Electrode",
      upsertParts: [{ ...part, id: "electrode" }],
      removePartIds: [],
    },
    "agent",
    "two",
  );
  assert.deepEqual(
    next.parts.map((p) => p.id),
    ["band", "electrode"],
  );
});
