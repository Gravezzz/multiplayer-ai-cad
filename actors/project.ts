import { Actor, Persisted } from "terse-sdk/actor";
import { initialProject, applyEdit, editSchema } from "../packages/protocol";
import type { Project, Job, LogEntry } from "../packages/protocol";

export class ProjectActor extends Actor {
  @Persisted document: Project = initialProject();
  async snapshot(): Promise<Project> {
    return { ...this.document, sequence: this.document.sequence ?? 0 };
  }
  async commit(
    input: string,
    author: string,
    requestId: string,
  ): Promise<Project> {
    const edit = editSchema.parse(JSON.parse(input));
    this.document = applyEdit(this.document, edit, author, requestId);
    return this.document;
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
