// Shared across the dashboard and every game (same origin, so localStorage
// is shared too). Local "who's playing" profile picking still lives in
// localStorage — it's just per-device player identity. Scores go to a
// shared Supabase table, so the leaderboard is global across every visitor.
(function () {
  const PROFILES_KEY = "gameland:profiles";
  const ACTIVE_KEY = "gameland:activeProfile";

  const SUPABASE_URL = "https://gzzwiqbekujrwhqvvwxv.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6endpcWJla3VqcndocXZ2d3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNDIyNTUsImV4cCI6MjEwMzgxODI1NX0.ACnEFC7mo9UDHh-L7JmNycKyP8ZlXn97xvrdPvEHWo8";

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // storage unavailable (private browsing, quota, etc.) — fail silently
    }
  }

  function getProfiles() {
    return readJSON(PROFILES_KEY, []);
  }

  function saveProfiles(list) {
    writeJSON(PROFILES_KEY, list);
  }

  function getActiveProfileId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function setActiveProfile(id) {
    try {
      localStorage.setItem(ACTIVE_KEY, id);
    } catch (e) {}
  }

  function getActiveProfile() {
    const id = getActiveProfileId();
    if (!id) return null;
    return getProfiles().find((p) => p.id === id) || null;
  }

  function createProfile(name) {
    const trimmed = (name || "").trim().slice(0, 24);
    if (!trimmed) return null;
    const profiles = getProfiles();
    const id = "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const profile = { id, name: trimmed, createdAt: Date.now() };
    profiles.push(profile);
    saveProfiles(profiles);
    setActiveProfile(id);
    return profile;
  }

  function deleteProfile(id) {
    saveProfiles(getProfiles().filter((p) => p.id !== id));
    if (getActiveProfileId() === id) localStorage.removeItem(ACTIVE_KEY);
  }

  // ---- Scores (global, via Supabase) ----

  async function recordScore(gameId, value, metric, difficulty) {
    const profile = getActiveProfile();
    if (!profile || typeof value !== "number" || !isFinite(value)) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          player_name: profile.name,
          game: gameId,
          value,
          metric,
          difficulty: difficulty || null,
        }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // Calendar-aligned reset boundaries, computed in Philippines time (UTC+8,
  // no DST) rather than rolling windows — "daily" resets at 12am PH today,
  // "weekly" at 12am PH the most recent Monday, "monthly" at 12am PH on the
  // 1st of the current month.
  const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

  function periodCutoff(period) {
    const phNow = new Date(Date.now() + PH_OFFSET_MS);
    const y = phNow.getUTCFullYear();
    const m = phNow.getUTCMonth();
    const d = phNow.getUTCDate();
    let phMidnightUtcMs;
    if (period === "weekly") {
      const dayOfWeek = phNow.getUTCDay(); // 0=Sun..6=Sat
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      phMidnightUtcMs = Date.UTC(y, m, d - daysSinceMonday);
    } else if (period === "monthly") {
      phMidnightUtcMs = Date.UTC(y, m, 1);
    } else {
      phMidnightUtcMs = Date.UTC(y, m, d);
    }
    return phMidnightUtcMs - PH_OFFSET_MS;
  }

  async function getLeaderboard(gameId, period, limit, difficulty) {
    const cutoffIso = new Date(periodCutoff(period)).toISOString();
    let url =
      `${SUPABASE_URL}/rest/v1/scores?select=player_name,value,metric,created_at` +
      `&game=eq.${encodeURIComponent(gameId)}` +
      `&created_at=gte.${encodeURIComponent(cutoffIso)}` +
      `&order=created_at.desc&limit=1000`;
    if (difficulty) url += `&difficulty=eq.${encodeURIComponent(difficulty)}`;

    let rows;
    try {
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) return { entries: [], error: true };
      rows = await res.json();
    } catch (e) {
      return { entries: [], error: true };
    }

    // Best score per player name within this window.
    const bestByPlayer = new Map();
    rows.forEach((s) => {
      const existing = bestByPlayer.get(s.player_name);
      const isBetter = !existing || (s.metric === "score" ? s.value > existing.value : s.value < existing.value);
      if (isBetter) bestByPlayer.set(s.player_name, s);
    });

    const list = [...bestByPlayer.values()].map((s) => ({
      name: s.player_name,
      value: s.value,
      metric: s.metric,
      timestamp: new Date(s.created_at).getTime(),
    }));

    list.sort((a, b) => (a.metric === "score" ? b.value - a.value : a.value - b.value));
    return { entries: list.slice(0, limit || 20), error: false };
  }

  function formatValue(value, metric) {
    if (metric === "score") return String(Math.round(value));
    const mm = String(Math.floor(value / 60)).padStart(2, "0");
    const ss = String(Math.floor(value % 60)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  }

  // Builds and wires a leaderboard modal for the given game, triggered by
  // the button at buttonId. Injected as plain DOM with inline styles driven
  // by the host page's own CSS custom properties, so it reuses that game's
  // color scheme without needing per-game leaderboard CSS.
  function initLeaderboard(options) {
    const gameId = options.gameId;
    const difficulties = options.difficulties || null; // e.g. [{key:"easy",label:"Easy"}, ...]
    const getCurrentDifficulty = options.getCurrentDifficulty;
    const btn = document.getElementById(options.buttonId || "leaderboard-btn");
    if (!btn) return;

    const difficultyTabsHtml = difficulties
      ? `<div class="lb-diff-tabs" style="display:flex;gap:6px;margin-bottom:10px;">` +
        difficulties
          .map(
            (d) =>
              `<button type="button" data-diff="${d.key}" style="flex:1;padding:5px 0;border-radius:999px;font-family:inherit;font-weight:600;font-size:0.76rem;cursor:pointer;background:transparent;">${d.label}</button>`
          )
          .join("") +
        `</div>`
      : "";

    // Fully self-contained via inline styles (only colors borrow the host
    // page's CSS vars, with fallbacks) — some games this mounts into, like
    // Pretty Bird, have no .modal/.modal-content classes of their own.
    const modal = document.createElement("div");
    modal.style.cssText =
      "display:none;position:fixed;inset:0;z-index:500;background:rgba(74,25,66,0.45);" +
      "align-items:center;justify-content:center;padding:20px;font-family:inherit;";
    modal.innerHTML = `
      <div style="position:relative;background:var(--surface,#fff);border-radius:18px;padding:26px 22px;max-width:380px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 16px 40px rgba(0,0,0,0.25);border:1px solid var(--border,#eee);">
        <button class="lb-close" aria-label="Close" style="position:absolute;top:12px;right:14px;background:none;border:none;font-size:1.4rem;color:var(--muted,#888);cursor:pointer;line-height:1;">&times;</button>
        <h2 style="margin:0 0 14px;font-size:1.2rem;font-weight:700;color:var(--pink-primary-dark,#b3106b);">🏆 Leaderboard</h2>
        ${difficultyTabsHtml}
        <div class="lb-tabs" style="display:flex;gap:6px;margin-bottom:14px;">
          <button type="button" data-period="daily" style="flex:1;padding:7px 0;border:none;border-radius:999px;font-family:inherit;font-weight:600;font-size:0.82rem;cursor:pointer;">Daily</button>
          <button type="button" data-period="weekly" style="flex:1;padding:7px 0;border:none;border-radius:999px;font-family:inherit;font-weight:600;font-size:0.82rem;cursor:pointer;">Weekly</button>
          <button type="button" data-period="monthly" style="flex:1;padding:7px 0;border:none;border-radius:999px;font-family:inherit;font-weight:600;font-size:0.82rem;cursor:pointer;">Monthly</button>
        </div>
        <div class="lb-list"></div>
        <p class="lb-note" style="margin:14px 0 0;font-size:0.78rem;color:var(--muted,#888);text-align:center;"></p>
      </div>
    `;
    document.body.appendChild(modal);
    const showModal = () => { modal.style.display = "flex"; };
    const hideModal = () => { modal.style.display = "none"; };

    const tabs = [...modal.querySelectorAll(".lb-tabs button")];
    const diffTabs = [...modal.querySelectorAll(".lb-diff-tabs button")];
    const listEl = modal.querySelector(".lb-list");
    const noteEl = modal.querySelector(".lb-note");
    let period = "daily";
    let difficulty = difficulties ? difficulties[0].key : null;
    let requestToken = 0;

    function paintTabs() {
      tabs.forEach((t) => {
        const active = t.dataset.period === period;
        t.style.color = active ? "#fff" : "var(--muted, #888)";
        t.style.background = active
          ? "linear-gradient(135deg, var(--pink-primary, #e91e8c), var(--pink-soft, #ff6fb0))"
          : "var(--key-bg, #f2f2f2)";
      });
      diffTabs.forEach((t) => {
        const active = t.dataset.diff === difficulty;
        t.style.color = active ? "var(--pink-primary-dark, #b3106b)" : "var(--muted, #888)";
        t.style.border = active
          ? "1.5px solid var(--pink-primary, #e91e8c)"
          : "1.5px solid var(--border, #eee)";
      });
    }

    async function render() {
      paintTabs();
      const myToken = ++requestToken;
      listEl.innerHTML = `<p style="text-align:center;color:var(--muted,#888);font-size:0.85rem;padding:24px 0;">Loading…</p>`;
      noteEl.textContent = "";

      const { entries, error } = await window.GamelandProfiles.getLeaderboard(gameId, period, 20, difficulty);
      if (myToken !== requestToken) return; // a newer tab switch superseded this request

      const active = window.GamelandProfiles.getActiveProfile();

      if (error) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--muted,#888);font-size:0.85rem;padding:24px 0;">Couldn't load the leaderboard — check your connection and try again.</p>`;
      } else if (!entries.length) {
        const periodLabel = period === "daily" ? "today" : period === "weekly" ? "this week" : "this month";
        listEl.innerHTML = `<p style="text-align:center;color:var(--muted,#888);font-size:0.85rem;padding:24px 0;">No scores yet ${periodLabel} — be the first!</p>`;
      } else {
        listEl.innerHTML = entries
          .map((e, i) => {
            const isMe = active && e.name === active.name;
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border,#eee);${isMe ? "background:rgba(233,30,99,0.08);border-radius:8px;" : ""}">
              <span style="width:22px;font-weight:700;color:var(--pink-primary-dark,#b3106b);">${i + 1}</span>
              <span style="flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(e.name)}${isMe ? " (you)" : ""}</span>
              <span style="font-variant-numeric:tabular-nums;color:var(--muted,#888);font-weight:600;">${window.GamelandProfiles.formatValue(e.value, e.metric)}</span>
            </div>`;
          })
          .join("");
      }

      if (!error && !active) {
        noteEl.textContent = "Create a profile from the Gameland dashboard to start showing up here.";
      }
    }

    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        period = t.dataset.period;
        render();
      });
    });

    diffTabs.forEach((t) => {
      t.addEventListener("click", () => {
        difficulty = t.dataset.diff;
        render();
      });
    });

    btn.addEventListener("click", () => {
      if (difficulties && getCurrentDifficulty) difficulty = getCurrentDifficulty();
      showModal();
      render();
    });
    modal.querySelector(".lb-close").addEventListener("click", hideModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideModal();
    });

    return { refresh: render };
  }

  window.GamelandProfiles = {
    getProfiles,
    getActiveProfile,
    setActiveProfile,
    createProfile,
    deleteProfile,
    recordScore,
    getLeaderboard,
    formatValue,
    escapeHtml,
    initLeaderboard,
  };
})();
