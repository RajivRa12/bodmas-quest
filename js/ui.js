/* ═══════════════════════════════════════════════════════════════════
   ui.js — All DOM manipulation, rendering, and visual feedback

   Responsibilities:
   - Render expression tokens
   - Render answer choices
   - Show correct/wrong feedback + explanation
   - Update HUD (score, timer ring, progress bar, lives, streak)
   - Screen transitions
   - Toast messages
   - Ripple effects
═══════════════════════════════════════════════════════════════════ */

const UI = (() => {

  /* ── Element cache ────────────────────────────────────────────── */
  const $  = id => document.getElementById(id);
  const el = {
    // Screens
    screenIntro:         $('screen-intro'),
    screenGame:          $('screen-game'),
    screenResults:       $('screen-results'),
    screenLeaderboard:   $('screen-leaderboard'),
    screenAchievements:  $('screen-achievements'),
    screenProfile:       $('screen-profile'),

    // Intro
    BtnStart:          $('btn-start-game'),
    IntroBestScore:    $('intro-best-score'),
    levelBtns:         document.querySelectorAll('.level-btn'),
    playerNameInput:   $('player-name-input'),
    serverStatus:      $('server-status'),
    btnShowLeaderboard:$('btn-show-leaderboard'),

    // HUD
    hudScore:       $('hud-score'),
    hudQCurrent:    $('hud-q-current'),
    hudQTotal:      $('hud-q-total'),
    hudTimer:       $('hud-timer'),
    timerRingFill:  $('timer-ring-fill'),
    progressFill:   $('progress-fill'),
    hudLevelBadge:  $('hud-level-badge'),
    livesDisplay:   $('lives-display'),
    streakCount:    $('streak-count'),
    streakFire:     $('streak-fire'),
    btnSound:       $('btn-sound'),
    btnMenu:        $('btn-menu'),

    // Game area
    expressionDisplay:  $('expression-display'),
    expressionHistory:  $('expression-history'),
    expressionCard:     $('expression-card'),
    choicesGrid:        $('choices-grid'),
    feedbackPanel:      $('feedback-panel'),
    feedbackIcon:       $('feedback-icon'),
    feedbackText:       $('feedback-text'),
    feedbackExplan:     $('feedback-explanation'),
    btnNext:            $('btn-next'),
    bodmasPill:         document.querySelector('.bodmas-pill'),
    gameInstruction:    $('game-instruction'),

    // Results
    resultsTrophy:       $('results-trophy'),
    resultsTitle:        $('results-title'),
    resSub:              $('results-subtitle'),
    resScore:            $('res-score'),
    resCorrect:          $('res-correct'),
    resAccuracy:         $('res-accuracy'),
    resStreak:           $('res-streak'),
    rankCard:            $('rank-card'),
    rankIcon:            $('rank-icon'),
    rankTitle:           $('rank-title'),
    rankDesc:            $('rank-desc'),
    newBestBanner:       $('new-best-banner'),
    serverRankBadge:     $('server-rank-badge'),
    submitScoreSection:  $('submit-score-section'),
    submitNameVal:       $('submit-name-val'),
    submitStatus:        $('submit-status'),
    btnRetry:            $('btn-retry'),
    btnBackMenu:         $('btn-back-menu'),
    btnResultsLB:        $('btn-results-leaderboard'),

    // Leaderboard
    btnLeaderboardBack: $('btn-leaderboard-back'),
    lbList:             $('lb-list'),
    lbLoading:          $('lb-loading'),
    lbEmpty:            $('lb-empty'),
    lbTabs:             document.querySelectorAll('.lb-tab'),
    lbOfflineNotice:    $('lb-offline-notice'),
  };

  const CIRCUM = 113.097; // 2π × 18 (radius of timer ring)

  const OP_COLOR_CLASS = {
    bracket:  'highlight-b',
    power:    'highlight-o',
    divide:   'highlight-d',
    multiply: 'highlight-m',
    add:      'highlight-a',
    subtract: 'highlight-s'
  };

  const PILL_CLASS = {
    bracket:  'pill-b',
    power:    'pill-o',
    divide:   'pill-d',
    multiply: 'pill-m',
    add:      'pill-a',
    subtract: 'pill-s'
  };

  /* ══════════════════════════════════════════════════════════════
     SCREENS
  ══════════════════════════════════════════════════════════════ */
  function showScreen(name) {
    ['screenIntro', 'screenGame', 'screenResults', 'screenLeaderboard', 'screenAchievements', 'screenProfile'].forEach(s => {
      el[s].classList.remove('active');
    });
    const key = `screen${name.charAt(0).toUpperCase() + name.slice(1)}`;
    if (el[key]) el[key].classList.add('active');
  }

  /* ══════════════════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════════════════ */
  function toast(msg, type = '', duration = 2200) {
    const t = document.createElement('div');
    t.className = `toast${type ? ' toast-' + type : ''}`;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => {
      t.classList.add('toast-hide');
      t.addEventListener('animationend', () => t.remove());
    }, duration);
  }

  /* ══════════════════════════════════════════════════════════════
     HUD UPDATES
  ══════════════════════════════════════════════════════════════ */
  function setScore(score) {
    el.hudScore.textContent = score;
    el.hudScore.classList.remove('bump');
    void el.hudScore.offsetWidth; // reflow to restart animation
    el.hudScore.classList.add('bump');
  }

  function setTimer(value, max) {
    el.hudTimer.textContent = value;
    const offset = CIRCUM * (1 - value / max);
    el.timerRingFill.style.strokeDashoffset = offset;
    el.timerRingFill.classList.remove('warn', 'danger');
    if (value <= 5)       el.timerRingFill.classList.add('danger');
    else if (value <= 10) el.timerRingFill.classList.add('warn');
  }

  function setProgress(current, total) {
    const pct = Math.min(100, Math.round((current / total) * 100));
    el.progressFill.style.width = pct + '%';
  }

  function setLives(lives, max) {
    if (max >= 99) {
      // Practice / Challenge = infinite lives
      el.livesDisplay.textContent = '∞ lives';
      return;
    }
    const full  = '❤️';
    const empty = '🖤';
    el.livesDisplay.textContent = full.repeat(Math.max(0, lives)) + empty.repeat(Math.max(0, max - lives));
  }

  function setStreak(streak) {
    el.streakCount.textContent = streak;
    if (streak >= 3) {
      el.streakFire.textContent = '🔥';
      el.streakCount.style.color = 'var(--warn)';
    } else {
      el.streakFire.textContent = '⚡';
      el.streakCount.style.color = 'var(--text-muted)';
    }
  }

  function setHudLevel(level) {
    const labels = { easy: '🌱 Easy', medium: '🔥 Medium', hard: '⚡ Hard' };
    el.hudLevelBadge.textContent = labels[level] || level;
  }

  function setQuestion(current, total) {
    el.hudQCurrent.textContent = current;
    el.hudQTotal.textContent   = total;
  }

  function setSoundBtn(muted) {
    el.btnSound.textContent = muted ? '🔇' : '🔊';
  }

  /* ══════════════════════════════════════════════════════════════
     BODMAS PILL — highlight the active operation tier
  ══════════════════════════════════════════════════════════════ */
  function highlightPill(opType) {
    document.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active-pill'));
    const cls = PILL_CLASS[opType];
    if (cls) {
      const pill = document.querySelector('.' + cls);
      if (pill) pill.classList.add('active-pill');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     EXPRESSION RENDERING
  ══════════════════════════════════════════════════════════════ */
  function renderExpression(tokens) {
    el.expressionDisplay.innerHTML = '';
    tokens.forEach(tok => {
      const span = document.createElement('span');
      span.classList.add('token');

      switch (tok.type) {
        case 'num':
          span.classList.add('token-number');
          span.textContent = tok.value;
          break;
        case 'op':
          span.classList.add('token-op');
          span.textContent = tok.value;
          break;
        case 'br_open':
        case 'br_close':
          span.classList.add('token-bracket');
          span.textContent = tok.value;
          break;
        case 'power':
          span.classList.add('token-number', 'token-power');
          span.innerHTML = `${tok.value}<sup>${tok.exp || 2}</sup>`;
          break;
        default:
          span.textContent = tok.value;
      }

      el.expressionDisplay.appendChild(span);
    });
  }

  /* Animate the correct part being resolved */
  function animateCorrectGroup(correctGroup) {
    const tokens = el.expressionDisplay.querySelectorAll('.token');
    // Simple approach: flash-highlight all tokens (full expression style)
    tokens.forEach(t => {
      t.classList.add('solved');
      setTimeout(() => t.classList.remove('solved'), 600);
    });
  }

  /* ══════════════════════════════════════════════════════════════
  /* All 6 BODMAS operation types used to generate distractors */
  const ALL_OP_DEFS = [
    { opType: 'bracket',  label: 'Brackets',       display: '(  )'   },
    { opType: 'power',    label: 'Orders',          display: 'x²'     },
    { opType: 'divide',   label: 'Division',        display: 'a ÷ b'  },
    { opType: 'multiply', label: 'Multiplication',  display: 'a × b'  },
    { opType: 'add',      label: 'Addition',        display: 'a + b'  },
    { opType: 'subtract', label: 'Subtraction',     display: 'a − b'  },
  ];

  function renderChoices(groups, onChoose) {
    el.choicesGrid.innerHTML = '';
    hideFeedback();

    // Deduplicate by opType (keep first occurrence)
    const seen   = new Set();
    const unique = groups.filter(g => {
      if (seen.has(g.opType)) return false;
      seen.add(g.opType);
      return true;
    });

    // ── Always pad to exactly 4 choices with BODMAS distractors ──
    const existingTypes = new Set(unique.map(g => g.opType));
    const available = ALL_OP_DEFS
      .filter(op => !existingTypes.has(op.opType))
      .sort(() => Math.random() - 0.5); // shuffle distractors

    while (unique.length < 4 && available.length > 0) {
      unique.push({ ...available.shift(), isDistractor: true });
    }

    // Shuffle all 4 choices so correct isn't predictable
    const shuffled = [...unique].sort(() => Math.random() - 0.5);

    shuffled.forEach(group => {
      const btn = document.createElement('button');
      btn.className   = 'choice-btn';
      btn.dataset.op  = group.opType;
      btn.id          = `choice-${group.opType}`;
      btn.setAttribute('aria-label', `Choose ${group.label}`);
      btn.innerHTML   = `
        <span class="choice-expr">${group.display}</span>
        <span class="choice-label">${group.label}</span>
      `;

      btn.addEventListener('click', e => {
        addRipple(btn, e);
        onChoose(group.opType, btn);
      });

      el.choicesGrid.appendChild(btn);
    });
  }


  function disableChoices() {
    el.choicesGrid.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
  }

  function markChoiceResult(btn, isCorrect) {
    btn.classList.add(isCorrect ? 'result-correct' : 'result-wrong');
  }

  function markCorrectChoice(correctOpType) {
    const btn = document.getElementById(`choice-${correctOpType}`);
    if (btn) btn.classList.add('result-correct');
  }

  /* ══════════════════════════════════════════════════════════════
     FEEDBACK PANEL
  ══════════════════════════════════════════════════════════════ */
  function showFeedback({ isCorrect, explanation, earned, streak, isTimeUp }) {
    el.feedbackPanel.classList.add('visible');

    if (isTimeUp) {
      el.feedbackIcon.textContent      = '⏰';
      el.feedbackText.textContent      = 'Time\'s up!';
      el.feedbackText.className        = 'feedback-text wrong-text';
      el.feedbackExplan.textContent    = explanation || 'Try to answer faster next time!';
    } else if (isCorrect) {
      const msgs = ['Excellent! 🎉', 'Perfect! ✨', 'Brilliant! 🌟', 'Correct! 👍', 'Great job! 🚀'];
      el.feedbackIcon.textContent   = '✅';
      el.feedbackText.textContent   = pickRandom(msgs) + (streak >= 3 ? ` 🔥 ${streak} streak!` : '');
      el.feedbackText.className     = 'feedback-text correct-text';
      el.feedbackExplan.textContent = explanation;
    } else {
      const msgs = ['Not quite!', 'Good try! Remember BODMAS', 'Almost!', 'Keep going!'];
      el.feedbackIcon.textContent   = '❌';
      el.feedbackText.textContent   = pickRandom(msgs);
      el.feedbackText.className     = 'feedback-text wrong-text';
      el.feedbackExplan.textContent = explanation;
    }
  }

  function hideFeedback() {
    el.feedbackPanel.classList.remove('visible');
  }

  /* ══════════════════════════════════════════════════════════════
     EXPRESSION HISTORY (solved steps log)
  ══════════════════════════════════════════════════════════════ */
  function appendHistory(stepNum, exprAfter) {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
      <span class="history-step-badge">Step ${stepNum}</span>
      <span class="history-expr">→ ${exprAfter}</span>
    `;
    el.expressionHistory.appendChild(row);
    el.expressionHistory.scrollTop = el.expressionHistory.scrollHeight;
  }

  function clearHistory() {
    el.expressionHistory.innerHTML = '';
  }

  /* ══════════════════════════════════════════════════════════════
     CARD BORDER FLASH
  ══════════════════════════════════════════════════════════════ */
  function flashCard(type) {
    el.expressionCard.classList.remove('correct-border', 'wrong-border');
    void el.expressionCard.offsetWidth;
    el.expressionCard.classList.add(type === 'correct' ? 'correct-border' : 'wrong-border');
    setTimeout(() => el.expressionCard.classList.remove('correct-border', 'wrong-border'), 900);
  }

  /* ══════════════════════════════════════════════════════════════
     RESULTS SCREEN
  ══════════════════════════════════════════════════════════════ */
  const RANKS = [
    { min: 90, icon: '🏆', title: 'BODMAS Legend',   desc: 'Perfect mastery of order of operations!' },
    { min: 75, icon: '🥇', title: 'Math Champion',   desc: 'Outstanding performance!' },
    { min: 60, icon: '🥈', title: 'Quick Thinker',   desc: 'Great work, keep practising!' },
    { min: 40, icon: '🥉', title: 'On the Rise',     desc: 'You\'re getting there!' },
    { min:  0, icon: '📚', title: 'Keep Learning',   desc: 'Revise BODMAS and try again!' }
  ];

  function showResults({ score, correctCount, totalAnswers, accuracy, bestStreak, isNewBest, lives, playerName }) {
    animateCount(el.resScore,    0, score,         800);
    animateCount(el.resCorrect,  0, correctCount,  600);
    animateCount(el.resStreak,   0, bestStreak,    500);

    // Hide server sections initially
    el.serverRankBadge.classList.remove('show');
    el.submitScoreSection.classList.remove('visible');
    el.submitNameVal.textContent = playerName || 'Anonymous';

    // Animate accuracy as percentage
    let acc = 0;
    const accInterval = setInterval(() => {
      acc = Math.min(acc + 2, accuracy);
      el.resAccuracy.textContent = acc + '%';
      if (acc >= accuracy) clearInterval(accInterval);
    }, 20);

    // Rank
    const rank = RANKS.find(r => accuracy >= r.min) || RANKS[RANKS.length - 1];
    el.rankIcon.textContent  = rank.icon;
    el.rankTitle.textContent = rank.title;
    el.rankDesc.textContent  = rank.desc;

    // Trophy
    if (accuracy >= 90) {
      el.resultsTrophy.textContent = '🏆';
      ConfettiEngine.burst(180);
    } else if (accuracy >= 60) {
      el.resultsTrophy.textContent = '⭐';
    } else {
      el.resultsTrophy.textContent = '📖';
    }

    // New best banner
    el.newBestBanner.classList.toggle('show', isNewBest);

    showScreen('results');
  }

  /* ══════════════════════════════════════════════════════════════
     INTRO BEST SCORE
  ══════════════════════════════════════════════════════════════ */
  function showIntroBestScores() {
    const bests = Storage.getAllBests();
    const parts = [];
    if (bests.easy)   parts.push(`🌱 Easy: ${bests.easy}`);
    if (bests.medium) parts.push(`🔥 Medium: ${bests.medium}`);
    if (bests.hard)   parts.push(`⚡ Hard: ${bests.hard}`);
    el.IntroBestScore.textContent = parts.length ? 'Best: ' + parts.join(' • ') : '';
  }

  /* ══════════════════════════════════════════════════════════════
     SERVER STATUS PILL
  ══════════════════════════════════════════════════════════════ */
  function showServerStatus(online) {
    el.serverStatus.className = `server-status ${online ? 'online' : 'offline'}`;
    el.serverStatus.textContent = online ? '🟢 Server connected — scores saved globally' : '🔴 Offline mode — scores saved locally';
  }

  /* ══════════════════════════════════════════════════════════════
     SUBMIT SECTION (results screen)
  ══════════════════════════════════════════════════════════════ */
  function showSubmitSection(playerName) {
    el.submitScoreSection.classList.add('visible');
    el.submitNameVal.textContent = playerName || 'Anonymous';
    el.submitStatus.innerHTML = '<span>⏳ Saving to leaderboard…</span>';
  }

  function updateSubmitStatus(success, rank) {
    if (success) {
      el.submitStatus.innerHTML = `<span class="submit-done">✅ Saved! You ranked #${rank} on the leaderboard.</span>`;
      // Show rank badge
      el.serverRankBadge.textContent = `🏆 Leaderboard Rank: #${rank}`;
      el.serverRankBadge.classList.add('show');
    } else {
      el.submitStatus.innerHTML = `<span class="submit-error">⚠️ Could not save to server (score saved locally).</span>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LEADERBOARD RENDERING
  ══════════════════════════════════════════════════════════════ */
  const RANK_MEDALS = ['🥇', '🥈', '🥉'];

  function renderLeaderboard(entries, isOnline) {
    el.lbLoading.style.display = 'none';
    el.lbOfflineNotice.classList.toggle('show', !isOnline);

    if (!isOnline || entries.length === 0) {
      el.lbEmpty.style.display = 'block';
      el.lbList.innerHTML = '';
      return;
    }

    el.lbEmpty.style.display = 'none';
    el.lbList.innerHTML = '';

    entries.forEach((entry, i) => {
      const rank    = i + 1;
      const isTop3  = rank <= 3;
      const medal   = RANK_MEDALS[rank - 1] || '';
      const rankNum = medal || rank;

      const row = document.createElement('div');
      row.className = `lb-row${isTop3 ? ' top-' + rank : ''}`;
      row.setAttribute('role', 'row');
      row.style.animationDelay = (i * 0.06) + 's';

      row.innerHTML = `
        <div class="lb-rank lb-rank-${rank}">${rankNum}</div>
        <div class="lb-name">${escapeHtml(entry.name)}</div>
        <div class="lb-meta">
          <span class="lb-score">${entry.score.toLocaleString()}</span>
          <span class="lb-detail">${entry.accuracy}% acc · ${entry.streak}🔥 streak</span>
          <span class="lb-detail">${entry.date || ''}</span>
        </div>
      `;
      el.lbList.appendChild(row);
    });
  }

  function setLeaderboardLoading() {
    el.lbLoading.style.display = 'block';
    el.lbEmpty.style.display   = 'none';
    el.lbList.innerHTML        = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ══════════════════════════════════════════════════════════════
     RIPPLE EFFECT
  ══════════════════════════════════════════════════════════════ */
  function addRipple(btn, e) {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width  = ripple.style.height = size + 'px';
    ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  /* ══════════════════════════════════════════════════════════════
     UTILITY
  ══════════════════════════════════════════════════════════════ */
  function animateCount(el, from, to, duration) {
    const step = (to - from) / (duration / 16);
    let current = from;
    const interval = setInterval(() => {
      current = Math.min(current + step, to);
      el.textContent = Math.floor(current);
      if (current >= to) clearInterval(interval);
    }, 16);
  }

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ── Expose public interface ──────────────────────────────────── */
  return {
    el,
    showScreen,
    toast,
    setScore,
    setTimer,
    setProgress,
    setLives,
    setStreak,
    setHudLevel,
    setQuestion,
    setSoundBtn,
    highlightPill,
    renderExpression,
    animateCorrectGroup,
    renderChoices,
    disableChoices,
    markChoiceResult,
    markCorrectChoice,
    showFeedback,
    hideFeedback,
    appendHistory,
    clearHistory,
    flashCard,
    showResults,
    showIntroBestScores,
    showServerStatus,
    showSubmitSection,
    updateSubmitStatus,
    renderLeaderboard,
    setLeaderboardLoading
  };
})();
