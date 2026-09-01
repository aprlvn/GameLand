(() => {
  // Smaller board = less room to maneuver = harder, same logic as a tighter
  // Minesweeper/Queens grid.
  const LEVELS = {
    easy: { n: 10 },
    medium: { n: 8 },
    hard: { n: 6 },
  };

  const COLORS = ["n1", "n2", "n3", "n4", "n5", "n6"];
  const COLOR_HEX = {
    n1: "#6fa8ff",
    n2: "#4fbf8a",
    n3: "#ff6f8f",
    n4: "#b47cff",
    n5: "#ff9a4f",
    n6: "#3ec4c9",
  };
  const LIFT = 68; // px the dragged piece floats above the finger so it stays visible
  const TRAY_SPAN = 3; // every piece's bounding box fits within 3×3, so the tray can show it at full board scale

  // Base shapes only — each spawns in a fixed orientation (no in-hand
  // rotation, like the real game). Every one fits within a 3×3 box, which
  // is what lets the tray render pieces at the same scale as the board.
  const BASE_SHAPES = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [2, 0]],
  ];

  function normalize(cells) {
    const minR = Math.min(...cells.map((c) => c[0]));
    const minC = Math.min(...cells.map((c) => c[1]));
    return cells.map(([r, c]) => [r - minR, c - minC]);
  }

  function rotate(cells) {
    const maxR = Math.max(...cells.map((c) => c[0]));
    return normalize(cells.map(([r, c]) => [c, maxR - r]));
  }

  function shapeKey(cells) {
    return cells.map(([r, c]) => `${r},${c}`).sort().join("|");
  }

  const SHAPE_POOL = (() => {
    const seen = new Set();
    const pool = [];
    BASE_SHAPES.forEach((base) => {
      let cur = normalize(base);
      for (let i = 0; i < 4; i++) {
        const key = shapeKey(cur);
        if (!seen.has(key)) {
          seen.add(key);
          pool.push(cur);
        }
        cur = rotate(cur);
      }
    });
    return pool;
  })();

  function shapeBounds(shape) {
    const maxR = Math.max(...shape.map((c) => c[0]));
    const maxC = Math.max(...shape.map((c) => c[1]));
    return { rows: maxR + 1, cols: maxC + 1 };
  }

  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best-score");
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
  const toastContainer = document.getElementById("toast-container");

  const BEST_KEY = "gameland:blockblast:best";

  let levelKey = "easy";
  let N;
  let board, cellEls, tray, trayEls, score, best, cellSize, gameOver;
  let drag = null;

  // Cell size is picked so the board (N rows), the tray (up to 3 rows of
  // pieces), and 3 tray slots side by side all fit on one screen — the
  // same square size is used everywhere, so a piece never changes size
  // between the tray and the board.
  function computeCellSize() {
    const widthBudget = Math.min(window.innerWidth - 40, 380);
    const byBoardWidth = Math.floor(widthBudget / N);
    const byTrayWidth = Math.floor((widthBudget - 48) / (TRAY_SPAN * 3));
    const reserved = 250; // header + control bar + chrome around the board and tray
    const byHeight = Math.floor((window.innerHeight - reserved) / (N + TRAY_SPAN));
    cellSize = Math.max(22, Math.min(byBoardWidth, byTrayWidth, byHeight, 44));
    document.documentElement.style.setProperty("--cell-size", cellSize + "px");
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", N);
    boardEl.style.setProperty("--rows", N);
    cellEls = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement("div");
        cell.className = "cell " + ((r + c) % 2 === 0 ? "chk-a" : "chk-b");
        boardEl.appendChild(cell);
        cellEls[r][c] = cell;
      }
    }
  }

  function renderCell(r, c) {
    const cell = cellEls[r][c];
    const color = board[r][c];
    cell.classList.toggle("filled", !!color);
    if (color) cell.style.setProperty("--piece-color", COLOR_HEX[color]);
  }

  function renderBoard() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) renderCell(r, c);
  }

  function buildPieceEl(piece, px) {
    const { rows, cols } = shapeBounds(piece.shape);
    const el = document.createElement("div");
    el.className = "piece";
    el.style.width = cols * px + "px";
    el.style.height = rows * px + "px";
    piece.shape.forEach(([r, c]) => {
      const block = document.createElement("div");
      block.className = "piece-block";
      block.style.width = px + "px";
      block.style.height = px + "px";
      block.style.left = c * px + "px";
      block.style.top = r * px + "px";
      block.style.background = COLOR_HEX[piece.color];
      el.appendChild(block);
    });
    return el;
  }

  function randomPiece() {
    const shape = SHAPE_POOL[Math.floor(Math.random() * SHAPE_POOL.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return { shape, color };
  }

  function renderTray() {
    trayEl.innerHTML = "";
    trayEls = [];
    tray.forEach((piece, i) => {
      const slot = document.createElement("div");
      slot.className = "tray-slot";
      if (piece) {
        const pieceEl = buildPieceEl(piece, cellSize);
        pieceEl.classList.add("tray-piece");
        pieceEl.addEventListener("pointerdown", (e) => startDrag(e, i));
        slot.appendChild(pieceEl);
      }
      trayEl.appendChild(slot);
      trayEls.push(slot);
    });
  }

  function refillTray() {
    tray = [randomPiece(), randomPiece(), randomPiece()];
    renderTray();
  }

  // ---- Drag & drop (pointer events cover mouse + touch identically) ----

  function positionGhost(x, y) {
    const w = drag.cols * cellSize;
    const h = drag.rows * cellSize;
    drag.ghost.style.left = x - w / 2 + "px";
    drag.ghost.style.top = y - h / 2 - LIFT + "px";
  }

  function clearPreview() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        cellEls[r][c].classList.remove("preview-valid", "preview-invalid");
      }
    }
  }

  function updateDragPreview(x, y) {
    const rect = boardEl.getBoundingClientRect();
    const w = drag.cols * cellSize;
    const h = drag.rows * cellSize;
    const left = x - w / 2;
    const top = y - h / 2 - LIFT;
    const col = Math.round((left - rect.left) / cellSize);
    const row = Math.round((top - rect.top) / cellSize);
    drag.targetR = row;
    drag.targetC = col;

    clearPreview();
    const inRange = row > -drag.rows && row < N && col > -drag.cols && col < N;
    if (!inRange) {
      drag.valid = false;
      return;
    }

    let valid = true;
    drag.piece.shape.forEach(([dr, dc]) => {
      const r = row + dr, c = col + dc;
      if (r < 0 || r >= N || c < 0 || c >= N || board[r][c]) valid = false;
    });
    drag.valid = valid;

    drag.piece.shape.forEach(([dr, dc]) => {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < N && c >= 0 && c < N) {
        cellEls[r][c].classList.add(valid ? "preview-valid" : "preview-invalid");
      }
    });
  }

  function startDrag(e, index) {
    if (gameOver || !tray[index]) return;
    e.preventDefault();
    const piece = tray[index];
    const { rows, cols } = shapeBounds(piece.shape);
    const ghost = buildPieceEl(piece, cellSize);
    ghost.classList.add("piece-ghost");
    document.body.appendChild(ghost);

    drag = {
      index,
      piece,
      rows,
      cols,
      pointerId: e.pointerId,
      ghost,
      slotEl: trayEls[index],
      valid: false,
      targetR: -999,
      targetC: -999,
    };
    drag.slotEl.classList.add("dragging-source");
    positionGhost(e.clientX, e.clientY);
    updateDragPreview(e.clientX, e.clientY);

    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    positionGhost(e.clientX, e.clientY);
    updateDragPreview(e.clientX, e.clientY);
  }

  function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    clearPreview();
    drag.ghost.remove();
    drag.slotEl.classList.remove("dragging-source");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);

    const { index, piece, valid, targetR, targetC } = drag;
    drag = null;

    if (valid) {
      commitPiece(index, piece, targetR, targetC);
    } else if (window.GamelandSound) {
      window.GamelandSound.playError();
    }
  }

  // ---- Placement, scoring, line clears ----

  function addScore(points) {
    if (!points) return;
    score += points;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (e) {}
    }
  }

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 1400);
  }

  function findFullLines() {
    const rows = [];
    const cols = [];
    for (let r = 0; r < N; r++) {
      if (board[r].every((v) => v)) rows.push(r);
    }
    for (let c = 0; c < N; c++) {
      let full = true;
      for (let r = 0; r < N; r++) {
        if (!board[r][c]) {
          full = false;
          break;
        }
      }
      if (full) cols.push(c);
    }
    return { rows, cols };
  }

  function resolveClear(rows, cols) {
    const cellsToClear = new Set();
    rows.forEach((r) => {
      for (let c = 0; c < N; c++) cellsToClear.add(`${r},${c}`);
    });
    cols.forEach((c) => {
      for (let r = 0; r < N; r++) cellsToClear.add(`${r},${c}`);
    });

    cellsToClear.forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      cellEls[r][c].classList.add("clearing");
    });
    if (window.GamelandSound) window.GamelandSound.playClick();

    const lineCount = rows.length + cols.length;
    const bonus = lineCount * N * 10 + (lineCount > 1 ? (lineCount - 1) * 30 : 0);

    setTimeout(() => {
      cellsToClear.forEach((key) => {
        const [r, c] = key.split(",").map(Number);
        board[r][c] = null;
        cellEls[r][c].classList.remove("clearing");
      });
      renderBoard();
      addScore(bonus);
      showToast(lineCount > 1 ? `${lineCount}x Clear! +${bonus}` : `Clear! +${bonus}`);
      if (window.GamelandSound) window.GamelandSound.playWin();
      afterMoveSettled();
    }, 240);
  }

  function commitPiece(index, piece, row, col) {
    const placedCells = [];
    piece.shape.forEach(([dr, dc]) => {
      const r = row + dr, c = col + dc;
      board[r][c] = piece.color;
      placedCells.push([r, c]);
    });
    tray[index] = null;

    placedCells.forEach(([r, c]) => {
      renderCell(r, c);
      cellEls[r][c].classList.add("pop");
      setTimeout(() => cellEls[r][c] && cellEls[r][c].classList.remove("pop"), 200);
    });

    if (window.GamelandSound) window.GamelandSound.playClick();
    addScore(placedCells.length);
    renderTray();

    const { rows, cols } = findFullLines();
    if (rows.length || cols.length) {
      setTimeout(() => resolveClear(rows, cols), 140);
    } else {
      afterMoveSettled();
    }
  }

  function pieceFitsAnywhere(piece) {
    const { rows, cols } = shapeBounds(piece.shape);
    for (let r = 0; r <= N - rows; r++) {
      for (let c = 0; c <= N - cols; c++) {
        let ok = true;
        for (const [dr, dc] of piece.shape) {
          if (board[r + dr][c + dc]) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
    return false;
  }

  function checkGameOver() {
    const anyFits = tray.some((p) => p && pieceFitsAnywhere(p));
    if (!anyFits) endGame();
  }

  function afterMoveSettled() {
    if (tray.every((p) => !p)) refillTray();
    checkGameOver();
  }

  function endGame() {
    gameOver = true;
    if (window.GamelandSound) window.GamelandSound.playLose();
    const isNewBest = score > 0 && score === best;
    endTitle.textContent = "Board's full!";
    endMessage.textContent = `Final score: ${score}${isNewBest ? " — new best! 🎉" : ""}`;
    endModal.classList.remove("hidden");
    if (window.GamelandProfiles) {
      window.GamelandProfiles.recordScore("block-blast", score, "score", levelKey);
    }
  }

  function newGame() {
    board = Array.from({ length: N }, () => Array(N).fill(null));
    score = 0;
    gameOver = false;
    scoreEl.textContent = "0";
    buildBoard();
    refillTray();
    endModal.classList.add("hidden");
  }

  function setLevel(key) {
    levelKey = key;
    N = LEVELS[key].n;
    difficultyGroup.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.level === key);
    });
    computeCellSize();
    newGame();
  }

  function init() {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best;
    setLevel(levelKey);
  }

  window.addEventListener("resize", () => {
    computeCellSize();
    renderTray();
  });

  difficultyGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-btn");
    if (!btn || btn.dataset.level === levelKey) return;
    if (score > 0 && !gameOver && !confirm("Switch difficulty? Your current score will be lost.")) return;
    setLevel(btn.dataset.level);
  });

  helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  closeHelp.addEventListener("click", () => helpModal.classList.add("hidden"));
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });
  closeEnd.addEventListener("click", () => endModal.classList.add("hidden"));
  newGameBtn.addEventListener("click", () => {
    if (!gameOver && score > 0 && !confirm("Start a new board? Your current score will be lost.")) return;
    newGame();
  });
  playAgainBtn.addEventListener("click", newGame);

  init();

  if (window.GamelandProfiles) {
    window.GamelandProfiles.initLeaderboard({
      gameId: "block-blast",
      metric: "score",
      difficulties: [
        { key: "easy", label: "Easy" },
        { key: "medium", label: "Medium" },
        { key: "hard", label: "Hard" },
      ],
      getCurrentDifficulty: () => levelKey,
    });
  }
})();
