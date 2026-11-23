const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const STAT_HINTS = {
  strength: "урон силовых умений, шанс парирования",
  dexterity: "урон ловких умений, шанс уклонения",
  intellect: "магический урон, мана, магическая броня",
  mastery: "слоты умений в бою",
  initiative: "частота ходов и перемещение",
  stamina: "здоровье и броня",
};
const DMG = { physical: "физ.", magic: "маг." };
const STAT_SHORT = { strength: "Сила", dexterity: "Ловкость", intellect: "Интеллект" };

let catalog = null;
let hero = null;
let tab = "classes";
let factions = [];
let pickedFaction = null;

const classDef = (id) => catalog.classes.find((c) => c.id === id);
const allSkills = () => {
  const map = new Map();
  for (const c of catalog.classes) for (const s of [c.basic, ...c.skills]) map.set(s.id, s);
  for (const h of catalog.hybrids) for (const s of h.skills) map.set(s.id, s);
  return map;
};

function effectText(e) {
  switch (e.type) {
    case "damage": return `урон ${DMG[e.damageType]} ${e.power}×${STAT_SHORT[e.stat]}${e.hits > 1 ? ` ×${e.hits}` : ""}${e.executeBelow ? `, ×2 если HP < ${e.executeBelow * 100}%` : ""}`;
    case "heal": return `лечение ${e.power}×${STAT_SHORT[e.stat]}`;
    case "armor": return `броня ${e.armor === "both" ? "обе" : DMG[e.armor]} +${e.percent}%`;
    case "dot": return `${e.name.toLowerCase()} ${e.power}×${STAT_SHORT[e.stat]} на ${e.turns} х.`;
    case "stun": return `${e.name.toLowerCase()} ${e.turns} х. (если пробита ${DMG[e.gate]} броня)`;
  }
  return "";
}

function skillHtml(s, extra = "") {
  const meta = [
    s.cost === "bonus" ? "бонус" : "действие",
    s.target === "self" ? "на себя" : `дальность ${s.range}`,
    s.mana ? `${s.mana} маны` : null,
    s.cooldown ? `перезарядка ${s.cooldown}` : null,
  ].filter(Boolean).join(" · ");
  return `<div class="skill-row">${extra}<span class="icon">${s.icon}</span><div><b>${esc(s.name)}</b>
    <div class="muted">${esc(s.description)}</div><div class="muted">${meta} · ${s.effects.map(effectText).join(", ")}</div></div></div>`;
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  if (res.status === 401) location.assign("/login");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ошибка");
  return data;
}

async function saveBuild(build) {
  $("build-error").textContent = "";
  try {
    const data = await api("/api/hero/build", { build });
    hero = { ...hero, ...data.hero };
    render();
  } catch (err) {
    $("build-error").textContent = err.message;
  }
}

const cloneBuild = () => JSON.parse(JSON.stringify(hero.build));

const STAT_ICONS = { strength: "✊", dexterity: "🪶", intellect: "📖", mastery: "🔮", initiative: "⏳", stamina: "🛡️" };

function vitalBar(name, cls, value) {
  return `<div class="vital"><span class="vital-name">${name}</span><div class="bar ${cls}"><div style="width:100%"></div><span>${value} / ${value}</span></div></div>`;
}

function render() {
  const h = hero;
  $("hero-name").textContent = h.name;
  $("class-title").textContent = h.needsClass ? "Герой не выбран" : h.className;
  renderFaction();
  $("level").textContent = `Уровень ${h.level}`;
  $("xp-text").textContent = `(${h.experience} / ${h.experienceToNext} опыта)`;
  $("xp-bar").style.width = `${Math.min(100, (h.experience / h.experienceToNext) * 100)}%`;
  $("class-line").textContent = h.build.classes.map((c) => `${classDef(c.id).name} ${ROMAN[c.rank]}`).join(" + ");
  const p = h.profile;
  $("stats").innerHTML = p
    ? Object.entries(catalog.statNames).map(([k, name]) => `<div class="stat-row" title="${esc(STAT_HINTS[k])}">
        <span class="stat-icon">${STAT_ICONS[k] ?? "•"}</span><span class="stat-name">${name}</span><b>${p.stats[k]}</b></div>`).join("")
    : `<p class="muted">Выберите класс, чтобы увидеть характеристики.</p>`;
  $("vitals").innerHTML = p
    ? vitalBar("Здоровье", "hp", p.maxHp) + vitalBar("Физическая броня", "parmor", p.physicalArmor) +
      vitalBar("Магическая броня", "marmor", p.magicArmor) + vitalBar("Мана", "mana", p.maxMana)
    : "";
  $("derived").innerHTML = p
    ? [
        ["Перемещение", `${p.moveRange} кл.`],
        ["Скорость ходов", `+${Math.round(p.speedBonus * 100)}%`],
        ["Уклонение", `${Math.round(p.dodge * 100)}%`],
        ["Парирование", `${Math.round(p.parry * 100)}%`],
      ].map(([n, v]) => `<div class="stat"><span>${n}</span><b>${v}</b></div>`).join("")
    : "";
  $("pvp").textContent = `${h.wins} / ${h.losses}`;
  $("bot").textContent = `${h.botWins} / ${h.botLosses}`;
  for (const b of $("tabs").querySelectorAll("button")) b.classList.toggle("active", b.dataset.tab === tab);
  $("tab-body").innerHTML = { classes: classesTab, skills: skillsTab, talents: talentsTab, relic: relicTab }[tab]();
}

// Read-only: the class lines come from the faction hero and grow with the level.
function classesTab() {
  const f = factions.find((x) => x.id === hero.faction);
  const fh = f?.heroes.find((x) => x.id === hero.factionHero);
  if (!fh) return `<p class="muted">Выберите фракцию и героя, чтобы увидеть его боевые направления.</p>`;
  const now = new Map(hero.build.classes.map((c) => [c.id, c.rank]));
  const rows = fh.classes.map((line, i) => {
    const def = classDef(line.id);
    const spec = def.specs.find((s) => s.id === line.spec);
    const rank = now.get(line.id);
    return `<div class="class-row ${rank ? "" : "locked"}">
      <span class="icon big">${def.icon}</span>
      <div class="grow"><b>${esc(def.name)} ${rank ? ROMAN[rank] : ""}</b> <span class="muted">${i === 0 ? "основное направление" : "второе направление"}</span>
        <div>${esc(spec?.name ?? "")}: <span class="muted">${esc(spec?.description ?? "")}</span></div>
        ${rank ? "" : `<div class="muted">🔒 Откроется на 6 уровне</div>`}</div></div>`;
  }).join("");
  return `<p class="muted">Боевые направления героя «${esc(fh.name)}» заданы фракцией. Ранг растёт сам: +1 каждый 3-й уровень,
      второе направление (если есть) открывается на 6 уровне и получает треть рангов. От направлений зависят характеристики и умения.</p>
    ${rows}`;
}

function skillsTab() {
  const map = allSkills();
  const { profile, availableSkills, build, limits } = hero;
  if (!profile) return "";
  const basicSkill = map.get(profile.basicSkill);
  const chosen = new Set(profile.skills);
  const rows = availableSkills.map((id) => {
    const s = map.get(id);
    const box = `<input type="checkbox" data-skill="${id}" ${chosen.has(id) ? "checked" : ""}>`;
    return skillHtml(s, box);
  }).join("");
  const locked = build.classes.flatMap((c) => classDef(c.id).skills.filter((s) => !availableSkills.includes(s.id)).map((s) => ({ s, c })));
  const lockedHtml = locked.map(({ s, c }) => {
    const def = classDef(c.id);
    const why = s.rank > c.rank ? `нужен ${def.name} ${ROMAN[s.rank]}` : `специализация «${def.specs.find((x) => x.id === s.spec)?.name}»`;
    return `<div class="muted locked">${s.icon} ${esc(s.name)} — ${why}</div>`;
  }).join("");
  return `<p class="muted">Слоты умений в бою: ${chosen.size} / ${limits.skillSlots} (Мастерство: +1 слот за каждые ${catalog.rules.MASTERY_PER_SLOT}). Обычная атака всегда доступна.</p>
    ${skillHtml(basicSkill, `<input type="checkbox" checked disabled>`)}${rows}
    ${lockedHtml ? `<p><b>Пока недоступны</b></p>${lockedHtml}` : ""}`;
}

function talentsTab() {
  const { build, limits } = hero;
  const head = limits.talentSlots
    ? `<p class="muted">Талантов: ${build.talents.length} / ${limits.talentSlots}. Новый талант каждые ${catalog.rules.TALENT_EVERY} уровня.</p>`
    : `<p class="muted">Первый талант откроется на ${catalog.rules.TALENT_EVERY}-м уровне.</p>`;
  return head + catalog.talents.map((t) => {
    const on = build.talents.includes(t.id);
    const conflict = !on && t.group && build.talents.some((id) => catalog.talents.find((x) => x.id === id)?.group === t.group);
    const disabled = !on && (conflict || build.talents.length >= limits.talentSlots);
    return `<div class="skill-row"><input type="checkbox" data-talent="${t.id}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}>
      <span class="icon">${t.icon}</span><div><b>${esc(t.name)}</b><div class="muted">${esc(t.description)}${conflict ? " Нельзя вместе с похожим талантом." : ""}</div></div></div>`;
  }).join("");
}

function relicTab() {
  const r = hero.relic;
  if (!r) return "";
  const maxTier = r.tier + r.nextTiers.length;
  const pips = Array.from({ length: maxTier }, (_, i) => `<span class="pip ${i < r.tier ? "on" : ""}"></span>`).join("");
  return `<div class="relic"><div class="relic-art">🗡️</div><div class="relic-info">
    <div class="relic-kind">Личная реликвия · всегда с героем, не теряется</div>
    <h3>${esc(r.name)}</h3>
    <div class="pips" title="Ступень ${r.tier} из ${maxTier}">${pips}<span class="muted">ступень ${r.tier}</span></div>
    <p class="relic-effect">${esc(r.effect)}</p>
    ${r.nextTiers.map((t) => `<div class="relic-next">🔒 ${esc(t)}</div>`).join("")}
    <p class="muted">Свойства зависят от ваших классов.</p></div></div>`;
}

$("tabs").onclick = (e) => {
  const t = e.target.dataset.tab;
  if (t) { tab = t; render(); }
};

$("tab-body").onchange = (e) => {
  const d = e.target.dataset;
  const build = cloneBuild();
  if (d.skill) {
    const current = new Set(hero.profile.skills);
    if (e.target.checked) current.add(d.skill); else current.delete(d.skill);
    build.loadout = [...current];
    if (build.loadout.length === 0) { e.target.checked = true; $("build-error").textContent = "Нужно хотя бы одно умение"; return; }
    if (build.loadout.length > hero.limits.skillSlots) { e.target.checked = false; $("build-error").textContent = "Все слоты заняты"; return; }
    return saveBuild(build);
  }
  if (d.talent) {
    build.talents = e.target.checked ? [...build.talents, d.talent] : build.talents.filter((t) => t !== d.talent);
    return saveBuild(build);
  }
};

$("fight").onclick = async () => {
  $("fight").disabled = true;
  const res = await fetch("/api/battle", { method: "POST" });
  if (res.ok) return location.assign("/battle");
  $("fight-error").textContent = (await res.json().catch(() => ({}))).error || "Ошибка";
  $("fight").disabled = false;
};

(async () => {
  [catalog, { hero }, { factions }] = await Promise.all([api("/api/classes"), api("/api/hero"), api("/api/factions")]);
  render();
  renderNews();
  if (!hero.factionHero) openFactionModal();
  checkOwnChallenge();
})();

// While your PvP challenge is open, bot battles are not available.
async function checkOwnChallenge() {
  const pvp = await fetch("/api/challenges").then((r) => r.json()).catch(() => null);
  if (!pvp?.challenges?.some((ch) => ch.mine)) return;
  $("fight").disabled = true;
  $("fight-error").textContent = "Открыта ваша PvP-заявка: пока она ждёт соперника, бой с ботом недоступен.";
}

// Someone joined your PvP challenge: the battle starts right away.
window.addEventListener("hb:ws", (e) => {
  if (e.detail.type === "battle-start") location.assign("/battle");
});

// ---------- Faction, faction hero and army ----------
const factionOf = (id) => factions.find((f) => f.id === id);
const ROMAN_TIER = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

function renderFaction() {
  const f = factionOf(hero.faction);
  const fh = f?.heroes.find((x) => x.id === hero.factionHero);
  $("portrait").innerHTML = fh
    ? hbFigure(fh, f)
    : `<span class="portrait-icon">${hero.build.classes[0] ? classDef(hero.build.classes[0].id).icon : "⚔️"}</span>`;
  $("portrait").style.setProperty("--fc", f?.color ?? "transparent");
  $("faction-line").innerHTML = f
    ? `<a class="faction-name" style="--fc:${f.color}" href="/wiki/factions">${esc(f.name)}</a>`
    : `<button type="button" class="link" id="pick-faction">не выбрана — выбрать</button>`;
  if (!f) $("pick-faction").onclick = openFactionModal;
  renderRelicBox(f, fh);
  $("army-panel").classList.toggle("hidden", !f);
  if (!f) return;
  document.documentElement.style.setProperty("--faction", f.color);
  const unitOf = (id) => f.tiers.flatMap((t) => t.units).find((u) => u.id === id);
  const slots = Array.from({ length: hero.armyLimits.maxStacks }, (_, i) => hero.army[i]);
  $("army-strip").innerHTML = slots.map((st) => {
    const u = st && unitOf(st.unitId);
    return u
      ? `<a class="slot" href="/army" title="${esc(u.name)}">${hbFigure(u, f)}<span class="slot-count">${st.count}</span><span class="slot-tier">${ROMAN_TIER[u.tier]}</span></a>`
      : `<a class="slot empty" href="/army" title="Пустой слот"></a>`;
  }).join("");
  const total = hero.army.reduce((sum, st) => sum + st.count, 0);
  $("army-total").textContent = `${total} сущ.`;
  $("army-total").title = `Лидерство ${hero.armyLimits.used} / ${hero.armyLimits.leadership}`;
}

// The faction hero's legendary relic and its three stages (stage = hero.relic.tier).
function renderRelicBox(f, fh) {
  if (!fh || !hero.relic) {
    $("relic-box").innerHTML = `<div class="note">При создании персонажа вы выбираете фракцию и одного из её четырёх героев.
      У каждого героя своя легендарная реликвия, она усиливается по мере развития.</div>`;
    return;
  }
  const stages = [1, 2, 3].map((n) => `<div class="relic-stage ${n <= hero.relic.tier ? "on" : ""}">
      <div class="token">${hbFigure(fh, f)}</div><span>${"★".repeat(n)}</span></div>`).join('<span class="arrow">→</span>');
  $("relic-box").innerHTML = `<div class="relic-title">Легендарная реликвия:</div>
    <div class="relic-name">${esc(fh.relic.name)}</div>
    <div class="relic-stages">${stages}</div>
    <div class="note">${esc(fh.relic.description)} Реликвия всегда с героем и не теряется.</div>`;
}

// Latest changelog entries as news.
async function renderNews() {
  try {
    const page = await api("/api/wiki/changelog");
    const doc = new DOMParser().parseFromString(page.html, "text/html");
    const items = [...doc.querySelectorAll("h2")].slice(0, 5).map((h) => `<li><a href="/wiki/changelog">${esc(h.textContent)}</a></li>`);
    $("news").innerHTML = items.join("") || `<li class="muted">Пока пусто</li>`;
  } catch {
    $("news").innerHTML = `<li class="muted">Не удалось загрузить</li>`;
  }
}

function openFactionModal() {
  pickedFaction = hero.faction ?? pickedFaction ?? factions[0].id;
  const hasHero = Boolean(hero.factionHero);
  $("faction-modal-title").textContent = hasHero ? "Сменить фракцию или героя" : "Выберите фракцию и героя";
  $("faction-modal-hint").textContent = hasHero
    ? "Сменить можно в любой момент вне боя, бесплатно. Новый герой той же фракции сохраняет армию, при смене фракции армия заменится стартовой армией новой фракции."
    : "От фракции зависят герой и войска. Фракцию и героя можно будет сменить позже.";
  $("faction-close").classList.toggle("hidden", !hasHero);
  $("faction-error").textContent = "";
  renderFactionModal();
  $("faction-modal").classList.remove("hidden");
}

function renderFactionModal() {
  $("faction-tabs").innerHTML = factions.map((f) => `<button type="button" class="faction-tab ${f.id === pickedFaction ? "active" : ""}"
      style="--fc:${f.color}" data-faction="${f.id}">
      <span class="banner"></span><b>${esc(f.name)}</b><small>${esc(f.motto)}</small></button>`).join("");
  const f = factionOf(pickedFaction);
  const preview = f.tiers.map((t) => t.units[0]);
  $("faction-body").innerHTML = `
    <p class="faction-desc">${esc(f.description)}</p>
    <div class="hero-choices">${f.heroes.map((h) => `
      <article class="hero-choice ${h.id === hero.factionHero ? "current" : ""}" style="--fc:${f.color}">
        <div class="token big">${hbFigure(h, f)}</div>
        <b>${esc(h.name)}</b><span class="muted">${esc(h.title)}</span>
        <p>${esc(h.description)}</p>
        <div class="relic-line" title="${esc(h.relic.description)}">🗡️ ${esc(h.relic.name)}</div>
        <div class="muted">${esc(h.relic.description)}</div>
        <div class="bonus-line">${esc(h.armyBonus)}</div>
        <button type="button" class="btn-primary" data-hero="${h.id}" ${h.id === hero.factionHero ? "disabled" : ""}>
          ${h.id === hero.factionHero ? "Ваш герой" : f.id === hero.faction || !hero.faction ? "Выбрать" : "Сменить фракцию"}</button>
      </article>`).join("")}</div>
    <h3 class="section-title">Войска фракции</h3>
    <div class="army-strip preview">${preview.map((u) => `<div class="slot" title="${esc(u.name)}">${hbFigure(u, f)}<span class="slot-tier">${ROMAN_TIER[u.tier]}</span></div>`).join("")}</div>`;
}

$("faction-tabs").onclick = (e) => {
  const id = e.target.closest("button")?.dataset.faction;
  if (!id) return;
  pickedFaction = id;
  renderFactionModal();
};

$("faction-body").onclick = async (e) => {
  const heroId = e.target.closest("button")?.dataset.hero;
  if (!heroId) return;
  const changesFaction = hero.faction && hero.faction !== pickedFaction;
  if (changesFaction && !confirm(`Сменить фракцию на «${factionOf(pickedFaction).name}»? Текущая армия будет заменена стартовой армией новой фракции.`)) return;
  $("faction-error").textContent = "";
  try {
    const data = await api("/api/hero/faction", { faction: pickedFaction, hero: heroId });
    hero = { ...hero, ...data.hero };
    $("faction-modal").classList.add("hidden");
    render();
  } catch (err) {
    $("faction-error").textContent = err.message;
  }
};

$("faction-close").onclick = () => $("faction-modal").classList.add("hidden");
$("change-hero").onclick = openFactionModal;
$("change-faction").onclick = openFactionModal;
$("side-change").onclick = openFactionModal;
