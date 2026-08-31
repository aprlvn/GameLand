// Add a new game by adding one entry to this array — the dashboard builds itself from it.
// preview: "bird" and "wordle" have built-in live-preview animations (see script.js).
// Leave preview out (or use an unrecognized value) to fall back to a plain icon card.
const GAMES = [
  {
    title: "Pretty Bird",
    tagline: "Tap, flap, don't crash",
    description: "A flappy little bird dodges cats and pipes in a cozy pastel sky. Simple to learn, hard to put down.",
    path: "games/pretty-bird/index.html",
    icon: "games/pretty-bird/images/bird1up.png",
    accent: "#2fb6c9",
    preview: "bird",
    previewAssets: {
      up: "games/pretty-bird/images/bird1up.png",
      down: "games/pretty-bird/images/bird1down.png",
      cats: [
        "games/pretty-bird/images/cat1.png",
        "games/pretty-bird/images/cat2.png",
        "games/pretty-bird/images/cat3.png",
        "games/pretty-bird/images/cat4.png",
      ],
    },
  },
  {
    title: "Wordle Land",
    tagline: "Guess the word, one bloom at a time",
    description: "The classic 5-letter word guessing game with a pink twist — hints, definitions, and a daily challenge.",
    path: "games/wordle-land/index.html",
    icon: "games/wordle-land/favicon-192.png",
    accent: "#ec4899",
    preview: "wordle",
    previewWord: "PINKY",
  },
];
