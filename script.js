const SAVE_KEY = "monquest_save_v1";
const TILE_SIZE = 32;
const VIEW_W = 480;
const VIEW_H = 352;

/* 1. Retro Web Audio Synthesizer */
const SFX = (() => {
  let ctx = null;
  let muted = false;

  function ensureCtx() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur = 0.08, type = "square", vol = 0.07, delay = 0) {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(vol, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + dur);
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    step: () => tone(160, 0.03, "triangle", 0.03),
    bump: () => tone(95, 0.08, "sawtooth", 0.05),
    select: () => tone(520, 0.06, "square", 0.05),
    hit: () => { tone(180, 0.09, "sawtooth", 0.08); tone(110, 0.1, "square", 0.07, 0.04); },
    superHit: () => { tone(440, 0.07, "square", 0.08); tone(660, 0.12, "square", 0.08, 0.06); },
    heal: () => { tone(523, 0.09, "sine", 0.08); tone(659, 0.09, "sine", 0.08, 0.09); tone(784, 0.16, "sine", 0.08, 0.18); },
    encounter: () => { [330, 392, 494, 659].forEach((f, i) => tone(f, 0.07, "square", 0.07, i * 0.06)); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "square", 0.07, i * 0.09)); }
  };
})();

/* 2. Type Chart & Moves */
const TYPE_CHART = {
  Fire:     { Grass: 2, Water: 0.5, Fire: 0.5 },
  Water:    { Fire: 2, Grass: 0.5, Water: 0.5 },
  Grass:    { Water: 2, Fire: 0.5, Grass: 0.5 },
  Electric: { Water: 2, Grass: 0.5, Electric: 0.5 },
  Normal:   {}
};

const MOVES = {
  tackle:     { name: "Quick Tackle", type: "Normal",   power: 35, kind: "attack" },
  scratch:    { name: "Swift Claw",   type: "Normal",   power: 40, kind: "attack" },
  ember:      { name: "Ember Burst",  type: "Fire",     power: 45, kind: "attack" },
  flameDash:  { name: "Flame Dash",   type: "Fire",     power: 62, kind: "attack" },
  waterPulse: { name: "Water Pulse",  type: "Water",    power: 45, kind: "attack" },
  aquaJet:    { name: "Aqua Jet",     type: "Water",    power: 62, kind: "attack" },
  vineLash:   { name: "Vine Lash",    type: "Grass",    power: 45, kind: "attack" },
  solarLeaf:  { name: "Solar Leaf",   type: "Grass",    power: 62, kind: "attack" },
  spark:      { name: "Spark Zap",    type: "Electric", power: 45, kind: "attack" },
  thunderBite:{ name: "Volt Fang",    type: "Electric", power: 62, kind: "attack" },
  healPulse:  { name: "Recover",      type: "Normal",   power: 0,  kind: "heal" },
  battleCry:  { name: "Focus Roar",   type: "Normal",   power: 0,  kind: "buff" }
};

/* 3. Creature Database & 12x12 Pixel-Art Sprites */
const SPECIES = {
  pyrokit: {
    name: "Pyrokit", type: "Fire", hp: 30, atk: 14, def: 10, spd: 13,
    moves: ["ember", "tackle", "flameDash", "battleCry"],
    palette: { k: "#1e293b", b: "#f97316", s: "#fed7aa", e: "#0f172a", a: "#ef4444", w: "#fde047" },
    sprite: [
      "..kk....kk..",
      ".kbbk..kbbk.",
      ".kbbkkkkbbk.",
      "kbbbbbbbbbbk",
      "kbbebbbbebbk",
      "kbbbbssbbbbk",
      ".kbbbbbbbbk.",
      "..kbbssbbk.a",
      ".kbbbbbbbbwa",
      ".kbbk..kbbka",
      ".kss.kk.ssk.",
      "..kk....kk.."
    ]
  },
  aquafin: {
    name: "Aquafin", type: "Water", hp: 33, atk: 12, def: 12, spd: 11,
    moves: ["waterPulse", "tackle", "aquaJet", "healPulse"],
    palette: { k: "#1e293b", b: "#38bdf8", s: "#e0f2fe", e: "#0f172a", a: "#0284c7" },
    sprite: [
      "....kkkk....",
      "..kbaaaabk..",
      ".kbbbbbbbbk.",
      "akbbebbbebka",
      "akbbbbbbbbka",
      ".kbbbssbbbk.",
      "..kbbssbbk..",
      ".kbbbbbbbbk.",
      ".kbbssssbbk.",
      ".kbbk..kbbk.",
      "..kk....kk..",
      "............"
    ]
  },
  sproutle: {
    name: "Sproutle", type: "Grass", hp: 35, atk: 12, def: 14, spd: 9,
    moves: ["vineLash", "tackle", "solarLeaf", "healPulse"],
    palette: { k: "#14532d", b: "#4ade80", s: "#dcfce7", e: "#0f172a", a: "#16a34a" },
    sprite: [
      "....aaaa....",
      "...aa..aa...",
      "..kkkkkkkk..",
      ".kbbbbbbbbk.",
      "kbbebbbbebbk",
      "kbbbbbbbbbbk",
      "kbbssssssbbk",
      ".kbaaaaaabk.",
      ".kbaaaaaabk.",
      ".kbbk..kbbk.",
      "..kk....kk..",
      "............"
    ]
  },
  voltpup: {
    name: "Voltpup", type: "Electric", hp: 28, atk: 15, def: 9, spd: 15,
    moves: ["spark", "tackle", "thunderBite", "battleCry"],
    palette: { k: "#1e293b", b: "#facc15", s: "#fef08a", e: "#0f172a", a: "#ef4444" },
    sprite: [
      ".kk......kk.",
      "kbbk....kbbk",
      "kbbkkkkkkbbk",
      "kbbbbbbbbbbk",
      "kbbebbbbebbk",
      "kabbssssbbak",
      ".kbbbbbbbbk.",
      "..kbbbbbbk.b",
      ".kbbbbbbbbkb",
      ".kbbk..kbbk.",
      "..kk....kk..",
      "............"
    ]
  },
  fluffbit: {
    name: "Fluffbit", type: "Normal", hp: 29, atk: 11, def: 10, spd: 12,
    moves: ["tackle", "scratch", "healPulse", "battleCry"],
    palette: { k: "#334155", b: "#f1f5f9", s: "#cbd5e1", e: "#0f172a", a: "#f472b6" },
    sprite: [
      "..kk....kk..",
      ".kbbk..kbbk.",
      ".kbak..kabk.",
      ".kbbkkkkbbk.",
      "kbbbbbbbbbbk",
      "kbbebaaebbbk",
      "kbbbbbbbbbbk",
      ".kbbssssbbk.",
      ".kbbbbbbbbk.",
      "..kbb..bbk..",
      "..kk....kk..",
      "............"
    ]
  },
  bramblet: {
    name: "Bramblet", type: "Grass", hp: 31, atk: 13, def: 12, spd: 10,
    moves: ["vineLash", "scratch", "solarLeaf", "battleCry"],
    palette: { k: "#1e293b", b: "#84cc16", s: "#ecfccb", e: "#0f172a", a: "#3f6212" },
    sprite: [
      "..a..aa..a..",
      ".kkkkkkkkkk.",
      "kbbbbbbbbbbk",
      "kbbebbbbebbk",
      "kbbbbssbbbbk",
      "kaaaaaaaaaak",
      "kbbbbbbbbbbk",
      ".kbbbbbbbbk.",
      ".kbbk..kbbk.",
      "..kk....kk..",
      "............",
      "............"
    ]
  },
  tidecrab: {
    name: "Tidecrab", type: "Water", hp: 30, atk: 14, def: 13, spd: 10,
    moves: ["waterPulse", "scratch", "aquaJet", "battleCry"],
    palette: { k: "#1e293b", b: "#fb7185", s: "#ffe4e6", e: "#0f172a", a: "#0ea5e9" },
    sprite: [
      "kk........kk",
      "kbk..kk..kbk",
      "kk.kbbbbk.kk",
      "..kbbbbbbk..",
      ".kbebbbbebk.",
      ".kbbbbbbbbk.",
      ".kbbssssbbk.",
      "kk.kbbbbk.kk",
      "k..k.kk.k..k",
      "............",
      "............",
      "............"
    ]
  },
  cinderon: {
    name: "Cinderon", type: "Fire", hp: 36, atk: 16, def: 12, spd: 13,
    moves: ["ember", "flameDash", "scratch", "battleCry"],
    palette: { k: "#1e293b", b: "#dc2626", s: "#fbbf24", e: "#ffffff", a: "#f97316" },
    sprite: [
      "...k....k...",
      "..ksk..ksk..",
      ".kbbbbbbbbk.",
      "kbbebbbbebbk",
      "kbbbbbbbbbbk",
      "kbbssssssbbk",
      ".kbbssssbbk.",
      ".kbbbbbbbbka",
      "kbbkbbbbkbsa",
      "kss.k..k.kka",
      ".kk......kk.",
      "............"
    ]
  }
};

/* 4. Overworld Map (24 x 18 tiles) */
const MAP_ROWS = [
  "########################",
  "#..FF..====..####..BBBB#",
  "#..H...====..#,,#..BBBB#",
  "#......====..#,,#..BBBB#",
  "#..======....=,,=..====#",
  "#..======....====..====#",
  "#..~~~~..========..====#",
  "#..~~~~..====..,,,,,,,,#",
  "#........====..,,,,,,,,#",
  "#..,,,,..====..,,,,,,,,#",
  "#..,,,,..====..........#",
  "#..,,,,..========..####.",
  "#........========..#..##",
  "#..####..====,,....,,,,#",
  "#..####..====,,,,,,~~~~#",
  "#..FF....====,,,,,,~~~~#",
  "#........====,,,,,,,,,,#",
  "########################"
];

const NPCS = [
  {
    id: "nurse",
    name: "Nurse Aria",
    x: 4, y: 2,
    color: "#f472b6",
    interact() {
      healParty();
      state.orbs = Math.max(state.orbs, 5);
      state.potions = Math.max(state.potions, 3);
      SFX.heal();
      updateHUD();
      saveGame();
      showDialog("Nurse Aria: Welcome! I've healed your whole party and restocked your Orbs & Potions!");
    }
  },
  {
    id: "guide",
    name: "Guide Leo",
    x: 10, y: 7,
    color: "#38bdf8",
    interact() {
      showDialog("Leo: Walk in tall grass to catch wild monsters! When you're Level 6+, challenge Champion Kai in the northeast arena!");
    }
  },
  {
    id: "champion",
    name: "Champion Kai",
    x: 20, y: 2,
    color: "#facc15",
    interact() {
      if (state.badges >= 1) {
        showDialog("Champion Kai: You already defeated me, Champ! Want a rematch?", () => {
          startTrainerBattle("Champion Kai", [
            createMonster("voltpup", 6),
            createMonster("cinderon", 7)
          ]);
        });
      } else {
        showDialog("Champion Kai: Think your squad is ready? Show me what you've got!", () => {
          startTrainerBattle("Champion Kai", [
            createMonster("voltpup", 6),
            createMonster("cinderon", 7)
          ]);
        });
      }
    }
  }
];

/* 5. Game State */
const state = {
  mode: "STARTER", // STARTER | OVERWORLD | DIALOG | BATTLE
  player: { x: 8, y: 5, px: 8 * TILE_SIZE, py: 5 * TILE_SIZE, dir: "down", moving: false, targetX: 8, targetY: 5, stepTick: 0 },
  party: [],
  dex: new Set(),
  orbs: 5,
  potions: 3,
  badges: 0,
  keys: {},
  dialogCallback: null,
  battle: null
};

/* 6. Monster Factory & Save System */
function createMonster(speciesId, level = 5) {
  const sp = SPECIES[speciesId];
  const maxHp = Math.floor(sp.hp + level * 4.2);
  return {
    uid: Math.random().toString(36).slice(2, 9),
    speciesId,
    name: sp.name,
    type: sp.type,
    level,
    hp: maxHp,
    maxHp,
    atk: Math.floor(sp.atk + level * 1.8),
    def: Math.floor(sp.def + level * 1.5),
    spd: Math.floor(sp.spd + level * 1.4),
    xp: 0,
    nextXp: level * 18,
    moves: [...sp.moves]
  };
}

function healParty() {
  state.party.forEach((m) => { m.hp = m.maxHp; });
}

function saveGame() {
  try {
    const payload = {
      playerX: state.player.x,
      playerY: state.player.y,
      party: state.party,
      dex: Array.from(state.dex),
      orbs: state.orbs,
      potions: state.potions,
      badges: state.badges
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Save failed:", e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.party) || data.party.length === 0) return false;

    state.player.x = data.playerX ?? 8;
    state.player.y = data.playerY ?? 5;
    state.player.px = state.player.x * TILE_SIZE;
    state.player.py = state.player.y * TILE_SIZE;
    state.party = data.party;
    state.dex = new Set(data.dex || []);
    state.orbs = data.orbs ?? 5;
    state.potions = data.potions ?? 3;
    state.badges = data.badges ?? 0;
    return true;
  } catch {
    return false;
  }
}

/* 7. Sprite Renderer */
function drawSpriteToCanvas(canvas, speciesId, flip = false) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sp = SPECIES[speciesId];
  if (!sp) return;

  const grid = sp.sprite;
  const pxSize = Math.floor(canvas.width / 12);

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      ctx.fillStyle = sp.palette[ch] || "#000";
      const drawX = flip ? (11 - x) * pxSize : x * pxSize;
      ctx.fillRect(drawX, y * pxSize, pxSize, pxSize);
    }
  }
}

/* 8. Initialization & UI Wiring */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

document.addEventListener("DOMContentLoaded", () => {
  initStarterChoices();
  bindControls();

  if (loadGame()) {
    document.getElementById("starterModal").hidden = true;
    state.mode = "OVERWORLD";
  }

  updateHUD();
  requestAnimationFrame(gameLoop);
});

function initStarterChoices() {
  const container = document.getElementById("starterChoices");
  ["pyrokit", "aquafin", "sproutle"].forEach((id) => {
    const sp = SPECIES[id];
    const btn = document.createElement("button");
    btn.className = "starter-card";
    btn.innerHTML = `
      <canvas width="72" height="72"></canvas>
      <strong>${sp.name}</strong>
      <span class="type-tag type-${sp.type}">${sp.type}</span>
    `;
    drawSpriteToCanvas(btn.querySelector("canvas"), id);
    btn.addEventListener("click", () => {
      SFX.win();
      state.party = [createMonster(id, 5)];
      state.dex.add(id);
      document.getElementById("starterModal").hidden = true;
      state.mode = "OVERWORLD";
      updateHUD();
      saveGame();
      showDialog(`You chose ${sp.name}! Walk into tall grass to catch more monsters, or talk to Nurse Aria anytime to heal.`);
    });
    container.appendChild(btn);
  });
}

function updateHUD() {
  document.getElementById("orbCount").textContent = `🔴 ${state.orbs}`;
  document.getElementById("potionCount").textContent = `🧪 ${state.potions}`;
  document.getElementById("badgePill").textContent = `🏆 ${state.badges}/1 Badge`;
}

/* 9. Controls (Keyboard + Touch D-Pad + Buttons) */
function bindControls() {
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }
    state.keys[e.key.toLowerCase()] = true;

    if (e.key === " " || e.key === "Enter") handleButtonA();
    if (e.key === "Escape" || e.key.toLowerCase() === "b") handleButtonB();
  });

  window.addEventListener("keyup", (e) => {
    state.keys[e.key.toLowerCase()] = false;
  });

  document.querySelectorAll(".pad-btn").forEach((btn) => {
    const dir = btn.dataset.dir;
    const keyMap = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };
    const start = (e) => { e.preventDefault(); state.keys[keyMap[dir]] = true; };
    const end = () => { state.keys[keyMap[dir]] = false; };
    btn.addEventListener("mousedown", start);
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("mouseup", end);
    btn.addEventListener("mouseleave", end);
    btn.addEventListener("touchend", end);
  });

  document.getElementById("btnA").addEventListener("click", handleButtonA);
  document.getElementById("btnB").addEventListener("click", handleButtonB);

  document.getElementById("soundBtn").addEventListener("click", (e) => {
    const muted = SFX.toggleMute();
    e.target.textContent = muted ? "🔇" : "🔊";
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Start a brand new adventure? Current save will be cleared.")) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });

  // Party & Dex Modal
  document.getElementById("partyBtn").addEventListener("click", () => openPartyModal(false));
  document.getElementById("closePartyBtn").addEventListener("click", () => {
    if (state.battle && state.battle.mustSwitch) return;
    document.getElementById("partyModal").hidden = true;
  });

  document.getElementById("tabParty").addEventListener("click", () => switchModalTab("party"));
  document.getElementById("tabDex").addEventListener("click", () => switchModalTab("dex"));

  // Battle Buttons
  document.getElementById("btnFight").addEventListener("click", openMovesMenu);
  document.getElementById("btnBag").addEventListener("click", openBagMenu);
  document.getElementById("btnSwitch").addEventListener("click", () => openPartyModal(true));
  document.getElementById("btnRun").addEventListener("click", attemptRun);
  document.getElementById("bagBackBtn").addEventListener("click", showBattleMainMenu);
  document.getElementById("useOrbBtn").addEventListener("click", useCaptureOrb);
  document.getElementById("usePotionBtn").addEventListener("click", usePotion);
}

function handleButtonA() {
  if (state.mode === "DIALOG") {
    SFX.select();
    const cb = state.dialogCallback;
    document.getElementById("dialogBox").hidden = true;
    state.dialogCallback = null;
    state.mode = "OVERWORLD";
    if (cb) cb();
    return;
  }

  if (state.mode === "OVERWORLD" && !state.player.moving) {
    const offsets = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = offsets[state.player.dir];
    const tx = state.player.x + dx;
    const ty = state.player.y + dy;

    const npc = NPCS.find((n) => n.x === tx && n.y === ty);
    if (npc) {
      SFX.select();
      npc.interact();
    } else if (MAP_ROWS[ty] && MAP_ROWS[ty][tx] === "H") {
      NPCS[0].interact();
    }
  }
}

function handleButtonB() {
  if (!document.getElementById("partyModal").hidden) {
    if (state.battle && state.battle.mustSwitch) return;
    document.getElementById("partyModal").hidden = true;
    return;
  }
  if (state.mode === "BATTLE" && !state.battle.busy) {
    showBattleMainMenu();
  }
}

function showDialog(text, callback = null) {
  state.mode = "DIALOG";
  state.dialogCallback = callback;
  document.getElementById("dialogText").textContent = text;
  document.getElementById("dialogBox").hidden = false;
}

/* 10. Overworld Movement, Collision & Rendering */
let waterTick = 0;

function gameLoop() {
  waterTick += 0.04;
  if (state.mode === "OVERWORLD") {
    updateOverworld();
  }
  drawOverworld();
  requestAnimationFrame(gameLoop);
}

function isTileWalkable(x, y) {
  if (y < 0 || y >= MAP_ROWS.length || x < 0 || x >= MAP_ROWS[0].length) return false;
  const ch = MAP_ROWS[y][x];
  if (ch === "#" || ch === "~") return false;
  if (NPCS.some((n) => n.x === x && n.y === y)) return false;
  return true;
}

function updateOverworld() {
  const p = state.player;

  if (!p.moving) {
    let dx = 0, dy = 0, dir = p.dir;
    if (state.keys["arrowup"] || state.keys["w"]) { dy = -1; dir = "up"; }
    else if (state.keys["arrowdown"] || state.keys["s"]) { dy = 1; dir = "down"; }
    else if (state.keys["arrowleft"] || state.keys["a"]) { dx = -1; dir = "left"; }
    else if (state.keys["arrowright"] || state.keys["d"]) { dx = 1; dir = "right"; }

    if (dx !== 0 || dy !== 0) {
      p.dir = dir;
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (isTileWalkable(nx, ny)) {
        p.targetX = nx;
        p.targetY = ny;
        p.moving = true;
        SFX.step();
      } else {
        SFX.bump();
      }
    }
  } else {
    const speed = 2.5;
    const destPx = p.targetX * TILE_SIZE;
    const destPy = p.targetY * TILE_SIZE;

    if (p.px < destPx) p.px = Math.min(p.px + speed, destPx);
    if (p.px > destPx) p.px = Math.max(p.px - speed, destPx);
    if (p.py < destPy) p.py = Math.min(p.py + speed, destPy);
    if (p.py > destPy) p.py = Math.max(p.py - speed, destPy);
    p.stepTick++;

    if (p.px === destPx && p.py === destPy) {
      p.x = p.targetX;
      p.y = p.targetY;
      p.moving = false;
      onStepComplete();
    }
  }
}

function onStepComplete() {
  const tile = MAP_ROWS[state.player.y][state.player.x];
  if (tile === "H") {
    healParty();
    SFX.heal();
    saveGame();
    showDialog("Stepped on Healing Pad — your party's HP is fully restored!");
    return;
  }

  // Wild encounter in tall grass
  if (tile === "," && Math.random() < 0.17) {
    triggerWildEncounter();
  }
}

function drawOverworld() {
  const mapW = MAP_ROWS[0].length * TILE_SIZE;
  const mapH = MAP_ROWS.length * TILE_SIZE;
  const camX = Math.max(0, Math.min(state.player.px - VIEW_W / 2 + TILE_SIZE / 2, mapW - VIEW_W));
  const camY = Math.max(0, Math.min(state.player.py - VIEW_H / 2 + TILE_SIZE / 2, mapH - VIEW_H));

  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-Math.floor(camX), -Math.floor(camY));

  for (let y = 0; y < MAP_ROWS.length; y++) {
    for (let x = 0; x < MAP_ROWS[y].length; x++) {
      const ch = MAP_ROWS[y][x];
      const tx = x * TILE_SIZE;
      const ty = y * TILE_SIZE;

      // Base grass
      ctx.fillStyle = (x + y) % 2 === 0 ? "#4ade80" : "#44d478";
      ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);

      if (ch === "=") {
        ctx.fillStyle = "#e7d3a1";
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
      } else if (ch === "B") {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#cbd5e1" : "#94a3b8";
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
      } else if (ch === "H") {
        ctx.fillStyle = "#fce7f3";
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "#ec4899";
        ctx.fillRect(tx + 12, ty + 6, 8, 20);
        ctx.fillRect(tx + 6, ty + 12, 20, 8);
      } else if (ch === ",") {
        ctx.fillStyle = "#15803d";
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(tx + 5 + i * 9, ty + 10, 4, 14);
          ctx.fillRect(tx + 3 + i * 9, ty + 14, 8, 4);
        }
      } else if (ch === "~") {
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = "#7dd3fc";
        const wave = Math.sin(waterTick + x) * 3;
        ctx.fillRect(tx + 6 + wave, ty + 10, 12, 3);
        ctx.fillRect(tx + 10 - wave, ty + 22, 10, 3);
      } else if (ch === "#") {
        ctx.fillStyle = "#166534";
        ctx.fillRect(tx + 4, ty + 2, 24, 22);
        ctx.fillStyle = "#14532d";
        ctx.fillRect(tx + 8, ty + 6, 16, 14);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(tx + 12, ty + 24, 8, 8);
      } else if (ch === "F") {
        ctx.fillStyle = "#fde047";
        ctx.fillRect(tx + 8, ty + 8, 6, 6);
        ctx.fillStyle = "#f472b6";
        ctx.fillRect(tx + 18, ty + 18, 6, 6);
      }
    }
  }

  // Draw NPCs
  NPCS.forEach((npc) => drawCharacter(npc.x * TILE_SIZE, npc.y * TILE_SIZE, npc.color, "down", 0));

  // Draw Player
  drawCharacter(state.player.px, state.player.py, "#ef4444", state.player.dir, state.player.moving ? state.player.stepTick : 0);

  ctx.restore();
}

function drawCharacter(px, py, hatColor, dir, tick) {
  const bob = tick > 0 ? Math.sin(tick * 0.4) * 2 : 0;
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(px + 6, py + 26, 20, 5);
  // Body
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(px + 8, py + 16 + bob, 16, 12);
  // Head
  ctx.fillStyle = "#fed7aa";
  ctx.fillRect(px + 8, py + 6 + bob, 16, 11);
  // Hat
  ctx.fillStyle = hatColor;
  ctx.fillRect(px + 6, py + 3 + bob, 20, 6);
  // Eyes based on direction
  ctx.fillStyle = "#0f172a";
  if (dir === "down") {
    ctx.fillRect(px + 11, py + 11 + bob, 2, 3);
    ctx.fillRect(px + 19, py + 11 + bob, 2, 3);
  } else if (dir === "left") {
    ctx.fillRect(px + 10, py + 11 + bob, 2, 3);
  } else if (dir === "right") {
    ctx.fillRect(px + 20, py + 11 + bob, 2, 3);
  }
}

/* 11. Battle System */
function triggerWildEncounter() {
  const pool = ["fluffbit", "bramblet", "tidecrab", "voltpup", "pyrokit", "aquafin", "sproutle", "cinderon"];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const avgLvl = Math.max(3, Math.floor(state.party[0].level - 1 + Math.random() * 2));
  const wildMon = createMonster(pick, avgLvl);

  SFX.encounter();
  startBattle({ isTrainer: false, trainerName: "", enemyTeam: [wildMon] });
}

function startTrainerBattle(trainerName, enemyTeam) {
  SFX.encounter();
  startBattle({ isTrainer: true, trainerName, enemyTeam });
}

function startBattle({ isTrainer, trainerName, enemyTeam }) {
  const activeIdx = state.party.findIndex((m) => m.hp > 0);
  if (activeIdx === -1) {
    healParty();
  }

  state.mode = "BATTLE";
  state.battle = {
    isTrainer,
    trainerName,
    enemyTeam,
    enemyIndex: 0,
    playerIndex: Math.max(0, state.party.findIndex((m) => m.hp > 0)),
    playerAtkBoost: 1,
    enemyAtkBoost: 1,
    busy: false,
    mustSwitch: false
  };

  document.getElementById("battleView").hidden = false;
  showBattleMainMenu();
  renderBattleUI();
  setBattleLog(
    isTrainer
      ? `${trainerName} sends out ${enemyTeam[0].name}!`
      : `A wild ${enemyTeam[0].name} (Lv.${enemyTeam[0].level}) appeared!`
  );
}

function getActivePlayer() {
  return state.party[state.battle.playerIndex];
}

function getActiveEnemy() {
  return state.battle.enemyTeam[state.battle.enemyIndex];
}

function renderBattleUI() {
  const p = getActivePlayer();
  const e = getActiveEnemy();

  document.getElementById("playerName").textContent = p.name;
  document.getElementById("playerLevel").textContent = `Lv.${p.level}`;
  const pType = document.getElementById("playerType");
  pType.textContent = p.type;
  pType.className = `type-tag type-${p.type}`;
  updateHpBar("playerHpBar", "playerHpText", p.hp, p.maxHp);
  document.getElementById("playerXpText").textContent = `XP ${p.xp}/${p.nextXp}`;
  document.getElementById("playerXpBar").style.width = `${Math.min(100, (p.xp / p.nextXp) * 100)}%`;
  drawSpriteToCanvas(document.getElementById("playerSprite"), p.speciesId, true);

  document.getElementById("enemyName").textContent = e.name;
  document.getElementById("enemyLevel").textContent = `Lv.${e.level}`;
  const eType = document.getElementById("enemyType");
  eType.textContent = e.type;
  eType.className = `type-tag type-${e.type}`;
  updateHpBar("enemyHpBar", "enemyHpText", e.hp, e.maxHp);
  document.getElementById("enemyCaughtMark").textContent = state.dex.has(e.speciesId) ? "🔴 Caught" : "New";
  drawSpriteToCanvas(document.getElementById("enemySprite"), e.speciesId, false);

  document.getElementById("bagOrbNum").textContent = state.orbs;
  document.getElementById("bagPotionNum").textContent = state.potions;
}

function updateHpBar(barId, textId, hp, maxHp) {
  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  const bar = document.getElementById(barId);
  bar.style.width = `${pct}%`;
  bar.style.background = pct <= 22 ? "var(--hp-red)" : pct <= 50 ? "var(--hp-yellow)" : "var(--hp-green)";
  document.getElementById(textId).textContent = `${hp}/${maxHp}`;
}

function setBattleLog(msg) {
  document.getElementById("battleLog").textContent = msg;
}

function showBattleMainMenu() {
  document.getElementById("battleMainMenu").hidden = false;
  document.getElementById("battleMovesMenu").hidden = true;
  document.getElementById("battleBagMenu").hidden = true;
}

function openMovesMenu() {
  if (state.battle.busy) return;
  const menu = document.getElementById("battleMovesMenu");
  menu.innerHTML = "";
  const p = getActivePlayer();

  p.moves.forEach((moveId) => {
    const mv = MOVES[moveId];
    const btn = document.createElement("button");
    btn.className = "act-btn";
    btn.innerHTML = `${mv.name} <small>${mv.type}${mv.power ? ` · ${mv.power} PWR` : ""}</small>`;
    btn.addEventListener("click", () => executePlayerMove(moveId));
    menu.appendChild(btn);
  });

  document.getElementById("battleMainMenu").hidden = true;
  menu.hidden = false;
}

function openBagMenu() {
  if (state.battle.busy) return;
  document.getElementById("battleMainMenu").hidden = true;
  document.getElementById("battleBagMenu").hidden = false;
}

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

function triggerHitAnim(targetId) {
  const el = document.getElementById(targetId);
  el.classList.remove("sprite-hit");
  void el.offsetWidth;
  el.classList.add("sprite-hit");
}

function calculateDamage(attacker, defender, move, atkBoost) {
  const mult = (TYPE_CHART[move.type] && TYPE_CHART[move.type][defender.type]) || 1;
  const stab = attacker.type === move.type ? 1.25 : 1;
  const crit = Math.random() < 0.08 ? 1.5 : 1;
  const variance = 0.88 + Math.random() * 0.17;
  const raw = (((2 * attacker.level) / 5 + 2) * move.power * ((attacker.atk * atkBoost) / defender.def)) / 22 + 2;
  return {
    dmg: Math.max(1, Math.round(raw * stab * mult * crit * variance)),
    mult,
    crit: crit > 1
  };
}

async function executePlayerMove(moveId) {
  if (state.battle.busy) return;
  state.battle.busy = true;
  showBattleMainMenu();

  const p = getActivePlayer();
  const e = getActiveEnemy();
  const mv = MOVES[moveId];

  setBattleLog(`${p.name} used ${mv.name}!`);
  await wait(650);

  if (mv.kind === "heal") {
    const healAmt = Math.max(6, Math.round(p.maxHp * 0.35));
    p.hp = Math.min(p.maxHp, p.hp + healAmt);
    SFX.heal();
    renderBattleUI();
    setBattleLog(`${p.name} restored ${healAmt} HP!`);
  } else if (mv.kind === "buff") {
    state.battle.playerAtkBoost = Math.min(2.0, state.battle.playerAtkBoost + 0.25);
    SFX.select();
    setBattleLog(`${p.name}'s Attack rose!`);
  } else {
    const { dmg, mult, crit } = calculateDamage(p, e, mv, state.battle.playerAtkBoost);
    e.hp = Math.max(0, e.hp - dmg);
    mult > 1 ? SFX.superHit() : SFX.hit();
    triggerHitAnim("enemySprite");
    renderBattleUI();

    let note = "";
    if (mult > 1) note = " It's super effective!";
    else if (mult < 1) note = " It's not very effective...";
    if (crit) note += " Critical hit!";
    setBattleLog(`${p.name} dealt ${dmg} damage!${note}`);
  }

  await wait(850);

  if (e.hp <= 0) {
    await handleEnemyDefeated();
    return;
  }

  await executeEnemyTurn();
}

async function executeEnemyTurn() {
  const p = getActivePlayer();
  const e = getActiveEnemy();
  const moveId = e.moves[Math.floor(Math.random() * e.moves.length)];
  const mv = MOVES[moveId];

  setBattleLog(`Foe ${e.name} used ${mv.name}!`);
  await wait(650);

  if (mv.kind === "heal") {
    const healAmt = Math.max(5, Math.round(e.maxHp * 0.3));
    e.hp = Math.min(e.maxHp, e.hp + healAmt);
    SFX.heal();
    renderBattleUI();
    setBattleLog(`Foe ${e.name} recovered ${healAmt} HP!`);
  } else if (mv.kind === "buff") {
    state.battle.enemyAtkBoost = Math.min(2.0, state.battle.enemyAtkBoost + 0.25);
    setBattleLog(`Foe ${e.name}'s Attack rose!`);
  } else {
    const { dmg, mult } = calculateDamage(e, p, mv, state.battle.enemyAtkBoost);
    p.hp = Math.max(0, p.hp - dmg);
    mult > 1 ? SFX.superHit() : SFX.hit();
    triggerHitAnim("playerSprite");
    renderBattleUI();
    const eff = mult > 1 ? " Super effective!" : mult < 1 ? " Not very effective..." : "";
    setBattleLog(`Foe ${e.name} dealt ${dmg} damage!${eff}`);
  }

  await wait(800);

  if (p.hp <= 0) {
    setBattleLog(`${p.name} fainted!`);
    await wait(800);
    const nextHealthy = state.party.findIndex((m) => m.hp > 0);
    if (nextHealthy === -1) {
      setBattleLog("All your monsters fainted! Hurrying back to Nurse Aria...");
      await wait(1300);
      healParty();
      state.player.x = 5;
      state.player.y = 3;
      state.player.px = 5 * TILE_SIZE;
      state.player.py = 3 * TILE_SIZE;
      endBattle();
      showDialog("Nurse Aria healed your exhausted team. Train a little more before big fights!");
      return;
    } else {
      state.battle.mustSwitch = true;
      state.battle.busy = false;
      openPartyModal(true);
      return;
    }
  }

  state.battle.busy = false;
}

async function handleEnemyDefeated() {
  const p = getActivePlayer();
  const e = getActiveEnemy();
  const gainedXp = Math.floor(e.level * 12);

  SFX.win();
  setBattleLog(`${e.name} fainted! ${p.name} gained ${gainedXp} XP!`);
  p.xp += gainedXp;

  while (p.xp >= p.nextXp) {
    p.xp -= p.nextXp;
    p.level++;
    p.nextXp = p.level * 18;
    const sp = SPECIES[p.speciesId];
    const oldMax = p.maxHp;
    p.maxHp = Math.floor(sp.hp + p.level * 4.2);
    p.hp += Math.max(2, p.maxHp - oldMax);
    p.atk = Math.floor(sp.atk + p.level * 1.8);
    p.def = Math.floor(sp.def + p.level * 1.5);
    p.spd = Math.floor(sp.spd + p.level * 1.4);
    renderBattleUI();
    setBattleLog(`${p.name} grew to Level ${p.level}!`);
    await wait(900);
  }

  // Check if trainer has more monsters
  if (state.battle.enemyIndex + 1 < state.battle.enemyTeam.length) {
    state.battle.enemyIndex++;
    state.battle.enemyAtkBoost = 1;
    const nextE = getActiveEnemy();
    renderBattleUI();
    setBattleLog(`${state.battle.trainerName} sent out ${nextE.name} (Lv.${nextE.level})!`);
    await wait(900);
    state.battle.busy = false;
    return;
  }

  // Battle Won!
  if (state.battle.isTrainer) {
    state.badges = 1;
    endBattle();
    showDialog("You defeated Champion Kai and earned the Wild Valley Badge! 🎉 Keep exploring to complete your Monsterdex!");
  } else {
    if (Math.random() < 0.5) { state.orbs++; setBattleLog("Found +1 Capture Orb!"); }
    else { state.potions++; setBattleLog("Found +1 Healing Potion!"); }
    await wait(800);
    endBattle();
  }
}

async function useCaptureOrb() {
  if (state.battle.busy) return;
  if (state.battle.isTrainer) {
    setBattleLog("You can't catch another Trainer's monster!");
    return;
  }
  if (state.orbs <= 0) {
    setBattleLog("Out of Capture Orbs! Talk to Nurse Aria for a free restock.");
    return;
  }

  state.battle.busy = true;
  showBattleMainMenu();
  state.orbs--;
  updateHUD();
  renderBattleUI();

  const e = getActiveEnemy();
  setBattleLog(`You threw a Capture Orb at ${e.name}...`);
  SFX.select();
  await wait(850);

  const hpFactor = (3 * e.maxHp - 2 * e.hp) / (3 * e.maxHp);
  const catchChance = Math.min(0.95, Math.max(0.22, hpFactor * 0.78));

  if (Math.random() <= catchChance) {
    SFX.win();
    state.dex.add(e.speciesId);
    if (state.party.length < 6) {
      state.party.push(e);
      setBattleLog(`Gotcha! ${e.name} joined your party!`);
    } else {
      setBattleLog(`Gotcha! ${e.name} was registered to your Monsterdex (Party full 6/6)!`);
    }
    await wait(1200);
    endBattle();
  } else {
    setBattleLog(`Oh no! ${e.name} broke free!`);
    await wait(800);
    await executeEnemyTurn();
  }
}

async function usePotion() {
  if (state.battle.busy) return;
  if (state.potions <= 0) {
    setBattleLog("No Potions left!");
    return;
  }
  const p = getActivePlayer();
  if (p.hp >= p.maxHp) {
    setBattleLog(`${p.name} is already at full HP!`);
    return;
  }

  state.battle.busy = true;
  showBattleMainMenu();
  state.potions--;
  p.hp = Math.min(p.maxHp, p.hp + 25);
  SFX.heal();
  updateHUD();
  renderBattleUI();
  setBattleLog(`Used a Potion! ${p.name} recovered HP!`);
  await wait(850);
  await executeEnemyTurn();
}

async function attemptRun() {
  if (state.battle.busy) return;
  if (state.battle.isTrainer) {
    setBattleLog("Can't run from a Trainer battle!");
    return;
  }
  SFX.select();
  state.battle.busy = true;
  setBattleLog("Got away safely!");
  await wait(650);
  endBattle();
}

function endBattle() {
  document.getElementById("battleView").hidden = true;
  state.battle = null;
  state.mode = "OVERWORLD";
  updateHUD();
  saveGame();
}

/* 12. Party & Monsterdex Modal */
function openPartyModal(inBattle = false) {
  const modal = document.getElementById("partyModal");
  modal.hidden = false;
  switchModalTab("party");

  document.getElementById("partyCountLabel").textContent = state.party.length;
  document.getElementById("dexCountLabel").textContent = state.dex.size;
  document.getElementById("closePartyBtn").hidden = Boolean(state.battle && state.battle.mustSwitch);

  const list = document.getElementById("partyList");
  list.innerHTML = "";

  state.party.forEach((mon, idx) => {
    const item = document.createElement("div");
    item.className = "party-item";
    item.innerHTML = `
      <canvas width="48" height="48"></canvas>
      <div class="party-info">
        <strong>${mon.name} <span class="type-tag type-${mon.type}">${mon.type}</span></strong>
        <small>Lv.${mon.level} · HP ${mon.hp}/${mon.maxHp} · ATK ${mon.atk}</small>
      </div>
    `;
    drawSpriteToCanvas(item.querySelector("canvas"), mon.speciesId);

    const actionBtn = document.createElement("button");
    actionBtn.className = "hud-btn";

    if (inBattle) {
      const isCurrent = idx === state.battle.playerIndex;
      actionBtn.textContent = isCurrent ? "Active" : mon.hp <= 0 ? "Fainted" : "Send Out";
      actionBtn.disabled = isCurrent || mon.hp <= 0;
      actionBtn.addEventListener("click", async () => {
        modal.hidden = true;
        const wasForced = state.battle.mustSwitch;
        state.battle.mustSwitch = false;
        state.battle.playerIndex = idx;
        state.battle.playerAtkBoost = 1;
        state.battle.busy = true;
        renderBattleUI();
        setBattleLog(`Go, ${mon.name}!`);
        await wait(700);
        if (wasForced) {
          state.battle.busy = false;
        } else {
          await executeEnemyTurn();
        }
      });
    } else {
      actionBtn.textContent = idx === 0 ? "Lead" : "Make Lead";
      actionBtn.disabled = idx === 0;
      actionBtn.addEventListener("click", () => {
        const [chosen] = state.party.splice(idx, 1);
        state.party.unshift(chosen);
        saveGame();
        openPartyModal(false);
      });
    }

    item.appendChild(actionBtn);
    list.appendChild(item);
  });

  // Render Monsterdex
  const dex = document.getElementById("dexList");
  dex.innerHTML = "";
  Object.keys(SPECIES).forEach((id) => {
    const sp = SPECIES[id];
    const caught = state.dex.has(id);
    const card = document.createElement("div");
    card.className = `dex-card ${caught ? "" : "unseen"}`;
    card.innerHTML = `
      <canvas width="48" height="48"></canvas>
      <strong>${caught ? sp.name : "???"}</strong>
      <span class="type-tag type-${sp.type}">${sp.type}</span>
    `;
    drawSpriteToCanvas(card.querySelector("canvas"), id);
    dex.appendChild(card);
  });
}

function switchModalTab(tab) {
  const isParty = tab === "party";
  document.getElementById("tabParty").classList.toggle("active", isParty);
  document.getElementById("tabDex").classList.toggle("active", !isParty);
  document.getElementById("partyList").hidden = !isParty;
  document.getElementById("dexList").hidden = isParty;
}
