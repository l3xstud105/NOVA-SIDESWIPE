// screens.js — all menu/UI screens (functional, responsive, animated)
import { el, clear, toast, banner, hexToRgba } from "./dom.js";
import { profile } from "../core/profile.js";
import { audio } from "../core/audio.js";
import { ARENAS } from "../data/arenas.js";
import { VEHICLES } from "../data/vehicles.js";
import { PAINTS, WHEELS, BOOSTS, BANNERS, TITLES } from "../data/cosmetics.js";
import { RANKS, ACHIEVEMENTS, DAILY_CHALLENGES, WEEKLY_CHALLENGES, levelForXP } from "../data/progression.js";

const codeLabel = (code) => {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "NP" + code.slice(6);
  if (code.startsWith("Arrow")) return code.slice(5) + "↔".replace("↔", "");
  const map = { Space: "SPACE", ShiftLeft: "L-SHIFT", ShiftRight: "R-SHIFT", ControlLeft: "L-CTRL", ControlRight: "R-CTRL", Escape: "ESC", Slash: "/", Comma: ",", Period: "." };
  return map[code] || code;
};

function shell(game, { title, back = true }) {
  const root = game.uiRoot;
  const screen = el("div", { class: "screen" });
  const topbar = el("div", { class: "topbar" });
  const brand = el("div", { class: "topbar__brand", html: "NOVA<b>S</b>" });
  const spacer = el("div", { class: "topbar__spacer" });
  topbar.append(brand, spacer);
  if (back) {
    const backBtn = el("button", { class: "btn btn--ghost btn--sm", text: "← Back", onclick: () => game.router.go("menu") });
    topbar.append(backBtn);
  }
  const player = playerChip(game);
  topbar.append(player);
  const content = el("div", { class: "content" });
  if (title) content.append(el("div", { class: "section-title", text: title }));
  screen.append(topbar, content);
  root.appendChild(screen);
  return { screen, content };
}

function playerChip(game) {
  const r = profile.rank("1v1");
  const lvl = profile.level;
  const chip = el("div", { class: "playerchip" });
  chip.append(
    el("div", { class: "playerchip__avatar", text: (profile.data.name[0] || "P").toUpperCase() }),
    el("div", {}, [
      el("div", { class: "playerchip__name", text: profile.data.name }),
      el("div", { class: "playerchip__rank", text: `${r.name} · Lv ${lvl.level}` }),
    ])
  );
  chip.style.cursor = "pointer";
  chip.onclick = () => game.router.go("profile");
  return chip;
}

// ---------------- MAIN MENU ----------------
export function menu(game) {
  game.setShowcase();
  game.clearPreview();
  const root = game.uiRoot;
  const screen = el("div", { class: "screen mainmenu" });
  const hero = el("div", { class: "mainmenu__hero" });
  hero.append(
    el("div", { class: "mainmenu__brand" }, [
      el("span", { class: "n", text: "NOVA" }),
      el("span", { class: "s", text: "SIDESWIPE" }),
    ]),
    el("div", { class: "mainmenu__tag", text: "Side-View Competitive Car Soccer" })
  );

  const nav = el("div", { class: "mainmenu__nav" });
  const tiles = [
    { label: "Play", sub: "Matchmaking & modes", cls: "navtile--play", go: "play" },
    { label: "Garage", sub: "Customize vehicle", go: "garage" },
    { label: "Training", sub: "Free play & drills", go: "training" },
    { label: "Ranked", sub: "Competitive ladder", go: "ranked" },
    { label: "Challenges", sub: "Daily & weekly", go: "challenges" },
    { label: "Profile", sub: "Stats & awards", go: "profile" },
    { label: "Settings", sub: "Audio, controls, more", go: "settings" },
  ];
  for (const t of tiles) {
    const tile = el("button", { class: "navtile " + (t.cls || ""), onclick: () => { audio.ui(720); game.router.go(t.go); } });
    tile.append(el("b", { text: t.label }), el("span", { text: t.sub }));
    nav.append(tile);
  }
  hero.append(nav);

  const r = profile.rank("1v1");
  const lvl = profile.level;
  const footer = el("div", { class: "mainmenu__footer" });
  footer.append(
    el("div", { html: `<span class="stat">Lv ${lvl.level}</span> · ${lvl.into}/${Math.round(lvl.need)} XP to next` }),
    el("div", { class: "stat", text: `Rank: ${r.name}` }),
    el("div", { class: "stat", text: `${profile.data.stats.matches} matches played` })
  );
  screen.append(hero, footer);
  root.appendChild(screen);

  // mark active
  return { name: "menu", destroy() { screen.remove(); } };
}

// ---------------- PLAY ----------------
export function play(game) {
  const { content } = shell(game, { title: "PLAY" });
  const sel = { mode: "1v1", arena: ARENAS[0].id, difficulty: "medium", ranked: false };

  content.append(el("div", { class: "section-title", text: "Game Mode" }));
  const modes = [
    { id: "1v1", name: "1v1 Duel", sub: "Solo showdown" },
    { id: "2v2", name: "2v2 Doubles", sub: "Team up vs AI" },
    { id: "local2p", name: "Local 2P", sub: "Same screen" },
    { id: "hoops", name: "Hoops", sub: "Shoot through rings" },
    { id: "volleyball", name: "Volleyball", sub: "Don't drop it" },
    { id: "free", name: "Free Play", sub: "Sandbox / training" },
  ];
  const modeGrid = el("div", { class: "grid grid--3" });
  const renderModes = () => {
    clear(modeGrid);
    for (const m of modes) {
      const c = el("div", { class: "card" + (sel.mode === m.id ? " is-selected" : ""), onclick: () => { sel.mode = m.id; audio.ui(); renderModes(); renderRanked(); } });
      c.append(el("div", { class: "card__title", text: m.name }), el("div", { class: "card__sub", text: m.sub }));
      modeGrid.append(c);
    }
  };
  renderModes();
  content.append(modeGrid);

  // ranked toggle (only for 1v1 / 2v2)
  const rankedWrap = el("div", { class: "field" });
  const renderRanked = () => {
    clear(rankedWrap);
    if (sel.mode === "1v1" || sel.mode === "2v2") {
      rankedWrap.append(el("div", { class: "section-title", text: "Queue Type" }));
      const seg = el("div", { class: "seg" });
      const casual = el("button", { class: sel.ranked ? "" : "is-active", text: "Casual", onclick: () => { sel.ranked = false; audio.ui(); renderRanked(); } });
      const ranked = el("button", { class: sel.ranked ? "is-active" : "", text: "Ranked", onclick: () => { sel.ranked = true; audio.ui(); renderRanked(); } });
      seg.append(casual, ranked);
      rankedWrap.append(seg);
      if (sel.ranked) {
        const rk = profile.rank(sel.mode);
        rankedWrap.append(el("div", { class: "text-dim mt-4", text: `Your ${sel.mode} rank: ${rk.name} (${profile.data.mmr[sel.mode]} MMR). Wins adjust MMR.` }));
      }
    }
  };
  renderRanked();
  content.append(rankedWrap);

  // difficulty (not for local2p/free)
  const diffWrap = el("div", { class: "field" });
  const renderDiff = () => {
    clear(diffWrap);
    if (sel.mode === "local2p" || sel.mode === "free") return;
    diffWrap.append(el("div", { class: "section-title", text: "AI Difficulty" }));
    const seg = el("div", { class: "seg" });
    for (const d of ["easy", "medium", "hard"]) {
      seg.append(el("button", { class: sel.difficulty === d ? "is-active" : "", text: d[0].toUpperCase() + d.slice(1), onclick: () => { sel.difficulty = d; audio.ui(); renderDiff(); } }));
    }
    diffWrap.append(seg);
  };
  renderDiff();
  content.append(diffWrap);

  // arena
  content.append(el("div", { class: "section-title", text: "Stadium" }));
  const arenaGrid = el("div", { class: "grid grid--3" });
  const renderArenas = () => {
    clear(arenaGrid);
    for (const a of ARENAS) {
      const c = el("div", { class: "card" + (sel.arena === a.id ? " is-selected" : ""), onclick: () => { sel.arena = a.id; audio.ui(); renderArenas(); } });
      const sw = el("div", { style: { height: "60px", borderRadius: "10px", marginBottom: "8px", background: `linear-gradient(135deg, ${a.floorEdge}, ${a.bgAccent})` } });
      c.append(sw, el("div", { class: "card__title", text: a.name }), el("div", { class: "card__sub", text: a.theme }));
      arenaGrid.append(c);
    }
  };
  renderArenas();
  content.append(arenaGrid);

  // start
  const startBtn = el("button", { class: "btn btn--primary btn--lg mt-5", text: "ENTER MATCH", onclick: () => { audio.ui(880); game.startMatch(sel); } });
  content.append(el("div", { class: "row mt-5" }, [startBtn]));
  content.append(el("div", { class: "text-dim mt-4", text: "Controls: A/D drive · SPACE jump (again = flip/dodge) · L-Mouse / Shift boost · R reset (Free Play). Fully remappable in Settings." }));

  return { name: "play", destroy() {} };
}

// ---------------- TRAINING ----------------
export function training(game) {
  const { content } = shell(game, { title: "TRAINING" });
  content.append(el("div", { class: "card", html: `<div class="card__title">Free Play Arena</div><div class="card__sub">Practice driving, aerials, flips and shooting against a passive ball. Press <span class="kbd">R</span> to reset the ball, <span class="kbd">Esc</span> to pause.</div>` }));
  const drills = [
    { name: "Ground Shots", sub: "Drive and flip into the ball" },
    { name: "Aerials", sub: "Jump + boost to meet high balls" },
    { name: "Flip Resets", sub: "Touch ball while inverted to reset flips" },
    { name: "Wall Play", sub: "Ride the side walls and ceiling" },
  ];
  const grid = el("div", { class: "grid grid--2 mt-4" });
  for (const d of drills) grid.append(el("div", { class: "card" }, [el("div", { class: "card__title", text: d.name }), el("div", { class: "card__sub", text: d.sub })]));
  content.append(grid);
  content.append(el("button", { class: "btn btn--primary btn--lg mt-5", text: "START FREE PLAY", onclick: () => { audio.ui(880); game.startMatch({ mode: "free", arena: ARENAS[0].id, difficulty: "medium" }); } }));
  return { name: "training", destroy() {} };
}

// ---------------- GARAGE ----------------
export function garage(game) {
  game.setShowcase();
  const { content } = shell(game, { title: "GARAGE" });
  const layout = el("div", { class: "garage" });
  const previewPanel = el("div", { class: "panel garage__preview" });
  const pcanvas = el("canvas", { id: "garage-canvas" });
  previewPanel.append(pcanvas);
  const right = el("div", { class: "col gap-4" });
  layout.append(previewPanel, right);
  content.append(layout);

  // vehicle selection
  const vehWrap = el("div", { class: "panel", style: { padding: "16px" } });
  vehWrap.append(el("div", { class: "section-title", text: "VEHICLE" }));
  const vehList = el("div", { class: "row wrap gap-2" });
  const renderVeh = () => {
    clear(vehList);
    for (const v of VEHICLES) {
      const owned = profile.owns("vehicle", v.id);
      const b = el("button", { class: "btn btn--sm" + (profile.equipped("vehicle") === v.id ? " is-active" : ""), text: owned ? v.name : "🔒 " + v.name, onclick: () => {
        if (!owned) { toast(`${v.name} is locked. Win matches to unlock.`); return; }
        profile.equip("vehicle", v.id); audio.ui(); refresh();
      } });
      vehList.append(b);
    }
  };
  vehWrap.append(vehList);
  // unlock hint
  vehWrap.append(el("div", { class: "text-dim mt-4", text: "Win matches to unlock more vehicles. Equip cosmetics below." }));
  right.append(vehWrap);

  // paints
  const paintPanel = el("div", { class: "panel", style: { padding: "16px" } });
  paintPanel.append(el("div", { class: "section-title", text: "PAINT" }));
  const swatches = (cat, slot, ownedCat) => {
    const wrap = el("div", { class: "swatches" });
    const render = () => {
      clear(wrap);
      for (const p of cat) {
        const owned = profile.owns(ownedCat, p.id);
        const sw = el("div", { class: "swatch" + (profile.equipped(slot) === p.id ? " is-active" : "") + (owned ? "" : " is-locked"), style: { background: p.hex }, title: p.name });
        sw.onclick = () => {
          if (!owned) { toast(`${p.name} is locked.`); return; }
          profile.equip(slot, p.id); audio.ui(); render(); refreshPreview();
        };
        wrap.append(sw);
      }
    };
    render();
    return wrap;
  };
  paintPanel.append(el("div", { class: "text-dim", text: "Primary" }), swatches(PAINTS, "paint", "paint"));
  paintPanel.append(el("div", { class: "text-dim mt-4", text: "Secondary" }), swatches(PAINTS, "paint2", "paint"));
  right.append(paintPanel);

  // wheels + boost + banner + title
  const misc = el("div", { class: "panel", style: { padding: "16px" } });
  misc.append(el("div", { class: "section-title", text: "WHEELS" }));
  const wheelGrid = el("div", { class: "cosmetic-list" });
  const renderWheels = () => {
    clear(wheelGrid);
    for (const w of WHEELS) {
      const owned = profile.owns("wheel", w.id);
      const c = el("div", { class: "cosmetic" + (profile.equipped("wheel") === w.id ? " is-active" : "") + (owned ? "" : " is-locked") });
      c.append(el("div", { class: "cosmetic__chip", style: { background: `radial-gradient(circle at 50% 50%, ${w.accent || w.color}, ${w.color})` } }), el("div", { class: "cosmetic__name", text: w.name }));
      c.onclick = () => { if (!owned) { toast("Locked."); return; } profile.equip("wheel", w.id); audio.ui(); renderWheels(); refreshPreview(); };
      wheelGrid.append(c);
    }
  };
  renderWheels();
  misc.append(wheelGrid);

  misc.append(el("div", { class: "section-title", text: "BOOST TRAIL" }));
  const boostGrid = el("div", { class: "cosmetic-list" });
  const renderBoosts = () => {
    clear(boostGrid);
    for (const b of BOOSTS) {
      const owned = profile.owns("boost", b.id);
      const c = el("div", { class: "cosmetic" + (profile.equipped("boost") === b.id ? " is-active" : "") + (owned ? "" : " is-locked") });
      c.append(el("div", { class: "cosmetic__chip", style: { background: `linear-gradient(90deg, ${b.burst}, ${b.trail})` } }), el("div", { class: "cosmetic__name", text: b.name }));
      c.onclick = () => { if (!owned) { toast("Locked."); return; } profile.equip("boost", b.id); audio.ui(); renderBoosts(); refreshPreview(); };
      boostGrid.append(c);
    }
  };
  renderBoosts();
  misc.append(boostGrid);
  right.append(misc);

  const meta = el("div", { class: "panel", style: { padding: "16px" } });
  meta.append(el("div", { class: "section-title", text: "IDENTITY" }));
  meta.append(el("div", { class: "text-dim", text: "Title" }));
  const titleSeg = el("div", { class: "seg mt-4" });
  for (const t of TITLES) {
    titleSeg.append(el("button", { class: profile.equipped("title") === t.id ? "is-active" : "", text: t.name, onclick: () => { profile.equip("title", t.id); audio.ui(); refresh(); } }));
  }
  meta.append(titleSeg);
  right.append(meta);

  function refreshPreview() { game.setPreview(profile.buildLoadout()); }
  function refresh() { renderVeh(); }

  // init preview
  requestAnimationFrame(() => { game.previewCanvas = pcanvas; game.setPreview(profile.buildLoadout()); });

  return { name: "garage", destroy() { game.clearPreview(); } };
}

// ---------------- RANKED ----------------
export function ranked(game) {
  const { content } = shell(game, { title: "RANKED" });
  for (const mode of ["1v1", "2v2"]) {
    const r = profile.rank(mode);
    const card = el("div", { class: "card" });
    card.append(
      el("div", { class: "card__title", text: mode === "1v1" ? "1v1 Ranked" : "2v2 Ranked" }),
      el("div", { class: "mt-4", style: { fontSize: "28px", fontWeight: "800", color: r.color }, text: r.name }),
      el("div", { class: "text-dim", text: `${profile.data.mmr[mode]} MMR` })
    );
    content.append(card);
  }
  // ladder
  content.append(el("div", { class: "section-title", text: "RANK LADDER" }));
  const ladder = el("div", { class: "col gap-2" });
  for (const rk of RANKS) {
    const isMe = profile.rank("1v1").id === rk.id;
    ladder.append(el("div", { class: "card" + (isMe ? " is-selected" : ""), style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      el("div", { class: "card__title", style: { color: rk.color }, text: rk.name }),
      el("div", { class: "text-dim", text: `${rk.min}+ MMR` }),
    ]));
  }
  content.append(ladder);
  content.append(el("div", { class: "text-dim mt-4", text: "Local ranking is derived from your match record. In online play the server is authoritative (see deployment docs)." }));
  return { name: "ranked", destroy() {} };
}

// ---------------- CHALLENGES ----------------
export function challenges(game) {
  const { content } = shell(game, { title: "CHALLENGES" });
  profile._ensureDaily();
  const dWrap = el("div", { class: "section-title", text: "DAILY" });
  content.append(dWrap);
  const dGrid = el("div", { class: "grid grid--2" });
  for (const c of DAILY_CHALLENGES) {
    const done = !!profile.data.challenges.daily.done[c.id];
    const card = el("div", { class: "card" + (done ? " is-selected" : "") }, [
      el("div", { class: "card__title", text: c.name }),
      el("div", { class: "card__sub", text: done ? "✓ Completed · +" + c.reward + " XP" : "Reward: +" + c.reward + " XP" }),
    ]);
    dGrid.append(card);
  }
  content.append(dGrid);

  content.append(el("div", { class: "section-title", text: "WEEKLY" }));
  const wGrid = el("div", { class: "grid grid--2" });
  for (const c of WEEKLY_CHALLENGES) {
    const done = !!profile.data.challenges.weekly.done[c.id];
    wGrid.append(el("div", { class: "card" + (done ? " is-selected" : "") }, [
      el("div", { class: "card__title", text: c.name }),
      el("div", { class: "card__sub", text: done ? "✓ Completed · +" + c.reward + " XP" : "Reward: +" + c.reward + " XP" }),
    ]));
  }
  content.append(wGrid);
  content.append(el("div", { class: "text-dim mt-4", text: "Challenges complete automatically as you play. Rewards are credited to your account." }));
  return { name: "challenges", destroy() {} };
}

// ---------------- PROFILE ----------------
export function profileScreen(game) {
  const { content } = shell(game, { title: "PROFILE" });
  const d = profile.data;
  const lvl = profile.level;

  const head = el("div", { class: "card" });
  head.append(
    el("div", { class: "card__title", text: d.name }),
    el("div", { class: "card__sub", text: `Level ${lvl.level} · ${profile.rank("1v1").name} (1v1) / ${profile.rank("2v2").name} (2v2)` })
  );
  const xpBar = el("div", { class: "hud__boostbar mt-4", style: { width: "100%" } }, [el("div", { class: "hud__boostfill", style: { width: Math.round(lvl.progress * 100) + "%", background: "linear-gradient(90deg,#2ce3ff,#b14bff)" } })]);
  head.append(xpBar);
  head.append(el("div", { class: "text-dim mt-4", text: `${lvl.into} / ${Math.round(lvl.need)} XP to level ${lvl.level + 1}` }));
  content.append(head);

  const statKeys = [["matches", "Matches"], ["wins", "Wins"], ["losses", "Losses"], ["goals", "Goals"], ["saves", "Saves"], ["aerials", "Aerials"], ["flipResets", "Flip Resets"], ["playtime", "Playtime (min)"]];
  content.append(el("div", { class: "section-title", text: "CAREER STATS" }));
  const grid = el("div", { class: "grid grid--3" });
  for (const [k, label] of statKeys) {
    grid.append(el("div", { class: "card" }, [el("div", { class: "card__title", text: String(d.stats[k] || 0) }), el("div", { class: "card__sub", text: label })]));
  }
  content.append(grid);

  content.append(el("div", { class: "section-title", text: "ACHIEVEMENTS" }));
  const ag = el("div", { class: "grid grid--2" });
  for (const a of ACHIEVEMENTS) {
    const got = profile.isAchieved(a.id);
    ag.append(el("div", { class: "card" + (got ? " is-selected" : "") }, [el("div", { class: "card__title", text: (got ? "🏆 " : "🔒 ") + a.name }), el("div", { class: "card__sub", text: a.desc })]));
  }
  content.append(ag);
  return { name: "profile", destroy() {} };
}

// ---------------- SETTINGS ----------------
export function settings(game) {
  const { content } = shell(game, { title: "SETTINGS" });
  const s = profile.data.settings;

  // graphics
  content.append(el("div", { class: "section-title", text: "GRAPHICS" }));
  const gField = el("div", { class: "field" });
  const gSeg = el("div", { class: "seg" });
  for (const q of ["low", "medium", "high", "ultra"]) {
    gSeg.append(el("button", { class: s.graphics === q ? "is-active" : "", text: q[0].toUpperCase() + q.slice(1), onclick: () => { s.graphics = q; profile.save(); audio.ui(); settingsRebuild(); } }));
  }
  gField.append(gSeg);
  content.append(gField);
  content.append(el("div", { class: "text-dim", text: "Adjusts particle counts, shadows and resolution scaling for your device." }));

  // audio
  content.append(el("div", { class: "section-title", text: "AUDIO" }));
  const mkSlider = (label, key, onInput) => {
    const val = el("b", { text: Math.round(s[key] * 100) + "%" });
    const input = el("input", { type: "range", min: "0", max: "100", value: String(s[key] * 100) });
    input.oninput = () => { s[key] = input.value / 100; val.textContent = input.value + "%"; audio.setVolumes({ [key]: s[key] }); profile.save(); if (onInput) onInput(); };
    const field = el("div", { class: "field" }, [el("div", { class: "field__label" }, [el("span", { text: label }), val]), input]);
    return field;
  };
  content.append(mkSlider("Master", "masterVol"));
  content.append(mkSlider("Music", "musicVol", () => { if (audio.ctx && !audio._musicTimer) audio.startMusic(); }));
  content.append(mkSlider("SFX", "sfxVol"));

  // accessibility
  content.append(el("div", { class: "section-title", text: "ACCESSIBILITY" }));
  const rmField = el("div", { class: "field" });
  const rmSeg = el("div", { class: "seg" });
  for (const [v, lbl] of [[false, "Motion On"], [true, "Reduced"]]) {
    rmSeg.append(el("button", { class: (s.reducedMotion === v) ? "is-active" : "", text: lbl, onclick: () => { s.reducedMotion = v; profile.save(); audio.ui(); applyReducedMotion(); settingsRebuild(); } }));
  }
  rmField.append(rmSeg);
  content.append(rmField);

  // controls
  content.append(el("div", { class: "section-title", text: "CONTROLS (Player 1)" }));
  const ctrl = el("div", { class: "col gap-2" });
  const actions = [["left", "Drive Left"], ["right", "Drive Right"], ["jump", "Jump / Flip"], ["boost", "Boost"], ["reset", "Reset (Free Play)"], ["pause", "Pause"]];
  const rebindBtns = {};
  const renderCtrl = () => {
    clear(ctrl);
    for (const [act, label] of actions) {
      const code = game.input.bindings.p1[act][0];
      const btn = el("button", { class: "btn btn--sm", text: codeLabel(code) });
      btn.onclick = () => {
        btn.textContent = "Press key…";
        game.input.captureNext((code) => { game.input.setBinding("p1", act, code); audio.ui(); renderCtrl(); });
      };
      rebindBtns[act] = btn;
      ctrl.append(el("div", { class: "field", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [el("span", { class: "text-dim", text: label }), btn]));
    }
    ctrl.append(el("button", { class: "btn btn--ghost btn--sm mt-4", text: "Reset to defaults", onclick: () => { game.input.resetBindings(); audio.ui(); renderCtrl(); } }));
  };
  renderCtrl();
  content.append(ctrl);
  content.append(el("div", { class: "text-dim mt-4", text: "Tip: Right mouse = jump, Left mouse = boost during a match. Controller (gamepad) is auto-detected." }));

  content.append(el("div", { class: "section-title", text: "ACCOUNT" }));
  const nameField = el("div", { class: "field" }, [el("div", { class: "field__label" }, [el("span", { text: "Display Name" })]), (() => {
    const inp = el("input", { type: "text", value: profile.data.name, maxlength: "14" });
    inp.oninput = () => { profile.data.name = inp.value || "Player"; profile.save(); };
    return inp;
  })()]);
  content.append(nameField);
  content.append(el("button", { class: "btn btn--danger btn--sm", text: "Reset all progress", onclick: () => {
    if (confirm("Erase all local progress, cosmetics and settings?")) { profile.reset(); audio.ui(220); toast("Progress reset."); game.router.go("menu"); }
  } }));

  function settingsRebuild() { clear(content); settings(game); }
  applyReducedMotion();
  return { name: "settings", destroy() {} };
}

function applyReducedMotion() {
  document.body.classList.toggle("reduce-motion", !!profile.data.settings.reducedMotion);
}

// ---------------- STATS / LEADERBOARD ----------------
export function statsScreen(game) {
  const { content } = shell(game, { title: "STATS & LEADERBOARD" });
  const d = profile.data;
  content.append(el("div", { class: "card" }, [
    el("div", { class: "card__title", text: "Your Record" }),
    el("div", { class: "card__sub", text: `W ${d.stats.wins} · L ${d.stats.losses} · D ${d.stats.draws} · Goals ${d.stats.goals}` }),
  ]));
  content.append(el("div", { class: "section-title", text: "LOCAL LEADERBOARD" }));
  content.append(el("div", { class: "card" }, [
    el("div", { class: "card__title", text: "1. " + d.name }),
    el("div", { class: "card__sub", text: `${profile.rank("1v1").name} · ${d.mmr["1v1"]} MMR` }),
  ]));
  content.append(el("div", { class: "text-dim mt-4", text: "Online leaderboards require the backend services described in the deployment docs. Local ranking is shown here." }));
  return { name: "stats", destroy() {} };
}
