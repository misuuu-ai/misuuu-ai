const MOBILE_CONTROL_SCHEMES = ["stick", "swipe", "dpad"];
const STICK_SIZES = { small: 100, medium: 120, large: 144 };
const CONTROL_OPACITIES = [0.2, 0.5, 0.8, 1];

class MobileControls {
  constructor({ onDirection, onBoost, onCombat, getState }) {
    this.onDirection = onDirection;
    this.onBoost = onBoost;
    this.onCombat = onCombat;
    this.getState = getState;
    this.root = document.getElementById("mobile-control-root");
    this.stickZone = document.getElementById("virtual-stick-zone");
    this.stickBase = this.stickZone.querySelector(".virtual-stick-base");
    this.stickKnob = this.stickZone.querySelector(".virtual-stick-knob");
    this.boostButton = document.getElementById("boost-btn");
    this.combatButton = document.getElementById("combat-btn");
    this.pad = document.getElementById("pad");
    this.settings = this._loadSettings();
    this.activePointerId = null;
    this.boostPointerId = null;
    this.lastDirection = null;
    this.tutorialStep = 0;
    this.tutorial = this._createTutorial();
    this._bindJoystick();
    this._bindActions();
    this._applySettings();
  }

  _loadSettings() {
    const savedScheme = safeStorage.getItem("mobile-control-scheme");
    const savedSize = safeStorage.getItem("mobile-stick-size");
    const savedOpacity = Number(safeStorage.getItem("mobile-control-opacity"));
    return {
      scheme: MOBILE_CONTROL_SCHEMES.includes(savedScheme) ? savedScheme : "stick",
      stickSize: Object.prototype.hasOwnProperty.call(STICK_SIZES, savedSize) ? savedSize : "medium",
      opacity: CONTROL_OPACITIES.includes(savedOpacity) ? savedOpacity : 0.8,
      vibration: safeStorage.getItem("mobile-vibration") !== "off",
      invertX: safeStorage.getItem("mobile-invert-x") === "on",
      invertY: safeStorage.getItem("mobile-invert-y") === "on",
      showTutorial: safeStorage.getItem("mobile-tutorial-enabled") === "on",
      tutorialSeen: safeStorage.getItem("mobile-tutorial-seen") === "on",
    };
  }

  getScheme() {
    return this.settings.scheme;
  }

  setPlaying(isPlaying) {
    this.root.classList.toggle("is-playing", isPlaying);
    this.root.setAttribute("aria-hidden", String(!isPlaying));
    if (!isPlaying) {
      this._resetStick();
      if (this.boostPointerId !== null) {
        const pointerId = this.boostPointerId;
        this.boostPointerId = null;
        if (this.boostButton.hasPointerCapture(pointerId)) this.boostButton.releasePointerCapture(pointerId);
      }
      this.onBoost(false);
    }
  }

  _applySettings() {
    this.root.dataset.scheme = this.settings.scheme;
    this.pad.dataset.scheme = this.settings.scheme;
    this.root.style.setProperty("--stick-size", `${STICK_SIZES[this.settings.stickSize]}px`);
    this.root.style.setProperty("--control-opacity", String(this.settings.opacity));
    this.root.classList.toggle("is-inverted-x", this.settings.invertX);
    this.root.classList.toggle("is-inverted-y", this.settings.invertY);
  }

  renderSettings(container) {
    const panel = document.createElement("fieldset");
    panel.className = "mobile-settings";
    const legend = document.createElement("legend");
    legend.textContent = "МОБИЛЬНОЕ УПРАВЛЕНИЕ";
    panel.appendChild(legend);

    this._addSelect(panel, "Схема", "scheme", [
      ["stick", "Джойстик"],
      ["swipe", "Свайпы"],
      ["dpad", "Крестовина"],
    ], this.settings.scheme, (value) => {
      this.settings.scheme = value;
      this._save("mobile-control-scheme", value);
      this._applySettings();
    });
    this._addSelect(panel, "Размер джойстика", "stick-size", [
      ["small", "Маленький"],
      ["medium", "Средний"],
      ["large", "Большой"],
    ], this.settings.stickSize, (value) => {
      this.settings.stickSize = value;
      this._save("mobile-stick-size", value);
      this._applySettings();
    });
    this._addSelect(panel, "Прозрачность кнопок", "opacity", CONTROL_OPACITIES.map((value) => [String(value), `${Math.round(value * 100)}%`]), String(this.settings.opacity), (value) => {
      this.settings.opacity = Number(value);
      this._save("mobile-control-opacity", value);
      this._applySettings();
    });
    this._addToggle(panel, "Вибрация", "vibration", this.settings.vibration, (checked) => {
      this.settings.vibration = checked;
      this._save("mobile-vibration", checked ? "on" : "off");
    });
    this._addToggle(panel, "Инвертировать горизонталь", "invert-x", this.settings.invertX, (checked) => {
      this.settings.invertX = checked;
      this._save("mobile-invert-x", checked ? "on" : "off");
      this._applySettings();
    });
    this._addToggle(panel, "Инвертировать вертикаль", "invert-y", this.settings.invertY, (checked) => {
      this.settings.invertY = checked;
      this._save("mobile-invert-y", checked ? "on" : "off");
      this._applySettings();
    });
    this._addToggle(panel, "Обучение при первом запуске", "tutorial", this.settings.showTutorial, (checked) => {
      this.settings.showTutorial = checked;
      this._save("mobile-tutorial-enabled", checked ? "on" : "off");
    });

    const tutorialButton = document.createElement("button");
    tutorialButton.type = "button";
    tutorialButton.className = "mobile-tutorial-replay";
    tutorialButton.textContent = "Повторить обучение";
    tutorialButton.addEventListener("click", () => this.showTutorial());
    panel.appendChild(tutorialButton);
    container.appendChild(panel);
  }

  _addSelect(parent, labelText, name, options, selected, onChange) {
    const label = document.createElement("label");
    label.className = "mobile-setting-row";
    label.htmlFor = `mobile-setting-${name}`;
    label.append(document.createTextNode(labelText));
    const select = document.createElement("select");
    select.id = `mobile-setting-${name}`;
    select.name = name;
    options.forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    });
    select.value = selected;
    select.addEventListener("change", () => onChange(select.value));
    label.appendChild(select);
    parent.appendChild(label);
  }

  _addToggle(parent, labelText, name, checked, onChange) {
    const label = document.createElement("label");
    label.className = "mobile-setting-row mobile-setting-toggle";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    label.append(text, input);
    parent.appendChild(label);
  }

  _save(key, value) {
    safeStorage.setItem(key, value);
  }

  _bindJoystick() {
    this.stickZone.addEventListener("pointerdown", (event) => {
      if (this.getState() !== STATE.PLAYING || this.settings.scheme !== "stick" || this.activePointerId !== null) return;
      event.preventDefault();
      this.activePointerId = event.pointerId;
      this.stickZone.setPointerCapture(event.pointerId);
      this.stickZone.classList.add("is-touching");
      const bounds = this.stickZone.getBoundingClientRect();
      const radius = STICK_SIZES[this.settings.stickSize] / 2;
      const x = Math.max(radius, Math.min(bounds.width - radius, event.clientX - bounds.left));
      const y = Math.max(radius, Math.min(bounds.height - radius, event.clientY - bounds.top));
      this.stickBase.style.left = `${x}px`;
      this.stickBase.style.top = `${y}px`;
      this.stickOrigin = { x: bounds.left + x, y: bounds.top + y };
      this._moveStick(event);
    });

    this.stickZone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.activePointerId) return;
      event.preventDefault();
      this._moveStick(event);
    });

    ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
      this.stickZone.addEventListener(eventName, (event) => {
        if (event.pointerId !== this.activePointerId) return;
        this._resetStick();
      });
    });
  }

  _bindActions() {
    this.boostButton.addEventListener("pointerdown", (event) => {
      if (this.getState() !== STATE.PLAYING || this.boostPointerId !== null) return;
      event.preventDefault();
      this.boostPointerId = event.pointerId;
      this.boostButton.setPointerCapture(event.pointerId);
      this.onBoost(true);
    });
    const releaseBoost = (event) => {
      if (event.pointerId !== this.boostPointerId) return;
      this.boostPointerId = null;
      this.onBoost(false);
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
      this.boostButton.addEventListener(eventName, releaseBoost);
    });
    this.combatButton.addEventListener("click", () => this.onCombat());
  }

  _moveStick(event) {
    if (!this.stickOrigin) return;
    let deltaX = event.clientX - this.stickOrigin.x;
    let deltaY = event.clientY - this.stickOrigin.y;
    if (this.settings.invertX) deltaX *= -1;
    if (this.settings.invertY) deltaY *= -1;
    const radius = STICK_SIZES[this.settings.stickSize] / 2;
    const maxOffset = radius * 0.62;
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > maxOffset ? maxOffset / distance : 1;
    this.stickKnob.style.transform = `translate(${deltaX * scale}px, ${deltaY * scale}px)`;

    if (distance < Math.max(14, radius * 0.22)) {
      this.lastDirection = null;
      return;
    }
    const direction = Math.abs(deltaX) >= Math.abs(deltaY)
      ? deltaX > 0 ? "right" : "left"
      : deltaY > 0 ? "down" : "up";
    if (direction === this.lastDirection) return;
    this.lastDirection = direction;
    this.onDirection(direction);
  }

  _resetStick() {
    if (this.activePointerId !== null && this.stickZone.hasPointerCapture(this.activePointerId)) {
      this.stickZone.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.stickOrigin = null;
    this.lastDirection = null;
    this.stickKnob.style.transform = "translate(0, 0)";
    this.stickZone.classList.remove("is-touching");
    this.stickBase.style.left = "50%";
    this.stickBase.style.top = "50%";
  }

  haptic(type) {
    if (!this.settings.vibration || typeof navigator.vibrate !== "function") return;
    if (!matchMedia("(pointer: coarse)").matches) return;
    const pattern = { turn: 10, eat: 30, death: 100, combat: [50, 50, 50] }[type];
    if (pattern) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }

  _createTutorial() {
    const dialog = document.createElement("section");
    dialog.className = "mobile-tutorial hidden";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "mobile-tutorial-title");
    dialog.setAttribute("aria-describedby", "mobile-tutorial-copy");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "mobile-tutorial-close";
    close.setAttribute("aria-label", "Закрыть обучение");
    close.title = "Закрыть обучение";
    close.textContent = "×";
    close.addEventListener("click", () => this.closeTutorial());

    const card = document.createElement("div");
    card.className = "mobile-tutorial-card";
    this.tutorialEyebrow = document.createElement("span");
    this.tutorialEyebrow.className = "mobile-tutorial-eyebrow";
    this.tutorialTitle = document.createElement("h2");
    this.tutorialTitle.id = "mobile-tutorial-title";
    this.tutorialCopy = document.createElement("p");
    this.tutorialCopy.id = "mobile-tutorial-copy";
    this.tutorialProgress = document.createElement("span");
    this.tutorialProgress.className = "mobile-tutorial-progress";
    const actions = document.createElement("div");
    actions.className = "mobile-tutorial-actions";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Пропустить";
    skip.addEventListener("click", () => this.closeTutorial());
    this.tutorialNext = document.createElement("button");
    this.tutorialNext.type = "button";
    this.tutorialNext.className = "is-primary";
    this.tutorialNext.addEventListener("click", () => this.advanceTutorial());
    actions.append(skip, this.tutorialNext);
    card.append(this.tutorialEyebrow, this.tutorialTitle, this.tutorialCopy, this.tutorialProgress, actions);
    dialog.append(close, card);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) this.closeTutorial();
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.closeTutorial();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (this.tutorial?.classList.contains("hidden") || event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.closeTutorial();
    }, true);
    document.body.appendChild(dialog);
    return dialog;
  }

  maybeShowFirstRunTutorial() {
    if (!this.settings.showTutorial || this.settings.tutorialSeen) return;
    if (!matchMedia("(pointer: coarse)").matches && innerWidth > 720) return;
    this.showTutorial();
  }

  showTutorial() {
    this.tutorialReturnFocus = document.activeElement;
    this.tutorialStep = 0;
    this._renderTutorialStep();
    this.tutorial.classList.remove("hidden");
    this.tutorialNext.focus();
  }

  advanceTutorial() {
    if (this.tutorialStep < 2) {
      this.tutorialStep += 1;
      this._renderTutorialStep();
    } else this.closeTutorial();
  }

  _renderTutorialStep() {
    const movement = this.settings.scheme === "stick"
      ? "Отклони стик в нужную сторону. Направление фиксируется по горизонтали или вертикали."
      : this.settings.scheme === "swipe"
        ? "Коротко проведи пальцем по полю в сторону поворота."
        : "Нажми стрелку на экранной крестовине, чтобы повернуть.";
    const steps = [
      ["ДВИЖЕНИЕ", "Поворот змейки", movement],
      ["УСКОРЕНИЕ", "Удерживай ↯", "Зажми кнопку ускорения правым большим пальцем. Отпусти, чтобы вернуться к обычной скорости."],
      ["БОЕВОЙ РЕЖИМ", "Нажми ⌖", "Включай и выключай стрельбу отдельной кнопкой. Пауза всегда доступна вверху экрана."],
    ];
    const [eyebrow, title, copy] = steps[this.tutorialStep];
    this.tutorialEyebrow.textContent = `${eyebrow} · ${this.tutorialStep + 1}/3`;
    this.tutorialTitle.textContent = title;
    this.tutorialCopy.textContent = copy;
    this.tutorialProgress.textContent = "● ".repeat(this.tutorialStep + 1) + "○ ".repeat(2 - this.tutorialStep);
    this.tutorialNext.textContent = this.tutorialStep === 2 ? "Начать" : "Далее";
  }

  closeTutorial() {
    if (this.tutorial.classList.contains("hidden")) return;
    this.tutorial.classList.add("hidden");
    this.settings.tutorialSeen = true;
    this._save("mobile-tutorial-seen", "on");
    if (this.tutorialReturnFocus instanceof HTMLElement && this.tutorialReturnFocus.isConnected) {
      this.tutorialReturnFocus.focus();
    }
    this.tutorialReturnFocus = null;
  }
}