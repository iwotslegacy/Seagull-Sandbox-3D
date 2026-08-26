const CUSTOMIZER_KEY = "seagullCustomizerV32";

function cleanRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function readCustomizer() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOMIZER_KEY) || "{}");
    return {
      name: String(saved.name || "").slice(0, 18),
      color: /^#[0-9a-f]{6}$/i.test(saved.color || "") ? saved.color : "#ffd166",
      style: String(saved.style || "classic")
    };
  } catch {
    return { name: "", color: "#ffd166", style: "classic" };
  }
}

function saveCustomizer() {
  const data = {
    name: String(document.querySelector("#playerName")?.value || "").slice(0, 18),
    color: document.querySelector("#gullColor")?.value || "#ffd166",
    style: document.querySelector("#gullStyle")?.value || "classic"
  };
  localStorage.setItem(CUSTOMIZER_KEY, JSON.stringify(data));
  return data;
}

function hydrateCustomizer() {
  const saved = readCustomizer();
  const name = document.querySelector("#playerName");
  const color = document.querySelector("#gullColor");
  const style = document.querySelector("#gullStyle");

  if (name) name.value = saved.name;
  if (color) color.value = saved.color;
  if (style) style.value = saved.style;

  [name, color, style].forEach((el) => {
    el?.addEventListener("input", saveCustomizer);
    el?.addEventListener("change", saveCustomizer);
  });
}

function createRoom() {
  saveCustomizer();
  window.location.href = "/play.html?create=1";
}

function joinRoomFromInput(inputSelector) {
  saveCustomizer();
  const input = document.querySelector(inputSelector);
  const code = cleanRoomCode(input?.value);

  if (!code) {
    if (input) {
      input.focus();
      input.placeholder = "ENTER CODE FIRST";
    }
    return;
  }

  window.location.href = `/play.html?room=${encodeURIComponent(code)}`;
}

hydrateCustomizer();

document.querySelectorAll("[data-create-room]").forEach((button) => {
  button.addEventListener("click", createRoom);
});

document.querySelector("#joinRoomButton")?.addEventListener("click", () => {
  joinRoomFromInput("#roomCode");
});

document.querySelector("#joinRoomButtonSecondary")?.addEventListener("click", () => {
  joinRoomFromInput("#roomCodeSecondary");
});

["#roomCode", "#roomCodeSecondary"].forEach((selector) => {
  const input = document.querySelector(selector);
  input?.addEventListener("input", (event) => {
    event.target.value = cleanRoomCode(event.target.value);
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinRoomFromInput(selector);
  });
});
