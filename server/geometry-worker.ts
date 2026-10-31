import "./kernel";
import {
  meshParts,
  stepParts,
  setSourceLoader,
  inspectPart,
  measureBetween,
} from "../packages/cad";
import type { Part } from "../packages/protocol";
import { loadBrep } from "./assets";
import { importStep } from "./import-step";
import { renderParts } from "./render";
setSourceLoader(loadBrep);
self.onmessage = async (
  event: MessageEvent<{
    id: number;
    mode: string;
    parts: Part[];
    options?: any;
  }>,
) => {
  const { id, mode, parts, options } = event.data;
  try {
    let result: unknown;
    if (mode === "mesh") result = meshParts(parts);
    else if (mode === "step") result = await stepParts(parts).arrayBuffer();
    else if (mode === "import")
      result = importStep(options.text, options.fileName);
    else if (mode === "inspect") result = inspectPart(parts[0]);
    else if (mode === "distance") result = measureBetween(parts);
    else if (mode === "render") result = renderParts(parts, options?.view);
    else throw new Error(`Unknown geometry operation ${mode}`);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
