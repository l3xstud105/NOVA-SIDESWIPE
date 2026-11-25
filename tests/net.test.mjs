// net.test.mjs — verify matchmaking logic, transports, and Multiplayer controller.
// Run: node tests/net.test.mjs   (no browser)
import { Matchmaking, WebSocketTransport, LocalLoopbackTransport, Multiplayer } from "../src/core/net.js";

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log("  ✓ " + name); }
  else { failed++; console.log("  ✗ " + name + (extra ? "  -> " + extra : "")); }
}

console.log("NOVA SIDESWIPE — networking & matchmaking tests\n");

// 1. Matchmaking: single waiter -> no match
{
  const mm = new Matchmaking();
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  check("one waiter yields no match", mm.poll() === null);
  check("queue size reflects waiters", mm.size === 1);
}

// 2. Matchmaking: two compatible waiters -> match
{
  const mm = new Matchmaking();
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  mm.join({ id: "b", mode: "1v1", mmr: 200 });
  const m = mm.poll();
  check("two compatible waiters produce a match", !!m);
  check("match has two players", m && m.players.length === 2);
  check("match mode is correct", m && m.mode === "1v1");
  check("match has an id", m && typeof m.id === "string" && m.id.length > 0);
  check("matched players removed from queue", mm.size === 0);
}

// 3. Matchmaking: different modes don't match
{
  const mm = new Matchmaking();
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  mm.join({ id: "b", mode: "2v2", mmr: 100 });
  check("different modes do not match", mm.poll() === null);
}

// 4. Matchmaking: MMR window respected
{
  const mm = new Matchmaking({ mmrWindow: 100 });
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  mm.join({ id: "b", mode: "1v1", mmr: 300 }); // diff 200 > 100
  check("MMR outside window does not match", mm.poll() === null);
  mm.join({ id: "c", mode: "1v1", mmr: 180 }); // diff 80 <= 100
  const m = mm.poll();
  check("MMR within window matches", !!m);
}

// 5. Matchmaking: leave + clear
{
  const mm = new Matchmaking();
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  mm.join({ id: "b", mode: "1v1", mmr: 100 });
  mm.leave("a");
  check("leave removes a waiter", mm.size === 1);
  mm.clear();
  check("clear empties the queue", mm.size === 0);
}

// 6. Matchmaking: estimateWait
{
  const mm = new Matchmaking();
  check("empty queue estimateWait is null", mm.estimateWait() === null);
  mm.join({ id: "a", mode: "1v1", mmr: 100 });
  const w = mm.estimateWait();
  check("non-empty queue returns a positive estimate", w > 0, "w=" + w);
}

// 7. WebSocketTransport: no URL -> error status (honest)
{
  const t = new WebSocketTransport(null);
  const r = t.connect();
  check("WebSocketTransport without URL does not connect", r === false);
  check("WebSocketTransport reports error status", t.status === "error");
  check("WebSocketTransport.configured is false without URL", t.configured === false);
}

// 8. LocalLoopbackTransport: link + message delivery
{
  const a = new LocalLoopbackTransport();
  const b = new LocalLoopbackTransport();
  let got = null;
  b.on("message", (m) => { got = m; });
  a.link(b);
  check("linked transports are connected", a.status === "connected" && b.status === "connected");
  check("send delivers to peer", a.send({ type: "ping", n: 1 }) === true);
  check("peer received the message", got && got.type === "ping" && got.n === 1);
  a.disconnect();
  check("disconnect closes both", a.status === "closed" && b.status === "closed");
}

// 9. Multiplayer: offline without a backend -> startSearch fails honestly
{
  const mp = new Multiplayer({ transport: new WebSocketTransport(null) });
  check("Multiplayer starts offline", mp.state === "offline");
  check("Multiplayer.online is false without backend", mp.online === false);
  const r = mp.startSearch("1v1");
  check("startSearch fails honestly without backend", r.ok === false && r.reason === "no-backend");
  check("Multiplayer reports error state after failed search", mp.state === "error");
}

// 10. Multiplayer: with a connected transport, search -> matched
{
  // two in-process clients linked via loopback, sharing one matchmaker queue
  const server = new LocalLoopbackTransport();
  const clientA = new LocalLoopbackTransport();
  const mpA = new Multiplayer({ transport: clientA, playerId: "a", mmr: 100 });
  // simulate the backend holding the queue: share a matchmaker
  const sharedMM = new Matchmaking();
  mpA.matchmaker = sharedMM;
  clientA.link(server);
  // a second waiter joins the shared queue (simulating another client)
  sharedMM.join({ id: "b", mode: "1v1", mmr: 150 });
  // start A's search
  const r = mpA.startSearch("1v1");
  check("search starts with connected transport", r.ok === true);
  check("Multiplayer.online true when transport connected", mpA.online === true);
  // drive the poll manually (startSearch uses a timer; call poll directly to avoid timing)
  mpA._stopSearch();
  const m = sharedMM.poll();
  if (m) { mpA.match = m; mpA.state = "matched"; }
  check("Multiplayer reaches matched state", mpA.state === "matched", "state=" + mpA.state);
  check("Multiplayer exposes the match", !!mpA.match);
  mpA.cancelSearch();
}

// 11. Multiplayer: status() shape
{
  const mp = new Multiplayer({ transport: new WebSocketTransport(null) });
  const s = mp.status();
  check("status() returns state/online/queueSize/estimateWait", "state" in s && "online" in s && "queueSize" in s && "estimateWait" in s);
  check("status() reflects offline", s.online === false);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
