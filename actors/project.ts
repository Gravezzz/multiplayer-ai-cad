import { Actor, Persisted } from "terse-sdk/actor";
import {
  initialProject,
  applyEdit,
  editSchema,
  projectThreads,
  startThreadJob,
  updateThreadJob,
} from "../packages/protocol";
import { z } from "zod";
import type {
  Project,
  Job,
  LogEntry,
  Part,
  RoomInfo,
} from "../packages/protocol";

export class RoomDirectory extends Actor {
  @Persisted rooms: RoomInfo[] = [];
  async list(): Promise<RoomInfo[]> {
    return this.rooms;
  }
  async register(input: string): Promise<RoomInfo> {
    const { id, name } = z
      .object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
        name: z.string().trim().min(1).max(80).optional(),
      })
      .parse(JSON.parse(input));
    const existing = this.rooms.find((r) => r.id === id);
    if (existing && (!name || name === existing.name)) return existing;
    if (!existing && this.rooms.length >= 100)
      throw new Error("Workspace limit: 100 rooms");
    const room = {
      id,
      name: name ?? `Assembly ${id.slice(0, 6)}`,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    this.rooms = [...this.rooms.filter((r) => r.id !== id), room];
    return room;
  }
}

export class ProjectActor extends Actor {
  @Persisted document: Project = initialProject();
  @Persisted checkpoints: Part[][] = [];
  async snapshot(): Promise<Project> {
    return {
      ...this.document,
      sequence: this.document.sequence ?? 0,
      threads: projectThreads(this.document),
    };
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
    this.document = updateThreadJob(this.document, job);
    return this.document;
  }
  async createThread(input: string): Promise<Project> {
    const { id, name } = z
      .object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60) })
      .parse(JSON.parse(input));
    const threads = projectThreads(this.document);
    if (threads.some((t) => t.id === id)) return this.snapshot();
    if (threads.length >= 30) throw new Error("Room limit: 30 agent threads");
    this.document = {
      ...this.document,
      threads: [...threads, { id, name, messages: [] }],
      sequence: (this.document.sequence ?? 0) + 1,
    };
    return this.document;
  }
  async startJob(input: string): Promise<Project> {
    const job = z
      .object({
        id: z.string().uuid(),
        threadId: z.string().min(1).max(100),
        author: z.string().min(1).max(60),
        task: z.string().min(1).max(8000),
        status: z.literal("running"),
        message: z.string(),
      })
      .parse(JSON.parse(input));
    this.document = startThreadJob(this.document, job);
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
