const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const speedText = document.querySelector("#speed");
const boostText = document.querySelector("#boost");
const scoreText = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const message = document.querySelector("#message");
const startButton = document.querySelector("#start");
const pauseButton = document.querySelector("#pause");
const leftButton = document.querySelector("#left");
const rightButton = document.querySelector("#right");
const nameForm = document.querySelector("#name-form");
const winnerName = document.querySelector("#winner-name");
const leaderboardList = document.querySelector("#leaderboard-list");

const SPEED_GAIN_PERCENT = 1;
const SPEED_GAIN_PER_SECOND = SPEED_GAIN_PERCENT / 100;
const LEADERBOARD_KEY = "bounceGameTimeLeaderboardV1";

const state = {
  running: false,
  paused: false,
  elapsed: 0,
  lastTime: 0,
  leftPressed: false,
  rightPressed: false,
  pointerActive: false,
  pointerX: 0,
  touchControlActive: false,
  pendingScore: null,
};

const bounds = {
  width: canvas.width,
  height: canvas.height,
};

const paddle = {
  width: 176,
  height: 16,
  x: (bounds.width - 176) / 2,
  speed: 520,
  inset: 34,
};

const ball = {
  x: bounds.width / 2,
  y: bounds.height / 2,
  radius: 12,
  vx: 90,
  vy: 230,
};

const trail = [];

function resetBall() {
  const horizontal = Math.random() > 0.5 ? 1 : -1;
  const vertical = Math.random() > 0.5 ? 1 : -1;
  ball.x = bounds.width / 2;
  ball.y = bounds.height / 2;
  ball.vx = 90 * horizontal;
  ball.vy = 230 * vertical;
  trail.length = 0;
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.elapsed = 0;
  state.lastTime = performance.now();
  state.pendingScore = null;
  paddle.x = (bounds.width - paddle.width) / 2;
  pauseButton.textContent = "暂停";
  nameForm.classList.remove("is-visible");
  overlay.classList.remove("is-visible");
  resetBall();
  updateHud();
}

function updateHud() {
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60).toString().padStart(2, "0");
  const speedPercent = (100 * Math.hypot(ball.vx, ball.vy) / Math.hypot(90, 230)).toFixed(2);
  speedText.textContent = `${speedPercent}%`;
  boostText.textContent = `+${SPEED_GAIN_PERCENT}%/秒`;
  scoreText.textContent = `${minutes}:${seconds}`;
}

function showOverlay(title, text, buttonText, options = {}) {
  overlay.querySelector("h1").textContent = title;
  message.textContent = text;
  startButton.textContent = buttonText;
  startButton.hidden = Boolean(options.hideStart);
  nameForm.classList.toggle("is-visible", Boolean(options.showNameForm));
  if (options.showNameForm) {
    winnerName.value = "";
    setTimeout(() => winnerName.focus(), 0);
  }
  overlay.classList.add("is-visible");
}

function finishGame() {
  state.running = false;
  state.paused = false;
  pauseButton.textContent = "暂停";
  const total = `${Math.floor(state.elapsed / 60)}分${Math.floor(state.elapsed % 60)}秒`;
  const entry = {
    name: "",
    score: Math.floor(state.elapsed * 1000),
    date: new Date().toLocaleDateString("zh-CN"),
  };
  const qualifies = isTopScore(entry);

  if (qualifies) {
    state.pendingScore = entry;
    const title = "新纪录";
    const text = `你坚持了 ${total}，成绩进入前 10。`;
    showOverlay(title, text, "重新开始", { hideStart: true, showNameForm: true });
    return;
  }

  showOverlay("游戏结束", `你坚持了 ${total}。`, "重新开始");
}

function movePaddle(dt) {
  if (state.pointerActive) {
    paddle.x = state.pointerX - paddle.width / 2;
  } else {
    const direction = Number(state.rightPressed) - Number(state.leftPressed);
    paddle.x += direction * paddle.speed * dt;
  }

  paddle.x = Math.max(0, Math.min(bounds.width - paddle.width, paddle.x));
}

function hitPaddle(y, isTop) {
  const paddleY = isTop ? paddle.inset : bounds.height - paddle.inset - paddle.height;
  const withinY = isTop
    ? ball.y - ball.radius <= paddleY + paddle.height && ball.y > paddleY
    : ball.y + ball.radius >= paddleY && ball.y < paddleY + paddle.height;
  const withinX = ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width;

  if (!withinY || !withinX) {
    return false;
  }

  const impact = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
  const speed = Math.hypot(ball.vx, ball.vy);
  ball.vx = impact * speed * 0.76;
  ball.vy = Math.sqrt(Math.max(speed * speed - ball.vx * ball.vx, 0)) * (isTop ? 1 : -1);
  ball.y = isTop ? paddleY + paddle.height + ball.radius : paddleY - ball.radius;
  return true;
}

function update(dt) {
  state.elapsed += dt;
  movePaddle(dt);

  const speedGain = Math.pow(1 + SPEED_GAIN_PER_SECOND, dt);
  ball.vx *= speedGain;
  ball.vy *= speedGain;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  }

  if (ball.x + ball.radius >= bounds.width) {
    ball.x = bounds.width - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }

  if (ball.vy < 0) {
    hitPaddle(ball.y, true);
  } else {
    hitPaddle(ball.y, false);
  }

  if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= bounds.height) {
    finishGame();
    return;
  }

  trail.unshift({ x: ball.x, y: ball.y, radius: ball.radius });
  trail.length = Math.min(trail.length, 12);
  updateHud();
}

function formatTime(score) {
  const totalSeconds = Math.floor(score / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 10)));
}

function sortLeaderboard(entries) {
  return entries
    .slice()
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "zh-CN"))
    .slice(0, 10);
}

function isTopScore(entry) {
  const entries = sortLeaderboard(getLeaderboard());
  return entries.length < 10 || entry.score > entries[entries.length - 1].score;
}

function renderLeaderboard() {
  const entries = sortLeaderboard(getLeaderboard());
  leaderboardList.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "还没有成绩，第一名等你来拿。";
    leaderboardList.append(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <span class="leaderboard-name"></span>
      <span class="leaderboard-score">${formatTime(entry.score)}</span>
    `;
    item.querySelector(".leaderboard-name").textContent = entry.name;
    leaderboardList.append(item);
  });
}

function addLeaderboardEntry(entry) {
  const entries = sortLeaderboard([...getLeaderboard(), entry]);
  saveLeaderboard(entries);
  renderLeaderboard();
}

function drawCourt() {
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  const courtGradient = ctx.createLinearGradient(0, 0, bounds.width, bounds.height);
  courtGradient.addColorStop(0, "#071017");
  courtGradient.addColorStop(0.52, "#101820");
  courtGradient.addColorStop(1, "#090e14");
  ctx.fillStyle = courtGradient;
  ctx.fillRect(0, 0, bounds.width, bounds.height);

  ctx.strokeStyle = "rgba(111, 214, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, bounds.width - 2, bounds.height - 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.028)";
  for (let x = 38; x < bounds.width; x += 38) {
    ctx.fillRect(x, 0, 1, bounds.height);
  }
  for (let y = 38; y < bounds.height; y += 38) {
    ctx.fillRect(0, y, bounds.width, 1);
  }

  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.moveTo(24, bounds.height / 2);
  ctx.lineTo(bounds.width - 24, bounds.height / 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPaddles() {
  const topY = paddle.inset;
  const bottomY = bounds.height - paddle.inset - paddle.height;
  const paddleGradient = ctx.createLinearGradient(paddle.x, 0, paddle.x + paddle.width, 0);
  paddleGradient.addColorStop(0, "#25d6a2");
  paddleGradient.addColorStop(0.5, "#9cf56f");
  paddleGradient.addColorStop(1, "#4fd0ff");

  [topY, bottomY].forEach((y) => {
    ctx.shadowColor = "rgba(82, 231, 190, 0.55)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = paddleGradient;
    roundRect(paddle.x, y, paddle.width, paddle.height, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(paddle.x + 14, y + 4, paddle.width - 28, 3, 2);
    ctx.fill();
  });
}

function drawBall() {
  trail.forEach((point, index) => {
    const alpha = (1 - index / trail.length) * 0.28;
    ctx.fillStyle = `rgba(255, 173, 72, ${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.radius * (1 - index * 0.035), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.shadowColor = "rgba(255, 204, 77, 0.75)";
  ctx.shadowBlur = 20;
  const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 2, ball.x, ball.y, ball.radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#ffcc4d");
  gradient.addColorStop(0.72, "#ff7a45");
  gradient.addColorStop(1, "#e54f68");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function render() {
  drawCourt();
  drawPaddles();
  drawBall();
}

function loop(now) {
  const dt = Math.min((now - state.lastTime) / 1000, 0.032);
  state.lastTime = now;

  if (state.running && !state.paused) {
    update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

function setButtonHold(button, key) {
  const down = () => {
    state[key] = true;
  };
  const up = () => {
    state[key] = false;
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !nameForm.classList.contains("is-visible")) {
    event.preventDefault();
    if (state.running && state.paused) {
      togglePause();
    } else if (!state.running) {
      resetGame();
    }
  }
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    state.leftPressed = true;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.rightPressed = true;
  }
  if (event.key === " " && state.running) {
    event.preventDefault();
    togglePause();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    state.leftPressed = false;
  }
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    state.rightPressed = false;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    updateTouchDirection(event);
  } else {
    state.pointerActive = true;
    updatePointer(event);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (state.touchControlActive) {
    updateTouchDirection(event);
  } else if (state.pointerActive) {
    updatePointer(event);
  }
});

window.addEventListener("pointerup", () => {
  state.pointerActive = false;
  state.touchControlActive = false;
  state.leftPressed = false;
  state.rightPressed = false;
});

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointerX = ((event.clientX - rect.left) / rect.width) * bounds.width;
}

function updateTouchDirection(event) {
  const rect = canvas.getBoundingClientRect();
  const touchX = event.clientX - rect.left;
  state.touchControlActive = true;
  state.leftPressed = touchX < rect.width / 2;
  state.rightPressed = !state.leftPressed;
}

function togglePause() {
  if (!state.running) {
    return;
  }
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "继续" : "暂停";
  if (state.paused) {
    showOverlay("已暂停", "点击继续，或按空格键恢复游戏。", "继续游戏");
  } else {
    startButton.hidden = false;
    nameForm.classList.remove("is-visible");
    overlay.classList.remove("is-visible");
    state.lastTime = performance.now();
  }
}

startButton.addEventListener("click", () => {
  if (state.running && state.paused) {
    togglePause();
  } else {
    resetGame();
  }
});

nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.pendingScore) {
    return;
  }

  const name = winnerName.value.trim().slice(0, 14) || "无名高手";
  addLeaderboardEntry({ ...state.pendingScore, name });
  state.pendingScore = null;
  startButton.hidden = false;
  nameForm.classList.remove("is-visible");
  showOverlay("排名已保存", `${name} 已进入排行榜前 10。`, "再玩一次");
});

pauseButton.addEventListener("click", togglePause);
setButtonHold(leftButton, "leftPressed");
setButtonHold(rightButton, "rightPressed");

renderLeaderboard();
render();
requestAnimationFrame(loop);
