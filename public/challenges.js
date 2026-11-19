// PvP 1x1 challenges page (/pvp): list (live over the chat WebSocket, polled as a fallback),
// level filter, create / cancel / join. When someone joins your challenge, the battle opens.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const FILTER_KEY = "hb.challengesMyLevel";

  let data = null;
  let clockOffset = 0; // serverNow - local now
  let busy = false;

  try {
    const saved = localStorage.getItem(FILTER_KEY);
    if (saved !== null) $("only-my-level").checked = saved === "1";
  } catch {}

  async function api(path, method = "GET") {
    const res = await fetch(path, { method });
    if (res.status === 401) location.assign("/login");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Ошибка");
    return body;
  }

  function left(iso) {
    const ms = new Date(iso).getTime() - (Date.now() + clockOffset);
    if (ms <= 0) return null;
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function render() {
    if (!data) return;
    const live = data.challenges.filter((c) => left(c.expiresAt));
    const mine = live.find((c) => c.mine);
    const onlyMine = $("only-my-level").checked;
    const others = live.filter((c) => !c.mine && (!onlyMine || c.level === data.myLevel));

    $("pvp-rules").textContent =
      `Вступить может любой герой того же уровня. Заявка живёт ${data.rules.challengeLifetimeMinutes} минут, ` +
      `потом удаляется. Пока ваша заявка открыта, бой с ботом недоступен. ` +
      `На ход в бою даётся ${data.rules.turnSeconds} секунд.`;
    $("create-challenge").classList.toggle("hidden", Boolean(mine));
    $("create-challenge").disabled = busy || data.inBattle;
    $("my-level").textContent = `Ваш уровень: ${data.myLevel}`;

    $("my-challenge").innerHTML = mine
      ? `<div class="challenge mine"><div class="who"><b>Ваша заявка</b>, уровень ${mine.level}.
           <span class="muted">Ждём соперника… осталось <span class="timer" data-exp="${mine.expiresAt}">${left(mine.expiresAt)}</span></span></div>
           <button type="button" class="link" data-cancel="${mine.id}" ${busy ? "disabled" : ""}>Отменить</button></div>`
      : "";

    $("challenge-list").innerHTML = others.length
      ? others.map((c) => {
          const same = c.level === data.myLevel;
          const a = c.artifact;
          return `<li class="challenge ${same ? "" : "other-level"}">
            <span class="icon">${a ? a.icon : "❔"}</span>
            <div class="who"><a href="/heroes/${encodeURIComponent(c.heroName)}">${esc(c.heroName)} [${c.level}]</a>
              <div class="muted">${a ? esc(a.className) + " · " : ""}осталось <span class="timer" data-exp="${c.expiresAt}">${left(c.expiresAt)}</span></div></div>
            <button type="button" data-join="${c.id}" ${same && !busy && !data.inBattle ? "" : "disabled"}
              title="${same ? "" : `Только для героев ${c.level} уровня`}">Вступить</button></li>`;
        }).join("")
      : `<li class="muted">${onlyMine ? `Нет заявок ${data.myLevel} уровня. Создайте свою, и её увидят все.` : "Заявок пока нет."}</li>`;
  }

  async function load() {
    try {
      const body = await api("/api/challenges");
      if (body.inBattle) return location.assign("/battle");
      clockOffset = new Date(body.serverNow).getTime() - Date.now();
      data = body;
      render();
    } catch (err) {
      $("challenge-error").textContent = err.message;
    }
  }

  async function run(path) {
    if (busy) return;
    busy = true;
    $("challenge-error").textContent = "";
    render();
    try {
      const body = await api(path, "POST");
      if (body.battleId) return location.assign("/battle");
    } catch (err) {
      $("challenge-error").textContent = err.message;
    } finally {
      busy = false;
    }
    await load();
  }

  $("create-challenge").onclick = () => run("/api/challenges");
  $("pvp-card").addEventListener("click", (e) => {
    const t = e.target.closest("[data-join],[data-cancel]");
    if (!t) return;
    if (t.dataset.join) run(`/api/challenges/${t.dataset.join}/join`);
    else run(`/api/challenges/${t.dataset.cancel}/cancel`);
  });
  $("only-my-level").onchange = () => {
    try { localStorage.setItem(FILTER_KEY, $("only-my-level").checked ? "1" : "0"); } catch {}
    render();
  };

  // Live updates from the server over the chat socket.
  window.addEventListener("hb:ws", (e) => {
    const msg = e.detail;
    if (msg.type === "battle-start") location.assign("/battle");
    else if (msg.type === "challenges") load();
  });

  // Countdown every second; a challenge that ran out disappears without waiting for the server.
  setInterval(() => {
    if (!data) return;
    let expired = false;
    for (const el of document.querySelectorAll("#pvp-card .timer")) {
      const t = left(el.dataset.exp);
      if (t) el.textContent = t;
      else expired = true;
    }
    if (expired) render();
  }, 1000);
  setInterval(load, 10000);
  load();
})();
