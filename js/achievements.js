/* ═══════════════════════════════════════════════════════════════
   achievements.js — Badge system with localStorage persistence
═══════════════════════════════════════════════════════════════ */

const Achievements = (() => {

  const KEY = 'bodmas_achievements';

  /* ── All achievement definitions ────────────────────────────── */
  const DEFS = [
    { id: 'first_correct',  icon: '🎯', title: 'First Blood',      desc: 'Get your first correct answer',               secret: false },
    { id: 'speed_demon',    icon: '⚡', title: 'Speed Demon',      desc: 'Answer correctly in under 3 seconds',          secret: false },
    { id: 'on_fire',        icon: '🔥', title: 'On Fire',          desc: 'Get 5 correct answers in a row',               secret: false },
    { id: 'combo_king',     icon: '👑', title: 'Combo King',       desc: 'Achieve a 10-answer streak',                   secret: false },
    { id: 'perfect_game',   icon: '💎', title: 'Perfect Game',     desc: '100% accuracy in any game',                    secret: false },
    { id: 'bodmas_legend',  icon: '🏆', title: 'BODMAS Legend',    desc: '100% accuracy on Hard level',                  secret: false },
    { id: 'no_hints',       icon: '🧠', title: 'No Hints Needed',  desc: 'Complete a game without using any hints',      secret: false },
    { id: 'hint_user',      icon: '💡', title: 'Smart Hint',       desc: 'Use your first hint',                          secret: false },
    { id: 'scholar',        icon: '📚', title: 'Scholar',           desc: 'Complete 10 games total',                      secret: false },
    { id: 'challenger',     icon: '⏱️', title: 'Challenge Master', desc: 'Score 50+ points in Challenge mode',           secret: false },
    { id: 'practitioner',   icon: '🌱', title: 'Practitioner',     desc: 'Complete a Practice mode session',             secret: false },
    { id: 'comeback',       icon: '🦅', title: 'Comeback Kid',     desc: 'Answer correctly after 2 wrong answers',       secret: true  },
    { id: 'graduate',       icon: '🎓', title: 'Graduate',         desc: 'Play all three difficulty levels',             secret: false },
    { id: 'night_owl',      icon: '🦉', title: 'Night Owl',        desc: 'Play after 10 PM',                             secret: true  },
  ];

  /* ── State ───────────────────────────────────────────────────── */
  let unlocked = {};

  function load() {
    try { unlocked = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { unlocked = {}; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(unlocked)); } catch (_) {}
  }

  load();

  /* ── Check & unlock ──────────────────────────────────────────── */
  let onUnlockCb = null;
  function onUnlock(cb) { onUnlockCb = cb; }

  function unlock(id) {
    if (unlocked[id]) return false; // already unlocked
    const def = DEFS.find(d => d.id === id);
    if (!def) return false;
    unlocked[id] = { unlockedAt: Date.now() };
    save();
    if (onUnlockCb) onUnlockCb(def);
    return true;
  }

  function isUnlocked(id) { return !!unlocked[id]; }

  /* ── Check all conditions after each game action ────────────── */
  function check(event, data) {
    const { type } = event;

    switch (type) {
      case 'correct':
        unlock('first_correct');
        if (data.timeLeft !== undefined && data.timeLeft >= (data.timerMax - 3)) {
          unlock('speed_demon');
        }
        if (data.streak >= 5)  unlock('on_fire');
        if (data.streak >= 10) unlock('combo_king');
        if (data.consecutiveWrong >= 2) unlock('comeback');
        break;

      case 'game_over':
        if (data.accuracy === 100) {
          unlock('perfect_game');
          if (data.level === 'hard') unlock('bodmas_legend');
        }
        if (!data.hintsUsed)         unlock('no_hints');
        if (data.mode === 'challenge' && data.score >= 50) unlock('challenger');
        if (data.mode === 'practice') unlock('practitioner');

        // Scholar: track game count
        const gc = (parseInt(localStorage.getItem('bodmas_game_count') || '0')) + 1;
        localStorage.setItem('bodmas_game_count', gc);
        if (gc >= 10) unlock('scholar');

        // Graduate: track levels played
        const lp = JSON.parse(localStorage.getItem('bodmas_levels_played') || '[]');
        if (!lp.includes(data.level)) lp.push(data.level);
        localStorage.setItem('bodmas_levels_played', JSON.stringify(lp));
        if (lp.length >= 3) unlock('graduate');
        break;

      case 'hint_used':
        unlock('hint_user');
        break;

      case 'session_start':
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 4) unlock('night_owl');
        break;
    }
  }

  /* ── Get all with unlock status ─────────────────────────────── */
  function getAll() {
    return DEFS.map(d => ({
      ...d,
      unlocked:    !!unlocked[d.id],
      unlockedAt:  unlocked[d.id]?.unlockedAt || null
    }));
  }

  function getUnlockedCount() { return Object.keys(unlocked).length; }
  function getTotalCount()    { return DEFS.length; }

  return { check, unlock, isUnlocked, onUnlock, getAll, getUnlockedCount, getTotalCount };
})();
