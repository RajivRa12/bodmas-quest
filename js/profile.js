/* ═══════════════════════════════════════════════════════════════
   profile.js — Player stats tracking with localStorage
═══════════════════════════════════════════════════════════════ */

const Profile = (() => {

  const KEY = 'bodmas_profile_stats';

  const DEFAULT = {
    totalGames:   0,
    totalCorrect: 0,
    totalAnswers: 0,
    totalScore:   0,
    gamesPerLevel:  { easy: 0, medium: 0, hard: 0 },
    gamesPerMode:   { normal: 0, practice: 0, challenge: 0 },
    bestScores:     { easy: 0, medium: 0, hard: 0 },
    bestStreaks:    { easy: 0, medium: 0, hard: 0 },
    bestAccuracy:  { easy: 0, medium: 0, hard: 0 },
    totalHintsUsed: 0,
    joinedAt: Date.now()
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
    } catch (_) { return { ...DEFAULT }; }
  }

  function save(stats) {
    try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (_) {}
  }

  function record({ score, correctCount, totalAnswers, accuracy, bestStreak, level, mode, hintsUsed }) {
    const s = load();

    s.totalGames++;
    s.totalCorrect  += correctCount;
    s.totalAnswers  += totalAnswers;
    s.totalScore    += score;
    s.totalHintsUsed += (hintsUsed || 0);

    s.gamesPerLevel  = s.gamesPerLevel  || {};
    s.gamesPerMode   = s.gamesPerMode   || {};
    s.bestScores     = s.bestScores     || {};
    s.bestStreaks    = s.bestStreaks    || {};
    s.bestAccuracy   = s.bestAccuracy   || {};

    s.gamesPerLevel[level] = (s.gamesPerLevel[level] || 0) + 1;
    s.gamesPerMode[mode]   = (s.gamesPerMode[mode]   || 0) + 1;

    if (score      > (s.bestScores[level]   || 0)) s.bestScores[level]   = score;
    if (bestStreak > (s.bestStreaks[level]  || 0)) s.bestStreaks[level]  = bestStreak;
    if (accuracy   > (s.bestAccuracy[level] || 0)) s.bestAccuracy[level] = accuracy;

    save(s);
    return s;
  }

  function get() { return load(); }

  function getOverallAccuracy() {
    const s = load();
    if (!s.totalAnswers) return 0;
    return Math.round((s.totalCorrect / s.totalAnswers) * 100);
  }

  function getAverageScore() {
    const s = load();
    if (!s.totalGames) return 0;
    return Math.round(s.totalScore / s.totalGames);
  }

  return { record, get, getOverallAccuracy, getAverageScore };
})();
