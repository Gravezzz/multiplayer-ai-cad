import type { Edit, Project } from "./protocol";
/** SDK for local trusted clients. Same validated API used by human controls and model tools. */
export class AssemblyClient {
  constructor(
    private readonly origin: string,
    private readonly room: string,
    private readonly author: string,
  ) {}
  private async request<T>(suffix: string, body?: unknown): Promise<T> {
    const response = await fetch(
      `${this.origin}/api/rooms/${encodeURIComponent(this.room)}${suffix}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || response.statusText);
    return result;
  }
  readAssembly() {
    return this.request<Project>("");
  }
  commit(edit: Edit, requestId = crypto.randomUUID()) {
    return this.request<Project>("/edit", {
      edit,
      author: this.author,
      requestId,
    });
  }
  startAgent(task: string) {
    return this.request<{ id: string }>("/agents", {
      task,
      author: this.author,
    });
  }
  mesh() {
    return this.request<{ revision: number; meshes: unknown[] }>("/meshes");
  }
  importSTEP(text: string, fileName: string, baseRevision: number) {
    return this.request<{ state: Project }>("/import-step", {
      text,
      fileName,
      baseRevision,
      author: this.author,
    });
  }
  inspectPart(partId: string) {
    return this.request<unknown>(
      `/parts/${encodeURIComponent(partId)}/inspect`,
    );
  }
  undo(baseRevision: number) {
    return this.request<Project>("/undo", {
      baseRevision,
      author: this.author,
      requestId: crypto.randomUUID(),
    });
  }
  get stepURL() {
    return `${this.origin}/api/rooms/${encodeURIComponent(this.room)}/export.step`;
  }
}
