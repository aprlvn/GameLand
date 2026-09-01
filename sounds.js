// Lightweight synthesized sound effects (no audio files) shared by Tango,
// Queens, and Minesweeper — same approach Wordle Land already uses.
(function () {
  const STORAGE_KEY = "gameland:sound";
  let soundOn = localStorage.getItem(STORAGE_KEY) !== "off";
  let audioCtx = null;

  function getCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, duration, type, volume, delay) {
    if (!soundOn) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const start = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    } catch (e) {
      // audio unavailable — fail silently
    }
  }

  function playClick() {
    tone(760, 0.05, "sine", 0.09);
    tone(980, 0.035, "sine", 0.05, 0.025);
  }

  function playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, 0.26, "triangle", 0.16, i * 0.11));
  }

  function playLose() {
    [329.63, 293.66, 246.94, 196.0].forEach((freq, i) => tone(freq, 0.3, "sine", 0.13, i * 0.13));
  }

  function playError() {
    tone(220, 0.14, "sawtooth", 0.1);
    tone(180, 0.17, "sawtooth", 0.08, 0.08);
  }

  function setEnabled(value) {
    soundOn = !!value;
    try {
      localStorage.setItem(STORAGE_KEY, soundOn ? "on" : "off");
    } catch (e) {}
  }

  window.GamelandSound = {
    playClick,
    playWin,
    playLose,
    playError,
    setEnabled,
    isEnabled: () => soundOn,
  };
})();
