const grid = document.getElementById("game-grid");

function buildBirdPreview(cover, game) {
  cover.classList.add("preview-bird");
  const assets = game.previewAssets || {};
  const cats = assets.cats || [];

  const track = document.createElement("div");
  track.className = "bird-pipes";

  // Mirrors the real game: obstacles are cat sprites, clipped so the face
  // sits right at the gap — the bottom cat upright, the top cat flipped.
  const pipeConfigs = [
    { top: 46, bottom: 54, catTop: 0, catBottom: 1 },
    { top: 70, bottom: 40, catTop: 2, catBottom: 3 },
  ];

  pipeConfigs.forEach((cfg) => {
    const set = document.createElement("div");
    set.className = "bird-pipe-set";

    const top = document.createElement("div");
    top.className = "bird-pipe bird-pipe-top";
    top.style.height = cfg.top + "px";
    const topCat = cats[cfg.catTop % cats.length];
    if (topCat) {
      const img = document.createElement("img");
      img.src = topCat;
      img.alt = "";
      top.appendChild(img);
    }

    const bottom = document.createElement("div");
    bottom.className = "bird-pipe bird-pipe-bottom";
    bottom.style.height = cfg.bottom + "px";
    const bottomCat = cats[cfg.catBottom % cats.length];
    if (bottomCat) {
      const img = document.createElement("img");
      img.src = bottomCat;
      img.alt = "";
      bottom.appendChild(img);
    }

    set.appendChild(top);
    set.appendChild(bottom);
    track.appendChild(set);
  });
  cover.appendChild(track);

  const bird = document.createElement("img");
  bird.className = "bird-sprite";
  bird.src = assets.up || game.icon;
  bird.alt = "";
  cover.appendChild(bird);

  const tap = document.createElement("span");
  tap.className = "tap-cursor tap-cursor-bird";
  tap.textContent = "👆";
  cover.appendChild(tap);

  if (assets.up && assets.down) {
    let flapped = false;
    setInterval(() => {
      flapped = !flapped;
      bird.src = flapped ? assets.down : assets.up;
    }, 260);
  }
}

function buildWordlePreview(cover, game) {
  cover.classList.add("preview-wordle");
  const word = (game.previewWord || "PINKY").toUpperCase();

  const row = document.createElement("div");
  row.className = "wordle-row";
  const tiles = [...word].map((letter) => {
    const tile = document.createElement("div");
    tile.className = "wordle-tile";
    tile.textContent = letter;
    row.appendChild(tile);
    return tile;
  });
  cover.appendChild(row);

  const tap = document.createElement("span");
  tap.className = "tap-cursor tap-cursor-row";
  tap.textContent = "👆";
  row.appendChild(tap);

  runTileCycle(tiles, tap);
}

function runTileCycle(tiles, tap) {
  const FLIP_GAP = 220;
  const HOLD = 1400;
  const RESET_PAUSE = 500;

  function runCycle() {
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("flip");
        tap.style.setProperty("--tap-index", i);
      }, i * FLIP_GAP);
    });
    const totalFlip = tiles.length * FLIP_GAP + HOLD;
    setTimeout(() => {
      tiles.forEach((tile) => tile.classList.remove("flip"));
    }, totalFlip);
    setTimeout(runCycle, totalFlip + RESET_PAUSE);
  }

  setTimeout(runCycle, 400);
}

function buildTangoPreview(cover, game) {
  cover.classList.add("preview-tango");
  const symbols = ["💗", "⭐", "💗", "⭐"];

  const row = document.createElement("div");
  row.className = "tango-row";
  const tiles = symbols.map((sym) => {
    const tile = document.createElement("div");
    tile.className = "tango-tile";
    tile.textContent = sym;
    row.appendChild(tile);
    return tile;
  });
  cover.appendChild(row);

  const tap = document.createElement("span");
  tap.className = "tap-cursor tap-cursor-row";
  tap.textContent = "👆";
  row.appendChild(tap);

  runTileCycle(tiles, tap);
}

function buildQueensPreview(cover, game) {
  cover.classList.add("preview-queens");
  const colors = ["#ffd6e8", "#e4d4ff", "#ffdcc2", "#cfd8ff"];
  const regions = [
    [0, 0, 1, 1],
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [2, 2, 3, 3],
  ];
  const crownSpots = [
    [0, 1],
    [1, 3],
    [3, 0],
  ];

  const gridEl = document.createElement("div");
  gridEl.className = "queens-grid";
  const cellEls = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const cell = document.createElement("div");
      cell.className = "queens-cell";
      cell.style.background = colors[regions[r][c]];
      cell.innerHTML = `<span class="crown">👑</span>`;
      gridEl.appendChild(cell);
      cellEls.push(cell);
    }
  }
  cover.appendChild(gridEl);

  const tap = document.createElement("span");
  tap.className = "tap-cursor";
  tap.textContent = "👆";
  tap.style.top = "-20px";
  tap.style.left = "0px";
  tap.style.opacity = "0";
  tap.style.transition = "left 0.2s ease, top 0.2s ease, opacity 0.2s ease";
  gridEl.style.position = "relative";
  gridEl.appendChild(tap);

  const STEP = 650;
  const HOLD = 1200;
  const RESET_PAUSE = 500;

  function runCycle() {
    crownSpots.forEach(([r, c], i) => {
      setTimeout(() => {
        cellEls[r * 4 + c].classList.add("placed");
        tap.style.left = `${c * 22}px`;
        tap.style.top = `${r * 22 - 20}px`;
        tap.style.opacity = "1";
      }, i * STEP);
    });
    const total = crownSpots.length * STEP + HOLD;
    setTimeout(() => {
      cellEls.forEach((cell) => cell.classList.remove("placed"));
      tap.style.opacity = "0";
    }, total);
    setTimeout(runCycle, total + RESET_PAUSE);
  }

  setTimeout(runCycle, 400);
}

function buildMinesweeperPreview(cover, game) {
  cover.classList.add("preview-minesweeper");
  const order = [
    [2, 2], [2, 1], [2, 3], [1, 2], [3, 2],
    [1, 1], [1, 3], [3, 1], [3, 3], [0, 2],
  ];
  const numbers = { "1,1": 1, "1,3": 2, "3,1": 1, "3,3": 3 };
  const pawSpot = "0,2";

  const gridEl = document.createElement("div");
  gridEl.className = "mine-grid";
  const cellEls = {};
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement("div");
      cell.className = "mine-cell";
      gridEl.appendChild(cell);
      cellEls[`${r},${c}`] = cell;
    }
  }
  cover.appendChild(gridEl);

  const tap = document.createElement("span");
  tap.className = "tap-cursor";
  tap.textContent = "👆";
  tap.style.top = "-20px";
  tap.style.left = "0px";
  tap.style.opacity = "0";
  tap.style.transition = "left 0.2s ease, top 0.2s ease, opacity 0.2s ease";
  gridEl.style.position = "relative";
  gridEl.appendChild(tap);

  const STEP = 160;
  const HOLD = 1500;
  const RESET_PAUSE = 500;

  function runCycle() {
    order.forEach(([r, c], i) => {
      setTimeout(() => {
        const key = `${r},${c}`;
        const cell = cellEls[key];
        cell.classList.add("revealed");
        if (key === pawSpot) {
          cell.innerHTML = `<svg class="mini-paw" viewBox="0 0 24 24"><ellipse cx="12" cy="16.5" rx="6" ry="5" fill="#f2994a"/><circle cx="5.8" cy="8.2" r="2.6" fill="#f2994a"/><circle cx="11" cy="5.2" r="2.6" fill="#f2994a"/><circle cx="16.6" cy="6.4" r="2.6" fill="#f2994a"/></svg>`;
        } else if (numbers[key]) {
          cell.classList.add(`n${numbers[key]}`);
          cell.textContent = numbers[key];
        }
        tap.style.left = `${c * 24}px`;
        tap.style.top = `${r * 24 - 20}px`;
        tap.style.opacity = "1";
      }, i * STEP);
    });
    const total = order.length * STEP + HOLD;
    setTimeout(() => {
      Object.values(cellEls).forEach((cell) => {
        cell.className = "mine-cell";
        cell.innerHTML = "";
      });
      tap.style.opacity = "0";
    }, total);
    setTimeout(runCycle, total + RESET_PAUSE);
  }

  setTimeout(runCycle, 400);
}

function createCard(game) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = game.path;
  card.style.setProperty("--accent", game.accent || "#e63d97");

  const cover = document.createElement("div");
  cover.className = "card-cover";

  if (game.preview === "bird") {
    buildBirdPreview(cover, game);
  } else if (game.preview === "wordle") {
    buildWordlePreview(cover, game);
  } else if (game.preview === "tango") {
    buildTangoPreview(cover, game);
  } else if (game.preview === "queens") {
    buildQueensPreview(cover, game);
  } else if (game.preview === "minesweeper") {
    buildMinesweeperPreview(cover, game);
  } else if (game.background) {
    cover.style.backgroundImage = `url("${game.background}")`;
  }

  const icon = document.createElement("img");
  icon.className = "card-icon";
  icon.src = game.icon;
  icon.alt = "";
  cover.appendChild(icon);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <h2 class="card-title">${game.title}</h2>
    <p class="card-tagline">${game.tagline}</p>
    <p class="card-description">${game.description}</p>
    <span class="play-btn">Play now →</span>
  `;

  card.appendChild(cover);
  card.appendChild(body);
  return card;
}

function createComingSoonCard() {
  const card = document.createElement("div");
  card.className = "card card-placeholder";
  card.innerHTML = `
    <div class="placeholder-icon">✨</div>
    <p class="placeholder-text">More games coming soon</p>
  `;
  return card;
}

GAMES.forEach((game) => grid.appendChild(createCard(game)));
grid.appendChild(createComingSoonCard());
