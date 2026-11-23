// Army screen (/army): the faction roster by tier, the current army and leadership.
// Edits are kept as a draft and saved with one button; the server checks the same rules.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ROLE = { melee: "ближний бой", ranged: "стрелок", flyer: "летает", caster: "заклинатель", siege: "осадное орудие" };
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

  let rules = null;
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

  function unitStats(u) {
    return `<dl class="unit-stats">
      <div><dt>❤️</dt><dd title="Здоровье">${u.hp}</dd></div>
      <div><dt>⚔</dt><dd title="Атака">${u.attack}</dd></div>
      <div><dt>🛡</dt><dd title="Защита">${u.defense}</dd></div>
      <div><dt>🗡</dt><dd title="Урон">${u.damage[0]}–${u.damage[1]}</dd></div>
      <div><dt>⏳</dt><dd title="Инициатива">${u.initiative}</dd></div>
      <div><dt>👣</dt><dd title="Скорость">${u.speed}</dd></div>
    </dl>`;
  }

  function render() {
    const used = cost(draft);
    const pct = Math.min(100, (used / lead()) * 100);
    const over = used > lead();
    const heroDef = faction.heroes.find((h) => h.id === hero.factionHero);
    $("army-summary").innerHTML = `
      <div class="army-hero">${heroDef ? `<div class="token">${hbModel(heroDef.model, faction)}</div>` : ""}
        <div><div class="faction-name" style="--fc:${faction.color}">${esc(faction.name)}</div>
          <b>${esc(heroDef?.name ?? "")}</b> <span class="muted">${esc(hero.name)}, ур. ${hero.level}</span>
          ${heroDef ? `<div class="muted">${esc(heroDef.armyBonus)}</div>` : ""}</div></div>
      <div class="leadership">
        <div class="row"><span>Лидерство</span><b class="${over ? "over" : ""}">${used} / ${lead()}</b></div>
        <div class="xp lead-bar"><div style="width:${pct}%" class="${over ? "over" : ""}"></div></div>
        <div class="muted">Отрядов: ${draft.length} / ${rules.MAX_ARMY_STACKS} · существ: ${draft.reduce((s, x) => s + x.count, 0)}</div>
      </div>`;

    const slots = Array.from({ length: rules.MAX_ARMY_STACKS }, (_, i) => draft[i]);
    $("army-slots").innerHTML = slots.map((s) => {
      if (!s) return `<div class="slot empty"></div>`;
      const u = unitOf(s.unitId);
      return `<button type="button" class="slot" data-jump="${u.id}" title="${esc(u.name)}">${hbModel(u.model, faction)}<span class="slot-count">${s.count}</span><span class="slot-tier">${ROMAN[u.tier]}</span></button>`;
    }).join("");

    $("roster-title").textContent = `Войска фракции «${faction.name}»`;
    $("roster").innerHTML = faction.tiers.map((t) => `
      <div class="tier ${isOpen(t) ? "" : "locked"}">
        <div class="tier-label"><span class="tier-num">${ROMAN[t.tier]}</span><small>${isOpen(t) ? "ступень" : `с ${t.unlockLevel} ур.`}</small></div>
        ${t.units.map((u) => {
          const n = countOf(u.id);
          return `<article class="unit-card ${n ? "in-army" : ""}" id="unit-${u.id}">
            <div class="token big">${hbModel(u.model, faction)}</div>
            <div class="unit-body">
              <div class="row"><b>${esc(u.name)}</b><span class="unit-cost" title="Лидерство за одно существо">👑 ${u.cost}</span></div>
              <div class="muted">${ROLE[u.role] ?? u.role} · ${esc(u.description)}</div>
              ${unitStats(u)}
              ${isOpen(t) ? `<div class="count-row">
                <button type="button" data-step="${u.id}" data-delta="-10">−10</button>
                <input type="number" min="0" inputmode="numeric" value="${n}" data-count="${u.id}" aria-label="Сколько: ${esc(u.name)}">
                <button type="button" data-step="${u.id}" data-delta="10">+10</button>
                <button type="button" class="link" data-max="${u.id}">макс.</button>
              </div>` : `<div class="muted">🔒 Откроется на ${t.unlockLevel} уровне</div>`}
            </div></article>`;
        }).join("")}
      </div>`).join("");

    $("army-save").disabled = busy || over || !isDirty();
    $("army-reset").disabled = busy || !isDirty();
  }

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
    if (id) $(`unit-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  window.addEventListener("beforeunload", (e) => { if (hero && isDirty()) e.preventDefault(); });

  (async () => {
    const [catalog, data] = await Promise.all([api("/api/factions"), api("/api/hero")]);
    rules = catalog.rules;
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
