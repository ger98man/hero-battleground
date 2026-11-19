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
  $("class-title").textContent = h.needsClass ? "Класс не выбран" : h.className;
  $("portrait-icon").textContent = h.build.classes[0] ? classDef(h.build.classes[0].id).icon : "⚔️";
  $("level").textContent = `Ур. ${h.level}`;
  $("xp-text").textContent = `${h.experience} / ${h.experienceToNext}`;
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

function classesTab() {
  const { limits, build } = hero;
  const free = limits.classPoints - limits.classPointsUsed;
  const rows = build.classes.map((c, i) => {
    const def = classDef(c.id);
    const specOptions = def.specs.map((s) => `<option value="${s.id}" ${s.id === c.spec ? "selected" : ""}>${esc(s.name)}</option>`).join("");
    const spec = def.specs.find((s) => s.id === c.spec);
    return `<div class="class-row">
      <span class="icon big">${def.icon}</span>
      <div class="grow"><b>${esc(def.name)} ${ROMAN[c.rank]}</b>
        <div><select data-spec="${i}">${specOptions}</select></div>
        <div class="muted">${esc(spec?.description ?? "")}</div></div>
      <div class="rank-btns">
        <button type="button" data-rank="${i}" data-delta="-1" ${c.rank <= 1 && build.classes.length === 1 ? "disabled" : ""}>−</button>
        <button type="button" data-rank="${i}" data-delta="1" ${free <= 0 || c.rank >= catalog.rules.MAX_CLASS_RANK ? "disabled" : ""}>+</button>
      </div></div>`;
  }).join("");
  const canAdd = free > 0 && build.classes.length < limits.classSlots;
  const addable = catalog.classes.filter((c) => !build.classes.some((b) => b.id === c.id));
  const addHtml = addable.map((c) => `<button type="button" class="chip" data-add="${c.id}" ${!c.playable || !canAdd ? "disabled" : ""}
      title="${esc(c.description)}">${c.icon} ${esc(c.name)}${c.playable ? "" : " (скоро)"}</button>`).join("");
  const hybrids = hero.build.classes.length > 1 ? "" : `<p class="muted">На 6-м уровне откроется второй класс: Воин + Монах = Паладин, Воин + Маг = Боевой маг.</p>`;
  return `<p class="muted">Очки классов: ${limits.classPointsUsed} / ${limits.classPoints} · классов: ${build.classes.length} / ${limits.classSlots}.
      Очко даётся каждый 3-й уровень, новый класс — каждый 6-й (до ${catalog.rules.MAX_CLASSES}).</p>
    ${rows}
    <p><b>Добавить класс</b>${canAdd ? "" : ` <span class="muted">(нужно свободное очко и место под класс)</span>`}</p>
    <div class="chips">${addHtml}</div>${hybrids}`;
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

$("tab-body").onclick = (e) => {
  const d = e.target.dataset;
  const build = cloneBuild();
  if (d.rank !== undefined) {
    const c = build.classes[Number(d.rank)];
    c.rank += Number(d.delta);
    if (c.rank < 1) build.classes.splice(Number(d.rank), 1);
    return saveBuild(build);
  }
  if (d.add) {
    const def = classDef(d.add);
    build.classes.push({ id: def.id, rank: 1, spec: def.specs[0].id });
    return saveBuild(build);
  }
};

$("tab-body").onchange = (e) => {
  const d = e.target.dataset;
  const build = cloneBuild();
  if (d.spec !== undefined) {
    build.classes[Number(d.spec)].spec = e.target.value;
    return saveBuild(build);
  }
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

function openClassModal() {
  $("class-list").innerHTML = catalog.classes.map((c) => {
    const specs = c.specs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    return `<div class="artifact-card ${c.playable ? "" : "locked"}">
      <div class="artifact-head"><span class="icon big">${c.icon}</span><div><b>${esc(c.name)}</b>
        <div class="muted">${esc(c.description)}</div></div></div>
      ${c.playable
        ? `<label>Специализация</label><select id="spec-${c.id}">${specs}</select>
           <details><summary>Умения</summary>${[c.basic, ...c.skills].map((s) => skillHtml(s)).join("")}</details>
           <button type="button" data-pick="${c.id}">Выбрать</button>`
        : `<p class="muted">Скоро</p>`}
    </div>`;
  }).join("");
  $("class-modal").classList.remove("hidden");
}

$("class-list").onclick = async (e) => {
  const id = e.target.dataset.pick;
  if (!id) return;
  try {
    const data = await api("/api/hero/build", { build: { classes: [{ id, rank: 1, spec: $(`spec-${id}`).value }], talents: [], loadout: [] } });
    hero = { ...hero, ...data.hero };
    $("class-modal").classList.add("hidden");
    render();
  } catch (err) {
    $("modal-error").textContent = err.message;
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
  [catalog, { hero }] = await Promise.all([api("/api/classes"), api("/api/hero")]);
  render();
  if (hero.needsClass) openClassModal();
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
