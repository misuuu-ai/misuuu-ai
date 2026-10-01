const fieldThemes = [
  { id: "classic", name: "Классика", icon: "▦", description: "Тёмное поле и спокойная сетка.", backgroundColor: "#07140c", gridColor: "rgba(34,197,94,0.10)", borderColor: "#566a52", pattern: null },
  { id: "cosmos", name: "Космос", icon: "✦", description: "Глубокая ночь с тихими звёздами.", backgroundColor: "#090d20", gridColor: "rgba(105,132,233,0.15)", borderColor: "#8275d0", pattern: "stars", ambientParticles: "stars" },
  { id: "forest", name: "Лес", icon: "❧", description: "Хвойная тень и листовой свет.", backgroundColor: "#101b13", gridColor: "rgba(141,174,105,0.13)", borderColor: "#8c7553", pattern: "leaves", ambientParticles: "leaves" },
  { id: "cyberpunk", name: "Киберпанк", icon: "⌁", description: "Розовые контуры в ночном городе.", backgroundColor: "#160d20", gridColor: "rgba(247,92,211,0.17)", borderColor: "#e872c8", pattern: "circuit" },
  { id: "desert", name: "Пустыня", icon: "◇", description: "Тёплый песок, длинные тени.", backgroundColor: "#30251b", gridColor: "rgba(245,190,110,0.14)", borderColor: "#ce9860", pattern: "dunes" },
  { id: "winter", name: "Зима", icon: "✳", description: "Ледяное поле и редкий снег.", backgroundColor: "#d7e9e9", gridColor: "rgba(55,125,154,0.19)", borderColor: "#4d9cb8", pattern: "snow", ambientParticles: "snow" },
  { id: "hell", name: "Жар", icon: "△", description: "Тёмная порода с жаром под сеткой.", backgroundColor: "#1e1013", gridColor: "rgba(255,103,71,0.15)", borderColor: "#d65c40", pattern: "lava" },
  { id: "ocean", name: "Океан", icon: "≈", description: "Глубокая вода и мягкие волны.", backgroundColor: "#082332", gridColor: "rgba(64,177,203,0.16)", borderColor: "#51aac0", pattern: "waves", ambientParticles: "bubbles" },
];

class FieldThemeManager {
  constructor() {
    this.themeMap = new Map(fieldThemes.map((theme) => [theme.id, theme]));
    const savedTheme = safeStorage.getItem("fieldTheme");
    this.currentId = this.themeMap.has(savedTheme) ? savedTheme : "classic";
    this.apply(this.currentId, false);
  }

  get current() {
    return this.themeMap.get(this.currentId) || this.themeMap.get("classic");
  }

  getAll() {
    return fieldThemes.map((theme) => ({ ...theme, unlocked: true }));
  }

  select(id) {
    if (!this.themeMap.has(id)) return false;
    this.apply(id);
    return true;
  }

  apply(id, persist = true) {
    this.currentId = this.themeMap.has(id) ? id : "classic";
    const theme = this.current;
    const app = document.querySelector(".app");
    app.dataset.fieldTheme = theme.id;
    app.style.setProperty("--field-frame", theme.borderColor);
    app.style.setProperty("--field-surface", theme.backgroundColor);
    document.querySelector(".board-wrap").style.borderColor = theme.borderColor;
    if (persist) safeStorage.setItem("fieldTheme", theme.id);
  }

  draw(context, width, height, now, combatActive) {
    const theme = this.current;
    if (theme.id === "ocean") {
      const gradient = context.createLinearGradient(0, 0, width * 0.65, height);
      gradient.addColorStop(0, "#061c2a");
      gradient.addColorStop(0.58, theme.backgroundColor);
      gradient.addColorStop(1, "#0a3841");
      context.fillStyle = gradient;
    } else {
      context.fillStyle = theme.backgroundColor;
    }
    context.fillRect(0, 0, width, height);

    if (theme.pattern === "stars" || theme.pattern === "snow" || theme.pattern === "leaves" || theme.pattern === "waves") {
      this._drawAmbient(context, width, height, now, theme);
    }
    if (theme.pattern === "circuit") this._drawCircuit(context, width, height);
    if (theme.pattern === "dunes" || theme.pattern === "lava") this._drawContours(context, width, height, now, theme);

    if (combatActive) {
      context.fillStyle = theme.id === "hell" ? "rgba(255,48,35,0.055)" : "rgba(219,56,42,0.035)";
      context.fillRect(0, 0, width, height);
    }

    context.strokeStyle = theme.gridColor;
    context.lineWidth = 1;
    for (let index = 0; index <= COLS; index += 1) {
      const x = index * width / COLS + 0.5;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let index = 0; index <= ROWS; index += 1) {
      const y = index * height / ROWS + 0.5;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
  }

  _drawAmbient(context, width, height, now, theme) {
    const count = theme.pattern === "stars" ? 26 : 15;
    for (let index = 0; index < count; index += 1) {
      const seed = index * 127.1 + 311.7;
      const baseX = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
      const baseY = ((Math.cos(seed * 0.71) * 24634.6345) % 1 + 1) % 1;
      const drift = ((now * (theme.pattern === "snow" ? 0.012 : 0.004) + index * 11) % height);
      const x = baseX * width + (theme.pattern === "leaves" ? Math.sin(now / 650 + index) * 7 : 0);
      const y = (baseY * height + drift) % height;
      const twinkle = 0.2 + (Math.sin(now / 460 + index * 2) + 1) * 0.18;
      context.globalAlpha = theme.pattern === "stars" ? twinkle : 0.23;
      context.fillStyle = theme.pattern === "snow" ? "#ffffff" : theme.pattern === "leaves" ? "#a9c978" : theme.pattern === "waves" ? "#78d8e9" : "#d8dcff";
      context.beginPath();
      context.arc(x, y, theme.pattern === "stars" ? (index % 4 === 0 ? 1.5 : 0.9) : 1.7, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  _drawCircuit(context, width, height) {
    context.save();
    context.strokeStyle = "rgba(86,232,223,0.16)";
    context.lineWidth = 1;
    for (let x = width * 0.15; x < width; x += width * 0.28) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height * 0.27);
      context.lineTo(x + width * 0.1, height * 0.27);
      context.lineTo(x + width * 0.1, height * 0.51);
      context.stroke();
    }
    context.restore();
  }

  _drawContours(context, width, height, now, theme) {
    context.save();
    context.strokeStyle = theme.pattern === "lava" ? "rgba(255,106,52,0.10)" : "rgba(255,206,130,0.10)";
    context.lineWidth = 1;
    for (let band = 0; band < 4; band += 1) {
      const baseY = height * (0.18 + band * 0.23);
      context.beginPath();
      for (let x = -8; x <= width + 8; x += 12) {
        const y = baseY + Math.sin(x / 44 + band + now / 1700) * (theme.pattern === "lava" ? 3 : 5);
        if (x === -8) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.restore();
  }
}