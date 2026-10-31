import "./kernel";
import assert from "node:assert/strict";
import { meshParts, inspectPart, measureBetween } from "../packages/cad";
import type { Part } from "../packages/protocol";
const box: Part = {
  id: "box",
  name: "test",
  color: "#658d7c",
  features: [
    {
      kind: "box",
      operation: "add",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [20, 20, 20],
      radius: 0,
      thickness: 0,
      startAngle: 0,
      endAngle: 0,
    },
  ],
};
const cases: Record<string, Part> = {
  fillet: {
    ...box,
    operations: [{ type: "fillet", radius: 1, edgeIndices: [0] }],
  },
  chamfer: {
    ...box,
    operations: [{ type: "chamfer", radius: 1, edgeIndices: [0] }],
  },
  shell: {
    ...box,
    operations: [{ type: "shell", thickness: -1, faceIndices: [0] }],
  },
  clip: {
    ...box,
    operations: [
      { type: "clip", origin: [0, 0, 0], normal: [1, 0, 0], keep: "positive" },
    ],
  },
  cut: {
    ...box,
    operations: [
      {
        type: "boolean",
        feature: {
          ...box.features[0],
          kind: "cylinder",
          operation: "cut",
          radius: 2,
          size: [0, 0, 30],
        },
      },
    ],
  },
  polygon: {
    ...box,
    features: [
      {
        ...box.features[0],
        kind: "polygon",
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        size: [0, 0, 10],
      },
    ],
  },
  sphere: {
    ...box,
    features: [{ ...box.features[0], kind: "sphere", radius: 5 }],
  },
  rotate: {
    ...box,
    operations: [
      { type: "rotate", angle: 45, axis: [0, 0, 1], origin: [0, 0, 0] },
    ],
  },
  scale: {
    ...box,
    operations: [{ type: "scale", factor: 2, origin: [0, 0, 0] }],
  },
};
for (const [name, part] of Object.entries(cases)) {
  const mesh = meshParts([part])[0];
  assert.ok(mesh.volume > 0);
  console.log(name, mesh.volume);
  if (name === "clip") assert.ok(Math.abs(mesh.volume - 4000) < 1e-4);
  if (name === "polygon") assert.ok(Math.abs(mesh.volume - 1000) < 1e-4);
}
const distance = measureBetween([
  box,
  {
    ...box,
    id: "other",
    operations: [{ type: "translate", vector: [30, 0, 0] }],
  },
]);
assert.ok(Math.abs(distance.minimumDistance - 10) < 1e-5);
assert.equal(inspectPart(box).faces.length, 6);
console.log("All direct-edit checks passed");
