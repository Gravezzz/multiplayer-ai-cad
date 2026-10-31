import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { createRoot } from "react-dom/client";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewport,
  Line,
} from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import {
  Box,
  ChevronRight,
  CircleDot,
  Command,
  Download,
  Eye,
  EyeOff,
  Layers,
  Link,
  LoaderCircle,
  Plus,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
  RotateCcw,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  initialProject,
  partSchema,
  projectThreads,
} from "../packages/protocol";
import type { Project, Part, Feature, Edit, Job } from "../packages/protocol";
import "./style.css";

const params = new URLSearchParams(location.search);
let room = params.get("room");
if (!room) {
  room = crypto.randomUUID();
  params.set("room", room);
  history.replaceState(null, "", `?${params}`);
}
const base = `/api/rooms/${room}`;
const author =
  sessionStorage.getItem("assembly-user") ||
  `Designer ${Math.floor(Math.random() * 900 + 100)}`;
sessionStorage.setItem("assembly-user", author);
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}
type MeshData = {
  id: string;
  vertices: number[];
  triangles: number[];
  normals: number[];
  volume: number;
  bounds: number[][];
};
const blankFeature: Feature = {
  kind: "box",
  operation: "add",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  size: [20, 10, 3],
  radius: 0,
  thickness: 0,
  startAngle: 0,
  endAngle: 0,
};

class SceneBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="scene-error">Viewport error: {this.state.error}</div>
    ) : (
      this.props.children
    );
  }
}
function Reference({
  kind,
  ghost,
}: {
  kind: "current" | "target";
  ghost: boolean;
}) {
  const source = useLoader(STLLoader, `/references/${kind}.stl`);
  const geometry = useMemo(() => {
    const copy = source.clone();
    copy.computeBoundingBox();
    const center = copy.boundingBox!.getCenter(new THREE.Vector3());
    copy.translate(-center.x, -center.y, -center.z);
    copy.computeVertexNormals();
    return copy;
  }, [source]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={kind === "current" ? "#808e8b" : "#c4bd9e"}
        metalness={0.18}
        roughness={0.55}
        transparent={ghost}
        opacity={ghost ? 0.25 : 1}
        depthWrite={!ghost}
      />
    </mesh>
  );
}
function Solid({
  data,
  part,
  selected,
  onSelect,
}: {
  data: MeshData;
  part: Part;
  selected: boolean;
  onSelect: () => void;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.vertices, 3),
    );
    g.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
    g.setIndex(data.triangles);
    return g;
  }, [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={part.color}
        metalness={part.color.toLowerCase() === "#c0c0c0" ? 0.75 : 0.2}
        roughness={0.35}
        emissive={selected ? "#307f71" : "#000000"}
        emissiveIntensity={selected ? 0.18 : 0}
      />
    </mesh>
  );
}
function Scene({
  project,
  meshes,
  selected,
  setSelected,
  reference,
  ghost,
  reset,
}: {
  project: Project;
  meshes: MeshData[];
  selected: string | null;
  setSelected: (id: string | null) => void;
  reference: "current" | "target" | "none";
  ghost: boolean;
  reset: number;
}) {
  return (
    <SceneBoundary>
      <Canvas
        camera={{
          position: [260, -350, 230],
          up: [0, 0, 1],
          fov: 42,
          near: 0.1,
          far: 5000,
        }}
        onPointerMissed={() => setSelected(null)}
        shadows
        dpr={[1, 1.5]}
      >
        <color attach="background" args={["#eef0eb"]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[100, -180, 300]} intensity={2.5} />
        <directionalLight position={[-150, 150, 70]} intensity={1.1} />
        <gridHelper
          args={[600, 30, "#c6cec5", "#dce1d8"]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -105]}
        />
        <Line
          points={[
            [-300, 0, -104.9],
            [300, 0, -104.9],
          ]}
          color="#d2b1a7"
          lineWidth={1}
        />
        <Line
          points={[
            [0, -300, -104.9],
            [0, 300, -104.9],
          ]}
          color="#adc2b5"
          lineWidth={1}
        />
        <Suspense fallback={null}>
          {reference !== "none" && <Reference kind={reference} ghost={ghost} />}
          {meshes.map((data) => {
            const part = project.parts.find((p) => p.id === data.id);
            return part ? (
              <Solid
                key={part.id}
                part={part}
                data={data}
                selected={selected === part.id}
                onSelect={() => setSelected(part.id)}
              />
            ) : null;
          })}
        </Suspense>
        <OrbitControls
          key={reset}
          makeDefault
          target={[0, 0, 0]}
          minDistance={30}
          maxDistance={1200}
        />
        <GizmoHelper alignment="bottom-right" margin={[65, 65]}>
          <GizmoViewport
            axisColors={["#bd6f5a", "#729e78", "#6f8dbb"]}
            labelColor="white"
          />
        </GizmoHelper>
      </Canvas>
    </SceneBoundary>
  );
}

function App() {
  const [project, setProject] = useState<Project>(initialProject),
    [connected, setConnected] = useState(false),
    [presence, setPresence] = useState(0);
  const [meshes, setMeshes] = useState<MeshData[]>([]),
    [meshRevision, setMeshRevision] = useState(-1),
    [meshError, setMeshError] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [reference, setReference] = useState<"current" | "target" | "none">("none"),
    [ghost, setGhost] = useState(false),
    [reset, setReset] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState(""),
    [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({}),
    [addingAgent, setAddingAgent] = useState(false),
    [newAgentName, setNewAgentName] = useState(""),
    [sending, setSending] = useState(false),
    [error, setError] = useState("");
  const [settings, setSettings] = useState(false),
    [configured, setConfigured] = useState(false),
    [model, setModel] = useState("gpt-6.1-sol"),
    [endpoint, setEndpoint] = useState("https://api.openai.com/v1"),
    [key, setKey] = useState("");
  const [tab, setTab] = useState<"team" | "history">("team"),
    [copied, setCopied] = useState(false),
    [draft, setDraft] = useState<Part | null>(null),
    [draftRevision, setDraftRevision] = useState(0),
    [saving, setSaving] = useState(false);
  const [transform, setTransform] = useState({
    vector: [0, 0, 0],
    angle: 0,
    axis: [0, 0, 1],
    origin: [0, 0, 0],
  });
  const [inspection, setInspection] = useState<any>(null);
  const [rawPart, setRawPart] = useState("");
  const conversationEnd = useRef<HTMLDivElement>(null);
  const threads = useMemo(() => projectThreads(project), [project]);
  const activeThread =
    threads.find((t) => t.id === selectedAgent) ?? threads[0];
  const task = threadDrafts[activeThread?.id ?? ""] ?? "";
  const setTask = (value: string) =>
    setThreadDrafts((drafts) => ({
      ...drafts,
      [activeThread?.id ?? ""]: value,
    }));
  const latestJob = (threadId: string) =>
    [...project.jobs]
      .reverse()
      .find((j) => (j.threadId ?? `legacy:${j.author}`) === threadId);
  const activeJob = activeThread ? latestJob(activeThread.id) : undefined;
  const jobLabel = (job?: Job) =>
    !job
      ? "Ready"
      : job.status === "running"
        ? "Working"
        : job.status === "needs_reply"
          ? "Needs reply"
          : job.status === "error"
            ? "Error"
            : job.committed
              ? "Changes saved"
              : "Replied";
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: "end" });
  }, [activeThread?.id, activeThread?.messages.length, activeJob?.status, tab]);
  async function addAgent() {
    if (!newAgentName.trim() || sending) return;
    setSending(true);
    try {
      const id = crypto.randomUUID();
      const state = await api<Project>(`${base}/threads`, {
        method: "POST",
        body: JSON.stringify({ id, name: newAgentName.trim() }),
      });
      setProject((current) =>
        state.sequence >= current.sequence ? state : current,
      );
      setSelectedAgent(id);
      setNewAgentName("");
      setAddingAgent(false);
      setTab("team");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  useEffect(() => {
    setRawPart(draft ? JSON.stringify(draft, null, 2) : "");
  }, [draft]);
  useEffect(() => {
    api<{ providerConfigured: boolean; model: string; baseUrl: string }>(
      "/api/health",
    )
      .then((data) => {
        setConfigured(data.providerConfigured);
        setModel(data.model);
        setEndpoint(data.baseUrl);
      })
      .catch(() => {});
    const events = new EventSource(`${base}/events`);
    events.addEventListener("project", (event) => {
      const incoming = JSON.parse((event as MessageEvent).data);
      setProject((current) =>
        (incoming.sequence ?? 0) >= (current.sequence ?? 0)
          ? incoming
          : current,
      );
      setConnected(true);
    });
    events.addEventListener("presence", (event) =>
      setPresence(JSON.parse((event as MessageEvent).data).count),
    );
    events.onerror = () => setConnected(false);
    return () => events.close();
  }, []);
  useEffect(() => {
    let active = true;
    setMeshError("");
    api<{ revision: number; meshes: MeshData[] }>(`${base}/meshes`)
      .then((data) => {
        if (active) {
          setMeshes(data.meshes);
          setMeshRevision(data.revision);
        }
      })
      .catch((err) => {
        if (active) setMeshError(err.message);
      });
    return () => {
      active = false;
    };
  }, [project.revision]);
  useEffect(() => {
    const part = project.parts.find((p) => p.id === selected);
    setDraft(part ? structuredClone(part) : null);
    setDraftRevision(project.revision);
    setInspection(null);
  }, [selected]);
  const selectedPart = project.parts.find((p) => p.id === selected);
  const pending = project.jobs.filter((j) => j.status === "running").length;
  async function submitTask() {
    if (
      !task.trim() ||
      !activeThread ||
      activeJob?.status === "running" ||
      sending ||
      !connected ||
      !configured
    )
      return;
    const threadId = activeThread.id;
    setSending(true);
    setError("");
    try {
      await api(`${base}/agents`, {
        method: "POST",
        body: JSON.stringify({ task, threadId }),
      });
      setThreadDrafts((drafts) => ({ ...drafts, [threadId]: "" }));
      setTab("team");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }
  async function edit(edit: Edit) {
    setSaving(true);
    setError("");
    try {
      const state = await api<Project>(`${base}/edit`, {
        method: "POST",
        body: JSON.stringify({ edit, author, requestId: crypto.randomUUID() }),
      });
      setProject((current) =>
        state.sequence >= current.sequence ? state : current,
      );
      setDraftRevision(state.revision);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function importFile(file: File) {
    setSaving(true);
    setError("");
    try {
      const result = await api<{ state: Project }>(`${base}/import-step`, {
        method: "POST",
        body: JSON.stringify({
          text: await file.text(),
          fileName: file.name,
          baseRevision: project.revision,
          author,
        }),
      });
      setProject((current) =>
        result.state.sequence >= current.sequence ? result.state : current,
      );
      setReference("none");
      setSelected(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function addPart() {
    const id = `part-${crypto.randomUUID().slice(0, 8)}`;
    const part: Part = {
      id,
      name: "New component",
      color: "#658d7c",
      features: [structuredClone(blankFeature)],
    };
    if (
      await edit({
        baseRevision: project.revision,
        summary: "Added a new editable component",
        upsertParts: [part],
        removePartIds: [],
      })
    ) {
      setSelected(id);
    }
  }
  function changeFeature(field: keyof Feature, value: any) {
    if (!draft) return;
    setDraft({
      ...draft,
      features: [
        { ...draft.features[0], [field]: value },
        ...draft.features.slice(1),
      ],
    });
  }
  async function saveSettings() {
    setError("");
    try {
      await api("/api/settings", {
        method: "POST",
        body: JSON.stringify({ apiKey: key, baseUrl: endpoint, model }),
      });
      setConfigured(true);
      setKey("");
      setSettings(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="app">
      <header>
        <a className="brand" href={location.href}>
          <span className="brand-mark">
            <Layers size={20} />
          </span>
          assembly<span className="beta">LAB</span>
        </a>
        <div className="breadcrumb">
          Workspace <ChevronRight size={13} />
          <strong>Wearable evolution</strong>
          <span className="revision">r{project.revision}</span>
        </div>
        <div className="header-actions">
          <button
            disabled={saving || !connected || !project.revision}
            title="Undo last shared geometry edit"
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                const state = await api<Project>(`${base}/undo`, {
                  method: "POST",
                  body: JSON.stringify({
                    baseRevision: project.revision,
                    author,
                    requestId: crypto.randomUUID(),
                  }),
                });
                setProject((current) =>
                  state.sequence >= current.sequence ? state : current,
                );
                setSelected(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Undo
          </button>
          <span className={`connection ${connected ? "online" : ""}`}>
            <i />
            {connected ? "Live project" : "Connecting to Terse"}
          </span>
          <button
            className="share"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("Copy this browser URL to join the same room.");
              }
            }}
          >
            <Users size={15} />
            {presence}
            <span>{copied ? "Copied" : "Share room"}</span>
            <Link size={13} />
          </button>
          <button
            className="icon-button"
            title="Model settings"
            onClick={() => setSettings(true)}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className="parts-panel">
          <div className="panel-title">
            ASSEMBLY{" "}
            <button
              className="icon-button"
              title="Add editable component"
              onClick={addPart}
              disabled={!connected || saving}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="project-label">
            <Box size={17} />
            <div>
              Wearable evolution<small>Shared mechanical design</small>
            </div>
          </div>
          <label className="part-row" style={{ cursor: "pointer" }}>
            <Plus size={16} />
            <span>
              {saving ? "Validating geometry…" : "Import STEP"}
              <small>Editable solid bodies</small>
            </span>
            <input
              aria-label="Import STEP"
              type="file"
              accept=".step,.stp"
              disabled={saving || !connected}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <div className="section-label">REFERENCE GEOMETRY</div>
          <button
            className={`part-row ${reference === "current" ? "active" : ""}`}
            onClick={() =>
              setReference(reference === "current" ? "none" : "current")
            }
          >
            <Box size={16} />
            <span>
              Current prototype<small>Imported STL · read only</small>
            </span>
            {reference === "current" ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className={`part-row ${reference === "target" ? "active" : ""}`}
            onClick={() =>
              setReference(reference === "target" ? "none" : "target")
            }
          >
            <Box size={16} />
            <span>
              Over-head reference<small>Target concept · read only</small>
            </span>
            {reference === "target" ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <label className="ghost-toggle">
            <input
              type="checkbox"
              checked={ghost}
              onChange={(e) => setGhost(e.target.checked)}
            />{" "}
            Ghost reference
          </label>
          <div className="section-label">
            EDITABLE COMPONENTS <span>{project.parts.length}</span>
          </div>
          {project.parts.length === 0 ? (
            <div className="empty-parts">
              Your agents’ new components will appear here. Select + to model a
              part manually.
            </div>
          ) : (
            project.parts.map((part) => (
              <button
                className={`part-row ${selected === part.id ? "selected" : ""}`}
                key={part.id}
                onClick={() => setSelected(part.id)}
              >
                <i className="swatch" style={{ background: part.color }} />
                <span>
                  {part.name}
                  <small>
                    {part.source ? "STEP solid · " : ""}
                    {part.features.length + (part.operations?.length || 0)}{" "}
                    edits
                  </small>
                </span>
              </button>
            ))
          )}
          <div className="left-bottom">
            <div className="tiny-logo">
              ▧ <strong>TERSE</strong>
              <span>Durable project state</span>
            </div>
            <p>People and agents. One current design.</p>
          </div>
        </aside>
        <main className="viewport">
          <div className="viewport-heading">
            <div>
              <span className="eyebrow">DESIGN EXPLORATION / 001</span>
              <h1>A new shape for an idea.</h1>
            </div>
            <span className="units">mm</span>
          </div>
          <Scene
            project={project}
            meshes={meshes}
            selected={selected}
            setSelected={setSelected}
            reference={reference}
            ghost={ghost}
            reset={reset}
          />
          <div className="view-toolbar">
            <button onClick={() => setReset(reset + 1)}>
              <RotateCcw size={15} />
              Reset orbit
            </button>
            <span />
            <button
              disabled={
                !project.parts.length || meshRevision !== project.revision
              }
              onClick={() => window.open(`${base}/export.step`, "_blank")}
            >
              <Download size={15} />
              Export STEP
            </button>
          </div>
          <div className="viewport-caption">
            <span>
              <CircleDot size={12} />{" "}
              {reference === "none"
                ? "Editable assembly"
                : reference === "current"
                  ? "Current prototype reference"
                  : "Over-head target reference"}
            </span>
            <span>
              Orbit · drag &nbsp; Pan · right drag &nbsp; Zoom · scroll
            </span>
          </div>
          {(meshError || meshRevision !== project.revision) && (
            <div className="mesh-status">
              {meshError ? (
                <>
                  <AlertCircle size={14} />
                  {meshError}
                </>
              ) : (
                <>
                  <LoaderCircle size={14} className="spin" />
                  Compiling revision {project.revision}…
                </>
              )}
            </div>
          )}
          {draft && selectedPart && (
            <div className="inspector">
              <div className="panel-title">
                COMPONENT{" "}
                <button
                  className="icon-button"
                  onClick={() => setSelected(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <input
                className="part-name"
                aria-label="Part name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="inspector-meta">
                {draft.source
                  ? `STEP solid · ${draft.source.bodyName}`
                  : draft.features[0]?.kind}{" "}
                · {draft.features.length} features ·{" "}
                {draft.operations?.length || 0} operations
              </div>
              {draft.features[0]?.kind === "arc" && (
                <>
                  <label>
                    Outer radius{" "}
                    <input
                      type="number"
                      value={draft.features[0].radius}
                      onChange={(e) =>
                        changeFeature("radius", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Band thickness{" "}
                    <input
                      type="number"
                      value={draft.features[0].thickness}
                      onChange={(e) =>
                        changeFeature("thickness", Number(e.target.value))
                      }
                    />
                  </label>
                </>
              )}
              {draft.features[0]?.kind === "cylinder" && (
                <label>
                  Radius{" "}
                  <input
                    type="number"
                    value={draft.features[0].radius}
                    onChange={(e) =>
                      changeFeature("radius", Number(e.target.value))
                    }
                  />
                </label>
              )}
              {draft.features.length > 0 &&
                ["size", "position", "rotation"].map((field) => (
                  <div className="vector-field" key={field}>
                    <span>
                      {field === "size"
                        ? "Size / depth"
                        : field === "position"
                          ? "Position"
                          : "Rotation °"}
                    </span>
                    <div>
                      {draft.features[0][
                        field as "size" | "position" | "rotation"
                      ].map((v, i) => (
                        <label key={i}>
                          {["X", "Y", "Z"][i]}
                          <input
                            aria-label={`${field} ${["X", "Y", "Z"][i]}`}
                            type="number"
                            value={v}
                            onChange={(e) => {
                              const values = [
                                ...draft.features[0][
                                  field as "size" | "position" | "rotation"
                                ],
                              ];
                              values[i] = Number(e.target.value);
                              changeFeature(field as keyof Feature, values);
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              <details>
                <summary>Move / rotate body</summary>
                {["vector", "axis", "origin"].map((field) => (
                  <div className="vector-field" key={field}>
                    <span>
                      {field === "vector"
                        ? "Translation (mm)"
                        : field === "axis"
                          ? "Rotation axis"
                          : "Rotation origin"}
                    </span>
                    <div>
                      {transform[field as "vector" | "axis" | "origin"].map(
                        (value, i) => (
                          <label key={i}>
                            {["X", "Y", "Z"][i]}
                            <input
                              type="number"
                              aria-label={`${field} ${["X", "Y", "Z"][i]}`}
                              value={value}
                              onChange={(e) => {
                                const values = [
                                  ...transform[
                                    field as "vector" | "axis" | "origin"
                                  ],
                                ];
                                values[i] = Number(e.target.value);
                                setTransform({ ...transform, [field]: values });
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                ))}
                <label>
                  Angle °
                  <input
                    type="number"
                    value={transform.angle}
                    onChange={(e) =>
                      setTransform({
                        ...transform,
                        angle: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <div className="inspector-actions">
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        operations: [
                          ...(draft.operations || []),
                          {
                            type: "translate",
                            vector: transform.vector as [
                              number,
                              number,
                              number,
                            ],
                          },
                        ],
                      })
                    }
                  >
                    Stage move
                  </button>
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        operations: [
                          ...(draft.operations || []),
                          {
                            type: "rotate",
                            angle: transform.angle,
                            axis: transform.axis as [number, number, number],
                            origin: transform.origin as [
                              number,
                              number,
                              number,
                            ],
                          },
                        ],
                      })
                    }
                  >
                    Stage rotation
                  </button>
                </div>
                <small>
                  Stages an operation. Apply change commits it to everyone.
                </small>
              </details>
              <details>
                <summary>Geometry inspection</summary>
                <button
                  onClick={async () => {
                    try {
                      setInspection(
                        await api(`${base}/parts/${selectedPart.id}/inspect`),
                      );
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  Inspect accepted body
                </button>
                {inspection && (
                  <pre
                    style={{ maxHeight: 180, overflow: "auto", fontSize: 10 }}
                  >
                    {JSON.stringify(inspection, null, 2)}
                  </pre>
                )}
              </details>
              <details>
                <summary>CAD specification</summary>
                <textarea
                  aria-label="Feature JSON"
                  value={rawPart}
                  onChange={(e) => setRawPart(e.target.value)}
                  onBlur={(e) => {
                    try {
                      setDraft(partSchema.parse(JSON.parse(e.target.value)));
                      setError("");
                    } catch (err) {
                      setError(
                        `Invalid feature specification: ${(err as Error).message}`,
                      );
                    }
                  }}
                />
              </details>
              {draftRevision !== project.revision && (
                <div className="stale-note">
                  The assembly changed. Reload this component before applying
                  edits.
                </div>
              )}
              <div className="inspector-actions">
                <button
                  disabled={saving || draftRevision !== project.revision}
                  className="primary"
                  onClick={() =>
                    edit({
                      baseRevision: draftRevision,
                      summary: `Updated ${draft.name}`,
                      upsertParts: [draft],
                      removePartIds: [],
                    })
                  }
                >
                  {saving ? "Validating…" : "Apply change"}
                </button>
                <button
                  onClick={() => {
                    setDraft(structuredClone(selectedPart));
                    setDraftRevision(project.revision);
                  }}
                >
                  Reload
                </button>
              </div>
              <button
                className="delete-part"
                disabled={saving}
                onClick={async () => {
                  if (
                    await edit({
                      baseRevision: project.revision,
                      summary: `Removed ${selectedPart.name}`,
                      upsertParts: [],
                      removePartIds: [selectedPart.id],
                    })
                  )
                    setSelected(null);
                }}
              >
                Remove component
              </button>
            </div>
          )}
        </main>
        <aside className="team-panel">
          <div className="team-tabs">
            <button
              className={tab === "team" ? "chosen" : ""}
              onClick={() => setTab("team")}
            >
              <Sparkles size={15} />
              Design team{" "}
              {pending > 0 && <span className="count">{pending}</span>}
            </button>
            <button
              className={tab === "history" ? "chosen" : ""}
              onClick={() => setTab("history")}
            >
              Activity
            </button>
          </div>
          {tab === "team" && (
            <div className="thread-toolbar">
              <div className="thread-toolbar-heading">
                <span>YOUR AGENTS</span>
                <button
                  onClick={() => {
                    setAddingAgent(!addingAgent);
                    setNewAgentName(`Agent ${threads.length + 1}`);
                  }}
                  disabled={!connected}
                >
                  <Plus size={14} /> Add agent
                </button>
              </div>
              {addingAgent && (
                <form
                  className="new-agent-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addAgent();
                  }}
                >
                  <input
                    autoFocus
                    aria-label="New agent name"
                    value={newAgentName}
                    maxLength={60}
                    onChange={(e) => setNewAgentName(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newAgentName.trim()}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel adding agent"
                    onClick={() => setAddingAgent(false)}
                  >
                    <X size={14} />
                  </button>
                </form>
              )}
              <div className="agent-switcher" aria-label="Agent conversations">
                {threads.map((thread) => {
                  const job = latestJob(thread.id);
                  return (
                    <button
                      key={thread.id}
                      aria-pressed={thread.id === activeThread?.id}
                      onClick={() => setSelectedAgent(thread.id)}
                      className={`thread-choice ${thread.id === activeThread?.id ? "selected" : ""}`}
                    >
                      <span className="thread-choice-name">
                        {job?.status === "running" ? (
                          <LoaderCircle size={13} className="spin" />
                        ) : (
                          <span
                            className={`status-dot ${job?.status ?? "ready"}`}
                          />
                        )}
                        {thread.name}
                      </span>
                      <small className={job?.status}>{jobLabel(job)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="team-content">
            {tab === "team" ? (
              <>
                {!configured && (
                  <button
                    className="setup-callout"
                    onClick={() => setSettings(true)}
                  >
                    <Settings size={15} />
                    <span>
                      Connect your model
                      <small>Add your API key to send a message.</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                )}
                {!activeThread ? (
                  <div className="thread-empty">
                    <Sparkles size={25} />
                    <h2>A teammate for every idea.</h2>
                    <p>
                      Add an agent to start a conversation. Each agent can work
                      on the shared assembly while you talk to another.
                    </p>
                    <button
                      onClick={() => {
                        setAddingAgent(true);
                        setNewAgentName("Agent 1");
                      }}
                      disabled={!connected}
                    >
                      Add your first agent <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="conversation"
                    aria-label={`Conversation with ${activeThread.name}`}
                  >
                    {!activeThread.messages.length && (
                      <div className="thread-empty">
                        <h2>Meet {activeThread.name}.</h2>
                        <p>
                          Give this agent a task. You can answer questions and
                          refine the design right here.
                        </p>
                      </div>
                    )}
                    {activeThread.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`chat-message ${message.role}`}
                      >
                        <div className="message-author">
                          {message.role === "user" ? "You" : activeThread.name}
                        </div>
                        <div className="message-body">
                          <Markdown>{message.text}</Markdown>
                        </div>
                      </article>
                    ))}
                    {activeJob?.status === "running" && (
                      <div className="agent-progress" role="status">
                        <LoaderCircle size={14} className="spin" />
                        <span>{activeJob.message}</span>
                      </div>
                    )}
                    {activeJob?.status === "needs_reply" && (
                      <div className="reply-notice">
                        Your reply is needed to continue.
                      </div>
                    )}
                    {activeJob?.status === "complete" &&
                      activeJob.committed === false && (
                        <div className="turn-note">
                          No geometry changes in this turn.
                        </div>
                      )}
                    {activeJob?.status === "error" && (
                      <div className="reply-notice error">
                        This run stopped. You can send a follow-up below.
                      </div>
                    )}
                    <div ref={conversationEnd} />
                  </div>
                )}
              </>
            ) : (
              <div className="activity-list">
                {project.history.length === 0 ? (
                  <p className="empty-parts">
                    Accepted changes and agent updates appear here.
                  </p>
                ) : (
                  [...project.history].reverse().map((entry) => (
                    <article
                      className={`activity ${entry.kind}`}
                      key={entry.id}
                    >
                      <div>
                        <strong>{entry.author}</strong>
                        <time>
                          {new Date(entry.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p>{entry.text}</p>
                      <span>
                        {entry.kind === "commit"
                          ? "Accepted change"
                          : entry.kind === "conflict"
                            ? "Revision conflict · returned to agent"
                            : entry.kind}
                      </span>
                    </article>
                  ))
                )}
              </div>
            )}
          </div>
          {tab === "team" && activeThread && (
            <div className="composer">
              <div className="composer-top">
                <span className="agent-dot" />
                <strong>{activeThread.name}</strong>
                <span>{configured ? "Model connected" : "Setup needed"}</span>
              </div>
              <textarea
                placeholder={
                  activeJob?.status === "needs_reply"
                    ? `Reply to ${activeThread.name}`
                    : `Message ${activeThread.name}`
                }
                aria-label="Message agent"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submitTask();
                  }
                }}
              />
              <div className="composer-bottom">
                <small>
                  {activeJob?.status === "running"
                    ? "Working. You can draft your next message."
                    : "Same conversation, shared assembly"}
                </small>
                <button
                  title="Send message"
                  aria-label="Send message"
                  disabled={
                    !task.trim() ||
                    sending ||
                    !connected ||
                    !configured ||
                    activeJob?.status === "running"
                  }
                  onClick={submitTask}
                >
                  {sending ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          )}
          <div className="team-footer">
            Shared workspace · accepted changes saved automatically
          </div>
        </aside>
      </div>
      <footer>
        <span>
          <i className={connected ? "live-dot" : "offline-dot"} />
          {connected ? "Terse actor connected" : "Waiting for actor server"}
        </span>
        <span>
          {project.parts.length} editable parts ·{" "}
          {meshes
            .reduce((n, m) => n + m.triangles.length / 3, 0)
            .toLocaleString()}{" "}
          triangles
        </span>
        <span>
          {author} <span className="footer-shortcut">⌘</span>
        </span>
      </footer>
      {error && (
        <div className="toast">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button className="icon-button" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {settings && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="panel-title">
              MODEL CONNECTION
              <button
                className="icon-button"
                onClick={() => {
                  setSettings(false);
                  setKey("");
                }}
              >
                <X size={18} />
              </button>
            </div>
            <h2>Connect your AI teammates.</h2>
            <p>
              Your key stays in server memory for this session. It is not saved
              in browser storage or the repository.
            </p>
            <label>
              API endpoint
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
            </label>
            <label>
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} />
            </label>
            <label>
              API key
              <input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Paste your hackathon key"
              />
            </label>
            <button
              className="primary"
              disabled={!key.trim()}
              onClick={saveSettings}
            >
              Connect model
            </button>
            <small>
              OpenAI Responses API. Provider switches are explicit; requests are
              never silently redirected.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
