(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  let data = null;

  async function api(path, body) {
    const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    if (res.status === 401) location.assign("/login");
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Ошибка");
    return out;
  }

  function card(def) {
    const p = data.progress.find((x) => x.id === def.id) ?? { level: 0, points: 0, pointsToNext: data.rules.pointsBase, picks: [], pendingPicks: 0 };
    const live = def.status === "live";
    const max = p.pointsToNext == null;
    const bar = `<div class="xp"><div style="width:${max ? 100 : Math.min(100, (p.points / p.pointsToNext) * 100)}%"></div></div>
      <div class="muted">${max ? "Максимальный уровень" : `${p.points} / ${p.pointsToNext} очков до ${p.level + 1} уровня`}</div>`;
    const picked = p.picks.length
      ? `<div class="muted">Выбрано: ${Object.entries(p.picks.reduce((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {}))
          .map(([k, n]) => `${esc(data.statNames[k])} +${n * data.rules.statPerLevel}`).join(", ")}</div>`
      : "";
    const pick = p.pendingPicks
      ? `<div><b>Выберите характеристику за уровень (${p.pendingPicks}):</b></div><div class="guild-picks">${def.statChoice
          .map((k) => `<button type="button" class="btn-secondary" data-guild="${def.id}" data-stat="${k}">${esc(data.statNames[k])} +${data.rules.statPerLevel}</button>`).join("")}</div>`
      : "";
    return `<div class="guild-card ${live ? "" : "planned"}">
      <h3><span class="guild-icon">${def.icon}</span>${esc(def.name)}</h3>
      <div class="guild-kind">${esc(def.kind)}</div>
      <div class="status">${live ? "✅ В игре" : "📝 В планах"} · Уровень ${p.level} / ${data.rules.maxLevel}</div>
      ${live ? bar : ""}
      <div>${esc(def.description)}</div>
      <div><b>Очки за:</b> ${esc(def.activity)}</div>
      <div><b>Даёт:</b> ${esc(def.reward)}</div>
      ${picked}${pick}
    </div>`;
  }

  function render() {
    $("guilds").innerHTML = data.guilds.map(card).join("");
  }

  $("guilds").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-stat]");
    if (!btn) return;
    $("guild-error").textContent = "";
    try {
      const out = await api(`/api/guilds/${btn.dataset.guild}/pick`, { stat: btn.dataset.stat });
      data.progress = out.progress;
      render();
    } catch (err) {
      $("guild-error").textContent = err.message;
    }
  });

  api("/api/guilds").then((d) => { data = d; render(); }).catch((err) => { $("guild-error").textContent = err.message; });
})();
