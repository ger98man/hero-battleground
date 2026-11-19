let mode = "login";
const $ = (id) => document.getElementById(id);

function setMode(next) {
  mode = next;
  $("tab-login").classList.toggle("active", mode === "login");
  $("tab-register").classList.toggle("active", mode === "register");
  $("hero-field").classList.toggle("hidden", mode === "login");
  $("heroName").required = mode === "register";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("submit").textContent = mode === "login" ? "Войти" : "Создать героя";
  $("error").textContent = "";
}
$("tab-login").onclick = () => setMode("login");
$("tab-register").onclick = () => setMode("register");

$("form").onsubmit = async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  $("submit").disabled = true;
  const body = { username: $("username").value, password: $("password").value };
  if (mode === "register") body.heroName = $("heroName").value;
  try {
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return location.assign("/hero");
    const data = await res.json().catch(() => ({}));
    $("error").textContent = data.error || "Ошибка";
  } catch {
    $("error").textContent = "Сервер недоступен";
  } finally {
    $("submit").disabled = false;
  }
};
