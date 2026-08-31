(() => {
  const LEVELS = {
    easy: { rows: 12, cols: 8, mines: 12, cellSize: "32px" },
    medium: { rows: 15, cols: 10, mines: 24, cellSize: "27px" },
    hard: { rows: 18, cols: 12, mines: 40, cellSize: "22px" },
  };

  const boardEl = document.getElementById("board");
  const mineCountEl = document.getElementById("mine-count");
  const timerEl = document.getElementById("timer");
  const faceBtn = document.getElementById("face-btn");
  const helpBtn = document.getElementById("help-btn");
  const closeHelp = document.getElementById("close-help");
  const helpModal = document.getElementById("help-modal");
  const flagModeBtn = document.getElementById("flag-mode-btn");
  const difficultyGroup = document.getElementById("difficulty-group");
  const endModal = document.getElementById("end-modal");
  const closeEnd = document.getElementById("close-end");
  const endTitle = document.getElementById("end-title");
  const endMessage = document.getElementById("end-message");
  const playAgainBtn = document.getElementById("play-again-btn");

  let levelKey = "easy";
  let rows, cols, mineTotal;
  let board, cellEls;
  let started = false;
  let gameOver = false;
  let flagMode = false;
  let revealedCount = 0;
  let flagCount = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let longPressTimer = null;
  let suppressClick = false;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
      }
    }
    return out;
  }

  function pawIcon() {
    return `<svg class="paw" viewBox="0 0 24 24"><ellipse cx="12" cy="16.5" rx="6" ry="5" fill="#ff6fb0"/><circle cx="5.8" cy="8.2" r="2.6" fill="#ff6fb0"/><circle cx="11" cy="5.2" r="2.6" fill="#ff6fb0"/><circle cx="16.6" cy="6.4" r="2.6" fill="#ff6fb0"/><circle cx="19.6" cy="11.4" r="2.3" fill="#ff6fb0"/></svg>`;
  }

  function flagIcon() {
    return `<svg class="flag" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="21" stroke="#b3106b" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h12l-4 4 4 4H6z" fill="#ff4fa3"/></svg>`;
  }

  function setLevel(key) {
    levelKey = key;
    const cfg = LEVELS[key];
    rows = cfg.rows;
    cols = cfg.cols;
    mineTotal = cfg.mines;
    boardEl.style.setProperty("--rows", rows);
    boardEl.style.setProperty("--cols", cols);
    boardEl.style.setProperty("--cell-size", cfg.cellSize);
    difficultyGroup.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.level === key);
    });
    newGame();
  }

  function newGame() {
    stopTimer();
    started = false;
    gameOver = false;
    revealedCount = 0;
    flagCount = 0;
    elapsedSeconds = 0;
    timerEl.textContent = "000";
    mineCountEl.textContent = mineTotal;
    faceBtn.textContent = "😊";
    endModal.classList.add("hidden");

    board = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
    );

    boardEl.innerHTML = "";
    cellEls = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        attachCellEvents(cell, r, c);
        boardEl.appendChild(cell);
        cellEls[r][c] = cell;
      }
    }
  }

  function attachCellEvents(cell, r, c) {
    cell.addEventListener("click", () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (flagMode) toggleFlag(r, c);
      else reveal(r, c);
    });
    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      toggleFlag(r, c);
    });
    cell.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      longPressTimer = setTimeout(() => {
        suppressClick = true;
        toggleFlag(r, c);
      }, 480);
    });
    cell.addEventListener("pointerup", () => clearTimeout(longPressTimer));
    cell.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
  }

  function placeMines(excludeR, excludeC) {
    const forbidden = new Set([`${excludeR},${excludeC}`]);
    neighbors(excludeR, excludeC).forEach(([r, c]) => forbidden.add(`${r},${c}`));
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!forbidden.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }
    shuffle(candidates);
    for (let i = 0; i < mineTotal; i++) {
      const [r, c] = candidates[i];
      board[r][c].mine = true;
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) continue;
        board[r][c].adjacent = neighbors(r, c).filter(([nr, nc]) => board[nr][nc].mine).length;
      }
    }
  }

  function renderCell(r, c) {
    const state = board[r][c];
    const el = cellEls[r][c];
    el.className = "cell";
    if (state.revealed) {
      el.classList.add("revealed");
      if (state.mine) {
        el.classList.add("mine");
        el.innerHTML = pawIcon();
      } else if (state.adjacent > 0) {
        el.classList.add(`n${state.adjacent}`);
        el.textContent = state.adjacent;
      } else {
        el.innerHTML = "";
      }
    } else {
      el.innerHTML = state.flagged ? flagIcon() : "";
    }
  }

  function reveal(r, c) {
    if (gameOver) return;
    const state = board[r][c];
    if (state.revealed || state.flagged) return;

    if (!started) {
      started = true;
      placeMines(r, c);
      startTimer();
    }

    if (board[r][c].mine) {
      loseGame(r, c);
      return;
    }

    const queue = [[r, c]];
    const seen = new Set();
    while (queue.length) {
      const [cr, cc] = queue.shift();
      const key = `${cr},${cc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cs = board[cr][cc];
      if (cs.revealed || cs.flagged) continue;
      cs.revealed = true;
      revealedCount++;
      renderCell(cr, cc);
      if (cs.adjacent === 0) {
        neighbors(cr, cc).forEach(([nr, nc]) => {
          if (!seen.has(`${nr},${nc}`)) queue.push([nr, nc]);
        });
      }
    }

    checkWin();
  }

  function toggleFlag(r, c) {
    if (gameOver) return;
    const state = board[r][c];
    if (state.revealed) return;
    state.flagged = !state.flagged;
    flagCount += state.flagged ? 1 : -1;
    mineCountEl.textContent = mineTotal - flagCount;
    renderCell(r, c);
  }

  function checkWin() {
    if (revealedCount === rows * cols - mineTotal) winGame();
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.min(999, elapsedSeconds + 1);
      timerEl.textContent = String(elapsedSeconds).padStart(3, "0");
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function revealAllMines(triggerR, triggerC) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) {
          board[r][c].revealed = true;
          renderCell(r, c);
          if (r === triggerR && c === triggerC) cellEls[r][c].classList.add("triggered");
        }
      }
    }
  }

  function loseGame(r, c) {
    gameOver = true;
    stopTimer();
    revealAllMines(r, c);
    faceBtn.textContent = "😿";
    endTitle.textContent = "Oh no!";
    endMessage.textContent = "A kitty got you. Try again?";
    endModal.classList.remove("hidden");
  }

  function winGame() {
    gameOver = true;
    stopTimer();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine && !board[r][c].flagged) {
          board[r][c].flagged = true;
          renderCell(r, c);
        }
      }
    }
    flagCount = mineTotal;
    mineCountEl.textContent = 0;
    faceBtn.textContent = "😎";
    endTitle.textContent = "You win!";
    endMessage.textContent = `Cleared in ${elapsedSeconds}s.`;
    endModal.classList.remove("hidden");
  }

  difficultyGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-btn");
    if (btn) setLevel(btn.dataset.level);
  });

  flagModeBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagModeBtn.classList.toggle("active", flagMode);
  });

  faceBtn.addEventListener("click", () => setLevel(levelKey));
  helpBtn.addEventListener("click", () => helpModal.classList.remove("hidden"));
  closeHelp.addEventListener("click", () => helpModal.classList.add("hidden"));
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) helpModal.classList.add("hidden");
  });
  closeEnd.addEventListener("click", () => endModal.classList.add("hidden"));
  playAgainBtn.addEventListener("click", () => setLevel(levelKey));

  setLevel("easy");
})();
