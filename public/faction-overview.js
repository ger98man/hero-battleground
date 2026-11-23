// "Герои по фракциям" and "Армии фракций": overview blocks for the wiki page /wiki/factions.
// hbFactionOverview(factions) → HTML; uses hbFigure from models.js for portraits.
(() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const heroesBlock = (factions) => factions.map((f) => `
    <div class="faction-col" style="--fc:${f.color}">
      <div class="faction-banner"><span class="banner"></span>${esc(f.name)}</div>
      ${f.heroes.map((h) => `<div class="hero-row">
        <div class="token">${hbFigure(h, f)}</div>
        <div><b>${esc(h.name)}</b><div class="muted">Реликвия: <span class="relic-link" title="${esc(h.relic.description)}">${esc(h.relic.name)}</span></div></div>
      </div>`).join("")}
    </div>`).join("");

  const armiesBlock = (factions) => factions.map((f) => `
    <div class="army-row" style="--fc:${f.color}">
      <div class="faction-banner"><span class="banner"></span>${esc(f.name)}</div>
      ${f.tiers.map((t) => `<div class="tier-cell" title="${t.units.map((u) => esc(u.name)).join(" / ")}">
        <div class="tier-pics">${t.units.map((u) => `<div class="token">${hbFigure(u, f)}</div>`).join("")}</div>
        <div class="tier-names">${t.tier}. ${t.units.map((u) => esc(u.name)).join(", ")}</div>
      </div>`).join("")}
    </div>`).join("");

  window.hbFactionOverview = (factions) => `
    <section class="overview">
      <h2>Герои по фракциям</h2>
      <div class="faction-columns">${heroesBlock(factions)}</div>
    </section>
    <section class="overview">
      <h2>Армии фракций</h2>
      <div class="armies-table">${armiesBlock(factions)}</div>
    </section>`;
})();
