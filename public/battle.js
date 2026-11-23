// Battle screen: heroes and their army stacks on one grid, a shared initiative queue,
// hero skills or stack moves/attacks depending on who acts, auto battle. Fits one screen.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const AUTO_KEY = "hb.autoBattle";

let battle = null;
let selectedSkill = null;
let busy = false;
let clockOffset = 0; // server clock minus local clock, for the PvP turn timer
let factions = [];
let auto = false;
let autoTimer = null;

const isPvp = () => battle?.mode === "pvp";
const isHeroId = (id) => id === "player" || id === "bot";
const stacks = () => (battle.state.stacks ?? []).filter((st) => st.count > 0);
const stackById = (id) => (battle.state.stacks ?? []).find((st) => st.id === id);
const activeStack = () => (isHeroId(battle.active) ? null : stackById(battle.active));
const myTurn = () => battle.state.status === "active" && battle.state.turn === "player";

// ---------- figures ----------
const unitDefs = new Map();
function figureOfStack(st) {
  const entry = unitDefs.get(st.unitId);
  return entry ? hbFigure(entry.unit, entry.faction) : `<span class="glyph">⚔</span>`;
}
function figureOfHero(side) {
  const fig = battle.state.units[side].figure;
  const f = fig && factions.find((x) => x.id === fig.faction);
  const h = f?.heroes.find((x) => x.id === fig.hero);
  if (h) return hbFigure(h, f);
  return `<span class="glyph">${side === "player" ? battle.skills[0].icon : battle.botSkills[0]?.icon ?? "⚔"}</span>`;
}
const figureOfActor = (id) => (isHeroId(id) ? figureOfHero(id) : stackById(id) ? figureOfStack(stackById(id)) : "");

/** Takes a fresh battle from the server. */
function setBattle(b) {
  const turnChanged = !battle || battle.active !== b.active || battle.state.time !== b.state.time;
  battle = b;
  if (b.serverNow) clockOffset = new Date(b.serverNow).getTime() - Date.now();
  if (turnChanged) selectedSkill = null;
}

function secondsLeft() {
  if (!battle?.turnDeadline) return null;
  return Math.max(0, Math.ceil((new Date(battle.turnDeadline).getTime() - (Date.now() + clockOffset)) / 1000));
}

function renderRound() {
  const s = battle.state;
  const left = s.status === "active" ? secondsLeft() : null;
  const whose = s.status !== "active" ? "" : s.turn === "player" ? "ваш ход" : isPvp() ? "ход соперника" : "ход противника";
  $("round").innerHTML = `<div class="round-title">Раунд ${s.round}</div><div class="round-sub">${whose}` +
    (left === null ? "" : `<span class="turn-timer ${left <= 10 ? "low" : ""}">⏱ ${left} с</span>`) + `</div>`;
}

function renderQueue() {
  $("queue").innerHTML = battle.queue.map((a, i) => {
    const st = !isHeroId(a.id) && stackById(a.id);
    const label = isHeroId(a.id) ? battle.state.units[a.id].name : st ? `${st.name} (${st.count})` : "";
    return `<div class="q ${a.side} ${i === 0 ? "now" : ""} ${isHeroId(a.id) ? "hero" : ""}" title="${esc(label)}">
      ${figureOfActor(a.id)}${st ? `<span class="q-count">${st.count}</span>` : ""}</div>`;
  }).join("");
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  if (res.status === 401) location.assign("/login");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка");
  return data;
}

function bar(cur, max, cls, label) {
  const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  return `<div class="bar ${cls}"><div style="width:${pct}%"></div><span>${label ?? `${cur} / ${max}`}</span></div>`;
}

function sidePanel(side) {
  const u = battle.state.units[side];
  const effects = [
    u.stunned ? "💫 оглушён" : null,
    ...u.dots.map((d) => `🔥 ${esc(d.name)} ${d.turns}`),
  ].filter(Boolean).join(" · ");
  const army = stacks().filter((st) => st.side === side);
  const creatures = army.reduce((sum, st) => sum + st.count, 0);
  return `<div class="side-portrait ${side}">${figureOfHero(side)}<span class="lvl">${u.level}</span></div>
    <div class="side-info"><div class="side-name"><b>${esc(u.name)}</b> <span class="muted">${esc(u.className)}</span></div>
      ${bar(u.hp, u.maxHp, "hp", `${u.hp} / ${u.maxHp}`)}
      <div class="armor-row">${bar(u.armor.physical.current, u.armor.physical.max, "parmor")}${bar(u.armor.magic.current, u.armor.magic.max, "marmor")}</div>
      <div class="side-extra">${bar(u.mana, u.maxMana, "mana")}<span class="muted">${army.length ? `⚑ ${army.length} отр. · ${creatures}` : ""}${effects ? ` · ${effects}` : ""}</span></div>
    </div>`;
}

function renderGrid() {
  const s = battle.state;
  const me = s.units.player;
  const st = activeStack();
  const mine = myTurn();
  const reachable = new Set(battle.reachable.map(([x, y]) => `${x},${y}`));
  const targets = new Set((battle.targets ?? []).map(([x, y]) => `${x},${y}`));
  const obstacles = new Set(s.obstacles.map(([x, y]) => `${x},${y}`));
  const visible = new Set(battle.visible.map(([x, y]) => `${x},${y}`));
  const skill = selectedSkill && battle.skills.find((k) => k.id === selectedSkill);
  const bodies = new Map();
  for (const side of ["player", "bot"]) bodies.set(`${s.units[side].x},${s.units[side].y}`, { side, hero: true, id: side });
  for (const x of stacks()) bodies.set(`${x.x},${x.y}`, { side: x.side, hero: false, id: x.id, st: x });
  const grid = $("grid");
  grid.style.gridTemplateColumns = `repeat(${s.width}, 1fr)`;
  grid.style.width = `min(100cqw, calc(100cqh * ${s.width / s.height}))`;
  const cells = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const key = `${x},${y}`;
      const cls = ["cell"];
      const body = bodies.get(key);
      const content = obstacles.has(key)
        ? `<span class="rock"></span>`
        : body ? `${body.hero ? figureOfHero(body.side) : figureOfStack(body.st)}${body.st ? `<span class="count">${body.st.count}</span>` : ""}` : "";
      if (obstacles.has(key)) cls.push("rock-cell");
      if (body) cls.push("unit", body.side, body.hero ? "hero" : "stack");
      if (body && body.id === battle.active) cls.push("acting");
      if (mine && !st && skill?.target === "enemy" && dist(me.x, me.y, x, y) <= skill.range && visible.has(key) && !obstacles.has(key)) cls.push("in-range");
      else if (mine && st && targets.has(key)) cls.push("target");
      else if (mine && !skill && reachable.has(key)) cls.push("reach");
      cells.push(`<div class="${cls.join(" ")}" data-x="${x}" data-y="${y}">${content}</div>`);
    }
  }
  grid.innerHTML = cells.join("");
}

function renderBottom() {
  const s = battle.state;
  const me = s.units.player;
  const st = activeStack();
  const mine = myTurn();
  if (mine && st) {
    $("actor-card").innerHTML = `<div class="actor-figure">${figureOfStack(st)}<span class="count">${st.count}</span></div>
      <div class="actor-info"><b>${esc(st.name)}</b><div class="muted">ходит отряд · ${st.ranged ? "стрелок" : st.flyer ? "летает" : "ближний бой"}</div>
      <div class="stack-stats"><span title="Атака">⚔ ${st.attack}</span><span title="Защита">🛡 ${st.defense}</span><span title="Урон">🗡 ${st.damage[0]}–${st.damage[1]}</span><span title="Скорость">👣 ${st.speed}</span><span title="Здоровье верхнего">❤ ${st.hpTop}/${st.hpPer}</span></div></div>`;
    $("economy").innerHTML = `<span class="${st.moved ? "used" : ""}">👣 Движение</span><span class="${st.attacked ? "used" : ""}">⚔ Атака</span>${st.retaliated ? "" : `<span title="Ответит на первую атаку в ближнем бою">↩ Ответный удар</span>`}`;
    $("skillbar").innerHTML = stacks().filter((x) => x.side === "player").map((x) => `<div class="army-card ${x.id === st.id ? "selected" : ""}" title="${esc(x.name)}">${figureOfStack(x)}<span class="count">${x.count}</span></div>`).join("");
    $("hint").textContent = `Синие клетки — куда пойти, красные — кого атаковать${st.ranged ? " (стрельба)" : ""}. После атаки ход отряда заканчивается.`;
  } else {
    $("actor-card").innerHTML = `<div class="actor-figure">${figureOfHero("player")}</div>
      <div class="actor-info"><b>${esc(me.name)}</b><div class="muted">${esc(me.className)} · ур. ${me.level}</div>
      ${bar(me.hp, me.maxHp, "hp")}${bar(me.mana, me.maxMana, "mana")}</div>`;
    $("economy").innerHTML = [
      `<span class="${me.actionUsed ? "used" : ""}">🟢 Действие ${me.actionUsed ? 0 : 1}/1</span>`,
      `<span class="${me.bonusUsed ? "used" : ""}">🔷 Бонус ${me.bonusUsed ? 0 : 1}/1</span>`,
      `<span class="${me.reactionUsed ? "used" : ""}">🟣 Реакция ${me.reactionUsed ? 0 : 1}/1</span>`,
      `<span>👣 ${me.movesLeft}/${me.moveRange}</span>`,
    ].join("");
    $("skillbar").innerHTML = battle.skills.map((k, i) => {
      const title = `${k.name}${k.basic ? " (обычная атака)" : ""}: ${k.description}\n${k.cost === "bonus" ? "Бонусное действие" : "Действие"}, ${k.target === "self" ? "на себя" : `дальность ${k.range}`}, мана ${k.mana}${k.cooldown ? `, перезарядка ${k.cooldown}` : ""}${k.blocker ? `\n${k.blocker}` : ""}`;
      return `<button type="button" class="skill ${selectedSkill === k.id ? "selected" : ""} ${k.blocker ? "off" : ""} ${k.cost}" data-skill="${k.id}" title="${esc(title)}">
        <span class="icon">${k.icon}</span><span class="key">${i + 1}</span>
        ${k.cooldownLeft ? `<span class="cd">${k.cooldownLeft}</span>` : ""}${k.mana ? `<span class="cost">${k.mana}</span>` : ""}</button>`;
    }).join("");
    const skill = selectedSkill && battle.skills.find((k) => k.id === selectedSkill);
    $("hint").textContent = !mine
      ? (s.status === "active" ? (isPvp() ? "Ход соперника…" : "Ходит противник…") : "")
      : skill ? `«${skill.name}»: кликните по врагу (герою или отряду) в красной зоне. Esc — отмена.`
        : `${me.movesLeft ? "Синие клетки — куда пойти. " : ""}Умения 1–${battle.skills.length} бьют героя или отряды.`;
  }
  $("end-turn").disabled = !mine || busy || auto;
  $("surrender").disabled = s.status !== "active";
  $("auto").classList.toggle("on", auto);
  $("auto").setAttribute("aria-pressed", String(auto));
  $("auto").textContent = auto ? "⏸ Авто: вкл" : "⚙ Авто бой";
}

function render() {
  $("panel-player").innerHTML = sidePanel("player");
  $("panel-bot").innerHTML = sidePanel("bot");
  renderRound();
  renderQueue();
  renderGrid();
  renderBottom();
  const log = $("log");
  log.innerHTML = battle.state.log.map((l) => `<div>${esc(l)}</div>`).join("");
  log.scrollTop = log.scrollHeight;
  if (battle.state.status !== "active") {
    setAuto(false);
    showResult();
  }
  scheduleAuto();
}

// ---------- floating numbers ----------
function floatAt(x, y, text, cls) {
  const cell = $("grid").querySelector(`[data-x="${x}"][data-y="${y}"]`);
  if (!cell) return;
  const el = document.createElement("div");
  el.className = `float ${cls}`;
  el.textContent = text;
  cell.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
const floatHero = (side, text, cls) => floatAt(battle.state.units[side].x, battle.state.units[side].y, text, cls);

function playEvents(events) {
  for (const e of events) {
    if (e.type === "damage") floatHero(e.side, e.amount ? `-${e.amount}` : `-${e.armor}${e.damageType === "magic" ? "🔷" : "🛡️"}`, e.amount ? "dmg" : "armor");
    if (e.type === "heal" && e.amount) floatHero(e.side, `+${e.amount}`, "heal");
    if (e.type === "armor") floatHero(e.side, `+${e.amount}${e.armor === "magic" ? "🔷" : "🛡️"}`, "heal");
    if (e.type === "miss") floatHero(e.side, e.reason === "dodge" ? "уклон" : "парир.", "armor");
    if (e.type === "stack-damage") {
      const st = stackById(e.id);
      if (st) floatAt(st.x, st.y, `-${e.amount}${e.killed ? ` †${e.killed}` : ""}`, "dmg");
    }
  }
}

async function act(action) {
  if (busy) return;
  busy = true;
  $("error").textContent = "";
  try {
    const data = await api(`/api/battle/${battle.id}/action`, action);
    setBattle(data.battle);
    selectedSkill = null;
    render();
    playEvents(data.events);
  } catch (err) {
    $("error").textContent = err.message;
    if (isPvp()) refresh();
  } finally {
    busy = false;
    $("end-turn").disabled = !(myTurn() && !auto);
    scheduleAuto();
  }
}

// ---------- auto battle ----------
function setAuto(on) {
  auto = on;
  try { sessionStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch {}
  if (!on) clearTimeout(autoTimer);
  if (battle) renderBottom();
}
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!auto || !battle || !myTurn() || busy) return;
  autoTimer = setTimeout(() => { if (auto && myTurn() && !busy) act({ type: "auto" }); }, 450);
}
$("auto").onclick = () => { setAuto(!auto); scheduleAuto(); };

// ---------- input ----------
function selectSkill(id) {
  if (activeStack()) return;
  const k = battle.skills.find((s) => s.id === id);
  if (!k) return;
  if (k.blocker) { $("error").textContent = k.blocker; return; }
  $("error").textContent = "";
  if (k.target === "self") {
    const me = battle.state.units.player;
    return act({ type: "skill", skillId: k.id, x: me.x, y: me.y });
  }
  selectedSkill = selectedSkill === id ? null : id;
  render();
}

$("skillbar").onclick = (e) => {
  const btn = e.target.closest("[data-skill]");
  if (btn) selectSkill(btn.dataset.skill);
};

$("grid").onclick = (e) => {
  const cell = e.target.closest(".cell");
  if (!cell || !battle || !myTurn() || auto) return;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  if (activeStack()) {
    if (cell.classList.contains("target")) return act({ type: "attack", x, y });
    if (cell.classList.contains("reach")) return act({ type: "move", x, y });
    return;
  }
  if (selectedSkill) {
    if (cell.classList.contains("in-range") && cell.classList.contains("unit") && !cell.classList.contains("player")) act({ type: "skill", skillId: selectedSkill, x, y });
    else { selectedSkill = null; render(); }
    return;
  }
  if (cell.classList.contains("reach")) act({ type: "move", x, y });
};

document.addEventListener("keydown", (e) => {
  if (!battle || e.target.tagName === "INPUT") return;
  if (e.key === "Escape") { selectedSkill = null; render(); }
  const n = Number(e.key);
  if (n >= 1 && n <= battle.skills.length) selectSkill(battle.skills[n - 1].id);
});

$("end-turn").onclick = () => act({ type: "end_turn" });
$("surrender").onclick = () => {
  if (confirm("Сдаться? Бой будет засчитан как поражение.")) act({ type: "surrender" });
};

// Log / battle chat tabs; on narrow screens the side panel opens over the field.
document.querySelector(".side-tabs").onclick = (e) => {
  const pane = e.target.closest("button")?.dataset.pane;
  if (!pane) return;
  for (const b of document.querySelectorAll(".side-tabs button")) b.classList.toggle("active", b.dataset.pane === pane);
  $("log").classList.toggle("hidden", pane !== "log");
  $("chat-slot").classList.toggle("hidden", pane !== "chat");
};
$("side-toggle").onclick = () => $("bf-side").classList.toggle("open");

function showResult() {
  if (!$("result").classList.contains("hidden")) return;
  const won = battle.state.status === "won";
  $("again").classList.toggle("hidden", isPvp());
  $("result-title").textContent = won ? "Победа!" : "Поражение";
  const r = battle.rewards;
  $("result-body").innerHTML = r ? `<p>Опыт героя: +${r.experience}${r.levelsGained ? ` · новый уровень героя!` : ""}</p>` : "";
  $("result").classList.remove("hidden");
}

$("to-hero").onclick = () => location.assign("/hero");
$("again").onclick = async () => {
  try {
    const data = await api("/api/battle", {});
    setBattle(data.battle);
    $("result").classList.add("hidden");
    render();
  } catch (err) {
    $("result-body").textContent = err.message;
  }
};

(async () => {
  try { auto = sessionStorage.getItem(AUTO_KEY) === "1"; } catch {}
  const params = new URLSearchParams(location.search);
  const [catalog, data] = await Promise.all([
    api("/api/factions").catch(() => ({ factions: [] })),
    params.get("id") ? api(`/api/battle/${params.get("id")}`) : api("/api/battle/current"),
  ]);
  factions = catalog.factions;
  for (const f of factions) for (const t of f.tiers) for (const u of t.units) unitDefs.set(u.id, { unit: u, faction: f });
  if (!data.battle) return location.assign("/hero");
  setBattle(data.battle);
  render();
})();

// PvP: the opponent's moves arrive as "battle" events over the chat socket; polling is the fallback.
let refreshing = false;
async function refresh() {
  if (!battle || !isPvp() || refreshing) return;
  refreshing = true;
  try {
    const data = await api(`/api/battle/${battle.id}`);
    const before = JSON.stringify(battle.state);
    setBattle(data.battle);
    if (JSON.stringify(battle.state) !== before) render();
  } catch {} finally {
    refreshing = false;
  }
}

window.addEventListener("hb:ws", (e) => {
  if (e.detail.type === "battle" && battle && e.detail.battleId === battle.id) refresh();
});

setInterval(() => {
  if (!battle || !isPvp() || battle.state.status !== "active") return;
  renderRound();
  // When time is up the server ends the turn within a couple of seconds.
  if (secondsLeft() === 0) refresh();
}, 1000);
setInterval(() => {
  if (battle && isPvp() && battle.state.status === "active" && battle.state.turn !== "player") refresh();
}, 4000);
