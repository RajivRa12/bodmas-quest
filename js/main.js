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
  let previousScreen = 'intro'; // for back-from-modal

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

  // Sound pref
  if (!Storage.getSoundPref()) { AudioEngine.toggleMute(); UI.setSoundBtn(true); }
  UI.el.btnSound.addEventListener('click', () => {
    const nowMuted = AudioEngine.toggleMute();
    UI.setSoundBtn(nowMuted);
    Storage.setSoundPref(!nowMuted);
    if (!nowMuted) AudioEngine.play('click');
  });

  // Level selection
  UI.el.levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      UI.el.levelBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLevel = btn.dataset.level;
      AudioEngine.play('click');
    });
  });

  // Mode selection
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

  // Start game
  UI.el.BtnStart.addEventListener('click', () => {
    const name = UI.el.playerNameInput.value.trim();
    if (name) Storage.setPlayerName(name);
    AudioEngine.play('click');
    Achievements.check({ type: 'session_start' }, {});
    startGame(selectedLevel, selectedMode);
  });

  // Intro leaderboard
  UI.el.btnShowLeaderboard.addEventListener('click', () => { AudioEngine.play('click'); openLeaderboard('easy'); });

  /* ════════════════════════════════════════════════════════════════
     NAVIGATION — HUD & RESULTS
  ════════════════════════════════════════════════════════════════ */
  UI.el.btnMenu.addEventListener('click', () => {
    AudioEngine.play('click');
    GameEngine.stopTimer();
    GameEngine.stopChallengeTimer && GameEngine.stopChallengeTimer();
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

  // Wrong answer review
  document.getElementById('btn-review-wrong').addEventListener('click', () => {
    AudioEngine.play('click');
    openWrongAnswerReview(GameEngine.getWrongAnswers());
  });

  /* ════════════════════════════════════════════════════════════════
     REFERENCE CARD MODAL
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

  /* ════════════════════════════════════════════════════════════════
     WRONG ANSWER REVIEW MODAL
  ════════════════════════════════════════════════════════════════ */
  function openWrongAnswerReview(wrongAnswers) {
    const body = document.getElementById('review-body');
    if (!wrongAnswers || wrongAnswers.length === 0) {
      body.innerHTML = '<p style="color:var(--correct);text-align:center;padding:20px">🎉 No mistakes! Perfect round!</p>';
    } else {
      const OP_NAMES = { bracket:'Brackets',power:'Orders',divide:'Division',multiply:'Multiplication',add:'Addition',subtract:'Subtraction',timeout:'Time ran out' };
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
  document.getElementById('modal-review').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('modal-review').classList.remove('open');
  });

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ════════════════════════════════════════════════════════════════
     ACHIEVEMENTS SCREEN
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
    const all     = Achievements.getAll();
    const count   = Achievements.getUnlockedCount();
    const total   = Achievements.getTotalCount();
    document.getElementById('ach-count').textContent = count;
    document.getElementById('ach-total').textContent = total;
    document.getElementById('ach-progress-fill').style.width = `${(count/total)*100}%`;

    const grid = document.getElementById('ach-grid');
    grid.innerHTML = all.map((a, i) => {
      const locked    = !a.unlocked;
      const secretHide = locked && a.secret;
      return `
        <div class="ach-card ${a.unlocked ? 'unlocked' : 'locked'}" role="listitem"
             title="${a.desc}" style="animation-delay:${i*0.04}s">
          <span class="ach-icon">${secretHide ? '❓' : a.icon}</span>
          <span class="ach-title">${secretHide ? '???' : a.title}</span>
          <span class="ach-desc">${secretHide ? 'Secret achievement' : a.desc}</span>
          ${a.unlocked ? '<span class="ach-unlocked-badge">✓</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════════
     PROFILE SCREEN
  ════════════════════════════════════════════════════════════════ */
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
    const stats    = Profile.get();
    const name     = Storage.getPlayerName() || 'Player';
    const bests    = Storage.getAllBests();
    const maxScore = Math.max(bests.easy || 0, bests.medium || 0, bests.hard || 0, 1);

    document.getElementById('profile-name-display').textContent = name;
    document.getElementById('profile-joined').textContent =
      'Playing since ' + new Date(stats.joinedAt || Date.now()).toLocaleDateString();

    document.getElementById('pstat-games').textContent    = stats.totalGames || 0;
    document.getElementById('pstat-correct').textContent  = stats.totalCorrect || 0;
    document.getElementById('pstat-accuracy').textContent = Profile.getOverallAccuracy() + '%';
    document.getElementById('pstat-avg-score').textContent= Profile.getAverageScore();
    document.getElementById('pstat-achievements').textContent =
      `${Achievements.getUnlockedCount()}/${Achievements.getTotalCount()}`;
    document.getElementById('pstat-hints').textContent    = stats.totalHintsUsed || 0;

    // Level bars
    ['easy','medium','hard'].forEach(lvl => {
      const score = bests[lvl] || 0;
      document.getElementById(`plv-${lvl}`).textContent = score || '—';
      document.getElementById(`pbar-${lvl}`).style.width = `${(score/maxScore)*100}%`;
    });
  }

  /* ════════════════════════════════════════════════════════════════
     LEADERBOARD SCREEN
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
     NEXT STEP BUTTON
  ════════════════════════════════════════════════════════════════ */
  UI.el.btnNext.addEventListener('click', () => {
    AudioEngine.play('click');
    UI.hideFeedback();
    document.getElementById('btn-hint').disabled     = false;
    document.getElementById('btn-hint').classList.remove('used');
    GameEngine.advanceStep();
  });

  /* ════════════════════════════════════════════════════════════════
     HINT BUTTON
  ════════════════════════════════════════════════════════════════ */
  document.getElementById('btn-hint').addEventListener('click', () => {
    const opType = GameEngine.useHint();
    if (!opType) return;

    AudioEngine.play('click');
    document.getElementById('btn-hint').disabled = true;
    document.getElementById('btn-hint').classList.add('used');
    document.getElementById('btn-hint').textContent = '💡 Hint used!';

    // Visually highlight the correct choice button briefly
    const correctBtn = document.querySelector(`.choice-btn[data-op="${opType}"]`);
    if (correctBtn) {
      correctBtn.style.boxShadow = '0 0 25px rgba(245,158,11,0.8)';
      correctBtn.style.borderColor = '#f59e0b';
      setTimeout(() => {
        if (correctBtn) {
          correctBtn.style.boxShadow = '';
          correctBtn.style.borderColor = '';
        }
      }, 2000);
    }

    UI.setScore(GameEngine.getScore());
    Achievements.check({ type: 'hint_used' }, {});
  });

  /* ════════════════════════════════════════════════════════════════
     START GAME
  ════════════════════════════════════════════════════════════════ */
  function startGame(level, mode) {
    selectedLevel = level;
    selectedMode  = mode;
    GameEngine.init(level, mode);

    // Reset hint button
    const hintBtn = document.getElementById('btn-hint');
    hintBtn.disabled = false;
    hintBtn.classList.remove('used');
    hintBtn.innerHTML = '💡 Hint <span class="hint-cost">−5 pts</span>';

    // Show/hide HUD elements based on mode
    const timerWrap     = document.getElementById('timer-wrap');
    const challengeWrap = document.getElementById('challenge-timer-wrap');
    const modeBadge     = document.getElementById('hud-mode-badge');

    timerWrap.style.display     = mode === 'normal' ? '' : 'none';
    challengeWrap.style.display = mode === 'challenge' ? '' : 'none';
    modeBadge.className = `mode-badge mode-badge-${mode}`;
    modeBadge.textContent = mode === 'practice' ? 'PRACTICE' : mode === 'challenge' ? '⏱️ CHALLENGE' : '';

    // Register game events
    GameEngine.on('questionLoaded', ({ question, index }) => {
      UI.clearHistory();
      UI.renderExpression(question.tokens);
      const displayIndex = mode === 'challenge' ? GameEngine.getScore() : index + 1;
      const displayTotal = mode === 'challenge' ? '∞' : GameEngine.getTotalQuestions();
      UI.setQuestion(displayIndex, displayTotal);
      if (mode !== 'challenge') UI.setProgress(index, GameEngine.getTotalQuestions());
      renderCurrentStep(question.steps[0]);
    });

    GameEngine.on('timerTick', ({ value, max }) => {
      UI.setTimer(value, max);
    });

    GameEngine.on('challengeTick', ({ value, max }) => {
      const el = document.getElementById('challenge-timer-val');
      if (!el) return;
      el.textContent = value;
      el.className = 'challenge-timer-val ' + (value > 20 ? 'ok' : value > 10 ? 'warn' : 'danger');
    });

    GameEngine.on('correct', ({ step, earned, streak }) => {
      AudioEngine.play('correct');
      if (streak >= 3) AudioEngine.play(streak >= 10 ? 'levelUp' : 'levelUp');

      UI.disableChoices();
      UI.flashCard('correct');
      UI.animateCorrectGroup(step.correctGroup);
      UI.setScore(GameEngine.getScore());
      UI.setStreak(streak);
      updateExpressionAfterStep(step);
      UI.showFeedback({ isCorrect: true, explanation: step.explanation, earned, streak });

      // Achievements
      Achievements.check({ type: 'correct' }, {
        timeLeft: GameEngine.getState().timerValue,
        timerMax: GameEngine.getState().timerMax,
        streak,
        consecutiveWrong: GameEngine.getState().consecutiveWrong
      });
    });

    GameEngine.on('wrong', ({ step }) => {
      AudioEngine.play('wrong');
      UI.disableChoices();
      UI.flashCard('wrong');
      UI.setStreak(0);
      if (GameEngine.getState().mcfg.livesEnabled) {
        UI.setLives(GameEngine.getLives(), GameEngine.getState().cfg.livesStart);
      }
      UI.markCorrectChoice(step.correctOpType);
      UI.showFeedback({ isCorrect: false, explanation: step.explanation });
    });

    GameEngine.on('timeUp', ({ step }) => {
      AudioEngine.play('wrong');
      UI.disableChoices();
      UI.flashCard('wrong');
      UI.setStreak(0);
      UI.setLives(GameEngine.getLives(), GameEngine.getState().cfg.livesStart);
      UI.showFeedback({
        isTimeUp: true, isCorrect: false,
        explanation: step ? `Time's up! Correct: ${step.correctGroup?.label} — ${step.correctGroup?.display}. ${step.explanation}` : ''
      });
      if (GameEngine.getLives() > 0) {
        setTimeout(() => {
          if (!GameEngine.isFinished()) {
            UI.hideFeedback();
            GameEngine.advanceStep();
          }
        }, 2500);
      }
    });

    GameEngine.on('hintUsed', ({ score }) => {
      UI.setScore(score);
    });

    GameEngine.on('stepAdvanced', () => {
      const step = GameEngine.getCurrentStep();
      if (step) renderCurrentStep(step);
    });

    GameEngine.on('gameOver', async (results) => {
      AudioEngine.play(results.accuracy >= 60 ? 'levelUp' : 'gameOver');

      // Record in profile
      Profile.record({ ...results, mode });

      // Check game-over achievements
      Achievements.check({ type: 'game_over' }, {
        ...results, mode, hintsUsed: GameEngine.getHintsUsed()
      });

      const playerName = Storage.getPlayerName() || 'Anonymous';

      // Show "Review Mistakes" button if there are wrong answers
      const reviewBtn = document.getElementById('btn-review-wrong');
      reviewBtn.style.display = (results.wrongAnswers && results.wrongAnswers.length > 0) ? '' : 'none';

      setTimeout(() => UI.showResults({ ...results, playerName }), 400);

      if (Storage.IS_SERVER) {
        UI.showSubmitSection(playerName);
        try {
          const response = await Storage.submitScore({
            name: playerName, score: results.score,
            level, accuracy: results.accuracy, streak: results.bestStreak
          });
          if (response?.success) {
            UI.updateSubmitStatus(true, response.rank);
            UI.toast(`🏆 Leaderboard rank: #${response.rank}`, 'success', 3500);
          } else {
            UI.updateSubmitStatus(false, null);
          }
        } catch (_) { UI.updateSubmitStatus(false, null); }
      } else {
        Storage.submitScore({
          name: playerName, score: results.score,
          level, accuracy: results.accuracy, streak: results.bestStreak
        });
      }
    });

    /* ── Initial HUD ──────────────────────────────────────────── */
    const cfg = GameEngine.getState().cfg;
    UI.setHudLevel(level);
    UI.setScore(0);
    UI.setLives(mode === 'normal' ? cfg.livesStart : 99, mode === 'normal' ? cfg.livesStart : 99);
    UI.setStreak(0);
    UI.setTimer(mode === 'normal' ? cfg.timerMax : 0, mode === 'normal' ? cfg.timerMax : 0);
    UI.setProgress(0, cfg.questions);

    UI.showScreen('game');
    GameEngine.start();
  }

  /* ════════════════════════════════════════════════════════════════
     RENDER CURRENT STEP + HELPERS
  ════════════════════════════════════════════════════════════════ */
  function renderCurrentStep(step) {
    UI.highlightPill(step.correctOpType);
    UI.renderChoices(step.groups, (chosenOpType, btn) => {
      GameEngine.submitAnswer(chosenOpType);
      const isCorrect = QuestionGenerator.PRIORITY[chosenOpType] === QuestionGenerator.PRIORITY[step.correctOpType];
      UI.markChoiceResult(btn, isCorrect);
    });
  }

  function updateExpressionAfterStep(step) {
    const stepNum = GameEngine.getStepIndex() + 1;
    if (step.expressionAfter) UI.appendHistory(stepNum, step.expressionAfter);
  }

})();
