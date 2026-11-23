(async () => {
  const $ = (id) => document.getElementById(id);
  const name = decodeURIComponent(location.pathname.split("/").pop());
  const res = await fetch(`/api/heroes/${encodeURIComponent(name)}`);
  if (res.status === 401) return location.assign("/login");
  const data = await res.json();
  if (!res.ok) {
    $("hero-name").textContent = name;
    $("card").classList.add("hidden");
    $("error").textContent = data.error;
    return;
  }
  const { hero } = data;
  document.title = `Hero Battleground — ${hero.name}`;
  $("hero-name").textContent = hero.name;
  $("level").textContent = `Ур. ${hero.level}`;
  const roman = ["", "I", "II", "III", "IV", "V"];
  $("class-name").textContent = hero.className;
  $("classes").textContent = hero.classes.map((c) => `${c.name} ${roman[c.rank] ?? c.rank}`).join(" + ") || "—";
  $("pvp").textContent = `${hero.wins} / ${hero.losses}`;
  $("bot").textContent = `${hero.botWins} / ${hero.botLosses}`;
  if (!hero.faction) return;
  const { factions } = await fetch("/api/factions").then((r) => r.json());
  const f = factions.find((x) => x.id === hero.faction);
  const fh = f?.heroes.find((x) => x.id === hero.factionHero);
  if (!f || !fh) return;
  document.documentElement.style.setProperty("--faction", f.color);
  $("portrait").innerHTML = hbModel(fh.model, f);
  $("faction-line").innerHTML = `<span class="faction-name" style="--fc:${f.color}"></span> · <span></span>`;
  $("faction-line").firstElementChild.textContent = f.name;
  $("faction-line").lastElementChild.textContent = fh.name;
})();
