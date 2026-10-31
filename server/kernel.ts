import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { setOC } from "replicad";
// This Emscripten distribution uses Node's CommonJS globals even in its ESM wrapper.
const require = createRequire(import.meta.url);
const entry = require.resolve("replicad-opencascadejs");
Object.assign(globalThis, { require, __dirname: path.dirname(entry) });
const { default: init } = await import("replicad-opencascadejs");
setOC(
  await init({
    wasmBinary: fs.readFileSync(
      path.join(path.dirname(entry), "replicad_single.wasm"),
    ),
  }),
);
