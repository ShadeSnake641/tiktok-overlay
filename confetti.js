const sync = window.HackySackSync ? window.HackySackSync.create("confetti") : null;
const confettiCanvas = document.getElementById("confettiCanvas");
const confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
const confettiPieces = [];
const confettiPalette = [
  "#ffd166",
  "#ef476f",
  "#06d6a0",
  "#118ab2",
  "#f4f1de",
  "#ff8fab",
  "#83f28f"
];
const goalFxTimers = new Set();
const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

let confettiFrame = null;
let confettiLastTs = 0;
let confettiWidth = 0;
let confettiHeight = 0;

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

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

function createConfettiPiece(yMin, yMax) {
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
    color: randomFrom(confettiPalette)
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

function clearGoalFxTimers() {
  goalFxTimers.forEach((timer) => clearTimeout(timer));
  goalFxTimers.clear();
}

function clearConfetti() {
  clearGoalFxTimers();
  if (confettiFrame !== null) {
    window.cancelAnimationFrame(confettiFrame);
    confettiFrame = null;
  }
  confettiPieces.length = 0;
  if (confettiCtx) {
    confettiCtx.clearRect(0, 0, confettiWidth, confettiHeight);
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
  if (!confettiCtx || confettiFrame !== null) return;
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

if (sync) {
  sync.subscribe((message) => {
    if (message.type === "goal") {
      launchGoalConfetti();
    }

    if (message.type === "reset" || message.type === "undo") {
      clearConfetti();
    }
  });
}

window.addEventListener("resize", resizeConfettiCanvas);
resizeConfettiCanvas();
