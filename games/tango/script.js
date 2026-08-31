(() => {
  const LEVELS = {
    easy: { size: 6, given: 9, pairs: 5, cellSize: 48 },
    medium: { size: 8, given: 13, pairs: 7, cellSize: 42 },
    hard: { size: 10, given: 17, pairs: 9, cellSize: 36 },
  };

  const boardEl = document.getElementById("board");
  const timerEl = document.getElementById("timer");
  const helpBtn = document.getElementById("help-btn");
  const closeHelp = document.getElementById("close-help");
  const helpModal = document.getElementById("help-modal");
  const newGameBtn = document.getElementById("new-game-btn");
  const checkBtn = document.getElementById("check-btn");
  const difficultyGroup = document.getElementById("difficulty-group");
  const toastContainer = document.getElementById("toast-container");
  const endModal = document.getElementById("end-modal");
  const closeEnd = document.getElementById("close-end");
  const endTitle = document.getElementById("end-title");
  const endMessage = document.getElementById("end-message");
  const playAgainBtn = document.getElementById("play-again-btn");

  let levelKey = "easy";
  let SIZE, HALF, CELL;
  let solution, grid, given, pairs;
  let cellEls, badgeEls;
  let timerInterval = null;
  let started = false;
  let solved = false;
  let clearErrorsTimeout = null;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function generateSolution() {
    const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const cells = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cells.push([r, c]);

    function fits(r, c, val) {
      if (c >= 2 && g[r][c - 1] === val && g[r][c - 2] === val) return false;
      if (r >= 2 && g[r - 1][c] === val && g[r - 2][c] === val) return false;
      let rowCount = 0;
      for (let cc = 0; cc < c; cc++) if (g[r][cc] === val) rowCount++;
      if (rowCount + 1 > HALF) return false;
      let colCount = 0;
      for (let rr = 0; rr < r; rr++) if (g[rr][c] === val) colCount++;
      if (colCount + 1 > HALF) return false;
      return true;
    }

    function backtrack(idx) {
      if (idx === cells.length) return true;
      const [r, c] = cells[idx];
      const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
      for (const val of order) {
        if (fits(r, c, val)) {
          g[r][c] = val;
          if (backtrack(idx + 1)) return true;
          g[r][c] = null;
        }
      }
      return false;
    }

    backtrack(0);
    return g;
  }

  function buildPuzzle(cfg) {
    solution = generateSolution();
    given = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    pairs = [];

    const adjacents = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (c + 1 < SIZE) adjacents.push({ r1: r, c1: c, r2: r, c2: c + 1 });
        if (r + 1 < SIZE) adjacents.push({ r1: r, c1: c, r2: r + 1, c2: c });
      }
    }
    shuffle(adjacents);
    const usedCells = new Set();
    for (const p of adjacents) {
      if (pairs.length >= cfg.pairs) break;
      const k1 = `${p.r1},${p.c1}`;
      const k2 = `${p.r2},${p.c2}`;
      if (usedCells.has(k1) || usedCells.has(k2)) continue;
      const v1 = solution[p.r1][p.c1];
      const v2 = solution[p.r2][p.c2];
      pairs.push({ ...p, type: v1 === v2 ? "eq" : "neq" });
      usedCells.add(k1);
      usedCells.add(k2);
    }

    const allCells = shuffle(
      Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => [r, c])).flat()
    );
    let remaining = cfg.given;
    for (const [r, c] of allCells) {
      if (remaining <= 0) break;
      given[r][c] = true;
      grid[r][c] = solution[r][c];
      remaining--;
    }
  }

  function heartIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M12 20.3C12 20.3 3.2 14.9 3.2 8.9C3.2 6 5.5 3.8 8.3 3.8C10 3.8 11.4 4.7 12 6C12.6 4.7 14 3.8 15.7 3.8C18.5 3.8 20.8 6 20.8 8.9C20.8 14.9 12 20.3 12 20.3Z" fill="var(--heart-color)"/></svg>`;
  }

  function starIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M12 2.5L14.9 8.8L21.8 9.6L16.7 14.3L18.1 21.1L12 17.6L5.9 21.1L7.3 14.3L2.2 9.6L9.1 8.8Z" fill="var(--star-color)"/></svg>`;
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.width = `${SIZE * CELL}px`;
    boardEl.style.height = `${SIZE * CELL}px`;
    cellEls = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    badgeEls = [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = `cell ${(r + c) % 2 === 0 ? "chk-a" : "chk-b"}`;
        cell.style.left = `${c * CELL}px`;
        cell.style.top = `${r * CELL}px`;
        cell.style.width = `${CELL}px`;
        cell.style.height = `${CELL}px`;
        cell.addEventListener("click", () => handleCellClick(r, c));
        boardEl.appendChild(cell);
        cellEls[r][c] = cell;
      }
    }

    pairs.forEach((p) => {
      const badge = document.createElement("div");
      badge.className = "badge";
      const isHorizontal = p.r1 === p.r2;
      const cx = isHorizontal ? (p.c1 + 1) * CELL : p.c1 * CELL + CELL / 2;
      const cy = isHorizontal ? p.r1 * CELL + CELL / 2 : (p.r1 + 1) * CELL;
      badge.style.left = `${cx - 10}px`;
      badge.style.top = `${cy - 10}px`;
      badge.innerHTML = `<span>${p.type === "eq" ? "=" : "×"}</span>`;
      boardEl.appendChild(badge);
      badgeEls.push(badge);
    });

    renderAllCells();
  }

  function renderAllCells() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) renderCell(r, c);
  }

  function renderCell(r, c) {
    const cell = cellEls[r][c];
    const val = grid[r][c];
    cell.innerHTML = val === 0 ? heartIcon() : val === 1 ? starIcon() : "";
    cell.classList.toggle("given", given[r][c]);
  }

  function isFull() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] === null) return false;
    return true;
  }

  function handleCellClick(r, c) {
    if (solved || given[r][c]) return;
    clearTimeout(clearErrorsTimeout);
    clearErrors();
    grid[r][c] = grid[r][c] === null ? 0 : grid[r][c] === 0 ? 1 : null;
    renderCell(r, c);
    if (!started) startTimer();
    if (isFull()) runCheck(true);
  }

  function computeViolations() {
    const cellErrors = new Set();

    for (let r = 0; r < SIZE; r++) {
      let run = 1;
      for (let c = 0; c < SIZE; c++) {
        if (c > 0 && grid[r][c] !== null && grid[r][c] === grid[r][c - 1]) run++;
        else run = 1;
        if (run >= 3 && grid[r][c] !== null) {
          cellErrors.add(`${r},${c}`);
          cellErrors.add(`${r},${c - 1}`);
          cellErrors.add(`${r},${c - 2}`);
        }
      }
      let cats = 0, dogs = 0;
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cats++;
        else if (grid[r][c] === 1) dogs++;
      }
      if (cats > HALF) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 0) cellErrors.add(`${r},${c}`);
      if (dogs > HALF) for (let c = 0; c < SIZE; c++) if (grid[r][c] === 1) cellErrors.add(`${r},${c}`);
    }

    for (let c = 0; c < SIZE; c++) {
      let run = 1;
      for (let r = 0; r < SIZE; r++) {
        if (r > 0 && grid[r][c] !== null && grid[r][c] === grid[r - 1][c]) run++;
        else run = 1;
        if (run >= 3 && grid[r][c] !== null) {
          cellErrors.add(`${r},${c}`);
          cellErrors.add(`${r - 1},${c}`);
          cellErrors.add(`${r - 2},${c}`);
        }
      }
      let cats = 0, dogs = 0;
      for (let r = 0; r < SIZE; r++) {
        if (grid[r][c] === 0) cats++;
        else if (grid[r][c] === 1) dogs++;
      }
      if (cats > HALF) for (let r = 0; r < SIZE; r++) if (grid[r][c] === 0) cellErrors.add(`${r},${c}`);
      if (dogs > HALF) for (let r = 0; r < SIZE; r++) if (grid[r][c] === 1) cellErrors.add(`${r},${c}`);
    }

    const pairErrors = new Set();
    pairs.forEach((p, idx) => {
      const v1 = grid[p.r1][p.c1];
      const v2 = grid[p.r2][p.c2];
      if (v1 === null || v2 === null) return;
      const ok = p.type === "eq" ? v1 === v2 : v1 !== v2;
      if (!ok) {
        pairErrors.add(idx);
        cellErrors.add(`${p.r1},${p.c1}`);
        cellErrors.add(`${p.r2},${p.c2}`);
      }
    });

    return { cellErrors, pairErrors };
  }

  function clearErrors() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cellEls[r][c].classList.remove("error");
    badgeEls.forEach((b) => b.classList.remove("error"));
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  function runCheck(isAuto) {
    if (solved) return;
    const { cellErrors, pairErrors } = computeViolations();
    const full = isFull();

    if (full && cellErrors.size === 0 && pairErrors.size === 0) {
      win();
      return;
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        cellEls[r][c].classList.toggle("error", cellErrors.has(`${r},${c}`));
      }
    }
    badgeEls.forEach((badge, idx) => badge.classList.toggle("error", pairErrors.has(idx)));

    if (cellErrors.size > 0) {
      showToast(full ? "So close — a few tiles need fixing" : "A couple of tiles break the rules");
      clearTimeout(clearErrorsTimeout);
      clearErrorsTimeout = setTimeout(clearErrors, 1800);
    } else if (!isAuto) {
      showToast("Looks good so far!");
    }
  }

  function startTimer() {
    started = true;
    const startTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const ss = String(elapsed % 60).padStart(2, "0");
      timerEl.textContent = `${mm}:${ss}`;
    }, 250);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function win() {
    solved = true;
    stopTimer();
    clearErrors();
    endTitle.textContent = "You balanced it! 💗⭐";
    endMessage.textContent = `Solved in ${timerEl.textContent}.`;
    endModal.classList.remove("hidden");
  }

  function setLevel(key) {
    levelKey = key;
    const cfg = LEVELS[key];
    SIZE = cfg.size;
    HALF = SIZE / 2;
    CELL = cfg.cellSize;
    difficultyGroup.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.level === key);
    });
    newGame();
  }

  function newGame() {
    stopTimer();
    clearTimeout(clearErrorsTimeout);
    started = false;
    solved = false;
    timerEl.textContent = "00:00";
    buildPuzzle(LEVELS[levelKey]);
    buildBoard();
    endModal.classList.add("hidden");
  }

  difficultyGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-btn");
    if (btn) setLevel(btn.dataset.level);
  });

  helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  closeHelp.addEventListener("click", () => helpModal.classList.add("hidden"));
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });
  closeEnd.addEventListener("click", () => endModal.classList.add("hidden"));
  newGameBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", () => runCheck(false));
  playAgainBtn.addEventListener("click", newGame);

  setLevel("easy");
})();
