/* ═══════════════════════════════════════════════════════════════════
   profile.js — Player statistics, XP, and Leveling
═══════════════════════════════════════════════════════════════════ */

const Profile = (() => {
  const KEY = 'bodmas_profile';
  const DEFAULT = {
    joinedAt: Date.now(),
    totalGames: 0,
    totalCorrect: 0,
    totalAnswers: 0,
    totalScore: 0,
    totalHintsUsed: 0,
    totalXP: 0,
    bestScores:   { easy:0, medium:0, hard:0 },
    bestStreaks:  { easy:0, medium:0, hard:0 },
    bestAccuracy: { easy:0, medium:0, hard:0 },
    gamesPerLevel:{ easy:0, medium:0, hard:0 },
    gamesPerMode: { normal:0, practice:0, challenge:0 }
  };

  let stats = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
    } catch (_) { return { ...DEFAULT }; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch (_) {}
  }

  function record(results) {
    const { score, correctCount, totalAnswers, bestStreak, level, mode, hintsUsed } = results;

    stats.totalGames++;
    stats.totalCorrect  += correctCount;
    stats.totalAnswers  += totalAnswers;
    stats.totalScore    += score;
    stats.totalHintsUsed += (hintsUsed || 0);
    stats.totalXP       += score;

    stats.gamesPerLevel[level] = (stats.gamesPerLevel[level] || 0) + 1;
    stats.gamesPerMode[mode]   = (stats.gamesPerMode[mode]   || 0) + 1;

    if (score      > (stats.bestScores[level]   || 0)) stats.bestScores[level]   = score;
    if (bestStreak > (stats.bestStreaks[level]  || 0)) stats.bestStreaks[level]  = bestStreak;
    
    const acc = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0;
    if (acc > (stats.bestAccuracy[level] || 0)) stats.bestAccuracy[level] = acc;

    save();
  }

  /* ── Level & Rank Logic ────────────────────────────────────────── */
  const RANKS = [
    { minXP: 0,      name: 'Novice',        icon: '🌱' },
    { minXP: 250,    name: 'Student',       icon: '📚' },
    { minXP: 750,    name: 'Scholar',       icon: '🎓' },
    { minXP: 1500,   name: 'Mathlete',      icon: '🏃' },
    { minXP: 3000,   name: 'Tactician',     icon: '♟️' },
    { minXP: 5000,   name: 'Strategist',    icon: '🗺️' },
    { minXP: 8000,   name: 'Mathematician', icon: '🧪' },
    { minXP: 12000,  name: 'BODMAS Master', icon: '👑' },
    { minXP: 25000,  name: 'Math Guru',     icon: '🧘' },
    { minXP: 50000,  name: 'Architect',     icon: '🏗️' }
  ];

  function getRankDetails() {
    const xp   = stats.totalXP || 0;
    const rank = RANKS.slice().reverse().find(r => xp >= r.minXP) || RANKS[0];
    const level = Math.floor(Math.sqrt(xp / 20)) + 1;
    
    const nextIdx = RANKS.findIndex(r => xp < r.minXP);
    const nextRank = nextIdx !== -1 ? RANKS[nextIdx] : null;
    const progress = nextRank ? Math.round(((xp - rank.minXP) / (nextRank.minXP - rank.minXP)) * 100) : 100;

    return { ...rank, level, nextRank, progress };
  }

  function get() { return stats; }

  function getOverallAccuracy() {
    if (stats.totalAnswers === 0) return 0;
    return Math.round((stats.totalCorrect / stats.totalAnswers) * 100);
  }

  function getAverageScore() {
    if (stats.totalGames === 0) return 0;
    return Math.round(stats.totalScore / stats.totalGames);
  }

  return { get, record, getRankDetails, getOverallAccuracy, getAverageScore };
})();
