class UIManager {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.app = document.querySelector(".app");
    this.overlay = document.getElementById("overlay");
    this.overlayStats = document.getElementById("overlay-stats");
    this.toastStack = document.getElementById("toast-stack");
    this.floatLayer = document.getElementById("float-layer");
    this.scoreValue = document.getElementById("score");
    this.bestValue = document.getElementById("best");
    this.lengthValue = document.getElementById("length-value");
    this.timerValue = document.getElementById("run-time");
    this.stateValue = document.getElementById("state-label");
    this.transitionTimer = 0;
    this.lastUiSoundAt = 0;
    this.themeNames = ["night", "day", "retro", "combat"];
    this.themeLabels = {
      night: "Сумерки",
      day: "Лайм-свет",
      retro: "Аркада",
      combat: "Боевой",
    };

    let savedTheme = "night";
    try {
      savedTheme = safeStorage.getItem("snake-theme") || savedTheme;
    } catch {}
    this.applyTheme(this.themeNames.includes(savedTheme) ? savedTheme : "night", false);
  }

  showScreen(screen) {
    const statusLabels = {
      MENU: "ГОТОВ К ЗАБЕГУ",
      PLAYING: "ЗАБЕГ ИДЁТ",
      PAUSED: "ПАУЗА",
      GAME_OVER: "ЗАБЕГ ЗАВЕРШЁН",
      RECORDS: "РЕКОРДЫ",
      SETTINGS: "НАСТРОЙКИ",
      CUSTOMIZATION: "ВНЕШНИЙ ВИД",
      CAMEOS: "КАМЕО-КАРТИНКИ",
      CONTROLS: "УПРАВЛЕНИЕ",
      ABOUT: "ОБ ИГРЕ",
    };
    this.app.dataset.screen = screen.toLowerCase();
    this.stateValue.textContent = statusLabels[screen] || "ЗМЕЙКА";
    if (this.transitionTimer) window.clearTimeout(this.transitionTimer);
    if (screen === "GAME_OVER") {
      this.app.classList.remove("is-game-over-flash");
      void this.app.offsetWidth;
      this.app.classList.add("is-game-over-flash");
      window.setTimeout(() => this.app.classList.remove("is-game-over-flash"), 320);
    }

    if (screen === "PLAYING") {
      this.overlay.setAttribute("aria-hidden", "true");
      this.overlay.classList.add("is-leaving");
      this.transitionTimer = window.setTimeout(() => {
        this.overlay.classList.add("hidden");
        this.overlay.classList.remove("is-leaving");
        this.transitionTimer = 0;
      }, 260);
      return;
    }

    this.overlay.dataset.screen = screen.toLowerCase();
    this.overlay.setAttribute("aria-hidden", "false");
    this.overlay.classList.remove("hidden", "is-leaving", "is-entering");
    requestAnimationFrame(() => this.overlay.classList.add("is-entering"));
    this.transitionTimer = window.setTimeout(() => {
      this.overlay.classList.remove("is-entering");
      this.transitionTimer = 0;
    }, 440);
  }

  updateScore(score) {
    this.scoreValue.textContent = Number.isInteger(score) ? String(score) : score.toFixed(1);
    this.scoreValue.classList.remove("is-bumping");
    void this.scoreValue.offsetWidth;
    this.scoreValue.classList.add("is-bumping");
  }

  updateBest(best, isRecord = false) {
    this.bestValue.textContent = String(best);
    if (isRecord) {
      this.bestValue.classList.remove("is-record");
      void this.bestValue.offsetWidth;
      this.bestValue.classList.add("is-record");
    }
  }

  updateRunStats(length, elapsedMs) {
    this.lengthValue.textContent = String(length).padStart(2, "0");
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    this.timerValue.textContent = `${minutes}:${seconds}`;
  }

  showMenuStats(metrics) {
    this.overlayStats.replaceChildren(...metrics.map(({ label, value }) => {
      const item = document.createElement("div");
      item.className = "end-stat";
      const name = document.createElement("span");
      name.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value;
      item.append(name, result);
      return item;
    }));
  }

  showEndStats({ score, best, length, elapsedMs, bulletHits, isRecord }) {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const duration = `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
    const metrics = [
      ["Счёт", Number.isInteger(score) ? String(score) : score.toFixed(1)],
      ["Рекорд", String(best)],
      ["Длина", String(length)],
      ["Время", duration],
      ["Пулевые попадания", String(bulletHits)],
    ];
    this.overlayStats.replaceChildren(...metrics.map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "end-stat";
      const name = document.createElement("span");
      name.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value;
      item.append(name, result);
      return item;
    }));
    this.overlay.classList.toggle("has-new-record", isRecord);
  }

  clearEndStats() {
    this.overlayStats.replaceChildren();
    this.overlay.classList.remove("has-new-record");
  }

  floatScore(text) {
    const score = document.createElement("span");
    score.className = "score-float";
    score.textContent = text;
    this.floatLayer.appendChild(score);
    window.setTimeout(() => score.remove(), 900);
  }

  showNotification(type, text) {
    while (this.toastStack.children.length >= 3) this.toastStack.firstElementChild.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.type = type;
    toast.setAttribute("role", "status");
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = type === "record" ? "★" : type === "achievement" ? "◆" : type === "combat" ? "⌖" : "•";
    const label = document.createElement("span");
    label.textContent = text;
    toast.append(icon, label);
    this.toastStack.appendChild(toast);
    this.audioManager.playSFX("toggle");
    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 240);
    }, 3000);
  }

  playUiSound() {
    const now = performance.now();
    if (now - this.lastUiSoundAt < 90) return;
    this.lastUiSoundAt = now;
    this.audioManager.playSFX("toggle");
  }

  applyTheme(theme, persist = true) {
    if (!this.themeNames.includes(theme)) return;
    this.app.dataset.theme = theme;
    document.documentElement.dataset.theme = theme;
    this.currentTheme = theme;
    if (persist) {
      try {
        safeStorage.setItem("snake-theme", theme);
      } catch {}
    }
  }

  cycleTheme() {
    const currentIndex = this.themeNames.indexOf(this.currentTheme);
    const next = this.themeNames[(currentIndex + 1) % this.themeNames.length];
    this.applyTheme(next);
    return this.themeLabels[next];
  }
}