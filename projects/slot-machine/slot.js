const ROWS = 3;
const REELS = 5;
const DENOMS = [0.01, 0.02, 0.05, 0.10];
const BET_CREDIT_STEPS = [50, 100, 200, 300, 400, 500];
const BASE_JACKPOTS = { mini: 10.0, minor: 20.0, major: 50.0, grand: 250.0 };
const SCATTER_FREE_SPINS = { 3: [5, 10], 4: [10, 25], 5: [15, 100] };
const SCATTER_RETRIGGER = { 3: 3, 4: 5, 5: 10 };
const STATE_BASE = "base";
const STATE_FREESPINS = "freespins";
const STATE_LOCKIN = "lockin";

const BASE_STRIP = [
  "1x1","1x1","1x1","10","J","Q","A","K","10","Q","J","A","K","10","AA","AAA","Q",
  "10","A","J","K","1x1","1x1","1x1","Q","10","AAAA","A","K","J",
  "10","Q","A","AAAAA","10","J","AA","Q","A","10","K","Scatter","J",
  "10","A","Q","AAA","10","K","A","Q","10","J","AA","10","A","K",
  "Q","A","10","J","Wild","K","10","AAAA","A","Q","J","10","K","A",
  "1x1","1x1","1x1","10","J","AA","Q","A","10","K","Q","10","J",
  "AAA","K","A","10","Q","AAAAA","AAAAA","AAAAA",
  "Scatter","Scatter","Scatter","Scatter","Scatter","Scatter","Scatter","Scatter","Scatter","Scatter","J","10",
  "A","Q","K","10","AA","A","10","Wild"
];

const FREE_STRIP = [
  "AA","AA","AA","AAA","AAA","AAAA","AAAA","AAAAA","AAAAA",
  "A","A","K","K","AA","AA","AAA","AAA","A","A",
  "1x1","1x1","1x1","1x1",
  "AAAA","AAAA","AAAAA","AAAAA",
  "Scatter",
  "AA","AA","K","K","A","A","AAA","AAA","AA","AA","AA"
];

const LOCKIN_STRIP = [
  0,0,0,0,0,"1x1",0,0,"1x1","1x1",0,"1x1",0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,"1x1",0,0,"1x1",0,0,0,0,"1x1",0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  "1x1","1x1",0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
];

const PAYTABLE_LINES = {
  "10": {3:0.2,4:0.4,5:2},
  "J": {3:0.2,4:0.4,5:2},
  "Q": {3:0.2,4:0.4,5:2},
  "K": {3:0.2,4:0.4,5:2},
  "A": {3:0.2,4:0.8,5:2.5},
  "AA": {3:0.2,4:1,5:4},
  "AAA": {3:0.2,4:1,5:4},
  "AAAA": {3:0.2,4:1.5,5:4},
  "AAAAA": {3:0.4,4:2,5:5},
  "Wild": {},
  "Scatter": {3:2,4:15,5:100}
};

const LINES = [
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[1,0],[1,1],[1,2],[1,3],[1,4]],
  [[2,0],[2,1],[2,2],[2,3],[2,4]],
  [[0,0],[1,1],[2,2],[1,3],[0,4]],
  [[2,0],[1,1],[0,2],[1,3],[2,4]],
  [[0,0],[0,1],[1,2],[0,3],[0,4]],
  [[2,0],[2,1],[1,2],[2,3],[2,4]],
  [[1,0],[0,1],[1,2],[2,3],[1,4]],
  [[1,0],[2,1],[1,2],[0,3],[1,4]],
  [[0,0],[1,1],[1,2],[1,3],[2,4]]
];

const LINE_COLORS = ["#ff0000","#00ff00","#0000ff","#ffff00","#00ffff","#ff00ff","#ff8000","#8000ff","#00ff80","#ff8080"];

function money(v) {
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

class AssetAudio {
  constructor(reportMissing) {
    this.reportMissing = reportMissing;
    this.map = {
      ding: document.getElementById("sndDing"),
      dun: document.getElementById("sndDun"),
      ring: document.getElementById("sndRing"),
      trythis: document.getElementById("sndTryThis"),
      ohboy: document.getElementById("sndOhBoy"),
      ohhey: document.getElementById("sndOhHey"),
      take: document.getElementById("sndTakeACouple")
    };

    Object.values(this.map).forEach((audio) => {
      if (!audio) return;
      const src = audio.getAttribute("src") || "(unknown audio)";
      audio.addEventListener("error", () => this.reportMissing(src));
    });
  }

  play(name, loop = false) {
    const a = this.map[name];
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
      a.loop = loop;
      a.play().catch(() => {});
    } catch {}
  }

  stop(name) {
    const a = this.map[name];
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
      a.loop = false;
    } catch {}
  }
}

class LockInBoard {
  constructor() {
    this.filled = Array.from({ length: ROWS }, () => Array(REELS).fill(false));
    this.blocks = [];
    this.spinsRemaining = 3;
    this.finished = false;
    this.jackpots = null;
    this.jackpotChanceScale = 1;
  }

  configureJackpots(amounts, chanceScale) {
    this.jackpots = amounts;
    this.jackpotChanceScale = chanceScale;
  }

  fromBaseSymbols(symbols) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (symbols[r][c] === "1x1") this.filled[r][c] = true;
      }
    }
    this.mergeBlocks();
  }

  applySpinResults(results) {
    let newHit = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (!this.filled[r][c] && results[r][c] === "1x1") {
          this.filled[r][c] = true;
          newHit = true;
        }
      }
    }

    if (newHit) this.spinsRemaining = 3;
    else {
      this.spinsRemaining -= 1;
      if (this.spinsRemaining <= 0) this.finished = true;
    }

    this.mergeBlocks();
    return { newHit };
  }

  mergeBlocks() {
    const allowed = [[2,2],[2,3],[2,4],[2,5],[3,2],[3,3],[3,4],[3,5]];
    const candidates = [];

    for (const [h, w] of allowed) {
      for (let r0 = 0; r0 <= ROWS - h; r0++) {
        for (let c0 = 0; c0 <= REELS - w; c0++) {
          let ok = true;
          for (let rr = r0; rr < r0 + h && ok; rr++) {
            for (let cc = c0; cc < c0 + w; cc++) {
              if (!this.filled[rr][cc]) {
                ok = false;
                break;
              }
            }
          }
          if (ok) candidates.push({ top_left: [r0, c0], width: w, height: h, area: w * h });
        }
      }
    }

    candidates.sort((a, b) => b.area - a.area);
    const assigned = Array.from({ length: ROWS }, () => Array(REELS).fill(false));
    const blocks = [];

    for (const cand of candidates) {
      const [r0, c0] = cand.top_left;
      let conflict = false;
      for (let rr = r0; rr < r0 + cand.height && !conflict; rr++) {
        for (let cc = c0; cc < c0 + cand.width; cc++) {
          if (assigned[rr][cc]) {
            conflict = true;
            break;
          }
        }
      }
      if (conflict) continue;

      const cells = [];
      for (let rr = r0; rr < r0 + cand.height; rr++) {
        for (let cc = c0; cc < c0 + cand.width; cc++) {
          assigned[rr][cc] = true;
          cells.push([rr, cc]);
        }
      }
      blocks.push({ top_left: [r0, c0], width: cand.width, height: cand.height, cells });
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (this.filled[r][c] && !assigned[r][c]) {
          blocks.push({ top_left: [r, c], width: 1, height: 1, cells: [[r, c]] });
        }
      }
    }

    this.blocks = blocks;
  }

  getPayouts(bet) {
    const payouts = [];
    for (const block of this.blocks) {
      const area = block.width * block.height;
      let tier = null;
      if (this.jackpots && Math.random() < (0.002 * area * this.jackpotChanceScale)) {
        if (area >= 8) tier = "grand";
        else if (area >= 6) tier = "major";
        else if (area >= 4) tier = "minor";
        else tier = "mini";
      }
      const amount = tier ? this.jackpots[tier] : bet * (1 + Math.floor(Math.random() * 3)) * area;
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
    this.infoImage = document.getElementById("infoImage");
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

    this.baseStrips = Array.from({ length: REELS }, () => [...BASE_STRIP]);
    this.freeStrips = Array.from({ length: REELS }, () => [...FREE_STRIP]);
    this.reelStrips = this.baseStrips;

    this.reelFinalIndex = Array.from({ length: REELS }, () => Math.floor(Math.random() * BASE_STRIP.length));
    this.reelOffsets = [...this.reelFinalIndex];
    this.reelSpinState = Array.from({ length: REELS }, () => ({ spinning: false, start: 0, duration: 0, finalIndex: 0, startOffset: 0 }));
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
    this.lockinAnimating = false;
    this.lockinAnimationUntil = 0;
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

    this.infoPage = 1;

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
    this.assetWarning.innerHTML = `<strong>Missing asset(s)</strong>${lines.join("\n")}`;
  }

  bindStaticAssetErrorChecks() {
    [
      "mainBg","jackpotBg","reelsBg","reelsFg","reelsBorder","infoImage"
    ].forEach((id) => {
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

    document.getElementById("paytableBtn").addEventListener("click", () => this.openInfo());
    document.getElementById("gameInfoBtn").addEventListener("click", () => this.openInfo());

    document.getElementById("modalCloseBtn").addEventListener("click", () => this.closeInfo());
    document.getElementById("modalToggleBtn").addEventListener("click", () => this.toggleInfoPage());

    this.infoModal.addEventListener("click", (e) => {
      if (e.target === this.infoModal) this.closeInfo();
    });

    this.transitionVideo.addEventListener("ended", () => this.finishTransition());

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.onSpinButton();
      }
      if (e.key === "Escape") this.closeInfo();
    });

    this.canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
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

  /* Fixed: only base game can adjust bet/denom */
  canAdjustBet() {
    return this.state === STATE_BASE &&
      !this.reelsSpinning &&
      !this.transitionActive &&
      !this.pendingFreeBonus &&
      !this.pendingLockinBonus;
  }

  setBetButtonsDisabled(disabled) {
    this.betMinusBtn.disabled = disabled;
    this.betPlusBtn.disabled = disabled;
    this.denomBtn.disabled = disabled;
  }

  refreshHud() {
    const winDisplay = this.state === STATE_LOCKIN ? this.lockinDisplayed : this.displayedWin;
    this.balanceEl.textContent = money(this.balance);
    this.betEl.textContent = money(this.currentBet);
    this.winEl.textContent =
      this.state === STATE_FREESPINS ? `FREE WIN ${money(winDisplay)}`
      : this.state === STATE_LOCKIN ? `LOCK-IN ${money(winDisplay)}`
      : `WIN ${money(winDisplay)}`;
    this.denomBtn.textContent = `${Math.round(this.currentDenom * 100)}¢`;
    this.setBetButtonsDisabled(!this.canAdjustBet());
  }

  renderJackpots() {
    const jp = this.currentJackpots;
    this.grandEl.textContent = money(jp.grand);
    this.majorEl.textContent = money(jp.major);
    this.minorEl.textContent = money(jp.minor);
    this.miniEl.textContent = money(jp.mini);
  }

  refreshBorder() {
    if (this.state === STATE_FREESPINS) this.reelsBorder.src = "Assets/Ui/ReelsBorderFreeGames.png";
    else if (this.state === STATE_LOCKIN) this.reelsBorder.src = "Assets/Ui/ReelsBorderBonus.png";
    else this.reelsBorder.src = "Assets/Ui/ReelsBorderLines.png";
  }

  buildGrid(indices, strips = this.reelStrips) {
    const grid = Array.from({ length: ROWS }, () => Array(REELS).fill(null));
    for (let c = 0; c < REELS; c++) {
      const strip = strips[c];
      const baseIdx = ((indices[c] % strip.length) + strip.length) % strip.length;
      for (let r = 0; r < ROWS; r++) {
        grid[r][c] = strip[(baseIdx + r) % strip.length];
      }
    }
    return grid;
  }

  evaluateWin(symbols) {
    let scatters = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (symbols[r][c] === "Scatter") scatters++;
      }
    }

    let total = 0;
    this.winningLines = [];

    for (let i = 0; i < LINES.length; i++) {
      const line = LINES[i];
      let firstSym = null;
      let count = 0;

      for (const [r, c] of line) {
        const sym = symbols[r][c];
        if (sym === "Scatter") break;

        if (firstSym === null) {
          if (sym === "Wild") break;
          firstSym = sym;
          count = 1;
        } else if (sym === firstSym || sym === "Wild") {
          count++;
        } else {
          break;
        }
      }

      if (firstSym && PAYTABLE_LINES[firstSym] && PAYTABLE_LINES[firstSym][count]) {
        total += PAYTABLE_LINES[firstSym][count] * this.currentBet;
        this.winningLines.push(i);
      }
    }

    return { total, scatters };
  }

  detectBonus(grid) {
    let scatters = 0;
    let count1x1 = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (grid[r][c] === "Scatter") scatters++;
        if (grid[r][c] === "1x1") count1x1++;
      }
    }
    if (count1x1 >= 6) return "lockin";
    if (this.state === STATE_BASE && scatters >= 3) return "freespins";
    return null;
  }

  /* Fixed: free spins use paired reel indexes like Python feel:
     reels 0-1 same, reel 2 different, reels 3-4 same */
  planSpinOutcome() {
    if (this.state === STATE_FREESPINS) {
      const len = this.reelStrips[0].length;
      const idxA = Math.floor(Math.random() * len);
      const idxM = Math.floor(Math.random() * len);
      const idxB = Math.floor(Math.random() * len);
      return [idxA, idxA, idxM, idxB, idxB];
    }
    return Array.from({ length: REELS }, (_, c) => Math.floor(Math.random() * this.reelStrips[c].length));
  }

  showMessage(text, ms = 2200) {
    this.messageText = text;
    this.messageUntil = performance.now() + ms;
    this.messageBanner.textContent = text;
    this.messageBanner.style.display = "block";
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove("show"), 2400);
  }

  showOverlay(big, small = "") {
    this.overlayBig.textContent = big;
    this.overlaySmall.textContent = small;
    this.fullscreenOverlay.style.display = "flex";
  }

  hideOverlay() {
    this.fullscreenOverlay.style.display = "none";
  }

  openInfo() {
    this.infoPage = 1;
    this.infoImage.src = "Assets/Ui/GameInfo1.png";
    this.infoModal.style.display = "flex";
  }

  toggleInfoPage() {
    this.infoPage = this.infoPage === 1 ? 2 : 1;
    this.infoImage.src = this.infoPage === 1 ? "Assets/Ui/GameInfo1.png" : "Assets/Ui/GameInfo2.png";
  }

  closeInfo() {
    this.infoModal.style.display = "none";
  }

  startTransition(type, nextState, after = null) {
    this.transitionActive = true;
    this.transitionTargetState = nextState;
    this.transitionAfter = after;
    this.audio.stop("ring");

    if (type === "bonusin") this.audio.play("trythis");
    if (type === "bonusout") this.audio.play("ohboy");

    const map = {
      free_in: "Assets/TransitionOverlaysVideos/FreeGamesTransitionIn.mp4",
      free_out: "Assets/TransitionOverlaysVideos/FreeGamesTransitionOut.mp4",
      lock_in: "Assets/TransitionOverlaysVideos/LockinPlaceTransitionIn.mp4",
      lock_out: "Assets/TransitionOverlaysVideos/LockinPlaceTransitionOut.mp4"
    };

    let src = null;
    if (type === "bonusin" && nextState === STATE_FREESPINS) src = map.free_in;
    if (type === "bonusout" && this.state === STATE_FREESPINS) src = map.free_out;
    if (type === "bonusin" && nextState === STATE_LOCKIN) src = map.lock_in;
    if (type === "bonusout" && this.state === STATE_LOCKIN) src = map.lock_out;

    if (src) {
      this.transitionVideo.style.display = "block";
      this.transitionVideo.src = src;
      this.transitionVideo.load();
      this.transitionVideo.currentTime = 0;
      this.transitionVideo.onerror = () => this.reportMissingAsset(src);
      this.transitionVideo.play().catch(() => {
        this.transitionVideo.style.display = "none";
        this.finishTransition();
      });
    } else {
      this.finishTransition();
    }
  }

  finishTransition() {
    this.transitionActive = false;
    this.transitionVideo.pause();
    this.transitionVideo.style.display = "none";

    if (this.transitionTargetState === STATE_FREESPINS) {
      this.state = STATE_FREESPINS;
      this.reelStrips = this.freeStrips;
    } else if (this.transitionTargetState === STATE_LOCKIN) {
      this.state = STATE_LOCKIN;
    } else if (this.transitionTargetState === STATE_BASE) {
      this.state = STATE_BASE;
      this.reelStrips = this.baseStrips;
    }

    this.refreshBorder();
    const after = this.transitionAfter;
    this.transitionAfter = null;
    this.transitionTargetState = null;
    if (after) after();
    this.refreshHud();
  }

  onSpinButton() {
    if (this.transitionActive) return;

    if (this.pendingFreeBonus) {
      this.pendingFreeBonus = false;
      this.hideOverlay();
      this.startTransition("bonusin", STATE_FREESPINS, () => {
        this.showMessage("Free games started.");
      });
      return;
    }

    if (this.pendingLockinBonus) {
      this.pendingLockinBonus = false;
      this.hideOverlay();
      this.lockinFromState = this.pendingLockinFromState;
      this.startTransition("bonusin", STATE_LOCKIN, () => this.enterLockin());
      return;
    }

    if (this.state === STATE_LOCKIN) {
      if (this.lockinRevealActive && !this.lockinRevealSpinActive) return;

      if (this.lockinBoard && this.lockinBoard.finished) {
        if (this.lockinPayoutIndex < this.lockinPayouts.length) {
          this.lockinPayoutIndex = this.lockinPayouts.length;
          this.lockinDisplayed = this.lockinPayouts.reduce((a, b) => a + b.amount, 0);
          this.refreshHud();
          return;
        }

        const total = this.lockinDisplayed;
        const target = this.lockinFromState || STATE_BASE;
        this.startTransition("bonusout", target, () => {
          if (target === STATE_BASE) {
            this.balance += total;
            this.displayedWin = total;
          } else {
            this.freeFeatureTotal += total;
            this.displayedWin = this.freeFeatureTotal;
          }
          this.lockinBoard = null;
          this.lockinPayouts = [];
          this.lockinPayoutIndex = 0;
          this.lockinDisplayed = 0;
          this.hideOverlay();
          this.refreshHud();
        });
        return;
      }

      this.startLockinSpin();
      return;
    }

    if (this.reelsSpinning) {
      this.fastSpinForced = true;
      return;
    }

    if (this.state === STATE_FREESPINS && this.freeSpinsLeft <= 0) {
      this.startTransition("bonusout", STATE_BASE, () => {
        this.balance += this.freeFeatureTotal;
        this.displayedWin = this.freeFeatureTotal;
        this.showOverlay("FREE GAMES WIN", `${money(this.freeFeatureTotal)} added to balance`);
        this.totalFreeSpins = 0;
        this.freeSpinsLeft = 0;
        this.freeFeatureTotal = 0;
        this.refreshHud();
      });
      return;
    }

    this.startSpin();
  }

  startSpin() {
    if (this.state === STATE_BASE && this.currentBet > this.balance) {
      this.showToast("Not enough balance for that bet.");
      return;
    }

    this.hideOverlay();
    this.winningLines = [];
    this.displayedWin = this.state === STATE_FREESPINS ? this.freeFeatureTotal : 0;
    this.currentWin = 0;
    this.fastSpinForced = false;
    this.luckForSpin = false;

    if (this.state === STATE_BASE) {
      this.balance -= this.currentBet;
      this.reelStrips = this.baseStrips;
    } else if (this.state === STATE_FREESPINS) {
      this.freeSpinsLeft -= 1;
      this.reelStrips = this.freeStrips;
    }

    const planned = this.planSpinOutcome();
    const bonusType = this.detectBonus(this.buildGrid(planned, this.reelStrips));

    if (this.state === STATE_BASE && bonusType) {
      this.luckForSpin = true;
      this.luckActive = true;
      this.luckTimer = performance.now() + 14000;
      this.luckVideo.style.display = "block";
      this.luckVideo.currentTime = 0;
      this.luckVideo.play().catch(() => {});
    }

    const now = performance.now();
    this.reelsSpinning = true;

    for (let c = 0; c < REELS; c++) {
      let duration = this.state === STATE_FREESPINS ? 2000 + Math.floor(c / 2) * 450 : 2000 + c * 450;
      if (this.luckForSpin) duration += 14000;
      const extra = 40 + Math.floor(Math.random() * 20);
      this.reelSpinState[c] = {
        spinning: true,
        start: now,
        duration,
        finalIndex: planned[c],
        startOffset: planned[c] + extra
      };
      this.reelOffsets[c] = planned[c] + extra;
    }

    this.reelFinalIndex = planned;
    this.refreshHud();
  }

  finishSpin() {
    this.reelsSpinning = false;
    this.reelOffsets = [...this.reelFinalIndex];
    this.luckForSpin = false;

    if (this.luckActive) {
      this.luckActive = false;
      this.luckVideo.pause();
      this.luckVideo.style.display = "none";
    }

    const symbols = this.buildGrid(this.reelFinalIndex, this.reelStrips);
    const { total, scatters } = this.evaluateWin(symbols);
    const count1x1 = symbols.flat().filter(s => s === "1x1").length;

    if (total > 0) this.audio.play("ohhey");

    if (this.state === STATE_FREESPINS) {
      this.freeFeatureTotal += total;
      this.displayedWin = this.freeFeatureTotal;
    } else {
      this.balance += total;
      this.displayedWin = total;
    }

    if (scatters >= 3 || count1x1 >= 6) {
      this.scatterShakeUntil = performance.now() + 1800;
      this.audio.play("ring", true);
    }

    if (this.state === STATE_FREESPINS && scatters >= 3) {
      const extra = SCATTER_RETRIGGER[scatters] || 0;
      if (extra > 0) {
        this.freeSpinsLeft += extra;
        this.totalFreeSpins += extra;
        this.showMessage(`${extra} additional free spins awarded.`);
      }
    }

    if (this.state === STATE_BASE && scatters >= 3) {
      const [fs] = SCATTER_FREE_SPINS[scatters] || [0, 0];
      if (fs > 0) {
        this.totalFreeSpins = fs;
        this.freeSpinsLeft = fs;
        this.freeFeatureTotal = 0;
        this.pendingFreeBonus = true;
        this.showOverlay(`${fs} FREE GAMES WON`, "Press SPIN to start");
      }
    }

    if (count1x1 >= 6 && (this.state === STATE_BASE || this.state === STATE_FREESPINS)) {
      this.pendingLockinBonus = true;
      this.pendingLockinSymbols = symbols;
      this.pendingLockinFromState = this.state;
      this.showOverlay("LOCK-IN FEATURE", "Press SPIN to enter the bonus");
    }

    this.refreshHud();
  }

  enterLockin() {
    this.lockinBoard = new LockInBoard();
    this.lockinBoard.fromBaseSymbols(this.pendingLockinSymbols);
    this.lockinBoard.configureJackpots(this.currentJackpots, 1 + 0.4 * this.currentBetIndex);
    this.lockinDisplayed = 0;
    this.lockinPayouts = [];
    this.lockinPayoutIndex = 0;
    this.lockinRevealActive = false;
    this.lockinRevealSpinActive = false;
    this.showMessage("Lock-in feature started.");
    this.refreshBorder();
    this.refreshHud();
  }

  startLockinSpin() {
    if (!this.lockinBoard || this.lockinBoard.finished) return;

    const results = Array.from({ length: ROWS }, () => Array(REELS).fill(0));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        if (!this.lockinBoard.filled[r][c]) {
          results[r][c] = LOCKIN_STRIP[Math.floor(Math.random() * LOCKIN_STRIP.length)];
        }
      }
    }

    this.lockinSpinResults = results;
    const applied = this.lockinBoard.applySpinResults(results);
    const filledCount = this.lockinBoard.filled.flat().filter(Boolean).length;
    if (filledCount >= 15) {
      this.lockinBoard.finished = true;
      this.lockinBoard.spinsRemaining = 0;
    }

    this.lockinAnimating = true;
    this.lockinAnimationUntil = performance.now() + 1000;
    this.showMessage(applied.newHit ? "New 1x1 landed. Spins reset to 3." : "No new 1x1 landed.");
  }

  maybeStartLockinCount() {
    if (!this.lockinBoard || !this.lockinBoard.finished || this.lockinPayouts.length) return;

    this.lockinPayouts = this.lockinBoard.getPayouts(this.currentBet)
      .sort((a, b) => (a.block.width * a.block.height) - (b.block.width * b.block.height));

    this.lockinPayoutIndex = 0;
    this.lockinDisplayed = 0;
    this.lockinPayoutTickerUntil = performance.now() + 800;
  }

  handleCanvasClick(e) {
    if (this.state !== STATE_LOCKIN || !this.lockinRevealActive || this.lockinRevealSpinActive || !this.lockinRevealKey) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cw = rect.width / REELS;
    const ch = rect.height / ROWS;
    const [r0, c0] = this.lockinRevealKey.top_left;
    const bx = c0 * cw;
    const by = r0 * ch;
    const bw = this.lockinRevealKey.width * cw;
    const bh = this.lockinRevealKey.height * ch;

    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      this.lockinRevealSpinActive = true;
      this.lockinRevealStart = performance.now();
    }
  }

  update(now) {
    if (this.reelsSpinning) {
      let allDone = true;
      for (let c = 0; c < REELS; c++) {
        const r = this.reelSpinState[c];
        let dur = r.duration;
        if (this.fastSpinForced && !this.luckForSpin) dur = Math.min(dur, 650 + c * 100);
        const t = clamp((now - r.start) / dur, 0, 1);
        this.reelOffsets[c] = r.startOffset - (r.startOffset - r.finalIndex) * easeOutCubic(t);
        if (t < 1) allDone = false;
      }
      if (allDone) this.finishSpin();
    }

    if (this.luckActive && now >= this.luckTimer) {
      this.luckActive = false;
      this.luckVideo.pause();
      this.luckVideo.style.display = "none";
    }

    if (this.lockinAnimating && now >= this.lockinAnimationUntil) {
      this.lockinAnimating = false;
      this.maybeStartLockinCount();
      if (this.lockinBoard && this.lockinBoard.finished && this.lockinPayouts.length) {
        const biggest = this.lockinPayouts[this.lockinPayouts.length - 1];
        if (biggest) {
          this.lockinRevealActive = true;
          this.lockinRevealKey = biggest.block;
        }
      }
    }

    if (this.lockinPayouts.length && this.lockinPayoutIndex < this.lockinPayouts.length && now >= this.lockinPayoutTickerUntil) {
      if (!(this.lockinRevealActive && this.lockinPayoutIndex === this.lockinPayouts.length - 1 && !this.lockinRevealSpinActive)) {
        this.lockinDisplayed += this.lockinPayouts[this.lockinPayoutIndex].amount;
        this.lockinPayoutIndex += 1;
        this.lockinPayoutTickerUntil = now + 800;
        this.refreshHud();
      }
    }

    if (this.lockinRevealSpinActive) {
      const t = clamp((now - this.lockinRevealStart) / this.lockinRevealDuration, 0, 1);
      if (t >= 1) {
        this.lockinRevealSpinActive = false;
        this.lockinRevealActive = false;
        if (this.lockinPayoutIndex < this.lockinPayouts.length) {
          this.lockinDisplayed += this.lockinPayouts[this.lockinPayoutIndex].amount;
          this.lockinPayoutIndex += 1;
          this.refreshHud();
        }
      }
    }

    if (this.messageUntil && now > this.messageUntil) {
      this.messageUntil = 0;
      this.messageText = "";
      this.messageBanner.style.display = "none";
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const cellW = width / REELS;
    const cellH = height / ROWS;

    if (this.state === STATE_LOCKIN && this.lockinBoard) this.drawLockin(ctx, width, height, cellW, cellH);
    else this.drawReels(ctx, width, height, cellW, cellH);

    if (performance.now() < this.linesShowUntil && this.state !== STATE_LOCKIN) this.drawLinePreview(ctx, cellW, cellH);
    if (this.winningLines && this.winningLines.length && !this.reelsSpinning && this.state !== STATE_LOCKIN) this.drawWinningPulse(ctx, cellW, cellH);
    if (performance.now() < this.scatterShakeUntil) this.drawScatterBadge(ctx, width);
  }

  drawReels(ctx, width, height, cellW, cellH) {
    for (let c = 0; c < REELS; c++) {
      const strip = this.reelStrips[c];
      const offset = this.reelsSpinning ? this.reelOffsets[c] : this.reelFinalIndex[c];
      const frac = offset - Math.floor(offset);
      const base = Math.floor(offset);

      for (let k = -1; k < ROWS + 1; k++) {
        const idx = ((base + k) % strip.length + strip.length) % strip.length;
        const sym = strip[idx];
        const x = c * cellW;
        const y = (k - frac) * cellH;
        this.drawSymbol(ctx, sym, x, y, cellW, cellH);
      }
    }
  }

  drawSymbol(ctx, sym, x, y, w, h) {
    const img = this.symbolImages[sym];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x + 2, y + 2, w - 4, h - 4);
    } else {
      ctx.fillStyle = "#402244";
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(18, Math.floor(w / 5))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(sym), x + w / 2, y + h / 2);
    }
  }

  drawLinePreview(ctx, cellW, cellH) {
    for (let i = 0; i < LINES.length; i++) {
      ctx.strokeStyle = LINE_COLORS[i % LINE_COLORS.length];
      ctx.lineWidth = 3;
      ctx.beginPath();
      LINES[i].forEach(([r, c], idx) => {
        const px = c * cellW + cellW / 2;
        const py = r * cellH + cellH / 2 + ((i % 3) - 1) * 4;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  }

  drawWinningPulse(ctx, cellW, cellH) {
    const idx = this.winningLines[Math.floor(performance.now() / 500) % this.winningLines.length];
    const line = LINES[idx];
    ctx.strokeStyle = LINE_COLORS[idx % LINE_COLORS.length];
    ctx.lineWidth = 6;
    ctx.beginPath();
    line.forEach(([r, c], i) => {
      const px = c * cellW + cellW / 2;
      const py = r * cellH + cellH / 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  drawScatterBadge(ctx, width) {
    ctx.save();
    ctx.translate(width / 2, 28);
    ctx.rotate(Math.sin(performance.now() / 90) * 0.06);
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.strokeStyle = "rgba(255,213,79,0.7)";
    ctx.lineWidth = 2;
    const w = 360, h = 54, x = -w / 2, y = -h / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 18);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff66c4";
    ctx.font = "bold 28px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.pendingLockinBonus ? "1x1 FEATURE TRIGGERED" : "SCATTER BONUS!", 0, 0);
    ctx.restore();
  }

  drawLockin(ctx, width, height, cellW, cellH) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < REELS; c++) {
        const x = c * cellW;
        const y = r * cellH;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
        if (this.lockinBoard.filled[r][c]) this.drawSymbol(ctx, "1x1", x, y, cellW, cellH);
        else if (this.lockinAnimating && this.lockinSpinResults && this.lockinSpinResults[r][c] === "1x1") this.drawSymbol(ctx, "1x1", x, y, cellW, cellH);
      }
    }

    for (let i = 0; i < this.lockinBoard.blocks.length; i++) {
      const block = this.lockinBoard.blocks[i];
      const [r0, c0] = block.top_left;
      const x = c0 * cellW + 6;
      const y = r0 * cellH + 6;
      const w = block.width * cellW - 12;
      const h = block.height * cellH - 12;
      ctx.strokeStyle = "rgba(255,213,79,0.95)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      const matched = this.lockinPayouts.find(p =>
        p.block.top_left[0] === block.top_left[0] &&
        p.block.top_left[1] === block.top_left[1] &&
        p.block.width === block.width &&
        p.block.height === block.height
      );

      if (matched && this.lockinPayouts.indexOf(matched) < this.lockinPayoutIndex) {
        ctx.fillStyle = "#ff66c4";
        ctx.font = `bold ${Math.max(18, Math.floor(Math.min(w, h) / 4))}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(money(matched.amount), x + w / 2, y + h / 2);
      }
    }

    if (this.lockinRevealActive && this.lockinRevealKey) {
      const block = this.lockinRevealKey;
      const [r0, c0] = block.top_left;
      const x = c0 * cellW + 10;
      const y = r0 * cellH + 10;
      const w = block.width * cellW - 20;
      const h = block.height * cellH - 20;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(18, Math.floor(Math.min(w, h) / 5))}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.lockinRevealSpinActive ? "REVEALING..." : "CLICK TO REVEAL", x + w / 2, y + h / 2);
    }
  }

  loop(now) {
    this.update(now);
    this.draw();
    this.refreshHud();
    this.refreshBorder();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new SlotGameWebAssets();
});
