class CustomizationUI {
  constructor(skinManager, fieldThemeManager, uiManager, onChange) {
    this.skinManager = skinManager;
    this.fieldThemeManager = fieldThemeManager;
    this.uiManager = uiManager;
    this.onChange = onChange;
    this.menuActions = document.getElementById("menu-actions");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayText = document.getElementById("overlay-text");
    this.overlayStats = document.getElementById("overlay-stats");
    this.activeTab = "skins";
    this.previewSkinId = skinManager.currentId;
    this.previewThemeId = fieldThemeManager.currentId;
    this.returnAction = () => {};
  }

  open(returnAction) {
    this.returnAction = returnAction;
    this.activeTab = "skins";
    this.previewSkinId = this.skinManager.currentId;
    this.previewThemeId = this.fieldThemeManager.currentId;
    this.overlayTitle.textContent = "ВНЕШНИЙ ВИД";
    this.overlayText.textContent = "Косметика не меняет скорость. Только стиль поворотов.";
    this.overlayStats.replaceChildren();
    this.menuActions.classList.add("is-customization");
    this.menuActions.replaceChildren();
    this._buildShell();
    this.uiManager.showScreen("CUSTOMIZATION");
  }

  close() {
    this.menuActions.classList.remove("is-customization");
    this.returnAction();
  }

  _buildShell() {
    const root = document.createElement("section");
    root.className = "customization-panel";
    root.setAttribute("aria-label", "Настройка внешнего вида");

    const tabs = document.createElement("div");
    tabs.className = "custom-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Внешний вид игры");
    this.tabs = {};
    [["skins", "ЗМЕЙКА"], ["themes", "ПОЛЕ"]].forEach(([id, label]) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "custom-tab";
      tab.id = `custom-tab-${id}`;
      tab.textContent = label;
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => this._setTab(id));
      this.tabs[id] = tab;
      tabs.appendChild(tab);
    });

    const preview = document.createElement("div");
    preview.className = "custom-preview";
    const previewCanvas = document.createElement("canvas");
    previewCanvas.id = "custom-preview";
    previewCanvas.className = "custom-preview-canvas";
    previewCanvas.width = 320;
    previewCanvas.height = 88;
    previewCanvas.setAttribute("aria-label", "Предпросмотр выбранного оформления");
    this.previewCanvas = previewCanvas;
    this.previewName = document.createElement("strong");
    this.previewDescription = document.createElement("span");
    const previewCopy = document.createElement("div");
    previewCopy.className = "custom-preview-copy";
    previewCopy.append(this.previewName, this.previewDescription);
    preview.append(previewCanvas, previewCopy);

    this.list = document.createElement("div");
    this.list.className = "custom-card-track";
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", "Варианты оформления");

    const actions = document.createElement("div");
    actions.className = "custom-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "custom-back";
    back.textContent = "←  НАЗАД";
    back.addEventListener("click", () => this.close());
    this.selectionStatus = document.createElement("span");
    this.selectionStatus.className = "custom-selection-status";
    actions.append(back, this.selectionStatus);

    root.append(tabs, preview, this.list, actions);
    this.menuActions.appendChild(root);
    this._renderCards();
  }

  _setTab(tab) {
    this.activeTab = tab;
    this._renderCards();
  }

  _renderCards() {
    const isSkinTab = this.activeTab === "skins";
    this.tabs.skins.classList.toggle("is-active", isSkinTab);
    this.tabs.themes.classList.toggle("is-active", !isSkinTab);
    this.tabs.skins.setAttribute("aria-selected", String(isSkinTab));
    this.tabs.themes.setAttribute("aria-selected", String(!isSkinTab));
    this.list.replaceChildren();

    const items = isSkinTab ? this.skinManager.getAll() : this.fieldThemeManager.getAll();
    const selectedId = isSkinTab ? this.previewSkinId : this.previewThemeId;
    items.forEach((item) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "custom-card";
      card.setAttribute("role", "option");
      card.setAttribute("aria-selected", String(item.id === selectedId));
      card.classList.toggle("is-selected", item.id === selectedId);
      card.classList.toggle("is-locked", !item.unlocked);
      card.title = item.unlocked ? item.description : `${item.description} ${item.unlock?.hint || "Скин закрыт"}`;
      card.style.setProperty("--swatch-a", isSkinTab ? item.bodyGradient[0] : item.backgroundColor);
      card.style.setProperty("--swatch-b", isSkinTab ? item.bodyGradient[1] : item.borderColor);

      const mark = document.createElement("span");
      mark.className = "custom-card-mark";
      mark.textContent = !item.unlocked ? "🔒" : item.icon;
      mark.setAttribute("aria-hidden", "true");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const hint = document.createElement("span");
      hint.className = "custom-card-hint";
      hint.textContent = item.unlocked ? (item.id === selectedId ? "ВЫБРАНО" : isSkinTab ? "СКИН" : "ТЕМА") : item.unlock.hint;
      card.append(mark, name, hint);
      card.addEventListener("click", () => this._selectPreview(item, isSkinTab));
      this.list.appendChild(card);
    });
    this._updatePreview();
  }

  _selectPreview(item, isSkin) {
    if (isSkin) {
      this.previewSkinId = item.id;
      if (item.unlocked) {
        const result = this.skinManager.select(item.id);
        if (result.ok) this.onChange();
      } else {
        this.uiManager.showNotification("saved", item.unlock.hint);
      }
    } else {
      this.previewThemeId = item.id;
      this.fieldThemeManager.select(item.id);
      this.onChange();
    }
    const cardItems = isSkin ? this.skinManager.getAll() : this.fieldThemeManager.getAll();
    this.list.querySelectorAll(".custom-card").forEach((card, index) => {
      const cardItem = cardItems[index];
      const selected = cardItem.id === item.id;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-selected", String(selected));
      card.querySelector(".custom-card-hint").textContent = card.classList.contains("is-locked")
        ? cardItem.unlock?.hint || "СКИН ЗАКРЫТ"
        : selected ? "ВЫБРАНО" : this.activeTab === "skins" ? "СКИН" : "ТЕМА";
    });
    this._updatePreview();
  }

  _updatePreview() {
    const skin = this.skinManager.skinMap.get(this.previewSkinId) || this.skinManager.current;
    const theme = this.fieldThemeManager.themeMap.get(this.previewThemeId) || this.fieldThemeManager.current;
    const context = this.previewCanvas.getContext("2d");
    const width = this.previewCanvas.width;
    const height = this.previewCanvas.height;
    context.fillStyle = theme.backgroundColor;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = theme.gridColor;
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 32) {
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 22) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(width, y + 0.5);
      context.stroke();
    }
    const colors = [skin.headColor, ...Array.from({ length: 5 }, (_, index) => {
      if (skin.effect === "rainbow") return `hsl(${index * 42 + 20} 82% 60%)`;
      const mix = index / 5;
      return this._mixColor(skin.bodyGradient[0], skin.bodyGradient[1], mix);
    })];
    colors.forEach((color, index) => {
      const x = 34 + index * 38;
      const y = 34 + Math.sin(index * 0.76) * 8;
      context.fillStyle = color;
      context.shadowColor = skin.glowColor || "transparent";
      context.shadowBlur = skin.glowColor ? 8 : 0;
      context.beginPath();
      context.roundRect(x, y, 27, 24, 7);
      context.fill();
      context.save();
      context.beginPath();
      context.roundRect(x, y, 27, 24, 7);
      context.clip();
      context.strokeStyle = "rgba(255,255,255,0.42)";
      context.fillStyle = "rgba(255,255,255,0.42)";
      if (skin.pattern === "stripes") {
        for (let stripe = 0; stripe < 4; stripe += 1) {
          context.beginPath();
          context.moveTo(x + stripe * 8, y);
          context.lineTo(x + stripe * 8 + 9, y + 24);
          context.stroke();
        }
      } else if (skin.pattern === "dots") {
        [[8, 8], [19, 17]].forEach(([dotX, dotY]) => {
          context.beginPath();
          context.arc(x + dotX, y + dotY, 1.8, 0, Math.PI * 2);
          context.fill();
        });
      } else if (skin.pattern === "scales") {
        context.beginPath();
        context.arc(x + 13, y + 20, 8, Math.PI, Math.PI * 2);
        context.stroke();
      } else if (skin.pattern === "camo") {
        context.fillStyle = "rgba(31,38,29,0.48)";
        context.beginPath();
        context.ellipse(x + 8, y + 8, 5, 3, 0.4, 0, Math.PI * 2);
        context.ellipse(x + 20, y + 17, 5, 3, -0.3, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });
    context.shadowBlur = 0;
    context.fillStyle = skin.eyeColor;
    context.beginPath();
    context.arc(52, 42, 2.6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = skin.pupilColor;
    context.beginPath();
    context.arc(53, 42, 1.4, 0, Math.PI * 2);
    context.fill();

    const selected = this.activeTab === "skins" ? skin : theme;
    const locked = this.activeTab === "skins" && !this.skinManager.unlocked.has(skin.id);
    this.previewName.textContent = `${locked ? "🔒 " : ""}${selected.icon}  ${selected.name}`;
    this.previewDescription.textContent = locked ? skin.unlock.hint : selected.description;
    this.selectionStatus.textContent = this.activeTab === "skins"
      ? `СКИН: ${this.skinManager.current.name.toUpperCase()}`
      : `ПОЛЕ: ${this.fieldThemeManager.current.name.toUpperCase()}`;
  }

  _mixColor(start, end, ratio) {
    const toRgb = (hex) => hex.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16));
    const left = toRgb(start);
    const right = toRgb(end);
    const channels = left.map((value, index) => Math.round(value + (right[index] - value) * ratio));
    return `rgb(${channels.join(",")})`;
  }
}