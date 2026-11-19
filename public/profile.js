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
})();
