const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const EFFECT_TEXT = {
  damage: (e) => `урон ×${e.power}`,
  heal: (e) => `лечение ×${e.power}`,
  shield: (e) => `щит ${e.percent}% на ${e.turns} х.`,
  dot: (e) => `${e.name.toLowerCase()} ×${e.power} на ${e.turns} х.`,
  stun: (e) => `оглушение ${e.turns} х.`,
};

function skillHtml(s) {
  const meta = [
    s.cost === "bonus" ? "бонус" : "действие",
    s.target === "self" ? "на себя" : `дальность ${s.range}`,
    s.mana ? `${s.mana} маны` : null,
    s.cooldown ? `перезарядка ${s.cooldown}` : null,
  ].filter(Boolean).join(" · ");
  const effects = s.effects.map((e) => EFFECT_TEXT[e.type](e)).join(", ");
  return `<div class="skill-row"><span class="icon">${s.icon}</span><div><b>${esc(s.name)}</b>
    <div class="muted">${esc(s.description)}</div><div class="muted">${meta} · ${effects}</div></div></div>`;
}

function bonusText(b) {
  const names = { health: "здоровье", attack: "атака", defense: "защита", speed: "скорость", mana: "мана" };
  return Object.entries(b).filter(([, v]) => v).map(([k, v]) => `+${v} ${names[k]}`).join(", ");
}

let state = { hero: null, artifacts: [], needsStarter: false };

async function load() {
  const res = await fetch("/api/hero");
  if (res.status === 401) return location.assign("/login");
  const { hero } = await res.json();
  state.hero = hero;
  $("hero-name").textContent = hero.name;
  $("level").textContent = `Уровень ${hero.level}`;
  $("xp-text").textContent = `${hero.experience} / ${hero.experienceToNext} опыта`;
  $("xp-bar").style.width = `${Math.min(100, (hero.experience / hero.experienceToNext) * 100)}%`;
  const c = hero.combat;
  const withBonus = (base, total) => (c && total !== base ? `${total} <small class="bonus">(+${total - base})</small>` : base);
  $("health").innerHTML = withBonus(hero.health, c?.maxHp);
  $("attack").innerHTML = withBonus(hero.attack, c?.attack);
  $("defense").innerHTML = withBonus(hero.defense, c?.defense);
  $("speed").innerHTML = withBonus(hero.speed, c?.speed);
  $("mana").textContent = c ? c.maxMana : "—";
  $("move").textContent = c ? `${c.moveRange} кл.` : "—";
  $("wins").textContent = hero.wins;
  $("losses").textContent = hero.losses;
  $("owner").textContent = `Игрок: ${hero.username}.`;

  const a = hero.artifact;
  $("artifact-panel").innerHTML = a
    ? `<div class="artifact-head"><span class="icon big">${a.icon}</span><div><b>${esc(a.name)}</b>
         <div class="muted">${esc(a.className)} · ${bonusText(a.bonuses)}</div></div></div>
       <p class="muted">${esc(a.description)}</p>${a.skills.map(skillHtml).join("")}`
    : `<p class="muted">Артефакт не выбран.</p>`;

  const cur = await fetch("/api/battle/current").then((r) => r.json());
  $("fight").textContent = cur.battle ? "Продолжить бой" : "В бой против бота";
  $("fight").disabled = !a && !cur.battle;

  if (hero.needsStarterArtifact) openModal(true);
}

async function openModal(starter) {
  const data = await fetch("/api/artifacts").then((r) => r.json());
  state.needsStarter = data.needsStarter;
  const list = starter ? data.artifacts.filter((a) => a.starter) : data.artifacts;
  $("modal-title").textContent = starter ? "Выберите первый артефакт" : "Артефакты";
  $("modal-hint").textContent = starter
    ? "Артефакт определяет класс героя: бонусы и умения. Остальные артефакты можно будет выбить в бою."
    : "Сменить можно только на артефакт, который у вас есть. Остальные выпадают после побед над ботом.";
  $("modal-close").classList.toggle("hidden", starter);
  $("modal-error").textContent = "";
  $("artifact-list").innerHTML = list.map((a) => {
    let btn;
    if (starter) btn = `<button data-pick="${a.id}">Выбрать</button>`;
    else if (a.equipped) btn = `<button disabled>Надет</button>`;
    else if (a.owned) btn = `<button data-equip="${a.id}">Надеть</button>`;
    else btn = `<button disabled>Нет (добыча / крафт)</button>`;
    return `<div class="artifact-card ${a.owned || starter ? "" : "locked"}">
      <div class="artifact-head"><span class="icon big">${a.icon}</span><div><b>${esc(a.name)}</b>
        <div class="muted">${esc(a.className)} · ${bonusText(a.bonuses)} · ход ${a.moveRange} кл.</div></div></div>
      <p class="muted">${esc(a.description)}</p>
      <details><summary>Умения</summary>${a.skills.map(skillHtml).join("")}</details>
      ${btn}</div>`;
  }).join("");
  $("artifact-modal").classList.remove("hidden");
}

$("artifact-list").onclick = async (e) => {
  const pick = e.target.dataset.pick;
  const equip = e.target.dataset.equip;
  if (!pick && !equip) return;
  const res = await fetch(pick ? "/api/artifacts/starter" : "/api/artifacts/equip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifactId: pick || equip }),
  });
  if (!res.ok) {
    $("modal-error").textContent = (await res.json().catch(() => ({}))).error || "Ошибка";
    return;
  }
  $("artifact-modal").classList.add("hidden");
  load();
};

$("change-artifact").onclick = () => openModal(false);
$("modal-close").onclick = () => $("artifact-modal").classList.add("hidden");

$("fight").onclick = async () => {
  $("fight").disabled = true;
  const res = await fetch("/api/battle", { method: "POST" });
  if (res.ok) return location.assign("/battle");
  $("fight-error").textContent = (await res.json().catch(() => ({}))).error || "Ошибка";
  $("fight").disabled = false;
};

$("logout").onclick = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.assign("/login");
};

load();
