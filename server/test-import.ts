import "./kernel";
import fs from "node:fs";
import assert from "node:assert/strict";
import { importStep } from "./import-step";
import { loadBrep } from "./assets";
import {
  setSourceLoader,
  meshParts,
  inspectPart,
  stepParts,
} from "../packages/cad";
import { renderParts } from "./render";
setSourceLoader(loadBrep);
const inputPath = process.argv[2];
if (!inputPath)
  throw new Error(
    "Usage: tsx server/test-import.ts path/to/engram_module_v6.stp",
  );
const result = importStep(
  fs.readFileSync(inputPath, "utf8"),
  "engram_module_v6.stp",
);
assert.equal(result.parts.length, 8);
assert.equal(result.matchedNames, 8);
const meshes = meshParts(result.parts);
const band = result.parts.find((p) => p.name === "Band")!;
const inspected = inspectPart(band);
assert.equal(inspected.faces.length, 17);
const moved = {
  ...band,
  operations: [
    {
      type: "translate" as const,
      vector: [10, 0, 0] as [number, number, number],
    },
  ],
};
const before = meshes.find((m) => m.id === band.id)!;
const after = meshParts([moved])[0];
assert.ok(Math.abs(before.volume - after.volume) < 1e-5);
assert.ok(Math.abs(after.bounds[0][0] - before.bounds[0][0] - 10) < 1e-5);
const image = renderParts(result.parts);
fs.writeFileSync(
  "../../work/imported-step.png",
  Buffer.from(image.image.split(",")[1], "base64"),
);
const exported = stepParts(result.parts);
const roundtrip = importStep(await exported.text(), "roundtrip.step");
assert.equal(roundtrip.parts.length, 8);
fs.writeFileSync("../../work/import-result.json", JSON.stringify(result));
console.log(
  JSON.stringify({
    bodies: result.parts.map((p) => p.name),
    volumes: meshes.map((p) => p.volume),
    bandFaces: inspected.faces.length,
    roundtripBodies: roundtrip.parts.length,
    transform: "passed",
    render: "passed",
  }),
);
