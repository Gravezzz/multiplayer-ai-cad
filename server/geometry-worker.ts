import "./kernel";
import { meshParts, stepParts } from "../packages/cad";
import type { Part } from "../packages/protocol";
self.onmessage = async (
  event: MessageEvent<{ id: number; mode: "mesh" | "step"; parts: Part[] }>,
) => {
  const { id, mode, parts } = event.data;
  try {
    const result =
      mode === "mesh" ? meshParts(parts) : await stepParts(parts).arrayBuffer();
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
