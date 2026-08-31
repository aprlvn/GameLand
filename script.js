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
  tap.className = "tap-cursor tap-cursor-wordle";
  tap.textContent = "👆";
  row.appendChild(tap);

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
