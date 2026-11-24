// Army screen (/army): the faction roster by tier, the current army and leadership.
// Edits are kept as a draft and saved with one button; the server checks the same rules.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Stat icons with names and what they mean; shown as labelled cells with a tooltip.
  const STATS = [
    { key: "hp", icon: "❤️", name: "Здоровье", hint: "Здоровье одного существа. Отряд теряет существ, когда урон съедает их здоровье." },
    { key: "attack", icon: "⚔️", name: "Атака", hint: "Чем выше атака над защитой цели, тем больше урон: +5% за каждое очко разницы (до ×3)." },
    { key: "defense", icon: "🛡️", name: "Защита", hint: "Снижает урон от атак: каждое очко защиты сверх атаки врага — меньше урона." },
    { key: "damage", icon: "💥", name: "Урон", hint: "Урон одного существа за удар. Отряд бьёт: число существ × урон." },
    { key: "initiative", icon: "⏳", name: "Инициатива", hint: "Кто ходит раньше в очереди ходов: чем больше, тем чаще ход." },
    { key: "speed", icon: "👣", name: "Скорость", hint: "На сколько клеток отряд двигается за ход." },
  ];
  const ATTRIBUTE = {
    strength: { icon: "✊", name: "Сила" },
    dexterity: { icon: "🪶", name: "Ловкость" },
    intellect: { icon: "📖", name: "Интеллект" },
  };
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

  let rules = null;
  let tagNames = {};
  let faction = null;
  let hero = null;
  let draft = [];
  let busy = false;

  const units = () => faction.tiers.flatMap((t) => t.units);
  const unitOf = (id) => units().find((u) => u.id === id);
  const cost = (army) => army.reduce((sum, s) => sum + (unitOf(s.unitId)?.cost ?? 0) * s.count, 0);
  const lead = () => hero.armyLimits.leadership;
  const countOf = (id) => draft.find((s) => s.unitId === id)?.count ?? 0;
  const isOpen = (tier) => hero.level >= tier.unlockLevel;
  const isDirty = () => JSON.stringify(draft) !== JSON.stringify(hero.army);

  async function api(path, body) {
    const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    if (res.status === 401) location.assign("/login");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Ошибка");
    return data;
  }

  /** Sets a stack size; keeps the army ordered by tier, drops empty stacks. */
  function setCount(unitId, count) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    const others = draft.filter((s) => s.unitId !== unitId);
    if (n > 0 && others.length >= rules.MAX_ARMY_STACKS) {
      $("army-error").textContent = `Не больше ${rules.MAX_ARMY_STACKS} отрядов`;
      return render();
    }
    const order = units().map((u) => u.id);
    draft = (n > 0 ? [...others, { unitId, count: n }] : others).sort((a, b) => order.indexOf(a.unitId) - order.indexOf(b.unitId));
    $("army-error").textContent = "";
    render();
  }

  /** As many as fit into the leadership left (counting the current stack as free). */
  function maxFor(unitId) {
    const u = unitOf(unitId);
    const rest = lead() - cost(draft.filter((s) => s.unitId !== unitId));
    return Math.max(0, Math.floor(rest / u.cost));
  }

  function evenSplit() {
    const open = faction.tiers.filter(isOpen).map((t) => t.units.find((u) => countOf(u.id) > 0) ?? t.units[0]);
    const share = Math.floor(lead() / open.length);
    draft = open.map((u) => ({ unitId: u.id, count: Math.floor(share / u.cost) })).filter((s) => s.count > 0);
    $("army-error").textContent = "";
    render();
  }

  const tagInfo = (t) => tagNames[t] ?? { name: t, many: t, hint: "" };
  const heroDef = () => faction.heroes.find((h) => h.id === hero.factionHero);
  const bonusRule = () => heroDef()?.bonus;
  /** Does the hero's bonus boost this unit? (same rule as the server's bonusApplies) */
  const boosted = (u) => {
    const b = bonusRule();
    return Boolean(b && !b.enemies && (b.tags.length === 0 || b.tags.some((t) => u.tags.includes(t))));
  };
  const bonusTags = () => new Set(bonusRule()?.tags ?? []);
  let filter = null;

  function tagChip(t, { active = false, button = false } = {}) {
    const info = tagInfo(t);
    const cls = `tag tag-${t} ${bonusTags().has(t) ? "tag-bonus" : ""} ${active ? "active" : ""}`;
    return button
      ? `<button type="button" class="${cls}" data-filter="${t}" data-tip="${esc(info.hint)}">${esc(info.name)}</button>`
      : `<span class="${cls}" tabindex="0" data-tip="${esc(info.hint)}">${bonusTags().has(t) ? "★ " : ""}${esc(info.name)}</span>`;
  }

  /** Stat value with the hero bonus added (what the unit will have in battle). */
  function statCell(u, s) {
    const fx = boosted(u) ? bonusRule()?.effect : null;
    let value = s.key === "damage" ? `${u.damage[0]}–${u.damage[1]}` : u[s.key];
    let plus = "";
    if (fx && fx.stat === s.key) {
      if (s.key === "damage" || s.key === "hp") plus = `+${Math.round(fx.value * 100)}%`;
      else plus = `${fx.value > 0 ? "+" : ""}${fx.value}`;
      if (s.key === "hp") value = Math.round(u.hp * (1 + fx.value));
      else if (s.key !== "damage") value = u[s.key] + fx.value;
    }
    const tip = `${s.name}: ${s.hint}${plus ? ` Бонус героя: ${plus}.` : ""}`;
    return `<div class="ustat ${plus ? "up" : ""}" tabindex="0" data-tip="${esc(tip)}">
      <span class="stat-icon">${s.icon}</span><span class="stat-val">${value}${plus ? `<small>${plus}</small>` : ""}</span><span class="stat-name">${s.name}</span></div>`;
  }

  function unitStats(u) {
    return `<div class="unit-stats">${STATS.map((s) => statCell(u, s)).join("")}</div>`;
  }

  /** Hero bonus box: what it does and which units of the faction it works on. */
  function bonusBox(h) {
    const b = h.bonus;
    const fits = units().filter(boosted);
    let who;
    if (b.enemies) who = "Действует на все отряды врага.";
    else if (!b.tags.length) who = "Действует на всю армию.";
    else who = `Подходят: ${fits.map((u) => `<button type="button" class="link unit-link" data-jump="${u.id}">${esc(u.name)} <small>${ROMAN[u.tier]}</small></button>`).join(", ") || "нет"}`;
    return `<div class="hero-bonus ${b.effect ? "" : "inactive"}">
      <div class="hero-bonus-title">★ Бонус героя: <b>${esc(h.armyBonus)}</b>${b.tags.map((t) => tagChip(t)).join("")}</div>
      <div class="hero-bonus-who">${who}</div>
      ${b.effect ? "" : `<div class="muted small">Этот бонус пока только показывается, в бою начнёт работать позже.</div>`}
    </div>`;
  }

  function render() {
    const used = cost(draft);
    const pct = Math.min(100, (used / lead()) * 100);
    const over = used > lead();
    const h = heroDef();
    $("army-summary").innerHTML = `
      <div class="army-hero">${h ? `<div class="token big">${hbFigure(h, faction)}</div>` : ""}
        <div class="army-hero-text"><div class="faction-name" style="--fc:${faction.color}">${esc(faction.name)}</div>
          <div><b>${esc(h?.name ?? "")}</b> <span class="muted">${esc(hero.name)}, ур. ${hero.level}</span></div>
          ${h ? bonusBox(h) : ""}</div></div>
      <div class="leadership">
        <div class="row"><span data-tip="Сколько войск может вести герой: 60 + 30 за уровень. Каждое существо тратит лидерство своей ступени." tabindex="0">👑 Лидерство</span><b class="${over ? "over" : ""}">${used} / ${lead()}</b></div>
        <div class="xp lead-bar"><div style="width:${pct}%" class="${over ? "over" : ""}"></div></div>
        <div class="muted">Отрядов: ${draft.length} / ${rules.MAX_ARMY_STACKS} · существ: ${draft.reduce((s, x) => s + x.count, 0)}${lead() - used > 0 ? ` · свободно: ${lead() - used}` : ""}</div>
      </div>`;

    const slots = Array.from({ length: rules.MAX_ARMY_STACKS }, (_, i) => draft[i]);
    $("army-slots").innerHTML = slots.map((s) => {
      if (!s) return `<div class="slot empty"><span>пусто</span></div>`;
      const u = unitOf(s.unitId);
      return `<button type="button" class="slot ${boosted(u) ? "boosted" : ""}" data-jump="${u.id}" title="${esc(u.name)}">${hbFigure(u, faction)}<span class="slot-count">${s.count}</span><span class="slot-tier">${ROMAN[u.tier]}</span>${boosted(u) ? `<span class="slot-star" title="Бонус героя">★</span>` : ""}<span class="slot-name">${esc(u.name)}</span></button>`;
    }).join("");

    $("roster-title").textContent = `Войска фракции «${faction.name}»`;
    const present = [...new Set(units().flatMap((u) => u.tags))];
    $("roster-filter").innerHTML = `<span class="muted">Показать:</span>
      <button type="button" class="tag tag-all ${filter ? "" : "active"}" data-filter="">Все</button>
      ${present.map((t) => tagChip(t, { active: filter === t, button: true })).join("")}`;
    $("roster").innerHTML = faction.tiers.map((t) => `
      <div class="tier ${isOpen(t) ? "" : "locked"}">
        <div class="tier-label"><span class="tier-num">${ROMAN[t.tier]}</span><small>${isOpen(t) ? "ступень" : `с ${t.unlockLevel} ур.`}</small></div>
        ${t.units.map((u) => {
          const n = countOf(u.id);
          const dim = filter && !u.tags.includes(filter);
          const attr = ATTRIBUTE[u.attribute];
          return `<article class="unit-card ${n ? "in-army" : ""} ${boosted(u) ? "boosted" : ""} ${dim ? "dim" : ""}" id="unit-${u.id}">
            ${boosted(u) ? `<div class="bonus-ribbon" data-tip="${esc(`Бонус вашего героя: ${heroDef().armyBonus}`)}" tabindex="0">★ ${esc(heroDef().armyBonus)}</div>` : ""}
            <div class="unit-art"><div class="token big">${hbFigure(u, faction)}</div>
              <div class="unit-cost" data-tip="Лидерство за одно существо" tabindex="0">👑 ${u.cost}</div></div>
            <div class="unit-body">
              <div class="unit-name"><b>${esc(u.name)}</b>${n ? `<span class="in-army-mark">в армии: ${n}</span>` : ""}</div>
              <div class="tags">${u.tags.map((tg) => tagChip(tg)).join("")}</div>
              <div class="unit-desc">${esc(u.description)}</div>
              ${unitStats(u)}
              ${attr ? `<div class="unit-attr" tabindex="0" data-tip="Урон отряда растёт на 1% за каждое очко этой характеристики героя сверх 10.">Урон растёт от: ${attr.icon} ${attr.name} героя</div>` : ""}
              ${isOpen(t) ? `<div class="count-row">
                <button type="button" data-step="${u.id}" data-delta="-10">−10</button>
                <input type="number" min="0" inputmode="numeric" value="${n}" data-count="${u.id}" aria-label="Сколько: ${esc(u.name)}">
                <button type="button" data-step="${u.id}" data-delta="10">+10</button>
                <button type="button" class="link" data-max="${u.id}">макс.</button>
                ${n ? `<span class="muted small">= ${n * u.cost} 👑</span>` : ""}
              </div>` : `<div class="muted">🔒 Откроется на ${t.unlockLevel} уровне</div>`}
            </div></article>`;
        }).join("")}
      </div>`).join("");

    $("army-save").disabled = busy || over || !isDirty();
    $("army-reset").disabled = busy || !isDirty();
  }

  $("roster-filter").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-filter]");
    if (!b) return;
    filter = b.dataset.filter && b.dataset.filter !== filter ? b.dataset.filter : null;
    render();
  });
  const jump = (id) => {
    const el = $(`unit-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  };
  $("army-summary").addEventListener("click", (e) => {
    const id = e.target.closest("button")?.dataset.jump;
    if (id) jump(id);
  });
  $("roster").addEventListener("click", (e) => {
    const d = e.target.closest("button")?.dataset ?? {};
    if (d.step) setCount(d.step, countOf(d.step) + Number(d.delta));
    if (d.max) setCount(d.max, maxFor(d.max));
  });
  $("roster").addEventListener("change", (e) => {
    const id = e.target.dataset.count;
    if (id) setCount(id, e.target.value);
  });
  $("army-slots").addEventListener("click", (e) => {
    const id = e.target.closest("button")?.dataset.jump;
    if (id) jump(id);
  });
  $("army-even").onclick = evenSplit;
  $("army-reset").onclick = () => { draft = hero.army.map((s) => ({ ...s })); $("army-error").textContent = ""; render(); };
  $("army-save").onclick = async () => {
    busy = true;
    render();
    try {
      ({ hero } = await api("/api/hero/army", { army: draft }));
      draft = hero.army.map((s) => ({ ...s }));
      $("army-error").textContent = "";
    } catch (err) {
      $("army-error").textContent = err.message;
    } finally {
      busy = false;
      render();
    }
  };
  // One floating tooltip for every [data-tip] element: hover with a mouse, tap (focus) on a phone.
  const tip = document.createElement("div");
  tip.className = "float-tip";
  tip.hidden = true;
  document.body.append(tip);
  function showTip(el) {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    const top = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
    tip.style.left = `${left + scrollX}px`;
    tip.style.top = `${top + scrollY}px`;
  }
  const tipTarget = (e) => e.target.closest?.("[data-tip]");
  document.addEventListener("mouseover", (e) => { const el = tipTarget(e); if (el?.dataset.tip) showTip(el); });
  document.addEventListener("mouseout", (e) => { if (tipTarget(e)) tip.hidden = true; });
  document.addEventListener("focusin", (e) => { const el = tipTarget(e); if (el?.dataset.tip) showTip(el); });
  document.addEventListener("focusout", () => { tip.hidden = true; });
  window.addEventListener("beforeunload", (e) => { if (hero && isDirty()) e.preventDefault(); });

  (async () => {
    const [catalog, data] = await Promise.all([api("/api/factions"), api("/api/hero")]);
    rules = catalog.rules;
    tagNames = catalog.tags ?? {};
    hero = data.hero;
    faction = catalog.factions.find((f) => f.id === hero.faction);
    if (!faction) {
      $("no-faction").hidden = false;
      for (const id of ["army-summary", "army-slots"]) $(id).innerHTML = "";
      document.querySelector(".army-actions").hidden = true;
      $("roster").closest("section").hidden = true;
      return;
    }
    document.documentElement.style.setProperty("--faction", faction.color);
    draft = hero.army.map((s) => ({ ...s }));
    render();
  })();
})();
