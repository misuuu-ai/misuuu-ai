const DEFAULT_CAMEO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220"><rect width="320" height="220" rx="28" fill="#18251b"/><path d="M34 166c0-22 18-40 40-40h48c18 0 31-11 31-28 0-18 15-33 34-33h43c31 0 56 25 56 56v45H34Z" fill="#7dbb51" stroke="#c7f36b" stroke-width="8"/><circle cx="210" cy="96" r="8" fill="#f4f1da"/><circle cx="212" cy="96" r="4" fill="#1b2119"/><path d="M245 119q18 17 35 0" fill="none" stroke="#1b2119" stroke-linecap="round" stroke-width="6"/><path d="M53 176h205" stroke="#f6cc74" stroke-linecap="round" stroke-width="7"/><circle cx="68" cy="158" r="9" fill="#ff795d"/><circle cx="93" cy="158" r="9" fill="#f6cc74"/><text x="160" y="38" fill="#f0f2e9" font-family="sans-serif" font-size="19" font-weight="700" text-anchor="middle">СМОТРЮ НА ТЕБЯ</text></svg>`;
const DEFAULT_CAMEO_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DEFAULT_CAMEO_SVG)}`;
const CAMEO_STORAGE_KEY = "snakeCameoImages";
const CAMEO_ENABLED_KEY = "snakeCameoEnabled";
const CAMEO_MAX_IMAGES = 5;
const CAMEO_MAX_IMAGE_BYTES = 180 * 1024;
const CAMEO_MAX_STORAGE_BYTES = 4 * 1024 * 1024;

class CameoManager {
  constructor(uiManager, onImagesChanged = () => {}) {
    this.uiManager = uiManager;
    this.onImagesChanged = onImagesChanged;
    this.app = document.querySelector(".app");
    this.root = document.getElementById("cameo-root");
    this.leftWindow = document.getElementById("cameo-window-left");
    this.rightWindow = document.getElementById("cameo-window-right");
    this.leftCard = document.getElementById("cameo-card-left");
    this.rightCard = document.getElementById("cameo-card-right");
    this.leftImage = document.getElementById("cameo-image");
    this.rightImage = this.rightCard.querySelector("img");
    this.fileInput = document.getElementById("cameo-upload");
    this.gallery = document.getElementById("cameo-gallery");
    this.card = this.leftCard;
    this.displayImage = this.leftImage;
    this.activeWindow = this.leftWindow;
    this.images = [];
    this.nextCameoAt = 5;
    this.isActive = false;
    this.queue = 0;
    this.currentElement = null;
    this.currentGameState = "MENU";
    this.isEnabled = safeStorage.getItem(CAMEO_ENABLED_KEY) !== "off";
    this.gamePaused = false;
    this.combatBlocked = false;
    this.isSuspended = false;
    this.currentPhase = "";
    this.phaseRemaining = 0;
    this.phaseStartedAt = 0;
    this.phaseTimer = 0;
    this.phaseAdvance = null;
    this.scheduleRemaining = 0;
    this.scheduleStartedAt = 0;
    this.scheduleTimer = 0;
    this.nextStartAt = 0;
    this.loadFromStorage();
    this.fileInput.addEventListener("change", () => {
      const files = [...this.fileInput.files];
      this.fileInput.value = "";
      this.loadFiles(files);
    });
  }

  loadFromStorage() {
    try {
      const saved = JSON.parse(safeStorage.getItem(CAMEO_STORAGE_KEY) || "[]");
      this.images = saved
        .filter((entry) => entry && typeof entry.dataUrl === "string" && entry.dataUrl.startsWith("data:image/") && entry.dataUrl.length < 300000)
        .slice(0, CAMEO_MAX_IMAGES)
        .map((entry) => ({ id: entry.id || this._makeId(), name: entry.name || "Картинка", dataUrl: entry.dataUrl, image: this._makeImage(entry.dataUrl) }));
    } catch {
      this.images = [];
    }
  }

  saveToStorage() {
    const serialized = JSON.stringify(this.images.map(({ id, name, dataUrl }) => ({ id, name, dataUrl })));
    if (serialized.length > CAMEO_MAX_STORAGE_BYTES) {
      this.uiManager.showNotification("saved", "Картинки не помещаются в локальное хранилище.");
      return false;
    }
    try {
      if (!safeStorage.setItem(CAMEO_STORAGE_KEY, serialized)) {
        this.uiManager.showNotification("saved", "Не удалось сохранить картинку: хранилище браузера недоступно.");
        return false;
      }
      return true;
    } catch {
      this.uiManager.showNotification("saved", "Не удалось сохранить картинку: хранилище браузера заполнено.");
      return false;
    }
  }

  async loadFiles(files) {
    const accepted = files.filter((file) => file.type.startsWith("image/"));
    const selectedFiles = accepted.slice(0, Math.max(0, CAMEO_MAX_IMAGES - this.images.length));
    let added = 0;
    for (const file of selectedFiles) {
      if (file.size > 20 * 1024 * 1024) {
        this.uiManager.showNotification("saved", "Файл больше 20 МБ. Выбери изображение поменьше.");
        continue;
      }
      try {
        const dataUrl = await this._compressFile(file);
        this.images.push({ id: this._makeId(), name: file.name.replace(/[<>"']/g, "").slice(0, 48) || "Картинка", dataUrl, image: this._makeImage(dataUrl) });
        if (!this.saveToStorage()) this.images.pop();
        else added += 1;
      } catch (error) {
        this.uiManager.showNotification("saved", error.message || "Не удалось обработать изображение.");
      }
    }
    if (selectedFiles.length < accepted.length) this.uiManager.showNotification("saved", `Можно хранить не больше ${CAMEO_MAX_IMAGES} картинок.`);
    this.renderGallery();
    this.onImagesChanged();
    if (added) this.uiManager.showNotification("saved", `Добавлено картинок: ${added}`);
  }

  _compressFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let scale = Math.min(1, 1200 / image.naturalWidth, 1200 / image.naturalHeight);
          let quality = 0.78;
          for (let attempt = 0; attempt < 12; attempt += 1) {
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Браузер не смог подготовить изображение к сжатию.");
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            let dataUrl = canvas.toDataURL("image/webp", quality);
            if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality);
            const size = Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
            if (size <= CAMEO_MAX_IMAGE_BYTES) return resolve(dataUrl);
            if (quality > 0.5) quality -= 0.1;
            else scale *= 0.78;
          }
          reject(new Error(`Не удалось сжать картинку до ${Math.round(CAMEO_MAX_IMAGE_BYTES / 1024)} КБ.`));
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Браузер не смог открыть это изображение."));
      };
      image.src = objectUrl;
    });
  }

  _makeImage(source) {
    const image = new Image();
    image.src = source;
    return image;
  }

  _makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  renderGallery() {
    this.gallery.replaceChildren();
    if (!this.images.length) {
      const preview = document.createElement("div");
      preview.className = "cameo-thumb cameo-default-thumb";
      const image = document.createElement("img");
      image.src = DEFAULT_CAMEO_SRC;
      image.alt = "Встроенное cameo: змейка";
      const label = document.createElement("span");
      label.textContent = "Встроенная змейка";
      const empty = document.createElement("p");
      empty.className = "cameo-empty";
      empty.textContent = "Добавь до пяти своих картинок.";
      preview.append(image, label);
      this.gallery.append(preview, empty);
      return;
    }
    this.images.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "cameo-thumb";
      const image = document.createElement("img");
      image.src = entry.dataUrl;
      image.alt = entry.name;
      const name = document.createElement("span");
      name.textContent = entry.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cameo-remove";
      remove.setAttribute("aria-label", `Удалить ${entry.name}`);
      remove.title = "Удалить картинку";
      remove.textContent = "×";
      remove.addEventListener("click", () => this.removeImage(entry.id));
      item.append(image, name, remove);
      item.style.setProperty("--thumb-order", index);
      this.gallery.appendChild(item);
    });
  }

  removeImage(id) {
    this.images = this.images.filter((entry) => entry.id !== id);
    this.saveToStorage();
    this.renderGallery();
    this.onImagesChanged();
  }

  clearImages() {
    this.images = [];
    safeStorage.removeItem(CAMEO_STORAGE_KEY);
    this.renderGallery();
    this.onImagesChanged();
    this.uiManager.showNotification("saved", "Пользовательские картинки удалены.");
  }

  toggleEnabled(enabled) {
    this.isEnabled = Boolean(enabled);
    safeStorage.setItem(CAMEO_ENABLED_KEY, this.isEnabled ? "on" : "off");
    if (!this.isEnabled) {
      this.queue = 0;
      this.dismiss(180);
    } else this._pump();
  }

  resetRun() {
    this.nextCameoAt = 5;
    this.queue = 0;
    this.nextStartAt = 0;
    this.dismiss(0);
  }

  checkScore(score, gameState, combatActive) {
    while (score >= this.nextCameoAt) {
      this.nextCameoAt += 5;
      if (this.isEnabled && gameState === "PLAYING") this.queue += 1;
    }
    this.currentGameState = gameState;
    this.setCombatActive(combatActive);
    this._pump();
  }

  setGameState(state) {
    this.currentGameState = state;
    if (state === "PAUSED") {
      this.gamePaused = true;
      this._syncSuspension();
    } else if (state === "PLAYING") {
      this.gamePaused = false;
      this._syncSuspension();
      this._pump();
    } else if (state === "GAME_OVER") {
      this.gamePaused = false;
      this.combatBlocked = false;
      this.isSuspended = false;
      this.root.classList.remove("is-paused");
      this.dismiss(200);
    } else {
      this.gamePaused = false;
      this.combatBlocked = false;
      this.dismiss(0);
      this._syncSuspension();
    }
  }

  setCombatActive(active) {
    this.combatBlocked = Boolean(active);
    if (this.currentGameState === "GAME_OVER" || this.currentGameState === "MENU") return;
    this._syncSuspension();
  }

  _syncSuspension() {
    const shouldSuspend = this.gamePaused || this.combatBlocked || this.currentGameState !== "PLAYING";
    if (shouldSuspend && !this.isSuspended) {
      this.isSuspended = true;
      this.root.classList.add("is-paused");
      if (this.phaseTimer) {
        this.phaseRemaining = Math.max(0, this.phaseRemaining - (performance.now() - this.phaseStartedAt));
        clearTimeout(this.phaseTimer);
        this.phaseTimer = 0;
      }
      if (this.scheduleTimer) {
        this.scheduleRemaining = Math.max(0, this.scheduleRemaining - (performance.now() - this.scheduleStartedAt));
        clearTimeout(this.scheduleTimer);
        this.scheduleTimer = 0;
      }
    } else if (!shouldSuspend && this.isSuspended) {
      this.isSuspended = false;
      this.root.classList.remove("is-paused");
      if (this.isActive && this.phaseRemaining > 0) this._resumePhaseTimer();
      else if (!this.isActive && this.scheduleRemaining > 0) this._resumeScheduleTimer();
      else this._pump();
    }
  }

  _pump() {
    if (!this.isEnabled || this.queue <= 0 || this.isActive || this.isSuspended || this.currentGameState !== "PLAYING" || this.combatBlocked) return;
    const wait = Math.max(0, this.nextStartAt - Date.now());
    if (wait > 0) {
      this.scheduleRemaining = wait;
      this._resumeScheduleTimer();
    } else this.triggerCameo();
  }

  _resumeScheduleTimer() {
    if (this.scheduleTimer || this.isSuspended || this.queue <= 0) return;
    this.scheduleStartedAt = performance.now();
    this.scheduleTimer = window.setTimeout(() => {
      this.scheduleTimer = 0;
      this.scheduleRemaining = 0;
      this._pump();
    }, this.scheduleRemaining);
  }

  triggerCameo() {
    if (!this.isEnabled || this.isSuspended || this.isActive || this.queue <= 0 || this.currentGameState !== "PLAYING" || this.combatBlocked) return;
    this.queue -= 1;
    const entry = this.images.length
      ? this.images[Math.floor(Math.random() * this.images.length)]
      : { name: "Встроенная змейка", dataUrl: DEFAULT_CAMEO_SRC, image: null };
    const side = Math.random() > 0.5 ? "right" : "left";
    this.app.classList.toggle("cameo-from-left", side === "left");
    this.app.classList.toggle("cameo-from-right", side === "right");
    this.currentElement = entry;
    this.activeWindow = side === "right" ? this.rightWindow : this.leftWindow;
    this.card = side === "right" ? this.rightCard : this.leftCard;
    this.displayImage = side === "right" ? this.rightImage : this.leftImage;
    this.leftWindow.classList.remove("is-active");
    this.rightWindow.classList.remove("is-active");
    this.activeWindow.classList.add("is-active");
    this.displayImage.src = entry.dataUrl;
    this.displayImage.alt = entry.name;
    this.card.className = `cameo-card from-${side}`;
    this._sizeAndPosition(entry, side);
    this.root.classList.add("is-visible");
    this.isActive = true;
    this.nextStartAt = Date.now() + 5000;
    this._startPhase("entering", 520, () => this._startPhase("holding", 3000, () => this._startPhase("leaving", 420, () => this._finishCameo())));
  }

  _sizeAndPosition(entry, side) {
    const image = entry.image || this._makeImage(entry.dataUrl);
    const sizeAndPlace = () => {
      const mobile = window.matchMedia("(max-width: 720px)").matches || window.matchMedia("(pointer: coarse)").matches;
      const board = document.querySelector(".board-wrap").getBoundingClientRect();
      const leftLaneWidth = Math.max(0, board.left);
      const rightLaneWidth = Math.max(0, window.innerWidth - board.right);
      const laneGap = 4;
      this.leftWindow.style.left = "0px";
      this.leftWindow.style.right = "auto";
      this.leftWindow.style.width = `${Math.round(leftLaneWidth)}px`;
      this.rightWindow.style.left = `${Math.round(board.right)}px`;
      this.rightWindow.style.right = "auto";
      this.rightWindow.style.width = `${Math.round(rightLaneWidth)}px`;
      const laneWidth = side === "left" ? leftLaneWidth : rightLaneWidth;
      const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
      const maxWidth = Math.min(window.innerWidth * (mobile ? 0.19 : 0.2), mobile ? 180 : 320);
      const obstructions = [...document.querySelectorAll(".masthead, .side-rail > *, #pause-btn, #combat-btn, #boost-btn, #pad.is-active button, .board-caption, .board-wrap, .board-baseline, .page-footer, .toast-stack")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        })
        .map((element) => element.getBoundingClientRect());
      let width = maxWidth;
      let height = width / ratio;
      let top = null;
      for (let resize = 0; resize < 14 && width >= 24 && top === null; resize += 1) {
        height = width / ratio;
        this.card.style.width = `${Math.round(width)}px`;
        this.card.style.height = `${Math.round(height)}px`;
        this.card.style.left = side === "right" ? `${laneGap}px` : "auto";
        this.card.style.right = side === "left" ? `${laneGap}px` : "auto";
        const lane = this.activeWindow.getBoundingClientRect();
        const cardLeft = side === "left" ? lane.right - laneGap - width : lane.left + laneGap;
        const visibleLeft = Math.max(lane.left, cardLeft);
        const visibleRight = Math.min(lane.right, cardLeft + width);
        const maxSafeTop = Math.max(0, window.innerHeight - height);
        const minTop = Math.min(window.innerHeight * 0.2, maxSafeTop);
        const maxTop = Math.max(minTop, Math.min(window.innerHeight * 0.7, maxSafeTop));
        for (let attempt = 0; attempt < 56; attempt += 1) {
          const candidate = minTop + Math.random() * (maxTop - minTop);
          const overlapsHud = obstructions.some((rect) =>
            visibleLeft < rect.right && visibleRight > rect.left && candidate < rect.bottom && candidate + height > rect.top,
          );
          if (!overlapsHud) {
            top = candidate;
            break;
          }
        }
        if (top === null) width *= 0.86;
      }
      if (top === null) {
        height = width / ratio;
        top = Math.max(0, Math.min(window.innerHeight - height, window.innerHeight * 0.2));
      }
      this.card.style.top = `${Math.round(top)}px`;
    };
    const schedulePlacement = () => requestAnimationFrame(() => requestAnimationFrame(sizeAndPlace));
    if (image.complete && image.naturalWidth > 0) schedulePlacement();
    else {
      image.onload = schedulePlacement;
      image.onerror = () => {
        this.displayImage.src = DEFAULT_CAMEO_SRC;
        this._sizeAndPosition({ dataUrl: DEFAULT_CAMEO_SRC, image: this._makeImage(DEFAULT_CAMEO_SRC) }, side);
      };
    }
  }

  _startPhase(phase, duration, next) {
    if (!this.isActive) return;
    this.currentPhase = phase;
    this.phaseRemaining = duration;
    this.phaseAdvance = next;
    this.phaseStartedAt = performance.now();
    this.card.classList.remove("is-entering", "is-holding", "is-leaving");
    this.card.classList.add(`is-${phase}`);
    if (this.isSuspended) return;
    this.phaseTimer = window.setTimeout(() => {
      this.phaseTimer = 0;
      this.phaseRemaining = 0;
      if (this.phaseAdvance) this.phaseAdvance();
    }, duration);
  }

  _resumePhaseTimer() {
    if (this.phaseTimer || !this.isActive || !this.phaseAdvance) return;
    this.phaseStartedAt = performance.now();
    this.phaseTimer = window.setTimeout(() => {
      this.phaseTimer = 0;
      this.phaseRemaining = 0;
      if (this.phaseAdvance) this.phaseAdvance();
    }, this.phaseRemaining);
  }

  _finishCameo() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = 0;
    this.phaseAdvance = null;
    this.root.classList.remove("is-visible");
    this.app.classList.remove("cameo-from-left", "cameo-from-right");
    this.leftWindow.classList.remove("is-active");
    this.rightWindow.classList.remove("is-active");
    this.leftCard.className = "cameo-card from-left";
    this.rightCard.className = "cameo-card from-right";
    this.card.className = "cameo-card";
    this.isActive = false;
    this.currentPhase = "";
    this.currentElement = null;
    this._pump();
  }

  dismiss(duration = 200) {
    this.queue = 0;
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    this.scheduleTimer = 0;
    this.scheduleRemaining = 0;
    if (!this.isActive || duration <= 0) {
      this._finishCameo();
      return;
    }
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = 0;
    this.phaseAdvance = null;
    this.root.classList.remove("is-paused");
    this.root.classList.add("is-visible");
    this.card.classList.remove("is-entering", "is-holding", "is-leaving");
    this.card.classList.add("is-dismissing");
    this.card.style.setProperty("--cameo-dismiss-duration", `${duration}ms`);
    this.phaseTimer = window.setTimeout(() => this._finishCameo(), duration);
  }

  pause() {
    this.setGameState("PAUSED");
  }

  resume() {
    this.setGameState("PLAYING");
  }

  update() {}
}