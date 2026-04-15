// ─── FLAPPY BIRD ─── Modern neon arcade style ───

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen  = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreDisplay = document.getElementById('score-display');
const finalScoreEl = document.getElementById('final-score');
const highScoreEl  = document.getElementById('high-score');
const startPrompt  = document.querySelector('.start-prompt');

// ─── Constants ───
const GRAVITY       = 0.38;
const FLAP_FORCE    = -7.2;
const PIPE_SPEED    = 2.8;
const PIPE_WIDTH    = 64;
const PIPE_GAP      = 200;   // vertical gap between pipes
const PIPE_INTERVAL = 90;    // frames between new pipes
const BIRD_RADIUS   = 16;

// ─── State ───
let state = 'start'; // start | playing | dead
let bird, pipes, particles, score, frame;
let highScore = parseInt(localStorage.getItem('flappy-highscore')) || 0;
let flashTimer = 0;

// ─── Audio ───
let audioCtx = null;

function getAC() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch(e) { return null; }
}

function unlockAudio() {
  try {
    const ac = getAC();
    if (!ac) return;
    const buf = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start(0);
  } catch(e) {}
}
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('keydown',    unlockAudio, { once: true });

function playFlap() {
  try {
    const ac = getAC();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ac.currentTime + 0.06);
    gain.gain.setValueAtTime(0.18, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.1);
  } catch(e) {}
}

function playScore() {
  try {
    const ac = getAC();
    if (!ac) return;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = 'square';
      const t = ac.currentTime + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  } catch(e) {}
}

function playDie() {
  try {
    const ac = getAC();
    if (!ac) return;
    const bufSize = ac.sampleRate * 0.4;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ac.createGain();
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  } catch(e) {}
}

// ─── Resize ───
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ─── Bird factory ───
function createBird() {
  return {
    x: canvas.width * 0.25,
    y: canvas.height * 0.45,
    vy: 0,
    angle: 0,
    wingAngle: 0,
    wingDir: 1,
    dead: false,
  };
}

// ─── Pipe factory ───
function createPipe() {
  const minTop = 80;
  const maxTop = canvas.height - PIPE_GAP - 80;
  const topH = minTop + Math.random() * (maxTop - minTop);
  return {
    x: canvas.width + PIPE_WIDTH,
    topH,
    bottomY: topH + PIPE_GAP,
    scored: false,
  };
}

// ─── Particles ───
function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 25 + Math.random() * 20,
      maxLife: 45,
      r: 2 + Math.random() * 2,
      color,
    });
  }
}

// ─── Input ───
function flap() {
  if (state === 'start') {
    startGame();
    return;
  }
  if (state === 'dead') {
    startGame();
    return;
  }
  if (state === 'playing' && !bird.dead) {
    bird.vy = FLAP_FORCE;
    bird.wingAngle = -0.8;
    playFlap();
    spawnParticles(bird.x - 10, bird.y, '#00ccff', 4);
  }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
    e.preventDefault();
    flap();
  }
});
canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });
startScreen.addEventListener('touchstart',   e => { e.preventDefault(); flap(); }, { passive: false });
gameOverScreen.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, { passive: false });

// ─── Start game ───
function startGame() {
  state = 'playing';
  score = 0;
  frame = 0;
  bird = createBird();
  pipes = [];
  particles = [];
  flashTimer = 0;
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  scoreDisplay.style.display = 'block';
  scoreDisplay.textContent = '0';
}

// ─── Update ───
function update() {
  if (state === 'start') {
    // Idle bird bob
    if (!bird) bird = createBird();
    bird.y = canvas.height * 0.45 + Math.sin(Date.now() * 0.002) * 8;
    bird.wingAngle = Math.sin(Date.now() * 0.008) * 0.4;
    return;
  }

  if (state === 'dead') {
    // Bird falls off screen after death
    bird.vy += GRAVITY * 1.5;
    bird.y  += bird.vy;
    bird.angle = Math.min(bird.angle + 0.08, Math.PI / 2);
    updateParticles();
    if (flashTimer > 0) flashTimer--;
    return;
  }

  frame++;

  // Bird physics
  bird.vy += GRAVITY;
  bird.vy  = Math.min(bird.vy, 12); // terminal velocity
  bird.y  += bird.vy;

  // Tilt bird based on velocity
  const targetAngle = bird.vy > 0
    ? Math.min((bird.vy / 10) * (Math.PI / 2), Math.PI / 2)
    : Math.max(bird.vy * 0.06, -0.4);
  bird.angle += (targetAngle - bird.angle) * 0.12;

  // Wing flap animation
  bird.wingAngle += bird.wingDir * 0.18;
  if (bird.wingAngle >  0.5) bird.wingDir = -1;
  if (bird.wingAngle < -0.5) bird.wingDir =  1;

  // Spawn pipes
  if (frame % PIPE_INTERVAL === 0) pipes.push(createPipe());

  // Move pipes + score
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= PIPE_SPEED;
    if (!pipes[i].scored && pipes[i].x + PIPE_WIDTH < bird.x) {
      pipes[i].scored = true;
      score++;
      scoreDisplay.textContent = score;
      playScore();
      spawnParticles(bird.x, bird.y, '#ffdd00', 6);
    }
    if (pipes[i].x + PIPE_WIDTH < -10) pipes.splice(i, 1);
  }

  // Collision: ceiling & floor
  if (bird.y - BIRD_RADIUS < 0 || bird.y + BIRD_RADIUS > canvas.height) {
    killBird();
    return;
  }

  // Collision: pipes
  for (const p of pipes) {
    const bx = bird.x, by = bird.y, br = BIRD_RADIUS * 0.8;
    const inX = bx + br > p.x && bx - br < p.x + PIPE_WIDTH;
    if (inX && (by - br < p.topH || by + br > p.bottomY)) {
      killBird();
      return;
    }
  }

  updateParticles();
}

function killBird() {
  if (bird.dead) return;
  bird.dead = true;
  state = 'dead';
  flashTimer = 8;
  playDie();
  spawnParticles(bird.x, bird.y, '#ff4444', 14);
  spawnParticles(bird.x, bird.y, '#ffaa00', 8);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappy-highscore', highScore);
  }
  finalScoreEl.textContent = 'SCORE: ' + score;
  highScoreEl.textContent  = 'BEST:  ' + highScore;
  scoreDisplay.style.display = 'none';

  setTimeout(() => {
    gameOverScreen.classList.remove('hidden');
  }, 900);
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.dx;
    p.y += p.dy;
    p.dy += 0.12;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ─── Draw ───
function draw() {
  // Flash white on death
  if (flashTimer > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashTimer / 8 * 0.85})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Sky gradient background
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0,   '#020818');
  skyGrad.addColorStop(0.6, '#050f2e');
  skyGrad.addColorStop(1,   '#091a10');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  drawStars();

  // Ground line
  ctx.strokeStyle = 'rgba(0,255,120,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 1);
  ctx.lineTo(canvas.width, canvas.height - 1);
  ctx.stroke();

  // Pipes
  for (const p of pipes) drawPipe(p);

  // Bird
  if (bird) drawBird();

  // Particles
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Procedural stars (seeded by position so they don't flicker)
function drawStars() {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i = 0; i < 60; i++) {
    const x = ((i * 137 + 41)  % canvas.width);
    const y = ((i * 97  + 13)  % (canvas.height * 0.75));
    const r = (i % 3 === 0) ? 1.2 : 0.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPipe(p) {
  const w = PIPE_WIDTH;

  // Glow
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur  = 14;

  // Top pipe
  const topGrad = ctx.createLinearGradient(p.x, 0, p.x + w, 0);
  topGrad.addColorStop(0, '#004422');
  topGrad.addColorStop(0.4, '#00aa55');
  topGrad.addColorStop(1, '#003318');
  ctx.fillStyle = topGrad;
  ctx.fillRect(p.x, 0, w, p.topH);

  // Top pipe cap
  ctx.fillStyle = '#00cc66';
  ctx.fillRect(p.x - 6, p.topH - 22, w + 12, 22);

  // Bottom pipe
  const botGrad = ctx.createLinearGradient(p.x, 0, p.x + w, 0);
  botGrad.addColorStop(0, '#004422');
  botGrad.addColorStop(0.4, '#00aa55');
  botGrad.addColorStop(1, '#003318');
  ctx.fillStyle = botGrad;
  ctx.fillRect(p.x, p.bottomY, w, canvas.height - p.bottomY);

  // Bottom pipe cap
  ctx.fillStyle = '#00cc66';
  ctx.fillRect(p.x - 6, p.bottomY, w + 12, 22);

  // Highlight stripe
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(p.x + 8, 0, 8, p.topH);
  ctx.fillRect(p.x + 8, p.bottomY, 8, canvas.height - p.bottomY);
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.angle);

  // Body glow
  ctx.shadowColor = '#00ddff';
  ctx.shadowBlur  = 18;

  // Body
  const bodyGrad = ctx.createRadialGradient(-2, -3, 2, 0, 0, BIRD_RADIUS);
  bodyGrad.addColorStop(0,   '#aaeeff');
  bodyGrad.addColorStop(0.4, '#00aaff');
  bodyGrad.addColorStop(1,   '#0033aa');
  ctx.beginPath();
  ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Wing
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#0088ff';
  ctx.save();
  ctx.rotate(bird.wingAngle);
  const wingGrad = ctx.createLinearGradient(0, 0, -BIRD_RADIUS * 1.1, BIRD_RADIUS * 0.5);
  wingGrad.addColorStop(0, '#0088cc');
  wingGrad.addColorStop(1, '#004488');
  ctx.beginPath();
  ctx.ellipse(-BIRD_RADIUS * 0.3, BIRD_RADIUS * 0.2, BIRD_RADIUS * 0.9, BIRD_RADIUS * 0.35, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = wingGrad;
  ctx.fill();
  ctx.restore();

  // Eye white
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(BIRD_RADIUS * 0.45, -BIRD_RADIUS * 0.18, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Pupil
  ctx.beginPath();
  ctx.arc(BIRD_RADIUS * 0.5, -BIRD_RADIUS * 0.15, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // Beak
  ctx.beginPath();
  ctx.moveTo(BIRD_RADIUS * 0.7, 0);
  ctx.lineTo(BIRD_RADIUS * 1.25, BIRD_RADIUS * 0.12);
  ctx.lineTo(BIRD_RADIUS * 0.7, BIRD_RADIUS * 0.25);
  ctx.closePath();
  ctx.fillStyle = '#ffcc00';
  ctx.fill();

  ctx.restore();
}

// ─── Game loop ───
function gameLoop() {
  try {
    update();
    draw();
  } catch(e) {
    console.error('Game loop error:', e);
  }
  requestAnimationFrame(gameLoop);
}

// Show idle bird on start screen
bird = createBird();
gameLoop();
