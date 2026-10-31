import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const directory = path.resolve(".cad-assets");
export function saveBrep(data: string): string {
  const id = createHash("sha256").update(data).digest("hex");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${id}.brep`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, data, { flag: "wx" });
  return id;
}
export function loadBrep(id: string): string {
  if (!/^[a-f0-9]{64}$/.test(id))
    throw new Error("Invalid CAD asset identifier");
  const file = path.join(directory, `${id}.brep`);
  if (!fs.existsSync(file))
    throw new Error(`Missing CAD source asset ${id}; reimport the source STEP`);
  return fs.readFileSync(file, "utf8");
}
