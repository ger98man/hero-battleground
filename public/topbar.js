// Shared top bar: logo, main sections, online counter slot, logout.
// Pages put <header class="topbar" id="topbar" data-page="hero|pvp|wiki|profile" [data-public]></header>
// and load this script before online.js (the counter goes into #topbar-online).
(() => {
  const bar = document.getElementById("topbar");
  if (!bar) return;
  const page = bar.dataset.page;
  const isPublic = "public" in bar.dataset;
  const links = [
    ["hero", "/hero", "Герой"],
    ["army", "/army", "Армия"],
    ["pvp", "/pvp", "Арена (PvP)"],
    ["wiki", "/wiki", "Об игре"],
  ];
  bar.innerHTML = `
    <a class="brand" href="/" aria-label="Hero Battleground — в игру">
      <span class="brand-crest">⚜</span>
      <span class="brand-name"><b>Hero</b><small>Battleground</small></span>
    </a>
    <nav class="topnav">${links
      .map(([id, href, label]) => `<a href="${href}" class="${id === page ? "active" : ""}">${label}</a>`)
      .join("")}</nav>
    <div class="topbar-right">
      <span id="topbar-online"></span>
      ${isPublic ? "" : '<button type="button" class="icon-btn" id="logout" title="Выйти">⏻</button>'}
    </div>`;
  const logout = document.getElementById("logout");
  if (logout) {
    logout.onclick = async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.assign("/login");
    };
  }
})();
