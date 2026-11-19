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
  $("level").textContent = `Уровень ${hero.level}`;
  for (const key of ["health", "attack", "defense", "speed"]) $(key).textContent = hero[key];
  $("pvp").textContent = `${hero.wins} / ${hero.losses}`;
  $("bot").textContent = `${hero.botWins} / ${hero.botLosses}`;
})();
