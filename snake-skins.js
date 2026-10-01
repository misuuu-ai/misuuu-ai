const snakeSkins = [
  { id: "classic", name: "Классика", icon: "●", description: "Зелёная змейка из детства.", headColor: "#c7f36b", bodyGradient: ["#76c84c", "#2e7d43"], eyeColor: "#fffdf2", pupilColor: "#17241a", pattern: null, glowColor: null },
  { id: "fire", name: "Жар-птица", icon: "✦", description: "Тёплый градиент и хвостовой огонёк.", headColor: "#ffd06b", bodyGradient: ["#ff9158", "#ce3c37"], eyeColor: "#fff5d7", pupilColor: "#4a1e22", pattern: "stripes", glowColor: "#ff673f", effect: "fire" },
  { id: "ice", name: "Ледник", icon: "✳", description: "Холодный блеск и снежная крошка.", headColor: "#effcff", bodyGradient: ["#b9f4f4", "#55a9d7"], eyeColor: "#fff", pupilColor: "#173654", pattern: "dots", glowColor: "#94e7ff", effect: "ice" },
  { id: "electric", name: "Импульс", icon: "ϟ", description: "Заряжается от каждого поворота.", headColor: "#f8ff82", bodyGradient: ["#ffe76d", "#7e8cf2"], eyeColor: "#fff", pupilColor: "#262550", pattern: "stripes", glowColor: "#a8f6ff", effect: "electric" },
  { id: "rainbow", name: "Спектр", icon: "◉", description: "Радуга меняется по длине змейки.", headColor: "#ffb7de", bodyGradient: ["#8a78ff", "#35d5bd"], eyeColor: "#fff", pupilColor: "#24213f", pattern: "dots", glowColor: "#da9dff", effect: "rainbow", unlock: { stat: "best", value: 1000, hint: "Набери 1000 очков" } },
  { id: "shadow", name: "Полуночник", icon: "◐", description: "Матовый чёрный и фиолетовая дымка.", headColor: "#75658f", bodyGradient: ["#514461", "#171722"], eyeColor: "#f3dcff", pupilColor: "#1b1023", pattern: "scales", glowColor: "#9d70d1", effect: "shadow" },
  { id: "nature", name: "Лесной", icon: "❧", description: "Листовой узор и мягкие земляные тона.", headColor: "#d4d77a", bodyGradient: ["#9da65c", "#59643b"], eyeColor: "#fff5da", pupilColor: "#253021", pattern: "scales", glowColor: null, effect: "leaves" },
  { id: "cyberpunk", name: "Неон", icon: "⌁", description: "Розовый импульс на бирюзовых рёбрах.", headColor: "#ff86cf", bodyGradient: ["#ee6fbb", "#45d4c7"], eyeColor: "#fff", pupilColor: "#311639", pattern: "stripes", glowColor: "#f78cff", effect: "glitch", unlock: { stat: "boosts", value: 50, hint: "Используй ускорение 50 раз" } },
  { id: "military", name: "Камуфляж", icon: "▦", description: "Пятнистый строй. Ни одного лишнего манёвра.", headColor: "#d0c99b", bodyGradient: ["#85845a", "#54503d"], eyeColor: "#fff4cd", pupilColor: "#27251c", pattern: "camo", glowColor: null, effect: "helmet", unlock: { stat: "bulletHits", value: 100, hint: "Попади пулей в 100 порций еды" } },
  { id: "battle", name: "Боевой", icon: "✪", description: "Алый панцирь. Яблоки не готовы.", headColor: "#ff8b69", bodyGradient: ["#d34a44", "#532d35"], eyeColor: "#fff1dc", pupilColor: "#321a24", pattern: "camo", glowColor: "#ff584d", effect: "helmet", battleGlow: true, unlock: { stat: "combatUses", value: 10, hint: "Включи боевой режим 10 раз" } },
];

class SnakeSkinManager {
  constructor() {
    this.skinMap = new Map(snakeSkins.map((skin) => [skin.id, skin]));
    this.defaultUnlocked = ["classic", "fire", "ice", "electric", "shadow", "nature"];
    this.unlocked = new Set(this.defaultUnlocked);
    this.stats = { combatUses: 0, boosts: 0, bulletHits: 0 };
    this._load();
  }

  _load() {
    try {
      const savedUnlocks = JSON.parse(safeStorage.getItem("unlockedSkins") || "[]");
      savedUnlocks.filter((id) => this.skinMap.has(id)).forEach((id) => this.unlocked.add(id));
      const savedStats = JSON.parse(safeStorage.getItem("snakeCosmeticStats") || "{}");
      Object.keys(this.stats).forEach((key) => {
        if (Number.isSafeInteger(savedStats[key]) && savedStats[key] >= 0) this.stats[key] = savedStats[key];
      });
    } catch {}
    const savedSkin = safeStorage.getItem("snakeSkin");
    this.currentId = this.unlocked.has(savedSkin) ? savedSkin : "classic";
    this._saveUnlocks();
    safeStorage.setItem("snakeSkin", this.currentId);
  }

  get current() {
    return this.skinMap.get(this.currentId) || this.skinMap.get("classic");
  }

  getAll() {
    return snakeSkins.map((skin) => ({ ...skin, unlocked: this.unlocked.has(skin.id) }));
  }

  select(id) {
    const skin = this.skinMap.get(id);
    if (!skin) return { ok: false, reason: "Такого скина нет." };
    if (!this.unlocked.has(id)) return { ok: false, reason: skin.unlock?.hint || "Скин пока закрыт." };
    this.currentId = id;
    safeStorage.setItem("snakeSkin", id);
    return { ok: true, skin };
  }

  record(stat, amount = 1) {
    if (!(stat in this.stats)) return [];
    this.stats[stat] += amount;
    safeStorage.setItem("snakeCosmeticStats", JSON.stringify(this.stats));
    return this.checkUnlocks();
  }

  checkUnlocks(bestScore = 0) {
    const newlyUnlocked = [];
    snakeSkins.forEach((skin) => {
      if (!skin.unlock || this.unlocked.has(skin.id)) return;
      const value = skin.unlock.stat === "best" ? bestScore : this.stats[skin.unlock.stat] || 0;
      if (value < skin.unlock.value) return;
      this.unlocked.add(skin.id);
      newlyUnlocked.push(skin);
    });
    if (newlyUnlocked.length) this._saveUnlocks();
    return newlyUnlocked;
  }

  _saveUnlocks() {
    safeStorage.setItem("unlockedSkins", JSON.stringify([...this.unlocked]));
  }

  drawSegment(context, part, index, length, direction, cellSize, now, boosted, combatActive, offsetX = 0, offsetY = 0) {
    const skin = this.current;
    const pad = 2;
    const x = part.x * cellSize + pad + offsetX;
    const y = part.y * cellSize + pad + offsetY;
    const size = cellSize - pad * 2;
    const isHead = index === 0;
    const palette = skin.bodyGradient || [skin.bodyColor || "#76c84c", skin.bodyColor || "#2e7d43"];
    const glow = skin.battleGlow && combatActive ? skin.glowColor : skin.glowColor;
    const segmentFill = skin.effect === "rainbow" && !isHead
      ? `hsl(${(now / 42 + index * 34) % 360} 80% 59%)`
      : null;

    context.save();
    context.shadowColor = glow || "transparent";
    context.shadowBlur = glow ? (boosted || (skin.battleGlow && combatActive) ? 15 : 8) : 0;
    context.fillStyle = isHead ? skin.headColor : segmentFill || context.createLinearGradient(x, y, x + size, y + size);
    if (!isHead && !segmentFill) {
      context.fillStyle.addColorStop(0, palette[0]);
      context.fillStyle.addColorStop(1, palette[1]);
    }
    this._roundRect(context, x, y, size, size, Math.min(5, size * 0.24));
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = isHead ? (skin.glowColor || palette[0]) : palette[1];
    context.lineWidth = 1.25;
    context.stroke();
    this._drawPattern(context, skin.pattern, x, y, size, index, now);
    if (isHead) this._drawEyes(context, x, y, size, direction, skin);
    if (index === length - 1) this._drawTailEffect(context, x, y, size, direction, skin, now);
    if (combatActive && skin.battleGlow) this._drawBattleSpark(context, x, y, size, index, now);
    context.restore();
  }

  _roundRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  _drawPattern(context, pattern, x, y, size, index, now) {
    if (!pattern) return;
    context.save();
    this._roundRect(context, x, y, size, size, Math.min(5, size * 0.24));
    context.clip();
    context.lineWidth = 1;
    if (pattern === "stripes") {
      context.strokeStyle = "rgba(255,255,255,0.24)";
      for (let stripe = -1; stripe < 3; stripe += 1) {
        context.beginPath();
        context.moveTo(x + stripe * 7 + ((index % 2) * 3), y);
        context.lineTo(x + stripe * 7 + 8 + ((index % 2) * 3), y + size);
        context.stroke();
      }
    } else if (pattern === "dots") {
      context.fillStyle = "rgba(255,255,255,0.34)";
      [[0.28, 0.34], [0.7, 0.68]].forEach(([dx, dy]) => {
        context.beginPath();
        context.arc(x + size * dx, y + size * dy, Math.max(1, size * 0.07), 0, Math.PI * 2);
        context.fill();
      });
    } else if (pattern === "scales") {
      context.strokeStyle = "rgba(244,255,213,0.34)";
      [0.3, 0.65].forEach((offset) => {
        context.beginPath();
        context.arc(x + size * offset, y + size * 0.73, size * 0.22, Math.PI, Math.PI * 2);
        context.stroke();
      });
    } else if (pattern === "camo") {
      const patches = [
        [0.14, 0.18, 0.38, 0.24],
        [0.55, 0.15, 0.36, 0.36],
        [0.28, 0.62, 0.48, 0.25],
      ];
      patches.forEach(([px, py, width, height], patchIndex) => {
        context.fillStyle = patchIndex % 2 ? "rgba(41,49,35,0.42)" : "rgba(222,198,124,0.24)";
        context.beginPath();
        context.ellipse(x + size * px, y + size * py, size * width * 0.36, size * height * 0.52, patchIndex, 0, Math.PI * 2);
        context.fill();
      });
    }
    if (pattern === "stripes" && index === 0 && now % 1000 < 35) {
      context.fillStyle = "rgba(255,255,255,0.18)";
      context.fillRect(x, y, size, size);
    }
    context.restore();
  }

  _drawEyes(context, x, y, size, direction, skin) {
    const dx = direction?.x || 1;
    const dy = direction?.y || 0;
    const eyeDistance = size * 0.17;
    const forward = size * 0.24;
    const perpendicularX = -dy;
    const perpendicularY = dx;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    [-1, 1].forEach((side) => {
      const eyeX = centerX + dx * forward + perpendicularX * eyeDistance * side;
      const eyeY = centerY + dy * forward + perpendicularY * eyeDistance * side;
      context.fillStyle = skin.eyeColor;
      context.beginPath();
      context.arc(eyeX, eyeY, size * 0.115, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = skin.pupilColor;
      context.beginPath();
      context.arc(eyeX + dx * size * 0.035, eyeY + dy * size * 0.035, size * 0.05, 0, Math.PI * 2);
      context.fill();
    });
    if (skin.effect === "helmet") {
      context.strokeStyle = "rgba(35,38,29,0.86)";
      context.lineWidth = Math.max(2, size * 0.12);
      context.beginPath();
      context.arc(centerX, centerY, size * 0.38, Math.PI * 1.05, Math.PI * 1.95);
      context.stroke();
    }
  }

  _drawTailEffect(context, x, y, size, direction, skin, now) {
    if (!skin.effect) return;
    const centerX = x + size / 2 - (direction?.x || 1) * size * 0.35;
    const centerY = y + size / 2 - (direction?.y || 0) * size * 0.35;
    const pulse = 0.65 + Math.sin(now / 100) * 0.25;
    context.save();
    context.globalAlpha = pulse;
    context.fillStyle = skin.glowColor || skin.bodyGradient[0];
    if (skin.effect === "fire") {
      context.beginPath();
      context.moveTo(centerX - size * 0.17, centerY);
      context.quadraticCurveTo(centerX - size * 0.34, centerY - size * 0.3, centerX - size * 0.4, centerY - size * 0.04);
      context.quadraticCurveTo(centerX - size * 0.3, centerY + size * 0.12, centerX - size * 0.17, centerY);
      context.fill();
    } else if (skin.effect === "ice" || skin.effect === "leaves") {
      context.globalAlpha = 0.48;
      context.beginPath();
      context.arc(centerX, centerY, size * 0.08, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(centerX - size * 0.18, centerY + size * 0.1, size * 0.055, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  _drawBattleSpark(context, x, y, size, index, now) {
    if ((index + Math.floor(now / 110)) % 3 !== 0) return;
    context.fillStyle = "#ffcf83";
    context.globalAlpha = 0.55 + Math.sin(now / 55 + index) * 0.25;
    context.fillRect(x + size * 0.75, y + size * 0.18, 2, 2);
    context.globalAlpha = 1;
  }
}