// "Онлайн: N" badge. Polls /api/online; on pages with chat the WebSocket keeps it live instead.
// Sits in the top bar when the page has one (#topbar-online), otherwise in the top-right corner.
(() => {
  const slot = document.getElementById("topbar-online");
  const badge = document.createElement("div");
  badge.className = slot ? "online-badge in-bar" : "online-badge";
  badge.innerHTML = '<span class="online-dot"></span>Онлайн: <b id="online-count">…</b>';
  (slot ?? document.body).append(badge);
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
