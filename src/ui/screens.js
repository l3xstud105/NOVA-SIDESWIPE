// screens.js — all menu/UI screens (functional, responsive, animated)
import { el, clear, toast, banner, hexToRgba } from "./dom.js";
import { profile } from "../core/profile.js";
import { audio } from "../core/audio.js";
import { AI_PLAYSTYLES } from "../game/ai.js";
import { Tournament, getCurrentTournament, clearTournament } from "../game/tournament.js";
import { QUALITY_ORDER, QUALITY_PRESETS, autoQuality } from "../core/quality.js";
import { ARENAS } from "../data/arenas.js";
import { VEHICLES } from "../data/vehicles.js";
import { PAINTS, WHEELS, BOOSTS, BANNERS, TITLES } from "../data/cosmetics.js";
import { RANKS, ACHIEVEMENTS, DAILY_CHALLENGES, WEEKLY_CHALLENGES, levelForXP, LEVEL_REWARDS, REWARD_LEVELS, rewardsAtLevel } from "../data/progression.js";

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
    { label: "Replays", sub: "Saved matches", go: "replays" },
    { label: "Tournaments", sub: "Bracket cup", go: "tournaments" },
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
  const sel = { mode: "1v1", arena: ARENAS[0].id, difficulty: "medium", style: "balanced", ranked: false };

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

  // playstyle (not for local2p/free)
  const styleWrap = el("div", { class: "field" });
  const renderStyle = () => {
    clear(styleWrap);
    if (sel.mode === "local2p" || sel.mode === "free") return;
    styleWrap.append(el("div", { class: "section-title", text: "AI Playstyle" }));
    const seg = el("div", { class: "seg" });
    for (const s of AI_PLAYSTYLES) {
      seg.append(el("button", { class: sel.style === s ? "is-active" : "", text: s[0].toUpperCase() + s.slice(1), onclick: () => { sel.style = s; audio.ui(); renderStyle(); } }));
    }
    styleWrap.append(seg);
    styleWrap.append(el("div", { class: "text-dim mt-4", text: "Personalities change how the AI plays. Mix and match difficulty + style." }));
  };
  renderStyle();
  content.append(styleWrap);

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
  const startBtn = el("button", { class: "btn btn--primary btn--lg mt-5", text: "ENTER MATCH", onclick: () => { audio.ui(880); game.startMatch({ mode: sel.mode, arena: sel.arena, difficulty: sel.difficulty, style: sel.style, ranked: sel.ranked }); } });
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

  // ---- presets ----
  const presetWrap = el("div", { class: "panel", style: { padding: "16px" } });
  presetWrap.append(el("div", { class: "section-title", text: "PRESETS" }));
  presetWrap.append(el("div", { class: "text-dim", text: "Save your current setup. Load, rename, duplicate or delete." }));

  // save bar
  const saveBar = el("div", { class: "row gap-2 mt-4" });
  const nameInp = el("input", { type: "text", value: "My Preset", maxlength: "20", class: "preset-name" });
  const savePresetBtn = el("button", { class: "btn btn--primary btn--sm", text: "Save Preset", onclick: () => {
    const name = (nameInp.value || "").trim() || "Preset";
    const p = profile.savePreset(name, profile.data.cosmetics.equipped);
    audio.ui(880); toast("Saved preset: " + p.name, "reward");
    renderPresets();
  } });
  const dupBtn = el("button", { class: "btn btn--sm", text: "Duplicate", onclick: () => {
    const cur = profile.data.cosmetics.equipped;
    profile.savePreset((nameInp.value || "Copy").trim() + " (copy)", cur);
    audio.ui(); renderPresets();
  } });
  saveBar.append(nameInp, savePresetBtn, dupBtn);
  presetWrap.append(saveBar);

  const presetList = el("div", { class: "preset-list mt-4" });
  function renderPresets() {
    clear(presetList);
    const presets = profile.getPresets();
    if (!presets.length) {
      presetList.append(el("div", { class: "text-dim", text: "No presets saved yet." }));
      return;
    }
    for (const p of presets) {
      const item = el("div", { class: "preset-item" });
      item.append(el("div", { class: "preset-item__name", text: p.name }));
      const actions = el("div", { class: "row gap-2" });
      const load = el("button", { class: "btn btn--sm btn--primary", text: "Load", onclick: () => {
        if (profile.loadPreset(p.id)) { audio.ui(880); toast("Loaded: " + p.name, "reward"); refresh(); refreshPreview(); }
      } });
      const rename = el("button", { class: "btn btn--sm", text: "Rename", onclick: () => {
        const ni = el("input", { type: "text", value: p.name, maxlength: "20" });
        const ok = el("button", { class: "btn btn--sm btn--primary", text: "OK" });
        const cancel = el("button", { class: "btn btn--sm btn--ghost", text: "Cancel" });
        const row = el("div", { class: "row gap-2" }, [ni, ok, cancel]);
        item.replaceWith(row); row.classList.add("preset-item");
        cancel.onclick = () => renderPresets();
        ok.onclick = () => { profile.updatePreset(p.id, ni.value.trim() || p.name, null); audio.ui(); renderPresets(); };
      } });
      const del = el("button", { class: "btn btn--sm btn--danger", text: "Delete", onclick: () => { profile.deletePreset(p.id); audio.ui(220); renderPresets(); } });
      actions.append(load, rename, del);
      item.append(actions);
      presetList.append(item);
    }
  }
  renderPresets();
  presetWrap.append(presetList);
  right.append(presetWrap);

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

  const statKeys = [["matches", "Matches"], ["wins", "Wins"], ["losses", "Losses"], ["goals", "Goals"], ["shots", "Shots"], ["saves", "Saves"], ["aerials", "Aerials"], ["flipResets", "Flip Resets"], ["playtime", "Playtime (min)"]];
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

  // rewards track
  content.append(el("div", { class: "section-title", text: "REWARDS TRACK" }));
  const rr = el("div", { class: "grid grid--2" });
  const granted = profile.getGrantedRewards();
  const grantedKeys = new Set(granted.map((g) => g.category + ":" + g.id));
  for (const r of LEVEL_REWARDS) {
    const got = grantedKeys.has(r.category + ":" + r.id);
    const reached = r.level <= lvl.level;
    rr.append(el("div", { class: "card" + (got ? " is-selected" : "") + (!got && !reached ? " is-locked" : "") }, [
      el("div", { class: "card__title", text: (got ? "✅ " : reached ? "🔓 " : "🔒 ") + r.label }),
      el("div", { class: "card__sub", text: "Level " + r.level + " · " + r.category }),
    ]));
  }
  content.append(rr);
  const nr = profile.nextReward();
  if (nr) {
    content.append(el("div", { class: "text-dim mt-4", text: "Next tier — Level " + nr.level + ": " + nr.rewards.map((x) => x.label).join(", ") }));
  } else {
    content.append(el("div", { class: "text-dim mt-4", text: "All reward tiers unlocked!" }));
  }
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
  const opts = ["auto", ...QUALITY_ORDER];
  for (const q of opts) {
    const label = q === "auto" ? "Auto" : QUALITY_PRESETS[q].label;
    gSeg.append(el("button", { class: s.graphics === q ? "is-active" : "", text: label, onclick: () => { s.graphics = q; profile.save(); audio.ui(); if (game.rebuildQuality) game.rebuildQuality(); settingsRebuild(); } }));
  }
  gField.append(gSeg);
  content.append(gField);
  content.append(el("div", { class: "text-dim", text: "Presets scale resolution, particles, shadows and lighting. Auto picks the best fit for your device (Potato → Cinematic)." }));

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

// ---------------- REPLAYS ----------------
export function replays(game) {
  const { content } = shell(game, { title: "REPLAYS" });
  const list = profile.getReplays();

  if (!list.length) {
    content.append(el("div", { class: "card" }, [
      el("div", { class: "card__title", text: "No replays yet" }),
      el("div", { class: "card__sub", text: "Finish a match and it will be saved here automatically. Replays reconstruct the actual recorded frames." }),
    ]));
    content.append(el("button", { class: "btn btn--primary mt-5", text: "Go to Play", onclick: () => { audio.ui(880); game.router.go("play"); } }));
    return { name: "replays", destroy() {} };
  }

  content.append(el("div", { class: "text-dim mt-2", text: `${list.length} saved replay${list.length === 1 ? "" : "s"}. Click to play back.` }));

  const grid = el("div", { class: "grid grid--2 mt-4" });
  for (const r of list) {
    const card = el("div", { class: "card replay-card" });
    const verdict = r.winner === r.myTeam ? "WIN" : r.winner === "draw" ? "DRAW" : "LOSS";
    const vcls = r.winner === r.myTeam ? "results__verdict--win" : r.winner === "draw" ? "results__verdict--draw" : "results__verdict--loss";
    card.append(
      el("div", { class: "replay-card__head" }, [
        el("div", { class: "card__title", text: MODE_NAMES[r.mode] || r.mode }),
        el("div", { class: "replay-card__verdict " + vcls, text: verdict }),
      ]),
      el("div", { class: "card__sub", text: `${r.arenaName || r.arena} · ${r.score.blue}–${r.score.orange}` }),
      el("div", { class: "replay-card__foot" }, [
        el("span", { class: "text-dim", text: fmtDate(r.created) }),
        el("span", { class: "text-dim", text: `${Math.round(r.frames.length / 60)}s · ${r.frames.length} frames` }),
      ]),
    );
    const watch = el("button", { class: "btn btn--primary btn--sm", text: "▶ Watch" });
    watch.onclick = () => { audio.ui(880); game.startReplay(r); };
    card.append(el("div", { class: "mt-4" }, [watch]));
    const del = el("button", { class: "btn btn--ghost btn--sm", text: "Delete", onclick: () => { profile.deleteReplay(r.id); audio.ui(220); replays(game); } });
    card.append(el("div", { class: "mt-2" }, [del]));
    grid.append(card);
  }
  content.append(grid);
  return { name: "replays", destroy() {} };
}

// ---------------- TOURNAMENTS ----------------
export function tournaments(game) {
  const { content } = shell(game, { title: "TOURNAMENTS" });
  let t = getCurrentTournament();
  const render = () => {
    clear(content);
    content.append(el("div", { class: "section-title", text: "Single-Elimination Bracket" }));
    content.append(el("div", { class: "text-dim mt-2", text: "Battle through the bracket vs AI. Win to advance, lose and you're eliminated. Crown the champion." }));

    if (t && !t.complete && t.playerAlive) {
      // in progress — show player's next match
      const pm = t.playerMatch();
      const p = t.progress();
      if (pm) {
        const card = el("div", { class: "card is-selected" });
        card.append(el("div", { class: "card__title", text: "Your Next Match" }));
        card.append(el("div", { class: "card__sub", text: `Round ${pm.round + 1} of ${p.rounds}` }));
        const row = el("div", { class: "row", style: { justifyContent: "center", gap: "14px", margin: "10px 0" } });
        row.append(
          el("div", { class: "tourn-team", style: { color: t.teams[0].color } }, [el("b", { text: "You" }), el("span", { text: "(blue)" })]),
          el("div", { class: "text-dim", text: "vs" }),
          el("div", { class: "tourn-team", style: { color: pm.opponent.color } }, [el("b", { text: pm.opponent.name }), el("span", { text: pm.opponent.difficulty })])
        );
        card.append(row);
        const start = el("button", { class: "btn btn--primary btn--lg mt-4", text: "PLAY MATCH", onclick: () => { audio.ui(880); game.startMatch({ mode: "1v1", arena: ARENAS[0].id, difficulty: pm.opponent.difficulty, style: pm.opponent.style, tournament: { tournament: t, round: pm.round, index: pm.index, opponentId: pm.opponent.id, playerTeamId: t.teams[0].id } }); } });
        card.append(el("div", { class: "row", style: { justifyContent: "center" } }, [start]));
        content.append(card);
      }
      content.append(renderBracket(t.progress()));
      content.append(el("div", { class: "row mt-5", style: { justifyContent: "center" } }, [el("button", { class: "btn btn--ghost btn--sm", text: "Abandon Tournament", onclick: () => { clearTournament(); audio.ui(220); t = null; render(); } })]));
    } else if (t && t.complete) {
      const p = t.progress();
      const card = el("div", { class: "card" });
      card.append(el("div", { class: "card__title", text: "Tournament Complete" }));
      card.append(el("div", { class: "card__sub", text: p.champion === "You" ? "🏆 You are the champion!" : `Champion: ${p.champion}` }));
      content.append(card);
      content.append(renderBracket(p));
      content.append(el("div", { class: "row mt-5", style: { justifyContent: "center" } }, [
        el("button", { class: "btn btn--primary", text: "New Tournament", onclick: () => { clearTournament(); t = new Tournament({ size: 8 }); t.save(); audio.ui(880); render(); } }),
        el("button", { class: "btn btn--ghost", text: "Menu", onclick: () => { clearTournament(); game.router.go("menu"); } }),
      ]));
    } else {
      // no active tournament — create one
      const card = el("div", { class: "card" });
      card.append(el("div", { class: "card__title", text: "No Active Tournament" }));
      card.append(el("div", { class: "card__sub", text: "Enter a single-elimination bracket. You'll face a stream of AI opponents — win each match to advance toward the title." }));
      const sizes = el("div", { class: "seg", style: { margin: "12px 0" } });
      const sizesSel = { size: 8 };
      for (const s of [4, 8, 16]) sizes.append(el("button", { class: sizesSel.size === s ? "is-active" : "", text: s + " teams", onclick: () => { sizesSel.size = s; audio.ui(); [...sizes.children].forEach((c, i) => c.className = i === [4, 8, 16].indexOf(s) ? "is-active" : ""); } }));
      card.append(sizes);
      const create = el("button", { class: "btn btn--primary btn--lg", text: "CREATE BRACKET", onclick: () => { t = new Tournament({ size: sizesSel.size }); t.save(); audio.ui(880); render(); } });
      card.append(el("div", { class: "row", style: { justifyContent: "center" } }, [create]));
      content.append(card);
    }
  };
  render();
  return { name: "tournaments", destroy() {} };
}

function renderBracket(p) {
  const wrap = el("div", { class: "bracket mt-5" });
  p.bracket.forEach((round, ri) => {
    const col = el("div", { class: "bracket__round" });
    col.append(el("div", { class: "bracket__roundlabel", text: `Round ${ri + 1}` }));
    for (const m of round) {
      const card = el("div", { class: "bracket__match" });
      if (m.a) card.append(el("div", { class: "bracket__team" + (m.a.isPlayer ? " bracket__team--me" : "") + (m.a.adv ? " is-win" : ""), style: { borderColor: m.a.color } }, [el("b", { text: m.a.name })]));
      else card.append(el("div", { class: "bracket__team bracket__team--empty", text: "—" }));
      if (m.b) card.append(el("div", { class: "bracket__team" + (m.b.isPlayer ? " bracket__team--me" : "") + (m.b.adv ? " is-win" : ""), style: { borderColor: m.b.color } }, [el("b", { text: m.b.name })]));
      else card.append(el("div", { class: "bracket__team bracket__team--empty", text: "—" }));
      if (m.done) card.append(el("div", { class: "bracket__result", text: "W: " + m.winner }));
      col.append(card);
    }
    wrap.append(col);
  });
  return wrap;
}

function fmtDate(ts) {
  try { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch (e) { return ""; }
}

const MODE_NAMES = { "1v1": "1v1 Duel", "2v2": "2v2 Doubles", local2p: "Local 2P", hoops: "Hoops", volleyball: "Volleyball", free: "Free Play" };

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
