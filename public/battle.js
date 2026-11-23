const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

let battle = null;
let selectedSkill = null;
let busy = false;
let clockOffset = 0; // server clock minus local clock, for the PvP turn timer

const isPvp = () => battle?.mode === "pvp";

/** Takes a fresh battle from the server. */
function setBattle(b) {
  const turnChanged = !battle || battle.state.turn !== b.state.turn || battle.state.round !== b.state.round;
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
  const whose = isPvp() && s.status === "active" ? (s.turn === "player" ? "ваш ход" : "ход соперника") : "";
  const icon = (side) => (side === "player" ? battle.skills[0].icon : battle.botSkills[0].icon);
  $("round").innerHTML = `<div class="round-title">Раунд ${s.round}</div><div class="round-sub">${whose}` +
    (left === null ? "" : `<span class="turn-timer ${left <= 10 ? "low" : ""}">⏱ ${left} с</span>`) +
    `</div><div class="queue" title="Очередь ходов по инициативе">${battle.queue
      .map((side, i) => `<span class="q ${side} ${i === 0 ? "now" : ""}">${icon(side)}</span>`).join("")}</div>`;
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

function unitPanel(u, side) {
  const effects = [
    u.stunned ? "💫 оглушён" : null,
    u.stunImmune ? "🧿 устойчив к контролю" : null,
    ...u.dots.map((d) => `🔥 ${esc(d.name)} ${d.perTick}×${d.turns}`),
  ].filter(Boolean).join(" · ");
  const pa = u.armor.physical;
  const ma = u.armor.magic;
  return `<div class="unit-portrait ${side}">${unitIcon(side)}</div><div class="unit-info"><div class="unit-name"><b>${esc(u.name)}</b> <span class="muted">ур. ${u.level} · ${esc(u.className)}</span></div>
    ${bar(u.hp, u.maxHp, "hp", `❤️ ${u.hp} / ${u.maxHp}`)}
    <div class="armor-row">${bar(pa.current, pa.max, "parmor", `🛡️ ${pa.current} / ${pa.max}`)}${bar(ma.current, ma.max, "marmor", `🔷 ${ma.current} / ${ma.max}`)}</div>
    ${bar(u.mana, u.maxMana, "mana", `💧 ${u.mana} / ${u.maxMana}`)}
    <div class="muted effects">${effects || "&nbsp;"}</div></div>`;
}

const unitIcon = (side) => (side === "player" ? battle.skills[0].icon : battle.botSkills[0].icon);

function render() {
  const s = battle.state;
  const me = s.units.player;
  const foe = s.units.bot;
  const myTurn = s.status === "active" && s.turn === "player";

  $("panel-player").innerHTML = unitPanel(me, "player");
  $("panel-bot").innerHTML = unitPanel(foe, "bot");
  renderRound();

  const reachable = new Set(battle.reachable.map(([x, y]) => `${x},${y}`));
  const obstacles = new Set(s.obstacles.map(([x, y]) => `${x},${y}`));
  const visible = new Set(battle.visible.map(([x, y]) => `${x},${y}`));
  const skill = selectedSkill && battle.skills.find((k) => k.id === selectedSkill);
  const grid = $("grid");
  grid.style.gridTemplateColumns = `repeat(${s.width}, 1fr)`;
  grid.style.maxWidth = `calc((100vh - 300px) * ${s.width / s.height})`;
  let html = "";
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const key = `${x},${y}`;
      const cls = ["cell"];
      let content = "";
      if (obstacles.has(key)) { cls.push("rock"); content = "🪨"; }
      if (me.x === x && me.y === y) { cls.push("unit", "player"); content = unitIcon("player"); }
      if (foe.x === x && foe.y === y) { cls.push("unit", "bot"); content = unitIcon("bot"); }
      if (myTurn && skill?.target === "enemy" && dist(me.x, me.y, x, y) <= skill.range && visible.has(key) && !obstacles.has(key)) cls.push("in-range");
      else if (myTurn && !skill && reachable.has(key)) cls.push("reach");
      html += `<div class="${cls.join(" ")}" data-x="${x}" data-y="${y}">${content}</div>`;
    }
  }
  grid.innerHTML = html;

  $("economy").innerHTML = [
    `<span class="${me.actionUsed ? "used" : ""}">🟢 Действие ${me.actionUsed ? 0 : 1}/1</span>`,
    `<span class="${me.bonusUsed ? "used" : ""}">🔷 Бонус ${me.bonusUsed ? 0 : 1}/1</span>`,
    `<span class="${me.reactionUsed ? "used" : ""}" title="Реакция срабатывает в ход противника (например, талант «Оппортунист»)">🟣 Реакция ${me.reactionUsed ? 0 : 1}/1</span>`,
    `<span>👣 Ход ${me.movesLeft}/${me.moveRange}</span>`,
  ].join("");

  $("skillbar").innerHTML = battle.skills.map((k, i) => {
    const disabled = Boolean(k.blocker);
    const title = `${k.name}${k.basic ? " (обычная атака)" : ""}: ${k.description}\n${k.cost === "bonus" ? "Бонусное действие" : "Действие"}, ${k.target === "self" ? "на себя" : `дальность ${k.range}`}, мана ${k.mana}${k.cooldown ? `, перезарядка ${k.cooldown}` : ""}${k.blocker ? `\n${k.blocker}` : ""}`;
    return `<button type="button" class="skill ${selectedSkill === k.id ? "selected" : ""} ${disabled ? "off" : ""} ${k.cost}"
      data-skill="${k.id}" title="${esc(title)}">
      <span class="icon">${k.icon}</span><span class="key">${i + 1}</span>
      ${k.cooldownLeft ? `<span class="cd">${k.cooldownLeft}</span>` : ""}
      ${k.mana ? `<span class="cost">${k.mana}</span>` : ""}</button>`;
  }).join("");

  const talents = me.talents.length ? `Таланты: ${me.talents.length}` : "Без талантов";
  $("artifact-mini").innerHTML = `<span class="icon big">${unitIcon("player")}</span><div><b>${esc(me.className)}</b><div class="muted">${talents}</div></div>`;

  $("hint").textContent = !myTurn ? (isPvp() && s.status === "active" ? "Ход соперника. Ждём его действий…" : "") : skill
    ? skill.target === "self" ? "" : `«${skill.name}»: кликните по противнику в красной зоне. Esc — отмена.`
    : `${me.movesLeft ? "Синие клетки — куда можно пойти. " : ""}Выберите умение (1–${battle.skills.length}), чтобы атаковать.`;
  $("end-turn").disabled = !myTurn || busy;
  $("surrender").disabled = s.status !== "active";

  const log = $("log");
  log.innerHTML = s.log.map((l) => `<div>${esc(l)}</div>`).join("");
  log.scrollTop = log.scrollHeight;

  if (s.status !== "active") showResult();
}

function floatText(side, text, cls) {
  const u = battle.state.units[side];
  const cell = $("grid").querySelector(`[data-x="${u.x}"][data-y="${u.y}"]`);
  if (!cell) return;
  const el = document.createElement("div");
  el.className = `float ${cls}`;
  el.textContent = text;
  cell.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function playEvents(events) {
  for (const e of events) {
    if (e.type === "damage") floatText(e.side, e.amount ? `-${e.amount}` : `-${e.armor}${e.damageType === "magic" ? "🔷" : "🛡️"}`, e.amount ? "dmg" : "armor");
    if (e.type === "heal" && e.amount) floatText(e.side, `+${e.amount}`, "heal");
    if (e.type === "armor") floatText(e.side, `+${e.amount}${e.armor === "magic" ? "🔷" : "🛡️"}`, "heal");
    if (e.type === "miss") floatText(e.side, e.reason === "dodge" ? "уклон" : "парир.", "armor");
    if (e.type === "reaction") floatText(e.side, "реакция!", "armor");
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
    $("end-turn").disabled = !(battle.state.status === "active" && battle.state.turn === "player");
  }
}

function selectSkill(id) {
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
  if (!cell || !battle) return;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const foe = battle.state.units.bot;
  if (selectedSkill) {
    if (foe.x === x && foe.y === y) act({ type: "skill", skillId: selectedSkill, x, y });
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

function showResult() {
  if (!$("result").classList.contains("hidden")) return;
  const won = battle.state.status === "won";
  $("again").classList.toggle("hidden", isPvp());
  $("result-title").textContent = won ? "Победа!" : "Поражение";
  const r = battle.rewards;
  $("result-body").innerHTML = r
    ? `<p>Опыт героя: +${r.experience}${r.levelsGained ? ` · новый уровень героя!` : ""}</p>
`
    : "";
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
  const params = new URLSearchParams(location.search);
  const data = params.get("id") ? await api(`/api/battle/${params.get("id")}`) : await api("/api/battle/current");
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
