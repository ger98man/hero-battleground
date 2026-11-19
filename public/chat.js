// Global chat in the bottom-left corner, over one WebSocket (/ws). Also keeps the online counter live.
(() => {
  const root = document.createElement("aside");
  root.className = "chat";
  root.innerHTML = `
    <div class="chat-head"><b>Общий чат</b><span class="muted" id="chat-status"></span></div>
    <div class="chat-body">
      <ol class="chat-log" id="chat-log"></ol>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" maxlength="200" autocomplete="off" placeholder="Сообщение">
        <button type="submit">➤</button>
      </form>
      <div class="error" id="chat-error"></div>
    </div>`;
  document.body.append(root);
  document.body.classList.add("has-chat");

  const q = (sel) => root.querySelector(sel);
  const log = q("#chat-log");
  const input = q("#chat-input");
  const status = q("#chat-status");
  const errorBox = q("#chat-error");
  let ws;
  let retryMs = 1000;
  let errorTimer;
  let unread = 0;
  let connState = "";

  // Collapsed state is remembered per browser; small screens start collapsed.
  // A page can set <body data-chat-start="collapsed"> (the battle screen) to always start collapsed.
  const KEY = "hb.chatCollapsed";
  let collapsed;
  try { collapsed = localStorage.getItem(KEY); } catch {}
  if (document.body.dataset.chatStart === "collapsed") setCollapsed(true, false);
  else setCollapsed(collapsed === null || collapsed === undefined ? innerWidth < 760 : collapsed === "1");
  q(".chat-head").onclick = () => setCollapsed(!root.classList.contains("collapsed"));

  function setCollapsed(on, remember = true) {
    root.classList.toggle("collapsed", on);
    if (remember) try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
    if (!on) { unread = 0; log.scrollTop = log.scrollHeight; }
    renderStatus();
  }

  function renderStatus() {
    status.textContent = connState || (root.classList.contains("collapsed") && unread ? `+${unread}` : "");
  }

  const pad = (n) => String(n).padStart(2, "0");
  function fmtTime(iso) {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ` +
      `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${pad(d.getFullYear() % 100)}`;
  }

  function addMessage(m) {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = fmtTime(m.createdAt);
    li.append(time);
    if (m.kind === "system") {
      const span = document.createElement("span");
      span.className = "system";
      span.textContent = m.text;
      li.append(span);
    } else {
      const author = document.createElement("a");
      author.href = `/heroes/${encodeURIComponent(m.heroName)}`;
      author.textContent = `${m.heroName} [${m.level}]`;
      li.append(author, document.createTextNode(": " + m.text));
    }
    log.append(li);
    while (log.children.length > 200) log.firstChild.remove();
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  function showError(text) {
    errorBox.textContent = text;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (errorBox.textContent = ""), 3000);
  }

  function connect() {
    connState = "подключение…";
    renderStatus();
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onopen = () => { connState = ""; retryMs = 1000; window.hbOnlineLive = true; renderStatus(); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "hello") {
        log.replaceChildren();
        msg.history.forEach(addMessage);
        log.scrollTop = log.scrollHeight;
        window.hbSetOnline?.(msg.count);
      } else if (msg.type === "presence") window.hbSetOnline?.(msg.count);
      else if (msg.type === "message") {
        addMessage(msg.message);
        if (root.classList.contains("collapsed")) { unread++; renderStatus(); }
      } else if (msg.type === "error") showError(msg.error);
    };
    ws.onclose = () => {
      window.hbOnlineLive = false;
      connState = "нет связи";
      renderStatus();
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };
  }

  q("#chat-form").onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", text }));
    input.value = "";
  };

  connect();
})();
