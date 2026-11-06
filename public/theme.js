// The theme: System (follow the computer), Light or Dark. Loaded in <head> as a classic script so a saved choice
// is applied before the page paints. The choice is kept in this browser only.
(() => {
  const KEY = "sdr-outreach:theme";
  const root = document.documentElement;

  function saved() {
    try {
      const value = localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch {
      return "system";
    }
  }

  function apply(choice) {
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    for (const button of document.querySelectorAll("[data-theme-choice]")) {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === choice));
    }
  }

  apply(saved());

  document.addEventListener("DOMContentLoaded", () => {
    apply(saved());
    for (const button of document.querySelectorAll("[data-theme-choice]")) {
      button.addEventListener("click", () => {
        const choice = button.dataset.themeChoice;
        try {
          if (choice === "system") localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, choice);
        } catch {
          // Storage blocked: the theme still changes for this visit.
        }
        apply(choice);
      });
    }
  });
})();
