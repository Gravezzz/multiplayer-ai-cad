import type { Part } from "../packages/protocol";
export class GeometryService {
  private worker = this.createWorker();
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private createWorker() {
    const worker = new Worker(
      new URL("./geometry-worker.ts", import.meta.url).href,
    );
    worker.onmessage = (event) => {
      const { id, result, error } = event.data;
      const job = this.pending.get(id);
      if (!job) return;
      clearTimeout(job.timer);
      this.pending.delete(id);
      error ? job.reject(new Error(error)) : job.resolve(result);
    };
    worker.onerror = (event) =>
      this.failAll(new Error(event.message || "CAD worker failed"));
    return worker;
  }
  private failAll(error: Error) {
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.pending.clear();
    this.worker.terminate();
    this.worker = this.createWorker();
  }
  run(
    mode: "mesh" | "step" | "import" | "inspect" | "distance" | "render",
    parts: Part[],
    options?: unknown,
  ): Promise<any> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.failAll(new Error("CAD operation exceeded 60 seconds")),
        60_000,
      );
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, mode, parts, options });
    });
  }
}
