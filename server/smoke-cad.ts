import "./kernel";
import { meshParts, stepParts } from "../packages/cad";
import type { Part } from "../packages/protocol";
import { importSTEP, measureVolume, isShape3D } from "replicad";
const p: Part = {
  id: "test",
  name: "Over-head arc smoke test",
  color: "#ffffff",
  features: [
    {
      kind: "arc",
      operation: "add",
      position: [0, 0, 0],
      rotation: [90, 0, 0],
      size: [0, 0, 15],
      radius: 85,
      thickness: 3,
      startAngle: 0,
      endAngle: 180,
    },
  ],
};
const meshes = meshParts([p]);
const step = stepParts([p]);
console.log(
  JSON.stringify({
    vertices: meshes[0].vertices.length / 3,
    volume: meshes[0].volume,
    bounds: meshes[0].bounds,
    stepBytes: step.size,
  }),
);
const reopened = await importSTEP(step);
if (!isShape3D(reopened))
  throw new Error("STEP round-trip did not return a 3D shape");
const volume = measureVolume(reopened);
reopened.delete();
if (Math.abs(volume - meshes[0].volume) > 0.001)
  throw new Error("STEP round-trip volume changed");
console.log(JSON.stringify({ stepRoundTrip: true, volume }));
