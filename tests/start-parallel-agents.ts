import { AssemblyClient } from "../packages/sdk";
import fs from "node:fs";
const origin = "http://127.0.0.1:3100",
  room = `parallel-check-${crypto.randomUUID().slice(0, 8)}`;
const initial = await new AssemblyClient(
  origin,
  "wearable-editable-2026",
  "Reader",
).readAssembly();
await new AssemblyClient(origin, room, "Verification").commit({
  baseRevision: 0,
  summary: "Independent copy for live concurrent-agent test",
  upsertParts: initial.parts,
  removePartIds: [],
});
const results = await Promise.all([
  new AssemblyClient(origin, room, "Module teammate").startAgent(
    "Translate only the existing Ref_module body by [0,0,2] mm in world coordinates. Keep its exact STEP source and all other geometry intact. Inspect, preview, and commit the change.",
  ),
  new AssemblyClient(origin, room, "Front teammate").startAgent(
    "Translate only the existing Front_Right body by [3,0,0] mm in world coordinates. Keep its exact STEP source and all other geometry intact. Inspect, preview, and commit the change.",
  ),
]);
fs.writeFileSync(
  "../../work/parallel-agent-test.json",
  JSON.stringify({ room, results }),
);
console.log(JSON.stringify({ room, results }));
