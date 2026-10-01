const COLS = 20;
const ROWS = 20;
const START_MS = 140;
const MIN_MS = 70;
const BOOST_MULTIPLIER = 1.8;
const SHOT_INTERVAL_MS = 260;
const BULLET_SPEED_MULTIPLIER = 3.5;
const BULLET_SCORE_MULTIPLIER = 0.5;
const WEAPON_SCALE = 13;

class CombatWeapon {
  constructor() {
    this.reset();
  }

  reset() {
    this.active = false;
    this.bullets = [];
    this.casings = [];
    this.nextShotAt = 0;
    this.muzzleUntil = 0;
    this.recoilUntil = 0;
  }

  activate(now) {
    this.active = true;
    this.nextShotAt = now;
  }

  deactivate() {
    this.active = false;
  }

  hasEffects() {
    return this.active || this.bullets.length > 0 || this.casings.length > 0;
  }

  clearProjectiles() {
    this.bullets = [];
    this.casings = [];
  }

  update(delta, now, head, direction, food, stepMs, boosted, boardSize, onFoodHit, onSound) {
    if (this.active) {
      if (now >= this.nextShotAt) {
        this.nextShotAt = now + SHOT_INTERVAL_MS;
        this.fire(now, head, direction, stepMs, boosted, onSound);
      }
    }

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.previousX = bullet.x;
      bullet.previousY = bullet.y;
      bullet.x += bullet.dx * bullet.speed * delta;
      bullet.y += bullet.dy * bullet.speed * delta;
      if (bullet.x < 0 || bullet.x > boardSize || bullet.y < 0 || bullet.y > boardSize) {
        this.bullets.splice(index, 1);
        continue;
      }
      if (food && distanceToSegment(food.x, food.y, bullet.previousX, bullet.previousY, bullet.x, bullet.y) < cell * 0.48) {
        food = null;
        this.bullets.splice(index, 1);
        onFoodHit();
      }
    }

    for (let index = this.casings.length - 1; index >= 0; index -= 1) {
      const casing = this.casings[index];
      casing.x += casing.dx * delta;
      casing.y += casing.dy * delta;
      casing.dy += 120 * delta;
      casing.life -= delta;
      if (casing.life <= 0) this.casings.splice(index, 1);
    }
  }

  fire(now, head, direction, stepMs, boosted, onSound) {
    const headX = head.x * cell + cell / 2;
    const headY = head.y * cell + cell / 2;
    const muzzleOffset = cell * 0.18 + 17 * (cell / WEAPON_SCALE);
    const muzzleX = headX + direction.x * muzzleOffset;
    const muzzleY = headY + direction.y * muzzleOffset;
    const activeStep = stepMs / (boosted ? BOOST_MULTIPLIER : 1);
    this.bullets.push({
      x: muzzleX,
      y: muzzleY,
      previousX: muzzleX,
      previousY: muzzleY,
      dx: direction.x,
      dy: direction.y,
      speed: (cell * 1000 / activeStep) * BULLET_SPEED_MULTIPLIER,
    });
    this.casings.push({
      x: headX - direction.y * cell * 0.1,
      y: headY + direction.x * cell * 0.1,
      dx: -direction.x * 20 - direction.y * 42,
      dy: -direction.y * 20 + direction.x * 42,
      life: 0.7,
    });
    this.muzzleUntil = now + 70;
    this.recoilUntil = now + 90;
    onSound("shot");
  }

  draw(context, now, head, direction) {
    if (!head || !direction) return;
    const headX = head.x * cell + cell / 2;
    const headY = head.y * cell + cell / 2;
    const angle = Math.atan2(direction.y, direction.x);
    const recoil = now < this.recoilUntil ? (this.recoilUntil - now) / 90 * 2 : 0;

    context.save();
    context.strokeStyle = "rgba(251, 191, 36, 0.75)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(headX, headY, cell * 0.52, 0, Math.PI * 2);
    context.moveTo(headX - 3, headY);
    context.lineTo(headX + 3, headY);
    context.moveTo(headX, headY - 3);
    context.lineTo(headX, headY + 3);
    context.stroke();
    context.translate(headX + direction.x * cell * 0.18 - direction.x * recoil, headY + direction.y * cell * 0.18 - direction.y * recoil);
    context.rotate(angle);
    context.scale(cell / WEAPON_SCALE, cell / WEAPON_SCALE);
    this.drawRifle(context, now);
    context.restore();

    this.bullets.forEach((bullet) => {
      context.strokeStyle = "rgba(253, 230, 138, 0.75)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bullet.previousX, bullet.previousY);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
      context.fillStyle = "#fde68a";
      context.beginPath();
      context.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2);
      context.fill();
    });

    this.casings.forEach((casing) => {
      context.globalAlpha = Math.min(1, casing.life * 2);
      context.fillStyle = "#fbbf24";
      context.fillRect(casing.x, casing.y, 3, 2);
    });
    context.globalAlpha = 1;
  }

  drawRifle(context, now) {
    context.lineCap = "round";
    context.fillStyle = "#516b42";
    roundRect(-8, -1.8, 6, 3.6, 0.8);
    context.fill();
    context.fillStyle = "#77865a";
    roundRect(-2, -2.2, 9, 4.4, 0.8);
    context.fill();
    context.fillStyle = "#344735";
    context.fillRect(5, -1.1, 11, 2.2);
    context.fillRect(15, -1.7, 2, 3.4);
    context.beginPath();
    context.moveTo(0, 1.3);
    context.lineTo(3, 1.3);
    context.lineTo(2, 5.2);
    context.lineTo(0, 5.2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(3, 1.7);
    context.lineTo(6, 2);
    context.lineTo(5.6, 6.2);
    context.lineTo(4, 6.7);
    context.lineTo(2.4, 3.2);
    context.closePath();
    context.fillStyle = "#516b42";
    context.fill();
    context.strokeStyle = "#d1d5bd";
    context.lineWidth = 0.45;
    context.beginPath();
    context.arc(1.7, 1.8, 1.4, 0.1, Math.PI * 1.8);
    context.stroke();
    this.drawFlag(context, now);

    if (now < this.muzzleUntil) {
      context.fillStyle = "#fde68a";
      context.beginPath();
      context.moveTo(17, 0);
      context.lineTo(20, -1.6);
      context.lineTo(19.2, 0);
      context.lineTo(20, 1.6);
      context.closePath();
      context.fill();
    }
  }

  drawFlag(context, now) {
    const colors = ["#f8fafc", "#3b82f6", "#ef4444"];
    const wave = (x) => Math.sin(now / 110 + x * 0.45) * 0.7;
    context.strokeStyle = "#cbd5c0";
    context.lineWidth = 0.5;
    context.beginPath();
    context.moveTo(-1, -4);
    context.lineTo(-1, -14);
    context.stroke();
    colors.forEach((color, stripe) => {
      const top = -13.5 + stripe * 2.2;
      const bottom = top + 2.2;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(-0.5, top + wave(0));
      for (let x = 0; x <= 12; x += 2) context.lineTo(x, top + wave(x));
      for (let x = 12; x >= 0; x -= 2) context.lineTo(x, bottom + wave(x));
      context.closePath();
      context.fill();
    });
  }
}

const STATE = {
  MENU: "MENU",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  GAME_OVER: "GAME_OVER",
};

const canvas = document.getElementById("board");
const ctx = canvas ? canvas.getContext("2d") : null;
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const menuActions = document.getElementById("menu-actions");
const pauseBtn = document.getElementById("pause-btn");
const pad = document.getElementById("pad");
const boostBtn = document.getElementById("boost-btn");
const combatBtn = document.getElementById("combat-btn");
const combatIndicator = document.getElementById("combat-indicator");

const cell = canvas.width / COLS;
const dirs = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const opposite = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const BEST_KEY = "snake-best";
const SOUND_KEY = "snake-sound";
const audioManager = new AudioManager({ enabled: safeStorage.getItem(SOUND_KEY) !== "off" });
const snakeSkinManager = new SnakeSkinManager();
const fieldThemeManager = new FieldThemeManager();
const uiManager = new UIManager(audioManager);
const cameoManager = new CameoManager(uiManager, () => {
  if (menuScreen === "cameos") showCameoSettings(settingsReturnScreen);
});
const combatWeapon = new CombatWeapon();
const hitsEl = document.getElementById("hits-value");
const customizationUI = new CustomizationUI(snakeSkinManager, fieldThemeManager, uiManager, () => draw());

let snake;
let dir;
let queuedDir;
let food;
let score;
let foodEaten = 0;
let bulletFoodEaten = 0;
let boostFoodEaten = 0;
let pendingGrowth = 0;
let boostActive = false;
let trail = [];
const savedBest = Number(safeStorage.getItem(BEST_KEY));
let best = Number.isFinite(savedBest) && savedBest >= 0 ? savedBest : 0;
let soundOn = audioManager.isEnabled;
let lastScore = 0;
let newRecord = false;
let lastTick = 0;
let lastFrameAt = 0;
let lastHudAt = 0;
let lastThemeFrameAt = 0;
let lastCombatToggleAt = -Infinity;
let stepMs = START_MS;
let runStartedAt = 0;
let elapsedBeforePause = 0;
let state = STATE.MENU;
let mobileControls;
let menuScreen = "main";
let selectedIndex = 0;
let menuItems = [];
let settingsReturnScreen = "main";

uiManager.updateBest(best);
snakeSkinManager.checkUnlocks(best);
console.log("Game initialized successfully");

function notifyNewSkins(skins) {
  skins.forEach((skin) => uiManager.showNotification("achievement", `Открыт скин «${skin.name}»`));
}

function getRunElapsedMs(now = performance.now()) {
  return elapsedBeforePause + (state === STATE.PLAYING && runStartedAt ? now - runStartedAt : 0);
}

function resetBoard() {
  const mid = Math.floor(COLS / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  dir = "right";
  queuedDir = "right";
  score = 0;
  foodEaten = 0;
  bulletFoodEaten = 0;
  boostFoodEaten = 0;
  pendingGrowth = 0;
  elapsedBeforePause = 0;
  runStartedAt = 0;
  newRecord = false;
  boostActive = false;
  trail = [];
  combatWeapon.reset();
  audioManager.stopAnthem(0);
  stepMs = START_MS;
  placeFood();
  uiManager.updateScore(0);
  uiManager.updateRunStats(snake.length, 0);
  uiManager.clearEndStats();
  hitsEl.textContent = "00";
  updateCombatUi();
  draw();
}

function placeFood() {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  food = free[Math.floor(Math.random() * free.length)];
}

function setPlayingUi(isPlaying) {
  pauseBtn.classList.toggle("hidden", !isPlaying);
  pad.classList.toggle("is-active", isPlaying);
  pad.setAttribute("aria-hidden", String(!isPlaying));
  mobileControls?.setPlaying(isPlaying);
  boostBtn.classList.toggle("is-available", isPlaying);
  combatBtn.classList.toggle("is-available", isPlaying);
  if (!isPlaying) setBoostActive(false);
  updateCombatUi();
}

function updateCombatUi() {
  const combatBtnEl = document.getElementById("combat-btn");
  const combatIndicatorEl = document.getElementById("combat-indicator");
  const modeValue = document.getElementById("mode-value");

  if (combatBtnEl) {
    combatBtnEl.classList.toggle("is-active", combatWeapon.active);
    combatBtnEl.setAttribute("aria-pressed", String(combatWeapon.active));
  }
  if (combatIndicatorEl) {
    combatIndicatorEl.classList.toggle("hidden", !combatWeapon.active || state !== STATE.PLAYING);
  }
  if (modeValue) {
    modeValue.textContent = combatWeapon.active ? "БОЕВОЙ" : "КЛАССИЧЕСКИЙ";
  }
}

function setBoostActive(isActive) {
  const next = isActive && state === STATE.PLAYING;
  if (boostActive === next) return;
  boostActive = next;
  boostBtn.classList.toggle("is-boosting", boostActive);
  boostBtn.setAttribute("aria-pressed", String(boostActive));
  if (boostActive) notifyNewSkins(snakeSkinManager.record("boosts"));
  if (!boostActive) trail = [];
  if (snake) draw();
}

function setCombatActive(isActive, fadeDuration = 1500) {
  const next = isActive && state === STATE.PLAYING;
  if (combatWeapon.active === next) return;
  const now = performance.now();
  if (next) {
    combatWeapon.activate(now);
    notifyNewSkins(snakeSkinManager.record("combatUses"));
    audioManager.playAnthem();
    audioManager.playSFX("toggle");
  } else {
    combatWeapon.deactivate();
    audioManager.stopAnthem(fadeDuration);
    audioManager.playSFX("toggle");
  }
  cameoManager.setCombatActive(next);
  if (state === STATE.PLAYING) {
    uiManager.showNotification("combat", next ? "Боевой режим активирован" : "Боевой режим выключен");
    mobileControls?.haptic("combat");
  }
  updateCombatUi();
  draw();
}

function toggleCombat() {
  if (state !== STATE.PLAYING) return;
  const now = performance.now();
  if (now - lastCombatToggleAt < 180) return;
  lastCombatToggleAt = now;
  setCombatActive(!combatWeapon.active);
}

function renderMenu(title, text, items) {
  console.log("renderMenu called with:", title, items);
  overlayTitle.textContent = title;
  overlayText.textContent = text || "";
  menuItems = items;
  if (selectedIndex >= menuItems.length) selectedIndex = 0;
  menuActions.innerHTML = "";
  menuItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `menu-btn${item.primary ? " is-primary" : ""}`;
    button.textContent = item.label;
    button.dataset.index = String(index);
    button.dataset.indexLabel = String(index + 1).padStart(2, "0");
    button.style.setProperty("--stagger", `${index * 90}ms`);
    if (index === selectedIndex) button.classList.add("is-selected");
    button.addEventListener("click", () => {
      selectedIndex = index;
      uiManager.playUiSound();
      item.action();
    });
    button.addEventListener("mouseenter", () => {
      selectedIndex = index;
      highlightSelection();
      uiManager.playUiSound();
    });
    button.addEventListener("focus", () => {
      selectedIndex = index;
      highlightSelection();
    });
    menuActions.appendChild(button);
  });
  overlay.classList.remove("hidden");
  console.log("Overlay hidden class removed, overlay classes:", overlay.className);
  const screenNames = {
    main: "MENU",
    records: "RECORDS",
    settings: "SETTINGS",
    controls: "CONTROLS",
    about: "ABOUT",
    pause: "PAUSED",
    over: "GAME_OVER",
    cameos: "CAMEOS",
  };
  uiManager.showScreen(screenNames[menuScreen] || "MENU");
}

function highlightSelection() {
  [...menuActions.children].forEach((button, index) => {
    button.classList.toggle("is-selected", index === selectedIndex);
  });
}

function activateSelected() {
  const item = menuItems[selectedIndex];
  if (item) {
    uiManager.playUiSound();
    item.action();
  }
}

function showMainMenu() {
  console.log("showMainMenu called");
  menuScreen = "main";
  selectedIndex = 0;
  setPlayingUi(false);
  uiManager.clearEndStats();
  renderMenu("ЗМЕЙКА ХАСАНАТОР", "Точность, аппетит и ни одного резкого поворота.", [
    { label: "Начать забег", action: startGame, primary: true },
    { label: "Рекорды", action: showRecords },
    { label: "Настройки", action: () => showSettings("main") },
    { label: "Управление", action: showControls },
    { label: "Об игре", action: showAbout },
  ]);
}

function showRecords() {
  menuScreen = "records";
  selectedIndex = 0;
  uiManager.showMenuStats([
    { label: "ЛУЧШИЙ РЕЗУЛЬТАТ", value: String(best) },
    { label: "ПОСЛЕДНИЙ ЗАБЕГ", value: String(lastScore) },
  ]);
  renderMenu("РЕКОРДЫ", "Личная таблица лидеров. Пока без чит-кодов.", [
    { label: "Новый забег", action: startGame, primary: true },
    { label: "Назад", action: showMainMenu },
  ]);
}

function showSettings(returnScreen = "main") {
  settingsReturnScreen = returnScreen;
  menuScreen = "settings";
  selectedIndex = 0;
  uiManager.clearEndStats();
  renderMenu("НАСТРОЙКИ", "Тема сохраняется на этом устройстве.", [
    {
      label: "Внешний вид: змейка и поле",
      action: () => {
        menuScreen = "customization";
        customizationUI.open(() => showSettings(returnScreen));
      },
    },
    {
      label: soundOn ? "Звук: включён" : "Звук: выключен",
      action: toggleSound,
    },
    {
      label: `Тема: ${uiManager.themeLabels[uiManager.currentTheme]}`,
      action: () => {
        const themeName = uiManager.cycleTheme();
        uiManager.showNotification("saved", `Тема «${themeName}» выбрана`);
        showSettings(returnScreen);
      },
    },
    {
      label: `Камео-картинки: ${cameoManager.isEnabled ? "вкл" : "выкл"}`,
      action: () => {
        cameoManager.toggleEnabled(!cameoManager.isEnabled);
        uiManager.showNotification("saved", cameoManager.isEnabled ? "Камео включены" : "Камео выключены");
        showSettings(returnScreen);
      },
    },
    {
      label: `Мои картинки (${cameoManager.images.length}/5)`,
      action: () => showCameoSettings(returnScreen),
    },
    { label: "Назад", action: () => returnScreen === "pause" ? showPauseMenu() : showMainMenu() },
  ]);
  mobileControls?.renderSettings(menuActions);
}

function showCameoSettings(returnScreen = "main") {
  settingsReturnScreen = returnScreen;
  menuScreen = "cameos";
  selectedIndex = 0;
  uiManager.clearEndStats();
  cameoManager.renderGallery();
  renderMenu("КАМЕО-КАРТИНКИ", `Появляются каждые 5 очков. ${cameoManager.images.length}/5 загружено.`, [
    { label: "Загрузить картинки", action: () => document.getElementById("cameo-upload").click(), primary: true },
    { label: "Удалить пользовательские", action: () => cameoManager.clearImages() },
    { label: "Назад", action: () => showSettings(returnScreen) },
  ]);
}

function showControls() {
  menuScreen = "controls";
  selectedIndex = 0;
  uiManager.clearEndStats();
  renderMenu("УПРАВЛЕНИЕ", "Стрелки или WASD — поворот. Ctrl — ускорение. Z — боевой режим. Esc или P — пауза.", [
    { label: "Начать забег", action: startGame, primary: true },
    { label: "Назад", action: showMainMenu },
  ]);
}

function showAbout() {
  menuScreen = "about";
  selectedIndex = 0;
  uiManager.clearEndStats();
  renderMenu("ОБ ИГРЕ", "Небольшая аркада о большой змее, яблоках и сомнительных решениях с автоматом. Версия 1.0 · 2026.", [
    { label: "В меню", action: showMainMenu },
  ]);
}

function toggleSound() {
  soundOn = !soundOn;
  safeStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
  audioManager.toggleSound(soundOn);
  uiManager.showNotification("saved", soundOn ? "Звук включён" : "Звук выключен");
  showSettings(settingsReturnScreen);
}

function showPauseMenu() {
  menuScreen = "pause";
  selectedIndex = 0;
  renderMenu("ПАУЗА", "Змея не двигается. Можно спокойно обвинить клавиатуру.", [
    { label: "Продолжить", action: resumeGame, primary: true },
    { label: "Начать заново", action: restartGame },
    { label: "Выйти в меню", action: goToMenu },
    { label: "Настройки", action: () => showSettings("pause") },
  ]);
}

function showGameOver() {
  menuScreen = "over";
  selectedIndex = 0;
  audioManager.setGameState(STATE.GAME_OVER);
  cameoManager.setGameState(STATE.GAME_OVER);
  setPlayingUi(false);
  setCombatActive(false, 300);
  combatWeapon.clearProjectiles();
  lastScore = score;
  uiManager.showEndStats({
    score,
    best,
    length: snake.length,
    elapsedMs: elapsedBeforePause,
    bulletHits: bulletFoodEaten,
    isRecord: newRecord,
  });
  renderMenu("ЗАБЕГ ЗАВЕРШЁН", newRecord ? "Новый личный рекорд. Змея одобряет." : "На этот раз поле оказалось убедительнее.", [
    { label: "Играть снова", action: restartGame, primary: true },
    { label: "Выйти в меню", action: goToMenu },
  ]);
}

function goToMenu() {
  state = STATE.MENU;
  audioManager.setGameState(STATE.MENU);
  cameoManager.setGameState(STATE.MENU);
  resetBoard();
  showMainMenu();
}

function startGame() {
  resetBoard();
  cameoManager.resetRun();
  state = STATE.PLAYING;
  audioManager.setGameState(STATE.PLAYING);
  cameoManager.setGameState(STATE.PLAYING);
  runStartedAt = performance.now();
  elapsedBeforePause = 0;
  lastHudAt = 0;
  lastTick = runStartedAt;
  lastFrameAt = lastTick;
  uiManager.showScreen("PLAYING");
  setPlayingUi(true);
}

function restartGame() {
  startGame();
}

function pauseGame() {
  if (state !== STATE.PLAYING) return;
  elapsedBeforePause = getRunElapsedMs();
  runStartedAt = 0;
  state = STATE.PAUSED;
  setPlayingUi(false);
  audioManager.setGameState(STATE.PAUSED);
  cameoManager.setGameState(STATE.PAUSED);
  uiManager.updateRunStats(snake.length, elapsedBeforePause);
  showPauseMenu();
}

function resumeGame() {
  if (state !== STATE.PAUSED) return;
  state = STATE.PLAYING;
  audioManager.setGameState(STATE.PLAYING);
  cameoManager.setGameState(STATE.PLAYING);
  runStartedAt = performance.now();
  lastTick = runStartedAt;
  lastFrameAt = lastTick;
  uiManager.showScreen("PLAYING");
  setPlayingUi(true);
}

function setDirection(next) {
  if (state !== STATE.PLAYING) return false;
  if (!dirs[next]) return false;
  const current = queuedDir || dir;
  if (next === opposite[current]) return false;
  queuedDir = next;
  mobileControls?.haptic("turn");
  return true;
}

function tick() {
  dir = queuedDir;
  const head = snake[0];
  if (boostActive) {
    trail.unshift({ x: head.x, y: head.y });
    trail = trail.slice(0, 6);
  }
  const next = {
    x: head.x + dirs[dir].x,
    y: head.y + dirs[dir].y,
  };

  const hitWall = next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS;
  const eatsFood = food && next.x === food.x && next.y === food.y;
  const tailWillMove = pendingGrowth === 0 && !eatsFood;
  const bodyBeforeMove = tailWillMove ? snake.slice(0, -1) : snake;
  const hitSelf = bodyBeforeMove.some((p) => p.x === next.x && p.y === next.y);
  if (hitWall || hitSelf) {
    mobileControls?.haptic("death");
    elapsedBeforePause = getRunElapsedMs();
    runStartedAt = 0;
    lastScore = score;
    newRecord = score > best;
    if (score > best) {
      best = score;
      safeStorage.setItem(BEST_KEY, String(best));
      uiManager.updateBest(best, true);
      uiManager.showNotification("record", "Новый рекорд!");
      notifyNewSkins(snakeSkinManager.checkUnlocks(best));
    }
    state = STATE.GAME_OVER;
    uiManager.updateRunStats(snake.length, elapsedBeforePause);
    showGameOver();
    draw();
    return;
  }

  snake.unshift(next);
  if (food && next.x === food.x && next.y === food.y) eatFood(false);
  if (pendingGrowth > 0) pendingGrowth -= 1;
  else snake.pop();
  draw();
}

function draw() {
  const now = performance.now();
  fieldThemeManager.draw(ctx, canvas.width, canvas.height, now, combatWeapon.active);

  if (food) {
    drawCell(food.x, food.y, "#fb7185", "#be123c");
  }

  snake.forEach((part, index) => {
    const recoil = index === 0 && now < combatWeapon.recoilUntil
      ? (combatWeapon.recoilUntil - now) / 90 * 2
      : 0;
    snakeSkinManager.drawSegment(
      ctx,
      part,
      index,
      snake.length,
      dirs[dir],
      cell,
      now,
      boostActive,
      combatWeapon.active,
      -dirs[dir].x * recoil,
      -dirs[dir].y * recoil,
    );
  });

  if (boostActive) {
    ctx.save();
    trail.forEach((point, index) => {
      ctx.globalAlpha = 0.22 * (1 - index / trail.length);
      drawCell(point.x, point.y, "#86efac", "#4ade80");
    });
    ctx.restore();
  }

  if (combatWeapon.hasEffects()) {
    combatWeapon.draw(ctx, now, snake[0], dirs[dir]);
  }
}

function drawCell(x, y, fill, stroke, offsetX = 0, offsetY = 0) {
  const padSize = 2;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  roundRect(x * cell + padSize + offsetX, y * cell + padSize + offsetY, cell - padSize * 2, cell - padSize * 2, 5);
  ctx.fill();
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function distanceToSegment(pointX, pointY, startX, startY, endX, endY) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared));
  return Math.hypot(pointX - (startX + projection * deltaX), pointY - (startY + projection * deltaY));
}

function loop(now) {
  const delta = Math.min(Math.max(0, now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;
  const currentStepMs = boostActive ? stepMs / BOOST_MULTIPLIER : stepMs;
  if (state === STATE.PLAYING) {
    if (now - lastTick >= currentStepMs) {
      lastTick = now;
      tick();
    }
    if (state === STATE.PLAYING && combatWeapon.hasEffects()) {
      const targetFood = food ? { x: food.x * cell + cell / 2, y: food.y * cell + cell / 2 } : null;
      combatWeapon.update(
        delta,
        now,
        snake[0],
        dirs[dir],
        targetFood,
        stepMs,
        boostActive,
        canvas.width,
        () => eatFood(true),
        audioManager.playSFX.bind(audioManager),
      );
      if (combatWeapon.hasEffects()) draw();
    }
  }
  const animatedSkin = ["rainbow", "fire", "ice", "electric", "shadow", "cyberpunk", "battle"].includes(snakeSkinManager.current.id);
  if ((fieldThemeManager.current.ambientParticles || animatedSkin) && now - lastThemeFrameAt >= 42) {
    draw();
    lastThemeFrameAt = now;
  }
  if (now - lastHudAt >= 250) {
    uiManager.updateRunStats(snake ? snake.length : 0, getRunElapsedMs(now));
    hitsEl.textContent = String(bulletFoodEaten).padStart(2, "0");
    lastHudAt = now;
  }
  requestAnimationFrame(loop);
}

function moveMenu(delta) {
  if (!menuItems.length || overlay.classList.contains("hidden")) return;
  selectedIndex = (selectedIndex + delta + menuItems.length) % menuItems.length;
  highlightSelection();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "z" && state === STATE.PLAYING && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!event.repeat) toggleCombat();
    return;
  }
  if (key === "control") {
    if (state === STATE.PLAYING) {
      event.preventDefault();
      setBoostActive(true);
    }
    return;
  }
  const inMenu = state !== STATE.PLAYING;

  if (inMenu && menuScreen === "customization") {
    if (key === "escape") {
      event.preventDefault();
      customizationUI.close();
    }
    return;
  }

  if (inMenu) {
    if (key === "arrowup" || key === "w") {
      event.preventDefault();
      moveMenu(-1);
      return;
    }
    if (key === "arrowdown" || key === "s") {
      event.preventDefault();
      moveMenu(1);
      return;
    }
    if (key === "enter" || key === " " || key === "spacebar") {
      event.preventDefault();
      activateSelected();
      return;
    }
    if (key === "escape" && menuScreen === "cameos") {
      event.preventDefault();
      showSettings(settingsReturnScreen);
      return;
    }
    if (key === "escape" && state === STATE.PAUSED) {
      event.preventDefault();
      resumeGame();
      return;
    }
    if (key === "escape" && (menuScreen === "records" || menuScreen === "settings")) {
      event.preventDefault();
      if (state === STATE.PAUSED) showPauseMenu();
      else showMainMenu();
      return;
    }
    if (key === "escape" && (menuScreen === "controls" || menuScreen === "about")) {
      event.preventDefault();
      showMainMenu();
      return;
    }
    if (key === "escape" && menuScreen === "customization") {
      event.preventDefault();
      customizationUI.close();
      return;
    }
    if (key === "r" && state === STATE.GAME_OVER && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      restartGame();
    }
    return;
  }

  if (event.ctrlKey) event.preventDefault();

  const map = {
    arrowup: "up",
    w: "up",
    arrowdown: "down",
    s: "down",
    arrowleft: "left",
    a: "left",
    arrowright: "right",
    d: "right",
  };

  if (map[key]) {
    event.preventDefault();
    setDirection(map[key]);
    return;
  }

  if (key === "escape" || key === "p") {
    event.preventDefault();
    pauseGame();
    return;
  }

  if (key === "r" && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    restartGame();
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key.toLowerCase() !== "control") return;
  if (state === STATE.PLAYING) event.preventDefault();
  setBoostActive(event.ctrlKey);
});

window.addEventListener("blur", () => setBoostActive(false));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setBoostActive(false);
});

pauseBtn.addEventListener("click", () => {
  pauseGame();
});

document.querySelectorAll(".pad button").forEach((button) => {
  button.addEventListener("click", () => {
    setDirection(button.dataset.dir);
  });
});

function eatFood(byBullet) {
  mobileControls?.haptic("eat");
  foodEaten += 1;
  if (byBullet) {
    bulletFoodEaten += 1;
    notifyNewSkins(snakeSkinManager.record("bulletHits"));
  }
  if (boostActive) boostFoodEaten += 1;
  score = foodEaten - bulletFoodEaten * (1 - BULLET_SCORE_MULTIPLIER) + Math.floor(boostFoodEaten / 5);
  uiManager.updateScore(score);
  cameoManager.checkScore(score, state, combatWeapon.active);
  hitsEl.textContent = String(bulletFoodEaten).padStart(2, "0");
  uiManager.floatScore(`+${byBullet ? "0.5" : "1"}`);
  pendingGrowth += 1;
  stepMs = Math.max(MIN_MS, START_MS - foodEaten * 3);
  placeFood();
  audioManager.playSFX("eat");
}

let touchStart = null;
canvas.addEventListener("touchstart", (event) => {
  if (state !== STATE.PLAYING || mobileControls?.getScheme() !== "swipe") return;
  const t = event.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  if (state !== STATE.PLAYING || mobileControls?.getScheme() !== "swipe" || !touchStart) {
    touchStart = null;
    return;
  }
  const t = event.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDirection(dx > 0 ? "right" : "left");
  } else {
    setDirection(dy > 0 ? "down" : "up");
  }
}, { passive: true });

canvas.addEventListener("touchcancel", () => {
  touchStart = null;
}, { passive: true });

mobileControls = new MobileControls({
  onDirection: setDirection,
  onBoost: setBoostActive,
  onCombat: toggleCombat,
  getState: () => state,
});

console.log("Starting game initialization");
resetBoard();
showMainMenu();
mobileControls.maybeShowFirstRunTutorial();
console.log("Starting animation loop");
requestAnimationFrame(loop);
