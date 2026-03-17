const REELS = 5;
const ROWS = 4;
const SYMBOL_WILD = "Wild";
const SYMBOL_SCATTER = "Scatter";
const SYMBOL_LOCK = "1x1";

const STATE_BASE = "base";
const STATE_FREE = "free";
const STATE_LOCKIN = "lockin";

const DENOMS = [0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.00];
const BET_CREDIT_STEPS = [20, 40, 60, 80, 100];

const BASE_JACKPOTS = {
  mini: 10,
  minor: 25,
  major: 100,
  grand: 500
};

const BASE_STRIP = [
  "10","J","Q","K","A","AA","AAA","AAAA","AAAAA","10","J","Q","K","A","AA","AAA",
  "Wild","10","J","Q","K","A","AA","Scatter","10","J","Q","K","A","AA","AAA","AAAA",
  "10","J","Q","K","A","AA","AAA","Wild","10","J","Q","K","A","AA","Scatter","AAAAA"
];

const FREE_STRIP = [
  "10","J","Q","K","A","AA","AAA","AAAA","AAAAA","Wild","10","J","Q","K","A","AA",
  "AAA","Scatter","10","J","Q","K","A","AA","AAA","Wild","10","J","Q","K","A","AA",
  "AAAA","AAAAA","10","J","Q","K","A","AA","AAA","Scatter","Wild","10","J","Q","K"
];

const PAYLINES = [
  [0,0,0,0,0],
  [1,1,1,1,1],
  [2,2,2,2,2],
  [3,3,3,3,3],
  [0,1,2,1,0],
  [3,2,1,2,3],
  [0,0,1,0,0],
  [3,3,2,3,3],
  [1,0,0,0,1],
  [2,3,3,3,2],
  [0,1,1,1,0],
  [3,2,2,2,3],
  [1,2,3,2,1],
  [2,1,0,1,2],
  [0,1,0,1,0],
  [3,2,3,2,3],
  [1,1,0,1,1],
  [2,2,3,2,2],
  [1,0,1,0,1],
  [2,3,2,3,2]
];

const PAYTABLE = {
  "10": { 3: 1, 4: 4, 5: 10 },
  "J": { 3: 1, 4: 5, 5: 15 },
  "Q": { 3: 2, 4: 6, 5: 20 },
  "K": { 3: 2, 4: 8, 5: 25 },
  "A": { 3: 3, 4: 10, 5: 30 },
  "AA": { 3: 4, 4: 15, 5: 40 },
  "AAA": { 3: 5, 4: 20, 5: 50 },
  "AAAA": { 3: 8, 4: 30, 5: 75 },
  "AAAAA": { 3: 10, 4: 40, 5: 100 }
};

const SCATTER_PAYS = { 3: 2, 4: 10, 5: 50 };
const SCATTER_TO_FREE = { 3: 8, 4: 12, 5: 20 };

const LOCKIN_SHAPES = [
  { name: "2x2", cells: [[0,0],[1,0],[0,1],[1,1]], weight: 1.0 },
  { name: "3x2", cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]], weight: 0.5 },
  { name: "2x3", cells: [[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]], weight: 0.45 },
  { name: "L", cells: [[0,0],[0,1],[0,2],[1,2]], weight: 0.35 },
  { name: "T", cells: [[0,0],[1,0],[2,0],[1,1]], weight: 0.35 }
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedChoice(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function money(v) {
  return `$${v.toFixed(2)}`;
}

class AssetAudio {
  constructor(onMissing) {
    this.onMissing = onMissing;
    this.cache = new Map();
  }

  play(path, volume = 1) {
    if (!path) return null;
    let audio = this.cache.get(path);
    if (!audio) {
      audio = new Audio(path);
      audio.preload = "auto";
      audio.addEventListener("error", () => {
        if (this.onMissing) this.onMissing(path);
      });
      this.cache.set(path, audio);
    }
    try {
      const a = audio.cloneNode();
      a.volume = volume;
      a.play().catch(() => {});
      return a;
    } catch {
      return null;
    }
  }
}

class LockinBoard {
  constructor(rows = ROWS, reels = REELS) {
    this.rows = rows;
    this.reels = reels;
    this.grid = Array.from({ length: rows }, () =>
      Array.from({ length: reels }, () => null)
    );
    this.blocks = [];
  }

  addBlock(symbol, reel, row, shape) {
    const cells = shape.cells.map(([dx, dy]) => [reel + dx, row + dy]);
    const block = {
      symbol,
      reel,
      row,
      shape: shape.name,
      cells,
      width: Math.max(...shape.cells.map((c) => c[0])) + 1,
      height: Math.max(...shape.cells.map((c) => c[1])) + 1
    };
    this.blocks.push(block);
    for (const [r, c] of cells.map(([x, y]) => [y, x])) {
      if (r >= 0 && r < this.rows && c >= 0 && c < this.reels) {
        this.grid[r][c] = symbol;
      }
    }
    return block;
  }

  canPlace(reel, row, shape) {
    for (const [dx, dy] of shape.cells) {
      const c = reel + dx;
      const r = row + dy;
      if (c < 0 || c >= this.reels || r < 0 || r >= this.rows) return false;
      if (this.grid[r][c] !== null) return false;
    }
    return true;
  }

  static random(symbolCount = 3) {
    const board = new LockinBoard();
    const count = clamp(symbolCount, 2, 6);
    const premiumSymbols = ["AA", "AAA", "AAAA", "AAAAA"];
    let tries = 0;

    while (board.blocks.length < count && tries < 200) {
      tries++;
      const shape = weightedChoice(LOCKIN_SHAPES);
      const reel = Math.floor(Math.random() * REELS);
      const row = Math.floor(Math.random() * ROWS);
      if (!board.canPlace(reel, row, shape)) continue;
      const symbol = premiumSymbols[Math.floor(Math.random() * premiumSymbols.length)];
      board.addBlock(symbol, reel, row, shape);
    }

    if (board.blocks.length < 2) {
      board.addBlock("AA", 0, 0, LOCKIN_SHAPES[0]);
      if (board.canPlace(3, 2, LOCKIN_SHAPES[3])) {
        board.addBlock("AAAA", 3, 1, LOCKIN_SHAPES[3]);
      }
    }
    return board;
  }

  toSymbolGrid() {
    return this.grid.map((row) => row.map((cell) => cell || SYMBOL_LOCK));
  }

  getMergedBlocks() {
    const visited = new Set();
    const merged = [];

    const key = (r, c) => `${r}:${c}`;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.reels; c++) {
        const sym = this.grid[r][c];
        if (!sym || visited.has(key(r, c))) continue;

        const queue = [[r, c]];
        visited.add(key(r, c));
        const cells = [];

        while (queue.length) {
          const [cr, cc] = queue.shift();
          cells.push([cc, cr]);

          const neighbors = [
            [cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]
          ];
          for (const [nr, nc] of neighbors) {
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.reels) continue;
            if (this.grid[nr][nc] !== sym) continue;
            const k = key(nr, nc);
            if (visited.has(k)) continue;
            visited.add(k);
            queue.push([nr, nc]);
          }
        }

        merged.push({
          symbol: sym,
          cells,
          width: Math.max(...cells.map(([x]) => x)) - Math.min(...cells.map(([x]) => x)) + 1,
          height: Math.max(...cells.map(([, y]) => y)) - Math.min(...cells.map(([, y]) => y)) + 1
        });
      }
    }
    return merged;
  }
}

class LockinPayoutEngine {
  constructor(jackpots) {
    this.jackpots = jackpots;
  }

  evaluate(board, bet) {
    const merged = board.getMergedBlocks();
    const payouts = [];
    for (const block of merged) {
      const area = block.cells.length;
      let tier = null;
      if (area >= 8) tier = "grand";
      else if (area >= 6) tier = "major";
      else if (area >= 4) tier = "minor";
      else if (area >= 3) tier = "mini";

      const amount = tier
        ? this.jackpots[tier]
        : bet * (1 + Math.floor(Math.random() * 3)) * area;

      payouts.push({ amount, block, tier });
    }
    return payouts;
  }
}

class SlotGameWebAssets {
  constructor() {
    this.assetWarning = document.getElementById("assetWarning");
    this.missingAssets = new Set();

    this.audio = new AssetAudio((path) => this.reportMissingAsset(path));
    this.canvas = document.getElementById("reelsCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.reelsRegion = document.getElementById("reelsRegion");
    this.reelsBorder = document.getElementById("reelsBorder");
    this.transitionVideo = document.getElementById("transitionVideo");
    this.luckVideo = document.getElementById("luckVideo");
    this.messageBanner = document.getElementById("messageBanner");
    this.fullscreenOverlay = document.getElementById("fullscreenOverlay");
    this.overlayBig = document.getElementById("overlayBig");
    this.overlaySmall = document.getElementById("overlaySmall");
    this.infoModal = document.getElementById("infoModal");
    this.gameInfoFrame = document.getElementById("gameInfoFrame");
    this.gameInfoFallback = document.getElementById("gameInfoFallback");
    this.fallbackPageImage = document.getElementById("fallbackPageImage");
    this.toast = document.getElementById("toast");

    this.balanceEl = document.getElementById("balanceAmount");
    this.betEl = document.getElementById("betAmount");
    this.winEl = document.getElementById("winBox");
    this.denomBtn = document.getElementById("denomBtn");
    this.betMinusBtn = document.getElementById("betMinusBtn");
    this.betPlusBtn = document.getElementById("betPlusBtn");

    this.grandEl = document.getElementById("grandAmount");
    this.majorEl = document.getElementById("majorAmount");
    this.minorEl = document.getElementById("minorAmount");
    this.miniEl = document.getElementById("miniAmount");

    this.state = STATE_BASE;
    this.balance = 100.0;
    this.currentDenomIndex = 0;
    this.currentBetIndex = 0;
    this.currentWin = 0;
    this.displayedWin = 0;
    this.totalFreeSpins = 0;
    this.freeSpinsLeft = 0;
    this.freeFeatureTotal = 0;

    this.gameInfoPage = 1;
    this.usingInfoFallback = false;
    this.infoFrameLoaded = false;
    this.infoOpenToken = 0;
    this.infoFallbackTimer = null;

    this.baseStrips = Array.from({ length: REELS }, () => [...BASE_STRIP]);
    this.freeStrips = Array.from({ length: REELS }, () => [...FREE_STRIP]);
    this.reelStrips = this.baseStrips;

    this.reelFinalIndex = Array.from({ length: REELS }, () => Math.floor(Math.random() * BASE_STRIP.length));
    this.reelOffsets = [...this.reelFinalIndex];
    this.reelSpinState = Array.from({ length: REELS }, () => ({
      spinning: false,
      start: 0,
      duration: 0,
      finalIndex: 0,
      startOffset: 0
    }));
    this.reelsSpinning = false;
    this.fastSpinForced = false;

    this.pendingFreeBonus = false;
    this.pendingLockinBonus = false;
    this.pendingLockinSymbols = null;
    this.pendingLockinFromState = null;

    this.transitionActive = false;
    this.transitionTargetState = null;
    this.transitionAfter = null;

    this.luckForSpin = false;
    this.luckActive = false;
    this.luckTimer = 0;

    this.linesShowUntil = 0;
    this.scatterShakeUntil = 0;
    this.messageUntil = 0;
    this.messageText = "";

    this.symbolImages = {};
    this.symbolNames = ["10","J","Q","K","A","AA","AAA","AAAA","AAAAA","Scatter","Wild","1x1"];
    this.loadSymbolImages();

    this.lockinBoard = null;
    this.lockinFromState = null;
    this.lockinSpinResults = null;
    this.lockinPayouts = [];
    this.lockinPayoutIndex = 0;
    this.lockinDisplayed = 0;
    this.lockinPayoutTickerUntil = 0;
    this.lockinRevealActive = false;
    this.lockinRevealKey = null;
    this.lockinRevealSpinActive = false;
    this.lockinRevealStart = 0;
    this.lockinRevealDuration = 2500;

    this.lockinSpinning = false;
    this.lockinSpinElapsed = 0;
    this.lockinSpinMax = 0;
    this.lockinCellOffsets = null;
    this.lockinCellStartOffsets = null;
    this.lockinCellStopTimes = null;
    this.lockinCellOverTimes = null;
    this.lockinCellFinalIndex = null;
    this.lockinCellFinalSymbol = null;

    this.lockinMergeAnimActive = false;
    this.lockinMergeAnimTime = 0;
    this.lockinMergeAnimDuration = 700;
    this.lockinOldBlocks = [];
    this.lockinNewBlocks = [];

    this.bindStaticAssetErrorChecks();
    this.bindUI();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.renderJackpots();
    this.refreshHud();
    requestAnimationFrame((t) => this.loop(t));
  }

  reportMissingAsset(path) {
    if (!path) return;
    this.missingAssets.add(path);
    const lines = Array.from(this.missingAssets).slice(0, 12);
    this.assetWarning.style.display = "block";
    this.assetWarning.innerHTML = `<strong>Missing asset(s)</strong>\n${lines.join("\n")}`;
  }

  bindStaticAssetErrorChecks() {
    ["mainBg","jackpotBg","reelsBg","reelsFg","reelsBorder"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const src = el.getAttribute("src");
      el.addEventListener("error", () => this.reportMissingAsset(src));
    });

    [
      { el: this.transitionVideo, path: "(transition video source missing)" },
      { el: this.luckVideo, path: "Assets/TransitionOverlaysVideos/LuckHasArrived.mp4" }
    ].forEach(({ el, path }) => {
      if (!el) return;
      el.addEventListener("error", () => this.reportMissingAsset(path));
    });
  }

  loadSymbolImages() {
    for (const name of this.symbolNames) {
      const img = new Image();
      const path = name === "1x1"
        ? "Assets/LockinPlaceSymbols/1x1.png"
        : `Assets/BaseSymbols/${name}.png`;
      img.src = path;
      img.addEventListener("error", () => this.reportMissingAsset(path));
      this.symbolImages[name] = img;
    }
  }

  bindUI() {
    document.getElementById("spinBtn").addEventListener("click", () => this.onSpinButton());

    this.betMinusBtn.addEventListener("click", () => {
      if (this.canAdjustBet()) {
        this.currentBetIndex = Math.max(0, this.currentBetIndex - 1);
        this.refreshHud();
      }
    });

    this.betPlusBtn.addEventListener("click", () => {
      if (this.canAdjustBet()) {
        this.currentBetIndex = Math.min(BET_CREDIT_STEPS.length - 1, this.currentBetIndex + 1);
        this.refreshHud();
      }
    });

    this.denomBtn.addEventListener("click", () => {
      if (this.canAdjustBet()) {
        this.currentDenomIndex = (this.currentDenomIndex + 1) % DENOMS.length;
        this.renderJackpots();
        this.refreshHud();
      }
    });

    document.getElementById("linesBtn").addEventListener("click", () => {
      this.linesShowUntil = performance.now() + 1600;
    });

    document.getElementById("collectBtn").addEventListener("click", () => {
      this.showToast("This feature is only available with the Python version of this game.");
    });

    document.getElementById("gameInfoBtn").addEventListener("click", () => this.openGameInfo(1));
    document.getElementById("paytableBtn").addEventListener("click", () => this.openGameInfo(2));

    document.getElementById("modalCloseBtn").addEventListener("click", () => this.closeGameInfo());
    document.getElementById("modalToggleBtn").addEventListener("click", () => this.nextGameInfoPage());

    this.infoModal.addEventListener("click", (e) => {
      if (e.target === this.infoModal) this.closeGameInfo();
    });

    this.transitionVideo.addEventListener("ended", () => this.finishTransition());

    this.gameInfoFrame.addEventListener("error", () => this.activateInfoFallback());
    this.gameInfoFrame.addEventListener("load", () => {
      this.infoFrameLoaded = true;
      if (this.infoFallbackTimer) {
        clearTimeout(this.infoFallbackTimer);
        this.infoFallbackTimer = null;
      }
      if (!this.usingInfoFallback) {
        this.gameInfoFrame.style.display = "block";
        this.gameInfoFallback.style.display = "none";
      }
    });

    this.fallbackPageImage.addEventListener("error", () => {
      this.reportMissingAsset(this.fallbackPageImage.getAttribute("src"));
    });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.onSpinButton();
      }
      if (e.key === "Escape") this.closeGameInfo();
    });

    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
  }

  buildInfoUrl(page = 1) {
    const safePage = page === 2 ? 2 : 1;
    return `gameinfo.html?page=${safePage}#page${safePage}`;
  }

  openGameInfo(page = 1) {
    this.gameInfoPage = page === 2 ? 2 : 1;
    this.usingInfoFallback = false;
    this.infoFrameLoaded = false;
    this.infoOpenToken += 1;
    const openToken = this.infoOpenToken;

    if (this.infoFallbackTimer) {
      clearTimeout(this.infoFallbackTimer);
      this.infoFallbackTimer = null;
    }

    this.gameInfoFallback.style.display = "none";
    this.gameInfoFrame.style.display = "block";
    this.infoModal.style.display = "flex";

    this.gameInfoFrame.removeAttribute("srcdoc");
    this.gameInfoFrame.src = this.buildInfoUrl(this.gameInfoPage);

    this.infoFallbackTimer = setTimeout(() => {
      if (!this.infoFrameLoaded && this.infoOpenToken === openToken) {
        this.activateInfoFallback();
      }
    }, 700);
  }

  activateInfoFallback() {
    this.usingInfoFallback = true;
    this.infoFrameLoaded = false;
    if (this.infoFallbackTimer) {
      clearTimeout(this.infoFallbackTimer);
      this.infoFallbackTimer = null;
    }
    this.gameInfoFrame.style.display = "none";
    this.gameInfoFallback.style.display = "flex";
    this.updateFallbackPage();
  }

  updateFallbackPage() {
    this.fallbackPageImage.src = this.gameInfoPage === 1
      ? "Assets/Ui/GameInfo1.png"
      : "Assets/Ui/GameInfo2.png";
  }

  nextGameInfoPage() {
    this.gameInfoPage = this.gameInfoPage === 1 ? 2 : 1;

    if (this.usingInfoFallback) {
      this.updateFallbackPage();
      return;
    }

    this.infoFrameLoaded = false;
    if (this.infoFallbackTimer) {
      clearTimeout(this.infoFallbackTimer);
      this.infoFallbackTimer = null;
    }
    const openToken = ++this.infoOpenToken;
    this.gameInfoFrame.src = this.buildInfoUrl(this.gameInfoPage);
    this.infoFallbackTimer = setTimeout(() => {
      if (!this.infoFrameLoaded && this.infoOpenToken === openToken) {
        this.activateInfoFallback();
      }
    }, 700);
  }

  closeGameInfo() {
    if (this.infoFallbackTimer) {
      clearTimeout(this.infoFallbackTimer);
      this.infoFallbackTimer = null;
    }
    this.infoModal.style.display = "none";
  }

  resizeCanvas() {
    const rect = this.reelsRegion.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  get currentDenom() { return DENOMS[this.currentDenomIndex]; }
  get currentBetCredits() { return BET_CREDIT_STEPS[this.currentBetIndex]; }
  get currentBet() { return this.currentBetCredits * this.currentDenom; }
  get currentJackpots() {
    const m = this.currentDenom / 0.01;
    return {
      mini: BASE_JACKPOTS.mini * m,
      minor: BASE_JACKPOTS.minor * m,
      major: BASE_JACKPOTS.major * m,
      grand: BASE_JACKPOTS.grand * m
    };
  }

  canAdjustBet() {
    return !this.reelsSpinning && !this.transitionActive && !this.lockinSpinning;
  }

  refreshHud() {
    this.balanceEl.textContent = money(this.balance);
    this.betEl.textContent = money(this.currentBet);
    this.winEl.textContent = money(this.displayedWin);
    this.denomBtn.textContent = `DENOM ${this.currentDenom.toFixed(2)}`;
  }

  renderJackpots() {
    const jp = this.currentJackpots;
    this.grandEl.textContent = money(jp.grand);
    this.majorEl.textContent = money(jp.major);
    this.minorEl.textContent = money(jp.minor);
    this.miniEl.textContent = money(jp.mini);
  }

  showToast(text, ms = 2200) {
    this.toast.textContent = text;
    this.toast.style.display = "block";
    const now = performance.now();
    this.toast.dataset.hideAt = String(now + ms);
  }

  setMessage(text, ms = 2000) {
    this.messageText = text;
    this.messageUntil = performance.now() + ms;
    this.messageBanner.textContent = text;
    this.messageBanner.style.display = "block";
  }

  clearMessage() {
    this.messageText = "";
    this.messageUntil = 0;
    this.messageBanner.style.display = "none";
  }

  showOverlay(big, small = "") {
    this.overlayBig.textContent = big;
    this.overlaySmall.textContent = small;
    this.fullscreenOverlay.style.display = "flex";
  }

  hideOverlay() {
    this.fullscreenOverlay.style.display = "none";
  }

  onSpinButton() {
    if (this.transitionActive || this.lockinSpinning) return;

    if (this.pendingFreeBonus) {
      this.pendingFreeBonus = false;
      this.startTransition(STATE_FREE, () => {
        this.state = STATE_FREE;
        this.reelStrips = this.freeStrips;
        this.startSpin();
      });
      return;
    }

    if (this.pendingLockinBonus) {
      this.pendingLockinBonus = false;
      this.startLockinFeature();
      return;
    }

    if (this.reelsSpinning) {
      this.fastSpinForced = true;
      return;
    }

    if (this.state === STATE_FREE && this.freeSpinsLeft <= 0) {
      this.finishFreeGames();
      return;
    }

    this.startSpin();
  }
    startSpin() {
    if (this.state === STATE_BASE && this.balance < this.currentBet) {
      this.showToast("Not enough balance.");
      return;
    }

    this.currentWin = 0;
    this.displayedWin = 0;
    this.refreshHud();
    this.clearMessage();
    this.hideOverlay();
    this.fastSpinForced = false;
    this.linesShowUntil = 0;

    if (this.state === STATE_BASE) {
      this.balance = +(this.balance - this.currentBet).toFixed(2);
      this.refreshHud();
    }

    if (this.state === STATE_FREE && this.freeSpinsLeft > 0) {
      this.freeSpinsLeft--;
    }

    this.reelsSpinning = true;
    const now = performance.now();

    for (let r = 0; r < REELS; r++) {
      const strip = this.reelStrips[r];
      const finalIndex = Math.floor(Math.random() * strip.length);
      const duration = 1200 + r * 180;
      this.reelSpinState[r] = {
        spinning: true,
        start: now,
        duration,
        finalIndex,
        startOffset: this.reelOffsets[r]
      };
      this.reelFinalIndex[r] = finalIndex;
    }

    this.luckForSpin = Math.random() < 0.08;
    if (this.luckForSpin) {
      this.luckActive = true;
      this.luckTimer = now + 1600;
      this.luckVideo.currentTime = 0;
      this.luckVideo.style.display = "block";
      this.luckVideo.play().catch(() => {});
    }

    this.audio.play("Assets/Sounds/reelspin.mp3", 0.4);
  }

  finishSpin() {
    this.reelsSpinning = false;
    this.luckActive = false;
    this.luckVideo.pause();
    this.luckVideo.style.display = "none";

    const grid = this.getVisibleGrid();
    const result = this.evaluateGrid(grid);

    this.currentWin = result.totalWin;
    this.displayedWin = result.totalWin;
    if (result.totalWin > 0) {
      this.balance = +(this.balance + result.totalWin).toFixed(2);
      if (this.state === STATE_FREE) {
        this.freeFeatureTotal = +(this.freeFeatureTotal + result.totalWin).toFixed(2);
      }
    }

    this.refreshHud();

    if (result.scatterCount >= 3) {
      this.scatterShakeUntil = performance.now() + 900;
      const addFree = SCATTER_TO_FREE[Math.min(5, result.scatterCount)] || 0;

      if (this.state === STATE_FREE) {
        this.freeSpinsLeft += addFree;
        this.setMessage(`${addFree} FREE GAMES ADDED!`, 2400);
      } else {
        this.pendingFreeBonus = true;
        this.totalFreeSpins = addFree;
        this.freeSpinsLeft = addFree;
        this.freeFeatureTotal = 0;
        this.showOverlay("FREE GAMES WON", "Press SPIN to start");
        return;
      }
    }

    if (Math.random() < 0.16) {
      this.pendingLockinBonus = true;
      this.pendingLockinFromState = this.state;
      this.pendingLockinSymbols = 3 + Math.floor(Math.random() * 3);
      this.showOverlay("LOCK IT IN", "Press SPIN to continue");
      return;
    }

    if (this.state === STATE_FREE) {
      if (this.freeSpinsLeft > 0) {
        this.setMessage(`${this.freeSpinsLeft} FREE GAMES REMAINING`, 1400);
      } else {
        this.finishFreeGames();
      }
    }
  }

  finishFreeGames() {
    const total = this.freeFeatureTotal;
    this.state = STATE_BASE;
    this.reelStrips = this.baseStrips;
    this.totalFreeSpins = 0;
    this.freeSpinsLeft = 0;
    this.freeFeatureTotal = 0;
    this.showOverlay("FREE GAMES COMPLETE", `Feature Win ${money(total)}`);
  }

  startTransition(targetState, afterFn) {
    this.transitionActive = true;
    this.transitionTargetState = targetState;
    this.transitionAfter = afterFn || null;

    const src = targetState === STATE_FREE
      ? "Assets/TransitionOverlaysVideos/TransitionToFreeGames.mp4"
      : "Assets/TransitionOverlaysVideos/TransitionToBaseGame.mp4";

    this.transitionVideo.src = src;
    this.transitionVideo.style.display = "block";
    this.transitionVideo.currentTime = 0;
    this.transitionVideo.play().catch(() => {
      this.finishTransition();
    });
  }

  finishTransition() {
    this.transitionActive = false;
    this.transitionVideo.pause();
    this.transitionVideo.style.display = "none";
    if (typeof this.transitionAfter === "function") {
      const fn = this.transitionAfter;
      this.transitionAfter = null;
      fn();
    }
  }

  startLockinFeature() {
    this.lockinFromState = this.pendingLockinFromState || this.state;
    this.lockinBoard = LockinBoard.random(this.pendingLockinSymbols || 3);
    this.lockinSpinResults = this.lockinBoard.toSymbolGrid();
    this.lockinRevealActive = false;
    this.lockinRevealKey = null;
    this.lockinSpinning = true;
    this.lockinSpinElapsed = 0;
    this.lockinSpinMax = 2400;
    this.lockinCellOffsets = Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => 0));
    this.lockinCellStartOffsets = Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => Math.floor(Math.random() * BASE_STRIP.length)));
    this.lockinCellStopTimes = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: REELS }, (_, reel) => 600 + reel * 180 + row * 90)
    );
    this.lockinCellOverTimes = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: REELS }, (_, reel) => this.lockinCellStopTimes[row][reel] + 300)
    );
    this.lockinCellFinalIndex = Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => 0));
    this.lockinCellFinalSymbol = Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => SYMBOL_LOCK));

    for (let row = 0; row < ROWS; row++) {
      for (let reel = 0; reel < REELS; reel++) {
        const finalSymbol = this.lockinSpinResults[row][reel];
        const strip = this.baseStrips[reel];
        const foundIndex = strip.indexOf(finalSymbol === SYMBOL_LOCK ? "AA" : finalSymbol);
        this.lockinCellFinalIndex[row][reel] = foundIndex >= 0 ? foundIndex : 0;
        this.lockinCellFinalSymbol[row][reel] = finalSymbol;
      }
    }

    this.showOverlay("LOCK IT IN", "Tap a symbol to reveal payouts");
    this.audio.play("Assets/Sounds/reelspin.mp3", 0.35);
  }

  finishLockinSpin() {
    this.lockinSpinning = false;
    this.lockinRevealActive = true;
    this.lockinPayouts = new LockinPayoutEngine(this.currentJackpots).evaluate(this.lockinBoard, this.currentBet);
    this.lockinPayoutIndex = 0;
    this.lockinDisplayed = 0;
    this.lockinPayoutTickerUntil = 0;
  }

  finishLockinFeature() {
    const award = this.lockinPayouts.reduce((sum, p) => sum + p.amount, 0);
    this.balance = +(this.balance + award).toFixed(2);
    this.currentWin = award;
    this.displayedWin = award;
    this.refreshHud();

    this.lockinBoard = null;
    this.lockinSpinResults = null;
    this.lockinPayouts = [];
    this.lockinRevealActive = false;
    this.lockinRevealKey = null;
    this.lockinMergeAnimActive = false;

    if (this.lockinFromState === STATE_FREE) {
      if (this.freeSpinsLeft > 0) {
        this.setMessage(`${this.freeSpinsLeft} FREE GAMES REMAINING`, 1400);
      } else {
        this.finishFreeGames();
      }
    } else {
      this.showOverlay("FEATURE COMPLETE", `Award ${money(award)}`);
    }
  }

  evaluateGrid(grid) {
    let totalWin = 0;
    let scatterCount = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (grid[r][c] === SYMBOL_SCATTER) scatterCount++;
      }
    }

    for (const line of PAYLINES) {
      const symbols = line.map((row, reel) => grid[row][reel]);
      const firstNonWild = symbols.find((s) => s !== SYMBOL_WILD && s !== SYMBOL_SCATTER);
      if (!firstNonWild) continue;

      let matchCount = 0;
      for (const sym of symbols) {
        if (sym === SYMBOL_SCATTER) break;
        if (sym === firstNonWild || sym === SYMBOL_WILD) {
          matchCount++;
        } else {
          break;
        }
      }

      const pay = PAYTABLE[firstNonWild]?.[matchCount] || 0;
      totalWin += pay * this.currentDenom;
    }

    const scatterPay = (SCATTER_PAYS[Math.min(5, scatterCount)] || 0) * this.currentDenom;
    totalWin += scatterPay;

    return {
      totalWin: +totalWin.toFixed(2),
      scatterCount
    };
  }

  getVisibleGrid() {
    return Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: REELS }, (_, reel) => {
        const strip = this.reelStrips[reel];
        const idx = (this.reelFinalIndex[reel] + row) % strip.length;
        return strip[idx];
      })
    );
  }

  handleCanvasClick(e) {
    if (!this.lockinRevealActive || !this.lockinBoard) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const reelW = rect.width / REELS;
    const rowH = rect.height / ROWS;
    const reel = Math.floor(x / reelW);
    const row = Math.floor(y / rowH);

    if (reel < 0 || reel >= REELS || row < 0 || row >= ROWS) return;
    const symbol = this.lockinBoard.grid[row][reel];
    if (!symbol) return;

    const key = `${row}:${reel}`;
    this.lockinRevealKey = key;
    this.lockinRevealSpinActive = true;
    this.lockinRevealStart = performance.now();

    const before = this.lockinBoard.getMergedBlocks();
    const after = this.lockinBoard.getMergedBlocks();

    this.lockinOldBlocks = before;
    this.lockinNewBlocks = after;
    this.lockinMergeAnimActive = true;
    this.lockinMergeAnimTime = performance.now();

    this.audio.play("Assets/Sounds/coin.mp3", 0.45);
  }

  update(dt, now) {
    if (this.toast.style.display === "block") {
      const hideAt = Number(this.toast.dataset.hideAt || 0);
      if (now >= hideAt) this.toast.style.display = "none";
    }

    if (this.messageUntil && now >= this.messageUntil) {
      this.clearMessage();
    }

    if (this.reelsSpinning) {
      let done = true;
      for (let r = 0; r < REELS; r++) {
        const state = this.reelSpinState[r];
        const strip = this.reelStrips[r];
        const elapsed = now - state.start;
        let t = clamp(elapsed / state.duration, 0, 1);

        if (this.fastSpinForced) {
          t = clamp((elapsed + 450) / state.duration, 0, 1);
        }

        if (t < 1) done = false;

        const loops = 12 + r * 2;
        const spinPos = lerp(
          state.startOffset,
          state.finalIndex + loops * strip.length,
          easeOutCubic(t)
        );

        this.reelOffsets[r] = spinPos % strip.length;
      }

      if (done) {
        for (let r = 0; r < REELS; r++) {
          this.reelOffsets[r] = this.reelFinalIndex[r];
        }
        this.finishSpin();
      }
    }

    if (this.luckActive && now >= this.luckTimer) {
      this.luckActive = false;
      this.luckVideo.pause();
      this.luckVideo.style.display = "none";
    }

    if (this.lockinSpinning) {
      this.lockinSpinElapsed += dt;
      let allStopped = true;

      for (let row = 0; row < ROWS; row++) {
        for (let reel = 0; reel < REELS; reel++) {
          const stopAt = this.lockinCellStopTimes[row][reel];
          const overAt = this.lockinCellOverTimes[row][reel];
          const startOffset = this.lockinCellStartOffsets[row][reel];
          const finalIndex = this.lockinCellFinalIndex[row][reel];
          const strip = this.baseStrips[reel];

          if (this.lockinSpinElapsed < stopAt) {
            allStopped = false;
            const progress = this.lockinSpinElapsed / stopAt;
            const loops = 10 + reel + row;
            const pos = lerp(startOffset, finalIndex + loops * strip.length, progress);
            this.lockinCellOffsets[row][reel] = pos % strip.length;
          } else if (this.lockinSpinElapsed < overAt) {
            allStopped = false;
            const t = (this.lockinSpinElapsed - stopAt) / (overAt - stopAt);
            const overshoot = finalIndex + 0.4 * (1 - easeOutCubic(t));
            this.lockinCellOffsets[row][reel] = overshoot;
          } else {
            this.lockinCellOffsets[row][reel] = finalIndex;
          }
        }
      }

      if (allStopped || this.lockinSpinElapsed >= this.lockinSpinMax) {
        for (let row = 0; row < ROWS; row++) {
          for (let reel = 0; reel < REELS; reel++) {
            this.lockinCellOffsets[row][reel] = this.lockinCellFinalIndex[row][reel];
          }
        }
        this.finishLockinSpin();
      }
    }

    if (this.lockinMergeAnimActive) {
      const elapsed = now - this.lockinMergeAnimTime;
      if (elapsed >= this.lockinMergeAnimDuration) {
        this.lockinMergeAnimActive = false;
      }
    }

    if (this.lockinRevealSpinActive) {
      const t = (now - this.lockinRevealStart) / this.lockinRevealDuration;
      if (t >= 1) {
        this.lockinRevealSpinActive = false;
        this.finishLockinFeature();
      }
    }
  }

  drawSymbol(symbol, x, y, w, h) {
    const img = this.symbolImages[symbol];
    if (img && img.complete && img.naturalWidth > 0) {
      this.ctx.drawImage(img, x, y, w, h);
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = "#2b1237";
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = "rgba(255,255,255,0.14)";
    this.ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    this.ctx.fillStyle = "#ff66c4";
    this.ctx.font = `bold ${Math.floor(h * 0.22)}px Arial`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(symbol, x + w / 2, y + h / 2);
    this.ctx.restore();
  }

  renderBaseReels(width, height) {
    const reelW = width / REELS;
    const rowH = height / ROWS;

    for (let reel = 0; reel < REELS; reel++) {
      const strip = this.reelStrips[reel];
      const offset = this.reelOffsets[reel];
      const baseIndex = Math.floor(offset);
      const frac = offset - baseIndex;

      for (let row = -1; row <= ROWS; row++) {
        const index = (baseIndex + row + strip.length) % strip.length;
        const symbol = strip[index];
        const y = (row - frac) * rowH;
        this.drawSymbol(symbol, reel * reelW + 6, y + 6, reelW - 12, rowH - 12);
      }
    }
  }

  renderLockinBoard(width, height) {
    const reelW = width / REELS;
    const rowH = height / ROWS;

    if (this.lockinSpinning && this.lockinCellOffsets) {
      for (let row = 0; row < ROWS; row++) {
        for (let reel = 0; reel < REELS; reel++) {
          const strip = this.baseStrips[reel];
          const offset = this.lockinCellOffsets[row][reel];
          const baseIndex = Math.floor(offset);
          const frac = offset - baseIndex;

          this.ctx.save();
          this.ctx.beginPath();
          this.ctx.rect(reel * reelW, row * rowH, reelW, rowH);
          this.ctx.clip();

          for (let i = -1; i <= 1; i++) {
            const index = (baseIndex + i + strip.length) % strip.length;
            const symbol = strip[index];
            const sy = row * rowH + (i - frac) * rowH;
            this.drawSymbol(symbol, reel * reelW + 6, sy + 6, reelW - 12, rowH - 12);
          }

          this.ctx.restore();
        }
      }
      return;
    }

    if (!this.lockinBoard) return;

    const grid = this.lockinBoard.grid;
    for (let row = 0; row < ROWS; row++) {
      for (let reel = 0; reel < REELS; reel++) {
        const symbol = grid[row][reel] || SYMBOL_LOCK;
        this.drawSymbol(symbol, reel * reelW + 6, row * rowH + 6, reelW - 12, rowH - 12);
      }
    }

    if (this.lockinMergeAnimActive && this.lockinNewBlocks.length) {
      const t = clamp((performance.now() - this.lockinMergeAnimTime) / this.lockinMergeAnimDuration, 0, 1);
      const alpha = easeInOutQuad(t);

      this.ctx.save();
      this.ctx.globalAlpha = alpha * 0.22;
      this.ctx.fillStyle = "#ffd45f";
      for (const block of this.lockinNewBlocks) {
        const xs = block.cells.map(([x]) => x);
        const ys = block.cells.map(([, y]) => y);
        const minX = Math.min(...xs) * reelW;
        const minY = Math.min(...ys) * rowH;
        const maxX = (Math.max(...xs) + 1) * reelW;
        const maxY = (Math.max(...ys) + 1) * rowH;
        this.ctx.fillRect(minX + 8, minY + 8, maxX - minX - 16, maxY - minY - 16);
      }
      this.ctx.restore();
    }
  }

  renderLines(width, height) {
    const now = performance.now();
    if (now > this.linesShowUntil) return;

    const reelW = width / REELS;
    const rowH = height / ROWS;

    this.ctx.save();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = "rgba(255, 212, 95, 0.85)";
    this.ctx.shadowColor = "rgba(255, 102, 196, 0.65)";
    this.ctx.shadowBlur = 10;

    for (const line of PAYLINES) {
      this.ctx.beginPath();
      line.forEach((row, reel) => {
        const x = reel * reelW + reelW / 2;
        const y = row * rowH + rowH / 2;
        if (reel === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      });
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  renderScatterShake(width, height) {
    const now = performance.now();
    if (now > this.scatterShakeUntil) return;
    const p = 1 - (this.scatterShakeUntil - now) / 900;
    const magnitude = (1 - p) * 8;
    this.ctx.save();
    this.ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    this.ctx.restore();
  }

  render() {
    const rect = this.reelsRegion.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    this.ctx.clearRect(0, 0, width, height);

    if (this.lockinBoard || this.lockinSpinning) {
      this.renderLockinBoard(width, height);
    } else {
      this.renderBaseReels(width, height);
    }

    this.renderLines(width, height);
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(dt, timestamp);
    this.render();
    this.refreshHud();

    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.slotGame = new SlotGameWebAssets();
});
