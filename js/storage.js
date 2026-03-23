/* ═══════════════════════════════════════════════════════════════
   storage.js — Unified storage layer
   Priority: PHP backend → localStorage fallback
   Auto-detects whether app is served from a PHP server.
═══════════════════════════════════════════════════════════════ */

const Storage = (() => {

  /* ── Config ──────────────────────────────────────────────────── */
  const KEY_SCORES  = 'bodmas_best_scores';
  const KEY_SOUND   = 'bodmas_sound';
  const KEY_NAME    = 'bodmas_player_name';
  const API_URL     = 'api.php';

  /**
   * Detect if we are running on a real HTTP server (PHP available)
   * or from a local file:// URL (PHP unavailable).
   */
  const IS_SERVER = location.protocol === 'http:' || location.protocol === 'https:';

  /* ══════════════════════════════════════════════════════════════
     PHP API helpers
  ══════════════════════════════════════════════════════════════ */

  /**
   * Fetch leaderboard from PHP for a given level.
   * Returns an array of entry objects or [].
   */
  async function fetchLeaderboard(level) {
    if (!IS_SERVER) return [];
    try {
      const res  = await fetch(`${API_URL}?action=leaderboard&level=${level}`);
      const json = await res.json();
      return json.leaderboard || [];
    } catch (_) { return []; }
  }

  /**
   * Submit a score to the PHP backend.
   * Returns { success, rank } or null.
   */
  async function submitScore({ name, score, level, accuracy, streak }) {
    // Always persist in localStorage immediately
    _saveLocalBest(level, score);

    if (!IS_SERVER) return null;
    try {
      const res  = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', name, score, level, accuracy, streak })
      });
      return await res.json();
    } catch (_) { return null; }
  }

  /**
   * Get the server-side best score for a level.
   */
  async function fetchServerBest(level) {
    if (!IS_SERVER) return 0;
    try {
      const res  = await fetch(`${API_URL}?action=best&level=${level}`);
      const json = await res.json();
      return json.best || 0;
    } catch (_) { return 0; }
  }

  /* ══════════════════════════════════════════════════════════════
     localStorage helpers (always available, used as fallback)
  ══════════════════════════════════════════════════════════════ */

  function _saveLocalBest(level, score) {
    try {
      const data  = JSON.parse(localStorage.getItem(KEY_SCORES) || '{}');
      if (score > (data[level] || 0)) {
        data[level] = score;
        localStorage.setItem(KEY_SCORES, JSON.stringify(data));
        return true;
      }
      return false;
    } catch (_) { return false; }
  }

  function getBest(level) {
    try {
      const data = JSON.parse(localStorage.getItem(KEY_SCORES) || '{}');
      return data[level] || 0;
    } catch (_) { return 0; }
  }

  function getAllBests() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SCORES) || '{}');
    } catch (_) { return {}; }
  }

  /**
   * Sync local bests from server (call this on app load if server available).
   */
  async function syncBestsFromServer() {
    if (!IS_SERVER) return;
    try {
      const res  = await fetch(`${API_URL}?action=summary`);
      const json = await res.json();
      if (json.summary) {
        const local = JSON.parse(localStorage.getItem(KEY_SCORES) || '{}');
        ['easy', 'medium', 'hard'].forEach(lvl => {
          if ((json.summary[lvl] || 0) > (local[lvl] || 0)) {
            local[lvl] = json.summary[lvl];
          }
        });
        localStorage.setItem(KEY_SCORES, JSON.stringify(local));
      }
    } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════════════
     Sound preference
  ══════════════════════════════════════════════════════════════ */
  function getSoundPref()      { return localStorage.getItem(KEY_SOUND) !== 'off'; }
  function setSoundPref(on)    { localStorage.setItem(KEY_SOUND, on ? 'on' : 'off'); }

  /* ══════════════════════════════════════════════════════════════
     Player name
  ══════════════════════════════════════════════════════════════ */
  function getPlayerName()     { return localStorage.getItem(KEY_NAME) || ''; }
  function setPlayerName(name) { localStorage.setItem(KEY_NAME, name.slice(0, 20)); }

  /* ── Public API ──────────────────────────────────────────────── */
  return {
    IS_SERVER,
    getBest,
    getAllBests,
    fetchLeaderboard,
    fetchServerBest,
    submitScore,
    syncBestsFromServer,
    getSoundPref,
    setSoundPref,
    getPlayerName,
    setPlayerName
  };
})();
