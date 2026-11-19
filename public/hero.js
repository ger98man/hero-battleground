const $ = (id) => document.getElementById(id);

async function load() {
  const res = await fetch("/api/hero");
  if (res.status === 401) return location.assign("/login");
  const { hero } = await res.json();
  $("hero-name").textContent = hero.name;
  $("level").textContent = `Уровень ${hero.level}`;
  $("xp-text").textContent = `${hero.experience} / ${hero.experienceToNext} опыта`;
  $("xp-bar").style.width = `${Math.min(100, (hero.experience / hero.experienceToNext) * 100)}%`;
  for (const key of ["health", "attack", "defense", "speed", "wins", "losses"]) $(key).textContent = hero[key];
  $("owner").textContent = `Игрок: ${hero.username}`;
}

$("logout").onclick = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  location.assign("/login");
};

load();
