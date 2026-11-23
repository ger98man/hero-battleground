// Wiki page: /wiki → first page, /wiki/<slug> → that page, /wiki/changelog → changelog.
(async () => {
  const content = document.getElementById("content");
  const nav = document.getElementById("nav");
  try {
    const toc = await fetch("/api/wiki").then((r) => r.json());
    const slug = decodeURIComponent(location.pathname.split("/")[2] || "") || toc.pages[0].slug;
    const isChangelog = slug === toc.changelog;
    document.getElementById(isChangelog ? "tab-changelog" : "tab-about").classList.add("active");

    if (!isChangelog) {
      for (const p of toc.pages.filter((p) => p.slug !== toc.changelog)) {
        const a = document.createElement("a");
        a.href = `/wiki/${p.slug}`;
        a.textContent = p.title;
        if (p.slug === slug) a.className = "active";
        nav.append(a);
      }
    }

    const res = await fetch(`/api/wiki/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      content.innerHTML = '<p>Страница не найдена. <a href="/wiki">К оглавлению</a></p>';
      return;
    }
    const page = await res.json();
    // Markdown comes from the game's own repository, not from players.
    content.innerHTML = page.html;
    if (slug === "factions") await addFactionOverview(content);
    document.title = `Hero Battleground — ${page.title}`;
  } catch {
    content.innerHTML = '<p class="error">Не удалось загрузить страницу.</p>';
  }
})();

// /wiki/factions: heroes and armies of every faction with portraits, after the intro paragraph.
async function addFactionOverview(content) {
  try {
    const { factions } = await fetch("/api/factions").then((r) => r.json());
    const anchor = content.querySelector("h2") ?? content.lastElementChild;
    anchor.insertAdjacentHTML("beforebegin", hbFactionOverview(factions));
  } catch {}
}
