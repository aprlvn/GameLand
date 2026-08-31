(() => {
  const LEVELS = {
    easy: { n: 6, cellSize: 56 },
    medium: { n: 8, cellSize: 46 },
    hard: { n: 10, cellSize: 40 },
  };

  const boardEl = document.getElementById("board");
  const timerEl = document.getElementById("timer");
  const helpBtn = document.getElementById("help-btn");
  const closeHelp = document.getElementById("close-help");
  const helpModal = document.getElementById("help-modal");
  const newGameBtn = document.getElementById("new-game-btn");
  const difficultyGroup = document.getElementById("difficulty-group");
  const endModal = document.getElementById("end-modal");
  const closeEnd = document.getElementById("close-end");
  const endTitle = document.getElementById("end-title");
  const endMessage = document.getElementById("end-message");
  const playAgainBtn = document.getElementById("play-again-btn");

  let levelKey = "easy";
  let N, CELL;
  let region, cellState, cellEls;
  let timerInterval = null;
  let started = false;
  let solved = false;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function placeSeeds() {
    const cols = Array(N).fill(-1);
    function backtrack(row, used) {
      if (row === N) return true;
      const order = shuffle([...Array(N).keys()].filter((c) => !used.has(c)));
      for (const c of order) {
        if (row > 0 && Math.abs(cols[row - 1] - c) <= 1) continue;
        cols[row] = c;
        used.add(c);
        if (backtrack(row + 1, used)) return true;
        used.delete(c);
        cols[row] = -1;
      }
      return false;
    }
    backtrack(0, new Set());
    return cols;
  }

  function growRegions(seedCols, freezeIndex) {
    const reg = Array.from({ length: N }, () => Array(N).fill(-1));
    const frontiers = seedCols.map((c, r) => {
      reg[r][c] = r;
      return [[r, c]];
    });
    // A frozen region stays a single tile — its own crown position is
    // then a free deduction for easier difficulties.
    if (freezeIndex !== undefined) frontiers[freezeIndex] = [];
    let assigned = N;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let guard = 0;
    while (assigned < N * N && guard < 20000) {
      guard++;
      const order = shuffle([...Array(N).keys()]);
      let progressed = false;
      for (const ri of order) {
        const frontier = frontiers[ri];
        if (!frontier.length) continue;
        shuffle(frontier);
        let placed = false;
        while (frontier.length && !placed) {
          const [r, c] = frontier[frontier.length - 1];
          const dirOrder = shuffle(dirs.slice());
          let candidate = null;
          for (const [dr, dc] of dirOrder) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
            if (reg[nr][nc] !== -1) continue;
            candidate = [nr, nc];
            break;
          }
          if (candidate) {
            reg[candidate[0]][candidate[1]] = ri;
            frontier.push(candidate);
            assigned++;
            placed = true;
            progressed = true;
          } else {
            frontier.pop();
          }
        }
      }
      if (!progressed) break;
    }
    return reg;
  }

  function generateRegions() {
    const wantsFreeze = levelKey === "easy" || levelKey === "medium";
    let attempt = 0;
    while (attempt < 50) {
      attempt++;
      const seeds = placeSeeds();
      const freezeIndex = wantsFreeze ? Math.floor(Math.random() * N) : undefined;
      const reg = growRegions(seeds, freezeIndex);
      const counts = Array(N).fill(0);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) counts[reg[r][c]]++;
      if (counts.every((x) => x > 0)) return reg;
    }
    return growRegions(placeSeeds());
  }

  // Evenly-spaced hues, one per region — every region gets its own distinct
  // color since there's exactly one crown per color.
  function regionHue(i) {
    return (330 + i * (360 / N)) % 360;
  }

  function colorRegions() {
    return shuffle([...Array(N).keys()]);
  }

  function crownIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M4 18h16l1-9-5 3.5L12 6l-4 6.5L3 9z" fill="var(--crown-color)" stroke="var(--crown-color)" stroke-width="1.1" stroke-linejoin="round"/></svg>`;
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = `repeat(${N}, ${CELL}px)`;
    boardEl.style.gridTemplateRows = `repeat(${N}, ${CELL}px)`;
    cellEls = Array.from({ length: N }, () => Array(N).fill(null));

    const colorOf = colorRegions();

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.style.background = `hsl(${regionHue(colorOf[region[r][c]])}, 68%, 84%)`;
        cell.addEventListener("click", () => handleCellClick(r, c));
        boardEl.appendChild(cell);
        cellEls[r][c] = cell;
      }
    }
    renderAllCells();
  }

  function renderCell(r, c) {
    const cell = cellEls[r][c];
    const state = cellState[r][c];
    cell.innerHTML = state === 2 ? crownIcon() : state === 1 ? "×" : "";
  }

  function renderAllCells() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) renderCell(r, c);
  }

  function handleCellClick(r, c) {
    if (solved) return;
    cellState[r][c] = (cellState[r][c] + 1) % 3;
    renderCell(r, c);
    if (!started) startTimer();
    checkState();
  }

  function checkState() {
    const rowCount = Array(N).fill(0);
    const colCount = Array(N).fill(0);
    const regionCount = Array(N).fill(0);
    const crowns = [];

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (cellState[r][c] === 2) {
          rowCount[r]++;
          colCount[c]++;
          regionCount[region[r][c]]++;
          crowns.push([r, c]);
        }
      }
    }

    const errorSet = new Set();
    crowns.forEach(([r, c]) => {
      if (rowCount[r] > 1 || colCount[c] > 1 || regionCount[region[r][c]] > 1) {
        errorSet.add(`${r},${c}`);
      }
    });
    for (let i = 0; i < crowns.length; i++) {
      for (let j = i + 1; j < crowns.length; j++) {
        const [r1, c1] = crowns[i];
        const [r2, c2] = crowns[j];
        if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
          errorSet.add(`${r1},${c1}`);
          errorSet.add(`${r2},${c2}`);
        }
      }
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        cellEls[r][c].classList.toggle("error", errorSet.has(`${r},${c}`));
      }
    }

    const allRowsOne = rowCount.every((x) => x === 1);
    const allColsOne = colCount.every((x) => x === 1);
    const allRegionsOne = regionCount.every((x) => x === 1);

    if (allRowsOne && allColsOne && allRegionsOne && errorSet.size === 0) win();
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
    endTitle.textContent = "All crowned! 👑";
    endMessage.textContent = `Solved in ${timerEl.textContent}.`;
    endModal.classList.remove("hidden");
  }

  function setLevel(key) {
    levelKey = key;
    const cfg = LEVELS[key];
    N = cfg.n;
    CELL = cfg.cellSize;
    difficultyGroup.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.level === key);
    });
    newGame();
  }

  function newGame() {
    stopTimer();
    started = false;
    solved = false;
    timerEl.textContent = "00:00";
    region = generateRegions();
    cellState = Array.from({ length: N }, () => Array(N).fill(0));
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
  playAgainBtn.addEventListener("click", newGame);

  setLevel("easy");
})();
