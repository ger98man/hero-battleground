// "Онлайн: N" badge. Polls /api/online; on pages with chat the WebSocket keeps it live instead.
(() => {
  const badge = document.createElement("div");
  badge.className = "online-badge";
  badge.innerHTML = 'Онлайн: <b id="online-count">…</b>';
  document.body.append(badge);
  const count = badge.querySelector("b");
  window.hbSetOnline = (n) => (count.textContent = n);

  async function poll() {
    if (window.hbOnlineLive) return;
    try {
      const res = await fetch("/api/online");
      if (res.ok) window.hbSetOnline((await res.json()).count);
    } catch {}
  }
  poll();
  setInterval(poll, 20000);
})();
