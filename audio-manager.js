const safeStorage = (() => {
  const overrides = new Map();
  return {
    getItem(key) {
      if (overrides.has(key)) return overrides.get(key);
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      const serialized = String(value);
      try {
        window.localStorage.setItem(key, serialized);
        overrides.delete(key);
        return true;
      } catch {
        overrides.set(key, serialized);
        return false;
      }
    },
    removeItem(key) {
      try {
        window.localStorage.removeItem(key);
        overrides.delete(key);
        return true;
      } catch {
        overrides.set(key, null);
        return false;
      }
    },
  };
})();

class AudioManager {
  constructor(options = {}) {
    this.isEnabled = options.enabled !== false;
    this.masterVolume = 1;
    this.musicVolume = 0.6;
    this.sfxVolume = 1;
    this.anthem = new Audio();
    this.anthem.preload = "auto";
    this.anthem.loop = true;
    this.anthem.volume = 0;
    this.isAnthemReady = false;
    this.isAnthemPlaying = false;
    this.isAnthemFading = false;
    this.isAnthemStarting = false;
    this.anthemUnavailable = false;
    this.shouldPlayAnthem = false;
    this.currentGameState = "MENU";
    this.fadeFrame = 0;
    this.fade = null;
    this.sfxContext = null;
    this.sfxVolumeGain = null;
    this.sfxMasterGain = null;
    this.sfxIndex = 0;

    // Отключаем загрузку отсутствующих аудиофайлов - используем только Web Audio API
    this.sounds = {
      shoot: null,
      reload: null,
      toggle: null,
      eat: null,
      gameover: null,
    };
    this.shootPool = [];

    this._initAudioElements();
  }

  _initAudioElements() {
    this.anthem.addEventListener("canplaythrough", () => {
      this.isAnthemReady = true;
      if (this.shouldPlayAnthem && this.currentGameState === "PLAYING") this._startAnthem();
    });
    this.anthem.addEventListener("error", () => {
      this.anthemUnavailable = true;
      this.isAnthemReady = false;
      console.warn("Гимн не удалось загрузить. Игра продолжит работать без музыки.");
    });
    // Предзагрузка начинается при запуске меню; ошибка файла не останавливает игру.
    this.anthem.src = "./assets/sounds/anthem.mp3";
    this.anthem.load();
  }

  _createAudio(source, label) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = this.sfxVolume * this.masterVolume;
    audio.addEventListener("error", () => {
      audio.dataset.failed = "true";
      console.warn(`${label}: аудиофайл недоступен, будет использован встроенный звук.`);
    });
    audio.src = source;
    audio.load();
    return audio;
  }

  playAnthem() {
    if (!this.isEnabled) return;
    this.shouldPlayAnthem = true;
    if (this.currentGameState !== "PLAYING" || this.anthemUnavailable) return;

    const reversingFade = Boolean(this.fade && this.fade.to === 0);
    if (reversingFade) this._cancelFade();
    this._startAnthem(!this.isAnthemPlaying || reversingFade);
  }

  _startAnthem(fadeIn = true) {
    if (!this.isEnabled || !this.shouldPlayAnthem || this.currentGameState !== "PLAYING" || this.isAnthemStarting) return;
    if (this.anthemUnavailable) return;

    this.isAnthemStarting = true;
    if (fadeIn && !this.isAnthemPlaying) {
      this.anthem.currentTime = 0;
      this.anthem.volume = 0;
    }
    this.anthem.play().then(() => {
      this.isAnthemStarting = false;
      if (!this.isEnabled || !this.shouldPlayAnthem || this.currentGameState !== "PLAYING") {
        this.anthem.pause();
        return;
      }
      this.isAnthemPlaying = true;
      if (fadeIn) this._fadeTo(this._musicTarget(), 1000);
      else this._resumeFade();
    }).catch((error) => {
      this.isAnthemStarting = false;
      if (this.currentGameState === "PLAYING" && this.shouldPlayAnthem) {
        console.warn("Гимн не удалось запустить:", error);
      }
    });
  }

  stopAnthem(durationMs = 1500) {
    this.shouldPlayAnthem = false;
    if (!this.isAnthemPlaying && !this.isAnthemStarting) return;
    if (durationMs <= 0 || !this.isAnthemReady) {
      this._stopAnthemImmediately();
      return;
    }
    if (this.fade && this.fade.to === 0) return;
    this._fadeTo(0, durationMs, () => this._finishAnthemStop());
  }

  _finishAnthemStop() {
    this.anthem.pause();
    this.anthem.currentTime = 0;
    this.isAnthemPlaying = false;
    this.isAnthemStarting = false;
  }

  _stopAnthemImmediately() {
    this._cancelFade();
    this.anthem.pause();
    this.anthem.currentTime = 0;
    this.anthem.volume = 0;
    this.isAnthemPlaying = false;
    this.isAnthemStarting = false;
    this.shouldPlayAnthem = false;
  }

  _fadeTo(target, durationMs, onComplete = null) {
    this._cancelFade();
    if (durationMs <= 0) {
      this.anthem.volume = target;
      this.isAnthemFading = false;
      if (onComplete) onComplete();
      return;
    }
    this.fade = {
      from: this.anthem.volume,
      to: target,
      duration: durationMs,
      remaining: durationMs,
      startedAt: performance.now(),
      onComplete,
    };
    this.isAnthemFading = true;
    this._animateFade();
  }

  _animateFade() {
    if (!this.fade) return;
    const now = performance.now();
    const progress = Math.min(1, (now - this.fade.startedAt) / this.fade.duration);
    this.anthem.volume = this.fade.from + (this.fade.to - this.fade.from) * progress;
    this.fade.remaining = Math.max(0, this.fade.duration - (now - this.fade.startedAt));
    if (progress >= 1) {
      const onComplete = this.fade.onComplete;
      this.fade = null;
      this.fadeFrame = 0;
      this.isAnthemFading = false;
      if (onComplete) onComplete();
      return;
    }
    this.fadeFrame = requestAnimationFrame(() => this._animateFade());
  }

  _pauseFade() {
    if (!this.fade) return;
    const now = performance.now();
    const progress = Math.min(1, (now - this.fade.startedAt) / this.fade.duration);
    this.anthem.volume = this.fade.from + (this.fade.to - this.fade.from) * progress;
    this.fade.remaining = Math.max(0, this.fade.duration - (now - this.fade.startedAt));
    this.fade.from = this.anthem.volume;
    this.fade.duration = this.fade.remaining;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
  }

  _resumeFade() {
    if (!this.fade) return;
    if (this.fade.remaining <= 0) {
      this.anthem.volume = this.fade.to;
      const onComplete = this.fade.onComplete;
      this.fade = null;
      this.isAnthemFading = false;
      if (onComplete) onComplete();
      return;
    }
    this.fade.from = this.anthem.volume;
    this.fade.duration = this.fade.remaining;
    this.fade.startedAt = performance.now();
    this._animateFade();
  }

  _cancelFade() {
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
    this.fade = null;
    this.isAnthemFading = false;
  }

  playSFX(soundName) {
    if (!this.isEnabled) return;
    const aliases = { shot: "shoot", "toggle-on": "toggle", "toggle-off": "toggle" };
    const name = aliases[soundName] || soundName;
    if (!Object.prototype.hasOwnProperty.call(this.sounds, name)) {
      console.warn(`Неизвестный звуковой эффект: ${soundName}`);
      return;
    }

    const audio = name === "shoot" ? this._nextShotAudio() : this.sounds[name];
    if (audio && !audio.dataset.failed && audio.readyState >= 2) {
      audio.volume = this.sfxVolume * this.masterVolume;
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.warn("SFX не удалось запустить:", error);
        this._playSynthSFX(name);
      });
      return;
    }
    this._playSynthSFX(name);
  }

  _nextShotAudio() {
    if (!this.shootPool.length) return null;
    const audio = this.shootPool[this.sfxIndex];
    this.sfxIndex = (this.sfxIndex + 1) % this.shootPool.length;
    return audio;
  }

  _playSynthSFX(name) {
    // Встроенные короткие сигналы сохраняют отклик, пока внешние SFX не добавлены.
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.sfxContext) {
      this.sfxContext = new AudioContextClass();
      this.sfxVolumeGain = this.sfxContext.createGain();
      this.sfxMasterGain = this.sfxContext.createGain();
      this.sfxVolumeGain.gain.value = this.sfxVolume;
      this.sfxMasterGain.gain.value = this.masterVolume;
      this.sfxVolumeGain.connect(this.sfxMasterGain);
      this.sfxMasterGain.connect(this.sfxContext.destination);
    }
    if (this.sfxContext.state === "suspended") this.sfxContext.resume().catch(() => {});

    const isShot = name === "shoot";
    const isEat = name === "eat";
    const startFrequency = isShot ? 150 : isEat ? 620 : name === "gameover" ? 220 : 720;
    const endFrequency = isShot ? 75 : isEat ? 880 : name === "gameover" ? 110 : 460;
    const duration = isShot ? 0.085 : isEat ? 0.12 : name === "gameover" ? 0.24 : 0.13;
    const gainLevel = isShot ? 0.045 : isEat ? 0.018 : 0.025;
    const oscillator = this.sfxContext.createOscillator();
    const gain = this.sfxContext.createGain();
    const start = this.sfxContext.currentTime;
    oscillator.type = isShot ? "triangle" : isEat ? "sine" : "square";
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration * 0.8);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainLevel, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.sfxVolumeGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  setGameState(state) {
    this.currentGameState = state;
    if (state === "PAUSED") {
      this._pauseFade();
      this.anthem.pause();
      return;
    }
    if (state === "PLAYING") {
      if (!this.isEnabled) return;
      if (this.isAnthemPlaying && this.shouldPlayAnthem) {
        this.anthem.play().then(() => this._resumeFade()).catch((error) => {
          console.warn("Гимн не удалось возобновить:", error);
        });
      } else if (this.shouldPlayAnthem) {
        this.playAnthem();
      }
      return;
    }
    if (state === "GAME_OVER") {
      this.stopAnthem(300);
      this.playSFX("gameover");
      return;
    }
    if (state === "MENU") this._stopAnthemImmediately();
  }

  toggleSound(enabled) {
    this.isEnabled = Boolean(enabled);
    if (!this.isEnabled) {
      const shouldResumeAnthem = this.shouldPlayAnthem;
      this._stopAnthemImmediately();
      this.shouldPlayAnthem = shouldResumeAnthem;
      const allAudio = [...Object.values(this.sounds).filter(a => a), ...this.shootPool];
      allAudio.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      if (this.sfxContext && this.sfxContext.state === "running") this.sfxContext.suspend();
      return;
    }
    if (this.currentGameState === "PLAYING" && this.shouldPlayAnthem) this.playAnthem();
  }

  setMasterVolume(volume) {
    this.masterVolume = this._clampVolume(volume);
    this._applySFXVolume();
    if (this.fade) this.fade.to = this._musicTarget();
    else if (this.isAnthemPlaying) this.anthem.volume = this._musicTarget();
  }

  setMusicVolume(volume) {
    this.musicVolume = this._clampVolume(volume);
    if (this.fade) this.fade.to = this._musicTarget();
    else if (this.isAnthemPlaying) this.anthem.volume = this._musicTarget();
  }

  setSFXVolume(volume) {
    this.sfxVolume = this._clampVolume(volume);
    this._applySFXVolume();
  }

  _musicTarget() {
    return this.musicVolume * this.masterVolume;
  }

  _applySFXVolume() {
    const volume = this.sfxVolume * this.masterVolume;
    const allAudio = [...Object.values(this.sounds).filter(a => a), ...this.shootPool];
    allAudio.forEach((audio) => {
      audio.volume = volume;
    });
    if (this.sfxVolumeGain) this.sfxVolumeGain.gain.value = this.sfxVolume;
    if (this.sfxMasterGain) this.sfxMasterGain.gain.value = this.masterVolume;
  }

  _clampVolume(volume) {
    return Math.max(0, Math.min(1, Number(volume) || 0));
  }
}