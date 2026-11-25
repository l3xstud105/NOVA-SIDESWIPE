// net.js — online multiplayer architecture & matchmaking (client side)
//
// Honest scope: this implements the CLIENT-SIDE architecture for online play —
// matchmaking logic, a transport adapter interface, and a Multiplayer controller.
// Real online play requires a deployed backend (WebSocket relay + authoritative
// server, see DEPLOY.md). WebSocketTransport reports "unavailable" until a
// backend URL is configured. The LocalLoopbackTransport lets the full
// matchmaking flow be exercised in-process for testing — it is NOT a stand-in
// for real online opponents and is never presented to players as such.

// ---------------- Matchmaking (pure logic, testable) ----------------
// A simple queue-based matchmaker: players join a queue for a mode; the first
// two compatible players (same mode, MMR within a window) are matched.
export class Matchmaking {
  constructor(opts = {}) {
    this.mmrWindow = opts.mmrWindow ?? 300; // max MMR difference for a match
    this.queue = []; // [{ id, mode, mmr, ts }]
  }

  get size() { return this.queue.length; }

  // join the queue; returns the player's queue entry
  join(player) {
    const entry = { id: player.id, mode: player.mode, mmr: player.mmr ?? 0, ts: Date.now() };
    this.queue.push(entry);
    return entry;
  }

  leave(playerId) {
    this.queue = this.queue.filter((p) => p.id !== playerId);
  }

  clear() { this.queue.length = 0; }

  // attempt to find a match for the waiting queue. Returns a match object
  // { id, mode, players: [a, b] } or null if no pair is ready.
  poll() {
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        const a = this.queue[i], b = this.queue[j];
        if (a.mode === b.mode && Math.abs(a.mmr - b.mmr) <= this.mmrWindow) {
          const match = {
            id: "m_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
            mode: a.mode,
            players: [{ ...a }, { ...b }],
          };
          // remove both from the queue
          this.queue = this.queue.filter((p) => p.id !== a.id && p.id !== b.id);
          return match;
        }
      }
    }
    return null;
  }

  // estimated wait (ms) based on queue depth — heuristic for the UI
  estimateWait() {
    if (this.queue.length === 0) return null;
    // ~15s base + a few seconds per extra waiter
    return 15000 + this.queue.length * 4000;
  }
}

// ---------------- Transport adapter interface ----------------
// A transport carries JSON messages between this client and the backend.
// Implementations: WebSocketTransport (real), LocalLoopbackTransport (test/local).
export class NetTransport {
  constructor() {
    this.status = "idle"; // idle | connecting | connected | error | closed
    this._handlers = {};
  }
  on(event, cb) {
    (this._handlers[event] = this._handlers[event] || []).push(cb);
  }
  _emit(event, payload) {
    (this._handlers[event] || []).forEach((cb) => cb(payload));
  }
  connect() { throw new Error("connect() not implemented"); }
  disconnect() { throw new Error("disconnect() not implemented"); }
  send() { throw new Error("send() not implemented"); }
}

// Real WebSocket transport. Honest: reports "unavailable"/"error" when no
// backend URL is configured or the connection cannot be established.
export class WebSocketTransport extends NetTransport {
  constructor(url) {
    super();
    this.url = url || null;
    this.ws = null;
  }
  get configured() { return !!this.url; }
  connect() {
    if (!this.url) {
      this.status = "error";
      this._emit("status", { status: "error", reason: "no-backend" });
      return false;
    }
    this.status = "connecting";
    this._emit("status", { status: "connecting" });
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      this.status = "error";
      this._emit("status", { status: "error", reason: String(e) });
      return false;
    }
    this.ws.onopen = () => { this.status = "connected"; this._emit("status", { status: "connected" }); };
    this.ws.onclose = () => { this.status = "closed"; this._emit("status", { status: "closed" }); };
    this.ws.onerror = () => { this.status = "error"; this._emit("status", { status: "error", reason: "socket-error" }); };
    this.ws.onmessage = (ev) => {
      try { this._emit("message", JSON.parse(ev.data)); } catch (e) { this._emit("message", ev.data); }
    };
    return true;
  }
  disconnect() {
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this.status = "closed";
    this._emit("status", { status: "closed" });
  }
  send(msg) {
    if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(msg)); return true; }
    return false;
  }
}

// In-process loopback transport for testing the matchmaking flow end-to-end
// without a backend. Two endpoints can be linked to exchange messages.
// This is a TEST/LOCAL utility only — never used to present fake online players.
export class LocalLoopbackTransport extends NetTransport {
  constructor() {
    super();
    this.peer = null;
  }
  link(other) {
    this.peer = other;
    other.peer = this;
    this.status = "connected";
    other.status = "connected";
    this._emit("status", { status: "connected" });
    other._emit("status", { status: "connected" });
  }
  connect() { return true; } // already linked via link()
  disconnect() {
    this.status = "closed";
    this._emit("status", { status: "closed" });
    if (this.peer) { this.peer.status = "closed"; this.peer._emit("status", { status: "closed" }); }
  }
  send(msg) {
    if (this.peer && this.peer.status === "connected") {
      this.peer._emit("message", msg);
      return true;
    }
    return false;
  }
}

// ---------------- Multiplayer controller ----------------
// Combines matchmaking + transport. Honest status reflects whether a real
// backend is reachable. Online play is only possible when a backend is
// connected; otherwise the controller reports offline and the UI directs the
// player to local/AI play.
export class Multiplayer {
  constructor(opts = {}) {
    this.transport = opts.transport || null;
    this.matchmaker = new Matchmaking({ mmrWindow: opts.mmrWindow });
    this.state = "offline"; // offline | searching | matched | in-match | error
    this.match = null;
    this.playerId = opts.playerId || ("p_" + Math.random().toString(36).slice(2, 8));
    this.mmr = opts.mmr || 0;
    this._searchTimer = null;
    if (this.transport) {
      this.transport.on("status", (s) => this._onTransportStatus(s));
    }
  }

  get online() { return this.transport && this.transport.status === "connected"; }

  _onTransportStatus(s) {
    if (s.status === "error" || s.status === "closed") {
      if (this.state === "searching" || this.state === "matched") {
        this._cancelSearch();
        this.state = s.status === "error" ? "error" : "offline";
      } else {
        this.state = s.status === "error" ? "error" : "offline";
      }
    } else if (s.status === "connected") {
      if (this.state === "offline" || this.state === "error") this.state = "offline";
    }
  }

  // begin searching for an online match in a mode
  startSearch(mode) {
    if (!this.online) {
      this.state = "error";
      return { ok: false, reason: "no-backend" };
    }
    this.matchmaker.join({ id: this.playerId, mode, mmr: this.mmr });
    this.state = "searching";
    // poll the queue (in a real client this would be driven by server messages)
    this._searchTimer = setInterval(() => {
      const m = this.matchmaker.poll();
      if (m) {
        this.match = m;
        this.state = "matched";
        this._stopSearch();
        if (this.transport) this.transport.send({ type: "match", match: m });
      }
    }, 50);
    return { ok: true, queueSize: this.matchmaker.size };
  }

  _stopSearch() {
    if (this._searchTimer) { clearInterval(this._searchTimer); this._searchTimer = null; }
  }

  cancelSearch() {
    this._cancelSearch();
    return { ok: true };
  }

  _cancelSearch() {
    this._stopSearch();
    this.matchmaker.leave(this.playerId);
    if (this.state === "searching") this.state = "offline";
  }

  status() {
    return {
      state: this.state,
      online: this.online,
      queueSize: this.matchmaker.size,
      estimateWait: this.matchmaker.estimateWait(),
      match: this.match,
    };
  }
}
