const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dist = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

let battle = null;
let selectedSkill = null;
let busy = false;

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

function unitPanel(u, artifact) {
  const effects = [
    u.shield ? `🛡️ щит ${u.shield.amount}` : null,
    u.stunned ? "💫 оглушён" : null,
    ...u.dots.map((d) => `🔥 ${esc(d.name)} ${d.perTick}×${d.turns}`),
  ].filter(Boolean).join(" · ");
  return `<div class="unit-name"><b>${esc(u.name)}</b> <span class="muted">ур. ${u.level} · ${artifact.icon} ${esc(artifact.className)}</span></div>
    ${bar(u.hp, u.maxHp, "hp")}${bar(u.mana, u.maxMana, "mana")}
    <div class="muted effects">${effects || "&nbsp;"}</div>`;
}

function render() {
  const s = battle.state;
  const me = s.units.player;
  const foe = s.units.bot;
  const myTurn = s.status === "active" && s.turn === "player";

  $("panel-player").innerHTML = unitPanel(me, battle.playerArtifact);
  $("panel-bot").innerHTML = unitPanel(foe, battle.botArtifact);
  $("round").textContent = `Раунд ${s.round}`;

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
      if (me.x === x && me.y === y) { cls.push("unit", "player"); content = battle.playerArtifact.icon; }
      if (foe.x === x && foe.y === y) { cls.push("unit", "bot"); content = battle.botArtifact.icon; }
      if (myTurn && skill?.target === "enemy" && dist(me.x, me.y, x, y) <= skill.range && visible.has(key) && !obstacles.has(key)) cls.push("in-range");
      else if (myTurn && !skill && reachable.has(key)) cls.push("reach");
      html += `<div class="${cls.join(" ")}" data-x="${x}" data-y="${y}">${content}</div>`;
    }
  }
  grid.innerHTML = html;

  $("economy").innerHTML = [
    `<span class="${me.actionUsed ? "used" : ""}">🟢 Действие ${me.actionUsed ? 0 : 1}/1</span>`,
    `<span class="${me.bonusUsed ? "used" : ""}">🔷 Бонус ${me.bonusUsed ? 0 : 1}/1</span>`,
    `<span>👣 Ход ${me.movesLeft}/${me.moveRange}</span>`,
  ].join("");

  $("skillbar").innerHTML = battle.skills.map((k, i) => {
    const disabled = Boolean(k.blocker);
    const title = `${k.name}: ${k.description}\n${k.cost === "bonus" ? "Бонусное действие" : "Действие"}, ${k.target === "self" ? "на себя" : `дальность ${k.range}`}, мана ${k.mana}${k.cooldown ? `, перезарядка ${k.cooldown}` : ""}${k.blocker ? `\n${k.blocker}` : ""}`;
    return `<button type="button" class="skill ${selectedSkill === k.id ? "selected" : ""} ${disabled ? "off" : ""} ${k.cost}"
      data-skill="${k.id}" title="${esc(title)}">
      <span class="icon">${k.icon}</span><span class="key">${i + 1}</span>
      ${k.cooldownLeft ? `<span class="cd">${k.cooldownLeft}</span>` : ""}
      ${k.mana ? `<span class="cost">${k.mana}</span>` : ""}</button>`;
  }).join("");

  const a = battle.playerArtifact;
  $("artifact-mini").innerHTML = `<span class="icon big">${a.icon}</span><div><b>${esc(a.name)}</b><div class="muted">${esc(a.className)}</div></div>`;

  $("hint").textContent = !myTurn ? "" : skill
    ? skill.target === "self" ? "" : `«${skill.name}»: кликните по противнику в красной зоне. Esc — отмена.`
    : `${me.movesLeft ? "Синие клетки — куда можно пойти. " : ""}Выберите умение (1–4), чтобы атаковать.`;
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
    if (e.type === "damage") floatText(e.side, `-${e.amount}`, "dmg");
    if (e.type === "heal" && e.amount) floatText(e.side, `+${e.amount}`, "heal");
    if (e.type === "shield") floatText(e.side, `🛡️${e.amount}`, "heal");
  }
}

async function act(action) {
  if (busy) return;
  busy = true;
  $("error").textContent = "";
  try {
    const data = await api(`/api/battle/${battle.id}/action`, action);
    battle = data.battle;
    selectedSkill = null;
    render();
    playEvents(data.events);
  } catch (err) {
    $("error").textContent = err.message;
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
  const won = battle.state.status === "won";
  $("result-title").textContent = won ? "Победа!" : "Поражение";
  const r = battle.rewards;
  $("result-body").innerHTML = r
    ? `<p>Опыт героя: +${r.experience}${r.levelsGained ? ` · новый уровень героя!` : ""}</p>
       <p>Опыт артефакта «${esc(r.artifact.name)}»: +${r.artifact.experience}${r.artifact.levelsGained ? ` · новый уровень артефакта!` : ""}</p>
       ${r.droppedArtifact ? `<p>Выпал артефакт: <b>${esc(r.droppedArtifact.name)}</b>. Его можно надеть на главной.</p>` : ""}
       ${r.shards ? `<p>Осколки «${esc(r.shards.name)}»: +${r.shards.amount}</p>` : ""}`
    : "";
  $("result").classList.remove("hidden");
}

$("to-hero").onclick = () => location.assign("/hero");
$("again").onclick = async () => {
  try {
    const data = await api("/api/battle", {});
    battle = data.battle;
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
  battle = data.battle;
  render();
})();
