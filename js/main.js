/* ═══════════════════════════════════════════════════════════════════
   main.js — Application bootstrap & complete event wiring
   Connects: UI ↔ GameEngine ↔ AudioEngine ↔ Storage ↔ Achievements ↔ Profile
═══════════════════════════════════════════════════════════════════ */

(function bootstrap() {

  /* ── Init background systems ──────────────────────────────────── */
  ParticleSystem.init();

  /* ── Register Service Worker (PWA) ───────────────────────────── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  /* ── State ────────────────────────────────────────────────────── */
  let selectedLevel = 'easy';
  let selectedMode  = 'normal';
  let leaderboardLevel = 'easy';
  let previousScreen = 'intro';

  /* ════════════════════════════════════════════════════════════════
     THEME TOGGLE
  ════════════════════════════════════════════════════════════════ */
  const THEME_KEY = 'bodmas_theme';
  let isDark = localStorage.getItem(THEME_KEY) !== 'light';

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = dark ? '🌙' : '☀️';
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }
  applyTheme(isDark);

  document.getElementById('btn-theme').addEventListener('click', () => {
    isDark = !isDark;
    applyTheme(isDark);
    AudioEngine.play('click');
  });

  /* ════════════════════════════════════════════════════════════════
     ACHIEVEMENT TOAST
  ════════════════════════════════════════════════════════════════ */
  const achToast    = document.getElementById('achievement-toast');
  const achToastIcon = document.getElementById('ach-toast-icon');
  const achToastName = document.getElementById('ach-toast-name');
  let achToastTimer  = null;

  Achievements.onUnlock((def) => {
    achToastIcon.textContent = def.icon;
    achToastName.textContent = def.title;
    achToast.classList.add('show');
    AudioEngine.play('levelUp');

    clearTimeout(achToastTimer);
    achToastTimer = setTimeout(() => achToast.classList.remove('show'), 3500);
  });

  /* ════════════════════════════════════════════════════════════════
     SERVER STATUS CHECK
  ════════════════════════════════════════════════════════════════ */
  async function checkServerStatus() {
    if (!Storage.IS_SERVER) { UI.showServerStatus(false); return; }
    try {
      const res  = await fetch('api.php?action=summary');
      const json = await res.json();
      if (json.summary !== undefined) {
        UI.showServerStatus(true);
        await Storage.syncBestsFromServer();
        UI.showIntroBestScores();
      } else {
        UI.showServerStatus(false);
      }
    } catch (_) { UI.showServerStatus(false); }
  }

  /* ════════════════════════════════════════════════════════════════
     INTRO SETUP
  ════════════════════════════════════════════════════════════════ */
  UI.showIntroBestScores();
  checkServerStatus();

  const savedName = Storage.getPlayerName();
  if (savedName) UI.el.playerNameInput.value = savedName;

  if (!Storage.getSoundPref()) { AudioEngine.toggleMute(); UI.setSoundBtn(true); }
  UI.el.btnSound.addEventListener('click', () => {
    const nowMuted = AudioEngine.toggleMute();
    UI.setSoundBtn(nowMuted);
    Storage.setSoundPref(!nowMuted);
    if (!nowMuted) AudioEngine.play('click');
  });

  UI.el.levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      UI.el.levelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLevel = btn.dataset.level;
      AudioEngine.play('click');
    });
  });

  const MODE_DESCS = {
    normal:    'Full game with timer & lives. Score as high as possible!',
    practice:  'No timer, no lives — learn BODMAS at your own pace.',
    challenge: '60-second speed round: answer as many steps as you can!'
  };
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      selectedMode = tab.dataset.mode;
      document.getElementById('mode-desc').textContent = MODE_DESCS[selectedMode] || '';
      AudioEngine.play('click');
    });
  });

  UI.el.BtnStart.addEventListener('click', () => {
    const name = UI.el.playerNameInput.value.trim();
    if (name) Storage.setPlayerName(name);
    AudioEngine.play('click');
    startGame(selectedLevel, selectedMode);
  });

  UI.el.btnShowLeaderboard.addEventListener('click', () => { AudioEngine.play('click'); openLeaderboard('easy'); });

  /* ════════════════════════════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════════════════════════════ */
  UI.el.btnMenu.addEventListener('click', () => {
    AudioEngine.play('click');
    GameEngine.stopTimer();
    UI.showIntroBestScores();
    UI.showScreen('intro');
  });

  UI.el.btnRetry.addEventListener('click', () => {
    AudioEngine.play('click');
    startGame(selectedLevel, selectedMode);
  });

  UI.el.btnBackMenu.addEventListener('click', () => {
    AudioEngine.play('click');
    UI.showIntroBestScores();
    UI.showScreen('intro');
  });

  UI.el.btnResultsLB.addEventListener('click', () => { AudioEngine.play('click'); openLeaderboard(selectedLevel); });

  document.getElementById('btn-review-wrong').addEventListener('click', () => {
    AudioEngine.play('click');
    openWrongAnswerReview(GameEngine.getWrongAnswers());
  });

  // Haptics
  function vibrate(pattern = [50]) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  // Social Share
  document.getElementById('btn-share').addEventListener('click', () => {
    const res = GameEngine.getState().results;
    if (!res) return;
    const rank = Profile.getRankDetails();
    const text = `🎮 I just scored ${res.score} points on BODMAS Quest! 🏆\n` +
                 `Rank: ${rank.icon} ${rank.name} (Lvl ${rank.level})\n` +
                 `Accuracy: ${res.accuracy}%\n` +
                 `Mode: ${selectedMode.toUpperCase()}\n` +
                 `Try to beat me here: ${window.location.href}`;
    
    if (navigator.share) {
      navigator.share({ title: 'BODMAS Quest Result', text }).catch(() => copyToClipboard(text));
    } else {
      copyToClipboard(text);
    }
  });

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      UI.toast('📣 Result copied to clipboard!', 'success');
      AudioEngine.play('levelUp');
    });
  }

  /* ════════════════════════════════════════════════════════════════
     MODALS
  ════════════════════════════════════════════════════════════════ */
  function openReference() {
    document.getElementById('modal-reference').classList.add('open');
    AudioEngine.play('click');
  }
  function closeReference() {
    document.getElementById('modal-reference').classList.remove('open');
  }

  document.getElementById('btn-open-reference').addEventListener('click', openReference);
  document.getElementById('btn-open-reference-game').addEventListener('click', openReference);
  document.getElementById('btn-close-reference').addEventListener('click', closeReference);
  document.getElementById('modal-reference').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeReference();
  });

  function openWrongAnswerReview(wrongAnswers) {
    const body = document.getElementById('review-body');
    if (!wrongAnswers || wrongAnswers.length === 0) {
      body.innerHTML = '<p style="color:var(--correct);text-align:center;padding:20px">🎉 No mistakes! Perfect round!</p>';
    } else {
      const OP_NAMES = { bracket:'Brackets',power:'Orders',divide:'Division',multiply:'Multiplication',add:'Addition',subtract:'Subtraction' };
      body.innerHTML = wrongAnswers.map((w, i) => `
        <div class="review-item" style="animation-delay:${i*0.07}s">
          <div class="review-expr">${escapeHtml(w.expressionStr)}</div>
          <div class="review-answer">
            <span>You chose: <span class="review-wrong">${OP_NAMES[w.chosenOpType] || w.chosenOpType}</span></span>
            <span>Correct: <span class="review-correct">${OP_NAMES[w.correctOpType]} — ${escapeHtml(w.correctDisplay || '')}</span></span>
          </div>
          <div class="review-explanation">${escapeHtml(w.explanation || '')}</div>
        </div>
      `).join('');
    }
    document.getElementById('modal-review').classList.add('open');
  }

  document.getElementById('btn-close-review').addEventListener('click', () => {
    document.getElementById('modal-review').classList.remove('open');
  });

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ════════════════════════════════════════════════════════════════
     ACHIEVEMENTS / PROFILE
  ════════════════════════════════════════════════════════════════ */
  document.getElementById('btn-open-achievements').addEventListener('click', () => {
    AudioEngine.play('click');
    previousScreen = 'intro';
    openAchievements();
    UI.showScreen('achievements');
  });
  document.getElementById('btn-achievements-back').addEventListener('click', () => {
    AudioEngine.play('click');
    UI.showScreen(previousScreen);
  });

  function openAchievements() {
    const all = Achievements.getAll();
    const count = Achievements.getUnlockedCount();
    const total = Achievements.getTotalCount();
    document.getElementById('ach-count').textContent = count;
    document.getElementById('ach-total').textContent = total;
    document.getElementById('ach-progress-fill').style.width = `${(count/total)*100}%`;

    const grid = document.getElementById('ach-grid');
    grid.innerHTML = all.map((a, i) => {
      const locked = !a.unlocked;
      const secretHide = locked && a.secret;
      return `
        <div class="ach-card ${a.unlocked ? 'unlocked' : 'locked'}" role="listitem"
             title="${a.desc}" style="animation-delay:${i*0.04}s">
          <span class="ach-icon">${secretHide ? '❓' : a.icon}</span>
          <span class="ach-title">${secretHide ? '???' : a.title}</span>
          <span class="ach-desc">${secretHide ? 'Secret achievement' : a.desc}</span>
          ${a.unlocked ? '<span class="ach-unlocked-badge">✓</span>' : ''}
        </div>`;
    }).join('');
  }

  document.getElementById('btn-open-profile').addEventListener('click', () => {
    AudioEngine.play('click');
    previousScreen = 'intro';
    openProfile();
    UI.showScreen('profile');
  });
  document.getElementById('btn-profile-back').addEventListener('click', () => {
    AudioEngine.play('click');
    UI.showScreen(previousScreen);
  });

  function openProfile() {
    const stats = Profile.get();
    const rank  = Profile.getRankDetails();
    const name  = Storage.getPlayerName() || 'Player';
    const bests = Storage.getAllBests();
    const maxScore = Math.max(bests.easy||0, bests.medium||0, bests.hard||0, 1);

    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-joined').textContent = 'Playing since ' + new Date(stats.joinedAt || Date.now()).toLocaleDateString();

    document.getElementById('pstat-games').textContent    = stats.totalGames;
    document.getElementById('pstat-correct').textContent  = stats.totalCorrect;
    document.getElementById('pstat-accuracy').textContent = Profile.getOverallAccuracy() + '%';
    document.getElementById('pstat-avg-score').textContent= Profile.getAverageScore();
    document.getElementById('pstat-achievements').textContent = Achievements.getUnlockedCount() + '/' + Achievements.getTotalCount();
    document.getElementById('pstat-hints').textContent    = stats.totalHintsUsed;

    // Rank Details
    document.getElementById('profile-rank-icon').textContent = rank.icon;
    document.getElementById('profile-rank-name').textContent = rank.name;
    document.getElementById('profile-level-val').textContent = rank.level;
    document.getElementById('profile-xp-val').textContent   = `${stats.totalXP} / ${rank.nextRank ? rank.nextRank.minXP : '∞'} XP`;
    document.getElementById('profile-xp-fill').style.width  = `${rank.progress}%`;
    document.getElementById('profile-next-rank').textContent = rank.nextRank 
      ? `Next Rank: ${rank.nextRank.name} (at ${rank.nextRank.minXP} XP)`
      : '🌟 Max Rank Achieved!';

    ['easy','medium','hard'].forEach(lvl => {
      const score = bests[lvl] || 0;
      const elVal = document.getElementById(`plv-${lvl}`);
      const elBar = document.getElementById(`pbar-${lvl}`);
      if (elVal) elVal.textContent = score || '—';
      if (elBar) elBar.style.width = `${(score/maxScore)*100}%`;
    });
  }

  /* ════════════════════════════════════════════════════════════════
     LEADERBOARD
  ════════════════════════════════════════════════════════════════ */
  UI.el.btnLeaderboardBack.addEventListener('click', () => { AudioEngine.play('click'); UI.showScreen('intro'); });
  UI.el.lbTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      UI.el.lbTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      leaderboardLevel = tab.dataset.level;
      loadLeaderboard(leaderboardLevel);
      AudioEngine.play('click');
    });
  });

  function openLeaderboard(level) {
    leaderboardLevel = level || 'easy';
    UI.el.lbTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.level === leaderboardLevel);
      t.setAttribute('aria-selected', t.dataset.level === leaderboardLevel ? 'true' : 'false');
    });
    UI.showScreen('leaderboard');
    loadLeaderboard(leaderboardLevel);
  }

  async function loadLeaderboard(level) {
    UI.setLeaderboardLoading();
    const entries = await Storage.fetchLeaderboard(level);
    UI.renderLeaderboard(entries, Storage.IS_SERVER);
  }

  /* ════════════════════════════════════════════════════════════════
     CORE GAME ENGINE BINDINGS
  ════════════════════════════════════════════════════════════════ */
  UI.el.btnNext.addEventListener('click', () => {
    AudioEngine.play('click');
    UI.hideFeedback();
    document.getElementById('btn-hint').disabled = false;
    document.getElementById('btn-hint').classList.remove('used');
    GameEngine.advanceStep();
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    const opType = GameEngine.useHint();
    if (!opType) return;
    AudioEngine.play('click');
    const b = document.getElementById('btn-hint');
    b.disabled = true;
    b.classList.add('used');
    b.textContent = '💡 Hint used!';
    const correctBtn = document.querySelector(`.choice-btn[data-op="${opType}"]`);
    if (correctBtn) {
      correctBtn.style.boxShadow = '0 0 25px rgba(245,158,11,0.8)';
      correctBtn.style.borderColor = '#f59e0b';
      setTimeout(() => { if (correctBtn) { correctBtn.style.boxShadow = ''; correctBtn.style.borderColor = ''; } }, 2000);
    }
    UI.setScore(GameEngine.getScore());
    Achievements.check({ type: 'hint_used' }, {});
  });

  function startGame(level, mode) {
    selectedLevel = level;
    selectedMode  = mode;
    GameEngine.init(level, mode);

    const hintBtn = document.getElementById('btn-hint');
    hintBtn.disabled = false;
    hintBtn.classList.remove('used');
    hintBtn.innerHTML = '💡 Hint <span class="hint-cost">−5 pts</span>';

    const timerWrap     = document.getElementById('timer-wrap');
    const challengeWrap = document.getElementById('challenge-timer-wrap');
    const modeBadge     = document.getElementById('hud-mode-badge');
    timerWrap.style.display     = mode === 'normal' ? '' : 'none';
    challengeWrap.style.display = mode === 'challenge' ? '' : 'none';
    modeBadge.className = `mode-badge mode-badge-${mode}`;
    modeBadge.textContent = mode === 'practice' ? 'PRACTICE' : mode === 'challenge' ? '⏱️ CHALLENGE' : '';

    GameEngine.on('questionLoaded', ({ question, index }) => {
      UI.clearHistory();
      UI.renderExpression(question.tokens);
      const displayIndex = mode === 'challenge' ? GameEngine.getScore() : index + 1;
      const displayTotal = mode === 'challenge' ? '∞' : GameEngine.getTotalQuestions();
      UI.setQuestion(displayIndex, displayTotal);
      if (mode !== 'challenge') UI.setProgress(index, GameEngine.getTotalQuestions());
      renderCurrentStep(question.steps[0]);
    });

    GameEngine.on('timerTick', ({ value, max }) => UI.setTimer(value, max));
    GameEngine.on('challengeTick', ({ value }) => {
      const el = document.getElementById('challenge-timer-val');
      if (el) { el.textContent = value; el.className = 'challenge-timer-val ' + (value > 20 ? 'ok' : value > 10 ? 'warn' : 'danger'); }
    });

    GameEngine.on('correct', ({ step, earned, streak }) => {
      AudioEngine.play('correct');
      UI.disableChoices();
      UI.flashCard('correct');
      UI.animateCorrectGroup(step.correctGroup);
      UI.setScore(GameEngine.getScore());
      UI.setStreak(streak);
      if (step.expressionAfter) UI.appendHistory(GameEngine.getStepIndex() + 1, step.expressionAfter);
      UI.showFeedback({ isCorrect: true, explanation: step.explanation, earned, streak });
      Achievements.check({ type: 'correct' }, { timeLeft: GameEngine.getState().timerValue, timerMax: GameEngine.getState().timerMax, streak });
    });

    GameEngine.on('wrong', ({ step }) => {
      AudioEngine.play('wrong');
      UI.disableChoices();
      UI.flashCard('wrong');
      UI.setStreak(0);
      if (GameEngine.getState().mcfg.livesEnabled) UI.setLives(GameEngine.getLives(), GameEngine.getState().cfg.livesStart);
      UI.markCorrectChoice(step.correctOpType);
      UI.showFeedback({ isCorrect: false, explanation: step.explanation });
      vibrate([100, 50, 100]);
    });

    GameEngine.on('timeUp', ({ step }) => {
      AudioEngine.play('wrong');
      UI.disableChoices();
      UI.flashCard('wrong');
      UI.setStreak(0);
      UI.setLives(GameEngine.getLives(), GameEngine.getState().cfg.livesStart);
      UI.showFeedback({ isTimeUp: true, isCorrect: false, explanation: step ? `Time ran out!` : '' });
    });

    GameEngine.on('gameOver', async (results) => {
      AudioEngine.play(results.accuracy >= 60 ? 'levelUp' : 'gameOver');
      Profile.record({ ...results, mode });
      Achievements.check({ type: 'game_over' }, { ...results, mode, hintsUsed: GameEngine.getHintsUsed() });
      const playerName = Storage.getPlayerName() || 'Anonymous';
      document.getElementById('btn-review-wrong').style.display = (results.wrongAnswers?.length > 0) ? '' : 'none';
      setTimeout(() => UI.showResults({ ...results, playerName }), 400);

      if (Storage.IS_SERVER) {
        UI.showSubmitSection(playerName);
        try {
          const res = await Storage.submitScore({ name: playerName, score: results.score, level, accuracy: results.accuracy, streak: results.bestStreak });
          if (res?.success) { UI.updateSubmitStatus(true, res.rank); UI.toast(`🏆 Leaderboard: #${res.rank}`, 'success'); }
        } catch (_) {}
      } else {
        Storage.submitScore({ name: playerName, score: results.score, level, accuracy: results.accuracy, streak: results.bestStreak });
      }
    });

    const c = GameEngine.getState().cfg;
    UI.setHudLevel(level);
    UI.setScore(0);
    UI.setLives(mode === 'normal' ? c.livesStart : 99, mode === 'normal' ? c.livesStart : 99);
    UI.setStreak(0);
    UI.setTimer(mode === 'normal' ? c.timerMax : 0, mode === 'normal' ? c.timerMax : 0);
    UI.showScreen('game');
    GameEngine.start();
  }

  function renderCurrentStep(step) {
    UI.highlightPill(step.correctOpType);
    UI.renderChoices(step.groups, (type, btn) => {
      GameEngine.submitAnswer(type);
      UI.markChoiceResult(btn, QuestionGenerator.PRIORITY[type] === QuestionGenerator.PRIORITY[step.correctOpType]);
    });
  }

})();
