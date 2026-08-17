/** Persistent Light / Dark / System appearance controller. */
const Theme = (() => {
  const STORAGE_KEY = "gedic_theme";
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");

  function readSaved() {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
  }

  function save(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); }
    catch { /* Theme still works for the current page in restricted browsers. */ }
  }

  function preference() {
    const saved = readSaved();
    return ["light", "dark", "system"].includes(saved) ? saved : "system";
  }

  function resolved(choice = preference()) {
    return choice === "system" ? (media?.matches ? "dark" : "light") : choice;
  }

  function paint(choice = preference()) {
    document.documentElement.dataset.theme = resolved(choice);
    document.documentElement.dataset.themePreference = choice;
    document.documentElement.style.colorScheme = resolved(choice);
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      const selected = button.dataset.themeChoice === choice;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function set(choice) {
    if (!["light", "dark", "system"].includes(choice)) return;
    save(choice);
    paint(choice);
  }

  function init() {
    paint();
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      button.addEventListener("click", () => set(button.dataset.themeChoice));
    });
    media?.addEventListener?.("change", () => {
      if (preference() === "system") paint("system");
    });
  }

  // Apply the stored preference before the page becomes visible.
  paint();
  return { init, set, preference, resolved };
})();
