// main.js — bootstrap: loader, profile, audio unlock, game + router
import { profile } from "./core/profile.js";
import { audio } from "./core/audio.js";
import { Input } from "./core/input.js";
import { Game } from "./game/game.js";
import { Router } from "./core/router.js";
import * as Screens from "./ui/screens.js";
import { createTouchControls, isTouchDevice } from "./ui/touch.js";
import { banner, toast } from "./ui/dom.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const fill = document.getElementById("loaderFill");
  const status = document.getElementById("loaderStatus");
  const tip = document.getElementById("loaderTip");

  const steps = [
    [12, "INITIALIZING SYSTEMS…"],
    [34, "LOADING VEHICLE DATA…"],
    [55, "CALIBRATING PHYSICS…"],
    [74, "BUILDING ARENAS…"],
    [90, "PREPARING AUDIO…"],
    [100, "READY"],
  ];
  for (const [p, s] of steps) {
    fill.style.width = p + "%";
    status.textContent = s;
    await sleep(160 + Math.random() * 120);
  }

  // ---- core init ----
  profile.init();
  const input = new Input();
  const canvas = document.getElementById("game");
  const uiRoot = document.getElementById("ui-root");

  const game = new Game({ canvas, uiRoot, input, router: null });

  const router = new Router(uiRoot, {
    menu: () => Screens.menu(game),
    play: () => Screens.play(game),
    garage: () => Screens.garage(game),
    training: () => Screens.training(game),
    ranked: () => Screens.ranked(game),
    challenges: () => Screens.challenges(game),
    profile: () => Screens.profileScreen(game),
    settings: () => Screens.settings(game),
    stats: () => Screens.statsScreen(game),
    replays: () => Screens.replays(game),
    tournaments: () => Screens.tournaments(game),
    online: () => Screens.online(game),
  }, "menu");
  game.router = router;

  if (isTouchDevice()) {
    game.touch = createTouchControls(input);
    game.touch.hide();
  }

  game.start();

  // audio unlock on first user gesture (autoplay policy)
  const unlock = () => {
    audio.resume();
    audio.setVolumes({
      master: profile.data.settings.masterVol,
      sfx: profile.data.settings.sfxVol,
      music: profile.data.settings.musicVol,
    });
    if (profile.data.settings.musicVol > 0) audio.startMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // reveal app
  const loader = document.getElementById("loader");
  loader.classList.add("is-done");
  setTimeout(() => {
    loader.hidden = true;
    document.getElementById("app").hidden = false;
    game.resize();
  }, 650);

  router.resolve();

  // connection / status note (honest: local-first, online pending backend)
  setTimeout(() => {
    banner("Local play is fully available. Online multiplayer requires the backend services described in the README.", "info");
  }, 1200);

  // expose for debugging / tests
  window.__NOVA__ = { game, profile, audio, input };
}

boot();
