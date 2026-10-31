import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Layers,
  Link,
  LoaderCircle,
  Plus,
  Users,
} from "lucide-react";
import type { RoomInfo } from "../packages/protocol";

type Room = RoomInfo & {
  revision: number;
  parts: number;
  agents: number;
  working: number;
  connections: number;
};

export function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [join, setJoin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok)
          throw new Error(
            "The workspace is unavailable. Check that the local server is running.",
          );
        const data = await response.json();
        if (active) {
          setRooms(data);
          setLoaded(true);
          setOnline(true);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
          setLoaded(true);
          setOnline(false);
        }
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled assembly" }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not create room");
      location.assign(`/?room=${encodeURIComponent(result.id)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  function joinRoom() {
    const value = join.trim();
    let id = value;
    try {
      if (value.includes("?"))
        id = new URL(value, location.origin).searchParams.get("room") ?? "";
    } catch {
      id = "";
    }
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
      setError("Paste a room link or its room ID.");
      return;
    }
    location.assign(`/?room=${encodeURIComponent(id)}`);
  }
  const ordered = [...rooms].sort(
    (a, b) =>
      b.connections - a.connections ||
      b.working - a.working ||
      b.parts - a.parts ||
      b.createdAt.localeCompare(a.createdAt),
  );
  return (
    <div className="lobby">
      <header>
        <a className="brand" href="/">
          <span className="brand-mark">
            <Layers size={20} />
          </span>
          assembly<span className="beta">LAB</span>
        </a>
        <span className="lobby-header-note">
          A shared space for hardware ideas.
        </span>
        <span className="lobby-local">
          <i className={online ? "live-dot" : "offline-dot"} />
          {online ? "Local workspace" : "Connecting"}
        </span>
      </header>
      <main className="lobby-main">
        <section className="lobby-hero">
          <div className="lobby-intro">
            <span className="lobby-eyebrow">
              HUMAN IDEAS. AI TEAMMATES. ONE ASSEMBLY.
            </span>
            <h1>
              Good ideas
              <br />
              work better together.
            </h1>
            <p>
              Bring your CAD. Start a room. Give each teammate a task and keep
              designing while they work.
            </p>
            <div className="lobby-capabilities">
              <span>Editable STEP solids</span>
              <span>Parallel AI agents</span>
              <span>Shared, durable state</span>
            </div>
          </div>
          <div className="lobby-actions">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <div className="action-heading">
                <span className="action-icon">
                  <Plus size={20} />
                </span>
                <div>
                  <h2>Make room for an idea.</h2>
                  <p>A fresh assembly, ready for your team.</p>
                </div>
              </div>
              <label htmlFor="room-name">Room name</label>
              <input
                id="room-name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wearable, next generation"
              />
              <button className="create-room" disabled={busy || !online}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <>
                    Create room <ArrowUpRight size={17} />
                  </>
                )}
              </button>
            </form>
            <form
              className="join-room"
              onSubmit={(e) => {
                e.preventDefault();
                joinRoom();
              }}
            >
              <label htmlFor="room-link">
                <Link size={14} /> Already have a room?
              </label>
              <div>
                <input
                  id="room-link"
                  value={join}
                  onChange={(e) => setJoin(e.target.value)}
                  placeholder="Paste a room link or ID"
                />
                <button disabled={!join.trim()} aria-label="Join room">
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </form>
          </div>
        </section>
        {error && (
          <div className="lobby-error" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        <section className="lobby-rooms">
          <div className="rooms-heading">
            <div>
              <span className="lobby-eyebrow">
                PICK UP WHERE AN IDEA LEFT OFF
              </span>
              <h2>
                Your rooms <span>{rooms.length}</span>
              </h2>
            </div>
            <p>Live counts reflect connected browser sessions.</p>
          </div>
          {!loaded ? (
            <p className="rooms-empty">
              <LoaderCircle size={16} className="spin" /> Loading your
              workspace...
            </p>
          ) : !rooms.length ? (
            <div className="rooms-empty">
              <Box size={24} />
              <p>
                Your first room starts above.
                <br />
                Import a STEP file, add an agent, and make something.
              </p>
            </div>
          ) : (
            <div className="room-grid">
              {ordered.map((room) => (
                <a
                  className="room-card"
                  href={`/?room=${encodeURIComponent(room.id)}`}
                  key={room.id}
                >
                  <div className="room-preview">
                    {room.parts > 0 ? (
                      <img
                        src={`/api/rooms/${encodeURIComponent(room.id)}/thumbnail?r=${room.revision}`}
                        alt={`${room.name} current CAD preview`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <div className="empty-room-preview">
                        <Box size={38} />
                        <span>Ready for your first part</span>
                      </div>
                    )}
                    <span
                      className={`room-presence ${room.connections ? "present" : ""}`}
                    >
                      <Users size={12} />
                      {room.connections
                        ? `${room.connections} connected`
                        : "No one here yet"}
                    </span>
                  </div>
                  <div className="room-card-body">
                    <div>
                      <h3>{room.name}</h3>
                      <ArrowUpRight size={17} />
                    </div>
                    <p>
                      {room.parts} parts <span>/</span> Revision {room.revision}
                    </p>
                    <div className="room-card-bottom">
                      {room.working ? (
                        <span className="room-working">
                          <LoaderCircle size={12} className="spin" />
                          {room.working} agent{room.working === 1 ? "" : "s"}{" "}
                          working
                        </span>
                      ) : (
                        <span>
                          {room.agents} agent conversation
                          {room.agents === 1 ? "" : "s"}
                        </span>
                      )}
                      <span>Open room</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
        <div className="lobby-foot">
          <span>
            <Layers size={14} /> Built with Terse Durable Actors
          </span>
          <span>Local demo · room links connect sessions on this laptop</span>
        </div>
      </main>
    </div>
  );
}
