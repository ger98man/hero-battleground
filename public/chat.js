// Online counter + global chat over a single WebSocket (/ws).
(() => {
  const el = (id) => document.getElementById(id);
  const log = el("chat-log");
  const input = el("chat-input");
  const status = el("chat-status");
  const errorBox = el("chat-error");
  const countBtn = el("online-count");
  const onlineList = el("online-list");
  let ws;
  let retryMs = 1000;
  let errorTimer;

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const label = (p) => `${p.heroName} [${p.level}]`;

  function addMessage(m) {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const li = document.createElement("li");
    const time = document.createElement("time");
    time.textContent = fmtTime(m.createdAt);
    const author = document.createElement("span");
    author.className = "author";
    author.textContent = label(m);
    author.onclick = () => { input.value = `${m.heroName}, ${input.value}`; input.focus(); };
    li.append(time, author, document.createTextNode(": " + m.text));
    log.append(li);
    while (log.children.length > 200) log.firstChild.remove();
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }

  function setPresence({ count, players }) {
    countBtn.textContent = count;
    onlineList.replaceChildren(...players.map((p) => {
      const d = document.createElement("div");
      d.textContent = label(p);
      return d;
    }));
  }

  function showError(text) {
    errorBox.textContent = text;
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => (errorBox.textContent = ""), 3000);
  }

  function connect() {
    status.textContent = "подключение…";
    ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onopen = () => { status.textContent = ""; retryMs = 1000; };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "hello") {
        log.replaceChildren();
        msg.history.forEach(addMessage);
        log.scrollTop = log.scrollHeight;
        setPresence(msg);
      } else if (msg.type === "presence") setPresence(msg);
      else if (msg.type === "message") addMessage(msg.message);
      else if (msg.type === "error") showError(msg.error);
    };
    ws.onclose = () => {
      status.textContent = "нет связи";
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };
  }

  el("chat-form").onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", text }));
    input.value = "";
  };

  countBtn.onclick = (e) => { e.stopPropagation(); onlineList.classList.toggle("hidden"); };
  document.addEventListener("click", () => onlineList.classList.add("hidden"));

  connect();
})();
