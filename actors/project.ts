import { Actor, Persisted } from "terse-sdk/actor";
import { initialProject, applyEdit, editSchema } from "../packages/protocol";
import type { Project, Job, LogEntry, Part } from "../packages/protocol";

export class ProjectActor extends Actor {
  @Persisted document: Project = initialProject();
  @Persisted checkpoints: Part[][] = [];
  async snapshot(): Promise<Project> {
    return { ...this.document, sequence: this.document.sequence ?? 0 };
  }
  async commit(
    input: string,
    author: string,
    requestId: string,
  ): Promise<Project> {
    const edit = editSchema.parse(JSON.parse(input));
    const next = applyEdit(this.document, edit, author, requestId);
    if (next !== this.document)
      this.checkpoints = [...this.checkpoints, this.document.parts].slice(-20);
    this.document = next;
    return this.document;
  }
  async undo(
    baseRevision: number,
    author: string,
    requestId: string,
  ): Promise<Project> {
    if (this.document.requests.includes(requestId)) return this.document;
    const parts = this.checkpoints.at(-1);
    if (!parts) throw new Error("No previous edit to undo");
    const ids = new Set(parts.map((p) => p.id));
    const next = applyEdit(
      this.document,
      {
        baseRevision,
        summary: "Undid the last shared geometry edit",
        upsertParts: parts,
        removePartIds: this.document.parts
          .filter((p) => !ids.has(p.id))
          .map((p) => p.id),
      },
      author,
      requestId,
    );
    this.checkpoints = this.checkpoints.slice(0, -1);
    this.document = next;
    return next;
  }
  async setJob(input: string): Promise<Project> {
    const job = JSON.parse(input) as Job;
    this.document = {
      ...this.document,
      sequence: (this.document.sequence ?? 0) + 1,
      jobs: [...this.document.jobs.filter((j) => j.id !== job.id), job].slice(
        -30,
      ),
    };
    return this.document;
  }
  async addActivity(input: string): Promise<Project> {
    const entry = JSON.parse(input) as LogEntry;
    this.document = {
      ...this.document,
      sequence: (this.document.sequence ?? 0) + 1,
      history: [...this.document.history, entry].slice(-200),
    };
    return this.document;
  }
}
