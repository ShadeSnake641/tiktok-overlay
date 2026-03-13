    const STORAGE_KEYS = {
      record: "hackySackCounter.recordPasses"
    };

    let recordPasses = readStoredNumber(STORAGE_KEYS.record, 0);
    let goalPasses = 5;
    let goalCelebrated = false;

    const overlay = document.getElementById("overlay");
    const headline = document.getElementById("headline");
    const currentText = document.getElementById("currentText");
    const currentValue = document.getElementById("currentValue");
    const recordValue = document.getElementById("recordValue");
    const goalValue = document.getElementById("goalValue");
    const goalPercent = document.getElementById("goalPercent");
    const goalProgressFill = document.getElementById("goalProgressFill");
    const currentLabelWave = document.getElementById("currentLabelWave");
    const recordLabelWave = document.getElementById("recordLabelWave");
    const goalLabelWave = document.getElementById("goalLabelWave");
    const goalSuffixWave = document.getElementById("goalSuffixWave");
    const goalPercentSuffixWave = document.getElementById("goalPercentSuffixWave");
    const eventLayer = document.getElementById("eventLayer");
    const sparkleLayer = document.getElementById("sparkleLayer");
    const confettiCanvas = document.getElementById("confettiCanvas");
    const confettiCtx = confettiCanvas.getContext("2d");
    const currentTextAnimations = ["flash-good", "flash-bad"];
    const overlayAnimations = ["shake", "record-burst", "goal-burst"];
    const recordAnimations = ["record-value-burst"];
    const goalValueAnimations = ["goal-value-burst"];
    const headlineAnimations = ["headline-hit"];
    const animationDurations = {
      "flash-good": 420,
      "flash-bad": 360,
      "shake": 220,
      "record-burst": 900,
      "record-value-burst": 780,
      "goal-value-burst": 860,
      "goal-burst": 1200,
      "headline-hit": 360
    };
    const MAX_PLUS_HISTORY = 500;
    const animationTimers = new Map();
    let newRecordAnnouncedThisRun = false;
    const plusActionHistory = [];
    const goalFxTimers = new Set();
    const confettiPieces = [];
    let confettiFrame = null;
    let confettiLastTs = 0;
    let confettiWidth = 0;
    let confettiHeight = 0;
    const IDLE_FLIP_HEADLINE = "\u266A\u250F(\u30FBo\uff65)\u251B\u266A";
    let goalReachedHeadlineActive = false;
    let goalBarHoldFull = false;
    let resetEmoteActive = false;
    let resetEmoteText = "";
    const resetTransitionTimers = new Set();
    let idleWaveConfigured = false;
    const resetHeadlines = [
      "\u02d9\u25e0\u02d9",
      "(\u2022\u0301 \u1d16 \u2022\u0300)",
      "\u0ac8(\u25de \u2038 \u25df )\u10d0",
      "(\u2565\u2038\u2565)",
      "._.",
      ".\u00b7\u00b0\u055e(\u02c3 \u15dd \u02c2)\u055e\u00b0\u00b7.",
      "\u0ac8\u25de\u2038\u25df\u02f6\u{1106c}",
      "\u{1050c}\u055e.\u2038.\u055e\u{109af}"
    ];
    const confettiPalette = [
      "#ffd166",
      "#ef476f",
      "#06d6a0",
      "#118ab2",
      "#f4f1de",
      "#ff8fab",
      "#83f28f"
    ];

    function render() {
      if (!idleWaveConfigured) {
        configureIdleTextWave();
      }
      currentValue.textContent = String(currentPasses);
      recordValue.textContent = String(recordPasses);
      goalValue.textContent = String(goalPasses);
      const rawPercent = goalPasses > 0 ? (currentPasses / goalPasses) * 100 : 0;
      const percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
      goalPercent.textContent = String(percent);
      updateGoalProgressBar(rawPercent);
      if (!resetEmoteActive) {
        headline.textContent = getMoodText();
      }
      syncHeadlineState();
    }

    function buildWaveCharacters(node, startDelay, charStepMs) {
      const source = node.textContent || "";
      node.textContent = "";
      let delay = startDelay;

      for (const ch of source) {
        const span = document.createElement("span");
        span.className = "wave-char";
        span.style.setProperty("--wave-delay", `${delay}ms`);
        span.textContent = ch === " " ? "\u00a0" : ch;
        node.appendChild(span);
        delay += charStepMs;
      }

      return delay;
    }

    function setWaveDelay(node, delayMs) {
      node.classList.add("wave-token");
      node.style.setProperty("--wave-delay", `${delayMs}ms`);
    }

    function configureIdleTextWave() {
      const charStepMs = 85;
      const lineGapMs = 290;
      const tokenStepMs = 140;
      let delay = 0;

      delay = buildWaveCharacters(currentLabelWave, delay, charStepMs);
      setWaveDelay(currentValue, delay);
      delay += tokenStepMs + lineGapMs;

      delay = buildWaveCharacters(recordLabelWave, delay, charStepMs);
      setWaveDelay(recordValue, delay);
      delay += tokenStepMs + lineGapMs;

      delay = buildWaveCharacters(goalLabelWave, delay, charStepMs);
      setWaveDelay(goalValue, delay);
      delay += tokenStepMs;
      delay = buildWaveCharacters(goalSuffixWave, delay, charStepMs);
      setWaveDelay(goalPercent, delay);
      delay += tokenStepMs;
      delay = buildWaveCharacters(goalPercentSuffixWave, delay, charStepMs);

      overlay.style.setProperty("--wave-cycle", `${delay + 2600}ms`);
      overlay.classList.add("idle-text-wave");
      idleWaveConfigured = true;
    }

    function getMoodText() {
      if (resetEmoteActive) return resetEmoteText;
      if (goalReachedHeadlineActive) return "Goal Reached";
      if (currentPasses === 0) return "";
      if (currentPasses === goalPasses - 1) return "So Close";
      if (currentPasses >= Math.floor(goalPasses * 0.75)) return "On Fire";
      if (currentPasses >= Math.floor(goalPasses * 0.5)) return "Cooking";
      if (currentPasses >= Math.floor(goalPasses * 0.25)) return "Locked In";
      return "Warming Up";
    }

    function syncHeadlineState() {
      const useIdle = !resetEmoteActive && !goalReachedHeadlineActive && currentPasses === 0;
      headline.classList.toggle("idle-flip", useIdle);
      if (useIdle) headline.textContent = IDLE_FLIP_HEADLINE;
    }

    function clearPlusHistory() {
      plusActionHistory.length = 0;
    }

    function mixHue(start, end, ratio) {
      return start + (end - start) * ratio;
    }

    function updateGoalProgressBar(rawPercent) {
      const clamped = Math.min(100, Math.max(0, rawPercent));
      const displayPercent = goalBarHoldFull ? 100 : clamped;
      const ratio = displayPercent / 100;
      const hue = mixHue(208, 46, ratio);
      const topLight = 58 + ratio * 7;
      const bottomLight = 47 + ratio * 9;
      const atRecordOrHigher = recordPasses > 0 && currentPasses >= recordPasses;

      goalProgressFill.style.width = `${displayPercent}%`;
      goalProgressFill.classList.toggle("goal-complete", goalBarHoldFull);
      goalProgressFill.classList.toggle("goal-shimmer", goalBarHoldFull);

      if (goalBarHoldFull) {
        goalProgressFill.classList.toggle("record-glow", atRecordOrHigher);
        goalProgressFill.style.background = "";
        goalProgressFill.style.boxShadow = "";
        goalProgressFill.style.filter = "";
        return;
      }

      if (atRecordOrHigher) {
        goalProgressFill.classList.add("record-glow");
        goalProgressFill.style.background = "";
        goalProgressFill.style.boxShadow = "";
        goalProgressFill.style.filter = "";
      } else {
        goalProgressFill.classList.remove("record-glow");
        goalProgressFill.classList.remove("goal-complete", "goal-shimmer");
        goalProgressFill.style.background =
          `linear-gradient(180deg, hsl(${hue.toFixed(1)} 97% ${topLight.toFixed(1)}%), hsl(${hue.toFixed(1)} 89% ${bottomLight.toFixed(1)}%))`;
        goalProgressFill.style.boxShadow = `0 0 ${Math.round(9 + ratio * 7)}px hsla(${hue.toFixed(1)} 95% 65% / ${0.36 + ratio * 0.26})`;
        goalProgressFill.style.filter = "none";
      }
    }

    function capturePlusSnapshot() {
      return {
        currentPasses,
        recordPasses,
        goalPasses,
        goalCelebrated,
        newRecordAnnouncedThisRun,
        goalReachedHeadlineActive,
        goalBarHoldFull
      };
    }

    function pushPlusSnapshot() {
      plusActionHistory.push(capturePlusSnapshot());
      if (plusActionHistory.length > MAX_PLUS_HISTORY) {
        plusActionHistory.shift();
      }
    }

    function scheduleGoalFx(callback, delay) {
      const timer = setTimeout(() => {
        goalFxTimers.delete(timer);
        callback();
      }, delay);
      goalFxTimers.add(timer);
      return timer;
    }

    function clearGoalFxTimers() {
      goalFxTimers.forEach((timer) => clearTimeout(timer));
      goalFxTimers.clear();
    }

    function clearResetTransition() {
      resetTransitionTimers.forEach((timer) => clearTimeout(timer));
      resetTransitionTimers.clear();
      resetEmoteActive = false;
      resetEmoteText = "";
      headline.style.transition = "";
      headline.style.opacity = "1";
      syncHeadlineState();
    }

    function runResetHeadlineTransition() {
      clearResetTransition();
      resetEmoteText = randomFrom(resetHeadlines);
      resetEmoteActive = true;

      headline.style.transition = "opacity 280ms ease";
      headline.style.opacity = "1";
      headline.textContent = resetEmoteText;
      syncHeadlineState();

      const fadeOutTimer = setTimeout(() => {
        headline.style.opacity = "0";
      }, 1000);
      resetTransitionTimers.add(fadeOutTimer);

      const swapTimer = setTimeout(() => {
        resetEmoteActive = false;
        headline.textContent = getMoodText();
        headline.style.opacity = "1";
        syncHeadlineState();
        resetTransitionTimers.delete(swapTimer);
      }, 1280);
      resetTransitionTimers.add(swapTimer);
    }

    function clearConfetti() {
      if (confettiFrame !== null) {
        window.cancelAnimationFrame(confettiFrame);
        confettiFrame = null;
      }
      confettiPieces.length = 0;
      if (confettiCtx) {
        confettiCtx.clearRect(0, 0, confettiWidth, confettiHeight);
      }
    }

    function clearVisualEffects() {
      clearGoalFxTimers();
      clearConfetti();
      clearResetTransition();
      eventLayer.replaceChildren();
      sparkleLayer.replaceChildren();
    }

    function restorePlusSnapshot(snapshot) {
      clearVisualEffects();

      currentPasses = snapshot.currentPasses;
      recordPasses = snapshot.recordPasses;
      goalPasses = snapshot.goalPasses;
      goalCelebrated = snapshot.goalCelebrated;
      newRecordAnnouncedThisRun = snapshot.newRecordAnnouncedThisRun;
      goalReachedHeadlineActive = snapshot.goalReachedHeadlineActive;
      goalBarHoldFull = snapshot.goalBarHoldFull;

      saveStoredNumber(STORAGE_KEYS.record, recordPasses);
      render();
    }

    function undoLastPlusAction() {
      if (!plusActionHistory.length) {
        animateClass(overlay, "shake", overlayAnimations);
        spawnPopup("No Undo", "minus");
        return;
      }

      const snapshot = plusActionHistory.pop();
      restorePlusSnapshot(snapshot);
      animateClass(currentText, "flash-bad", currentTextAnimations);
      spawnPopup("Undo", "minus");
    }

    function readStoredNumber(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function saveStoredNumber(key, value) {
      try {
        localStorage.setItem(key, String(value));
      } catch (error) {
        // Ignore storage failures in overlay contexts where storage is blocked.
      }
    }

    function sanitizeInputToNumber(value, fallback, min = 0) {
      const cleaned = String(value).replace(/[^\d]/g, "");
      if (!cleaned) return fallback;
      return Math.max(min, Number.parseInt(cleaned, 10));
    }

    function getAnimationKey(el, className) {
      if (!el.dataset.animKey) {
        el.dataset.animKey = `anim-${Math.random().toString(36).slice(2, 9)}`;
      }
      return `${el.dataset.animKey}:${className}`;
    }

    function animateClass(el, className, classGroup = []) {
      classGroup.forEach((name) => el.classList.remove(name));
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);
      const timerKey = getAnimationKey(el, className);
      const existingTimer = animationTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const duration = animationDurations[className] || 800;
      const timer = setTimeout(() => {
        el.classList.remove(className);
        animationTimers.delete(timerKey);
      }, duration + 40);
      animationTimers.set(timerKey, timer);
    }

    function spawnPopup(text, type = "plus") {
      const node = document.createElement("div");
      node.className = `popup ${type}`;
      node.textContent = text;
      const jitter = (Math.random() - 0.5) * 40;
      node.style.left = `${52 + jitter / 10}%`;
      eventLayer.appendChild(node);
      node.addEventListener("animationend", () => node.remove());
    }

    function spawnSparkles({ count = 14, color = "#ffd15a", rangeX = 170, rangeY = 95 } = {}) {
      for (let i = 0; i < count; i += 1) {
        const node = document.createElement("span");
        const angle = Math.random() * Math.PI * 2;
        const distanceX = 28 + Math.random() * rangeX;
        const distanceY = 16 + Math.random() * rangeY;
        const tx = Math.cos(angle) * distanceX;
        const ty = Math.sin(angle) * distanceY;
        const size = 4 + Math.random() * 7;

        node.className = "sparkle";
        node.style.setProperty("--tx", `${tx.toFixed(1)}px`);
        node.style.setProperty("--ty", `${ty.toFixed(1)}px`);
        node.style.setProperty("--sparkle-color", color);
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.left = `${42 + Math.random() * 20}%`;
        node.style.top = `${34 + Math.random() * 30}%`;
        node.style.animationDuration = `${780 + Math.random() * 420}ms`;

        sparkleLayer.appendChild(node);
        node.addEventListener("animationend", () => node.remove());
      }
    }

    const SCENE_WIDTH = 1920;
    const SCENE_HEIGHT = 1080;

    function resizeConfettiCanvas() {
      if (!confettiCtx) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      confettiWidth = SCENE_WIDTH;
      confettiHeight = SCENE_HEIGHT;
      confettiCanvas.width = Math.floor(confettiWidth * dpr);
      confettiCanvas.height = Math.floor(confettiHeight * dpr);
      confettiCanvas.style.width = `${confettiWidth}px`;
      confettiCanvas.style.height = `${confettiHeight}px`;
      confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function randomFrom(list) {
      return list[Math.floor(Math.random() * list.length)];
    }

    function createConfettiPiece(yMin, yMax) {
      const color = randomFrom(confettiPalette);
      return {
        x: Math.random() * confettiWidth,
        y: yMin + Math.random() * (yMax - yMin),
        vx: (Math.random() - 0.5) * 95,
        vy: 90 + Math.random() * 220,
        gravity: 260 + Math.random() * 260,
        swayAmp: 8 + Math.random() * 16,
        swayFreq: 1.4 + Math.random() * 2.4,
        swayPhase: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8.5,
        flipSpeed: 6 + Math.random() * 8,
        flipPhase: Math.random() * Math.PI * 2,
        width: 6 + Math.random() * 8,
        height: 10 + Math.random() * 12,
        drag: 0.008 + Math.random() * 0.012,
        color
      };
    }

    function addConfettiWave(count, yMin, yMax) {
      for (let i = 0; i < count; i += 1) {
        confettiPieces.push(createConfettiPiece(yMin, yMax));
      }
    }

    function drawConfettiPiece(piece) {
      if (!confettiCtx) return;
      const wobbleX = Math.sin(piece.swayPhase) * piece.swayAmp;
      const flipScale = 0.25 + Math.abs(Math.cos(piece.flipPhase));

      confettiCtx.save();
      confettiCtx.translate(piece.x + wobbleX, piece.y);
      confettiCtx.rotate(piece.rotation);
      confettiCtx.scale(1, flipScale);
      confettiCtx.fillStyle = piece.color;
      confettiCtx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
      confettiCtx.globalAlpha = 0.28;
      confettiCtx.fillStyle = "#000000";
      confettiCtx.fillRect(-piece.width / 2, -piece.height / 2, piece.width * 0.45, piece.height);
      confettiCtx.restore();
      confettiCtx.globalAlpha = 1;
    }

    function stepConfetti(timestamp) {
      if (!confettiCtx) {
        confettiPieces.length = 0;
        confettiFrame = null;
        return;
      }

      if (!confettiPieces.length) {
        confettiCtx.clearRect(0, 0, confettiWidth, confettiHeight);
        confettiFrame = null;
        return;
      }

      const dt = Math.min(0.034, (timestamp - confettiLastTs) / 1000);
      confettiLastTs = timestamp;

      confettiCtx.clearRect(0, 0, confettiWidth, confettiHeight);

      for (let i = confettiPieces.length - 1; i >= 0; i -= 1) {
        const piece = confettiPieces[i];
        piece.vx *= Math.max(0.88, 1 - piece.drag * 60 * dt);
        piece.vy += piece.gravity * dt;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rotation += piece.rotationSpeed * dt;
        piece.swayPhase += piece.swayFreq * dt;
        piece.flipPhase += piece.flipSpeed * dt;

        drawConfettiPiece(piece);

        if (piece.y - piece.height > confettiHeight + 40) {
          confettiPieces.splice(i, 1);
        }
      }

      confettiFrame = window.requestAnimationFrame(stepConfetti);
    }

    function startConfettiLoop() {
      if (!confettiCtx) return;
      if (confettiFrame !== null) return;
      confettiLastTs = performance.now();
      confettiFrame = window.requestAnimationFrame(stepConfetti);
    }

    function launchGoalConfetti() {
      if (!confettiCtx) return;
      if (!confettiWidth || !confettiHeight) {
        resizeConfettiCanvas();
      }

      addConfettiWave(260, -confettiHeight * 0.35, -6);
      scheduleGoalFx(() => addConfettiWave(190, -confettiHeight * 0.5, -10), 140);
      scheduleGoalFx(() => addConfettiWave(170, -confettiHeight * 0.4, -8), 300);
      startConfettiLoop();
    }

    function maybeAutoUpdateRecord() {
      if (currentPasses > recordPasses) {
        recordPasses = currentPasses;
        saveStoredNumber(STORAGE_KEYS.record, recordPasses);
        animateClass(recordValue, "record-value-burst", recordAnimations);
        if (!newRecordAnnouncedThisRun) {
          newRecordAnnouncedThisRun = true;
          spawnPopup("New Record!", "record");
          spawnSparkles({ count: 18, color: "#ffd15a", rangeX: 180, rangeY: 105 });
        }
        return true;
      }
      return false;
    }

    function celebrateGoalIfNeeded() {
      if (currentPasses >= goalPasses && !goalCelebrated) {
        goalCelebrated = true;
        goalReachedHeadlineActive = true;
        goalBarHoldFull = true;
        animateClass(overlay, "goal-burst", overlayAnimations);
        animateClass(goalValue, "goal-value-burst", goalValueAnimations);
        spawnPopup("GOAL!", "goal");
        spawnSparkles({ count: 30, color: "#82ffbf", rangeX: 240, rangeY: 150 });
        scheduleGoalFx(() => {
          spawnSparkles({ count: 20, color: "#d5ffe8", rangeX: 200, rangeY: 120 });
        }, 170);
        launchGoalConfetti();
        goalPasses += 5;
        render();
      } else if (currentPasses < goalPasses) {
        goalCelebrated = false;
      }
    }

    function isKey(event, key, code) {
      return event.key === key || event.code === code;
    }

    function isEditingNumber() {
      const active = document.activeElement;
      return active === recordValue || active === goalValue;
    }

    function selectAllText(el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function wireEditableNumber(el, onCommit) {
      el.addEventListener("focus", () => {
        el.classList.add("editing");
        setTimeout(() => selectAllText(el), 0);
      });

      el.addEventListener("blur", () => {
        el.classList.remove("editing");
        onCommit(el.textContent);
      });

      el.addEventListener("input", () => {
        const cleaned = el.textContent.replace(/[^\d]/g, "");
        if (cleaned !== el.textContent) {
          el.textContent = cleaned;
          selectAllText(el);
        }
      });

      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          el.blur();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          render();
          el.blur();
        }
      });
    }

    wireEditableNumber(recordValue, (textValue) => {
      recordPasses = sanitizeInputToNumber(textValue, recordPasses, 0);
      if (recordPasses < currentPasses) {
        recordPasses = currentPasses;
      }
      saveStoredNumber(STORAGE_KEYS.record, recordPasses);
      clearPlusHistory();
      render();
    });

    wireEditableNumber(goalValue, (textValue) => {
      goalPasses = sanitizeInputToNumber(textValue, goalPasses, 1);
      goalCelebrated = false;
      goalReachedHeadlineActive = false;
      goalBarHoldFull = false;
      clearPlusHistory();
      render();
      celebrateGoalIfNeeded();
    });

    window.addEventListener("keydown", (event) => {
      if (isEditingNumber()) {
        return;
      }

      if (isKey(event, "1", "Digit1")) {
        pushPlusSnapshot();
        clearResetTransition();
        goalReachedHeadlineActive = false;
        goalBarHoldFull = false;
        currentPasses += 1;
        animateClass(currentText, "flash-good", currentTextAnimations);
        spawnPopup("+1", "plus");
        maybeAutoUpdateRecord();
        render();
        animateClass(headline, "headline-hit", headlineAnimations);
        celebrateGoalIfNeeded();
      }

      if (isKey(event, "2", "Digit2")) {
        clearVisualEffects();
        clearPlusHistory();
        currentPasses = 0;
        goalCelebrated = false;
        goalReachedHeadlineActive = false;
        goalBarHoldFull = false;
        newRecordAnnouncedThisRun = false;
        animateClass(overlay, "shake", overlayAnimations);
        spawnPopup("Reset", "minus");
        render();
        runResetHeadlineTransition();
      }

      if (isKey(event, "3", "Digit3")) {
        clearResetTransition();
        undoLastPlusAction();
      }
    });

    window.addEventListener("resize", resizeConfettiCanvas);
    resizeConfettiCanvas();
    render();
