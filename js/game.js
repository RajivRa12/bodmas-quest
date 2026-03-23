/* ═══════════════════════════════════════════════════════════════════
   game.js — Core game state machine

   MODES:
     normal    : Timer per question, lives, full BODMAS game
     practice  : No timer, infinite lives — learn at own pace
     challenge : One 60-second global timer, score as many as possible
═══════════════════════════════════════════════════════════════════ */

const GameEngine = (() => {

  /* ── Config ──────────────────────────────────────────────────── */
  const LEVEL_CONFIG = {
    easy:   { questions: 8,  timerMax: 30, livesStart: 5, scorePerCorrect: 10, streakBonus: 5  },
    medium: { questions: 10, timerMax: 25, livesStart: 4, scorePerCorrect: 15, streakBonus: 8  },
    hard:   { questions: 10, timerMax: 20, livesStart: 3, scorePerCorrect: 20, streakBonus: 12 }
  };

  const MODE_CONFIG = {
    normal:    { timerEnabled: true,  livesEnabled: true,  challengeTimer: false },
    practice:  { timerEnabled: false, livesEnabled: false, challengeTimer: false },
    challenge: { timerEnabled: false, livesEnabled: false, challengeTimer: true, challengeSecs: 60 }
  };

  /* ── State ────────────────────────────────────────────────────── */
  let state = null;

  /* ── Initialise new game ─────────────────────────────────────── */
  function init(level, mode = 'normal') {
    const cfg  = LEVEL_CONFIG[level];
    const mcfg = MODE_CONFIG[mode] || MODE_CONFIG.normal;

    // Practice: lots of questions (unlimited feel)
    // Challenge: cap at 50 questions but expect game to end by timer
    const totalQ = mode === 'practice' ? 999 : mode === 'challenge' ? 50 : cfg.questions;

    state = {
      level,
      mode,
      cfg,
      mcfg,
      totalQuestions:    totalQ,
      questionIndex:     0,
      stepIndex:         0,
      score:             0,
      lives:             mcfg.livesEnabled ? cfg.livesStart : 99,
      streak:            0,
      bestStreak:        0,
      correctCount:      0,
      totalAnswers:      0,
      hintsUsed:         0,
      consecutiveWrong:  0,       // for comeback achievement
      wrongAnswers:      [],      // { expressionStr, correctOpType, chosenOpType, explanation }
      currentQuestion:   null,
      timerMax:          mcfg.timerEnabled ? cfg.timerMax : 0,
      timerValue:        mcfg.timerEnabled ? cfg.timerMax : 0,
      timerInterval:     null,
      challengeTimer:    mcfg.challengeTimer ? mcfg.challengeSecs : null,
      challengeInterval: null,
      started:           false,
      finished:          false,
      callbacks:         {}
    };
  }

  /* ── Getters ─────────────────────────────────────────────────── */
  function getState()           { return state; }
  function getScore()           { return state.score; }
  function getLives()           { return state.lives; }
  function getStreak()          { return state.streak; }
  function getBestStreak()      { return state.bestStreak; }
  function getLevel()           { return state.level; }
  function getMode()            { return state.mode; }
  function getQuestionIndex()   { return state.questionIndex; }
  function getTotalQuestions()  { return state.totalQuestions; }
  function getStepIndex()       { return state.stepIndex; }
  function getCurrentQuestion() { return state.currentQuestion; }
  function getChallengeTimer()  { return state.challengeTimer; }
  function getHintsUsed()       { return state.hintsUsed; }
  function getWrongAnswers()    { return state.wrongAnswers; }
  function getCurrentStep() {
    if (!state.currentQuestion) return null;
    return state.currentQuestion.steps[state.stepIndex] || null;
  }
  function isFinished() { return state.finished; }
  function getAccuracy() {
    if (state.totalAnswers === 0) return 0;
    return Math.round((state.correctCount / state.totalAnswers) * 100);
  }

  /* ── Event callbacks ─────────────────────────────────────────── */
  function on(event, cb) { state.callbacks[event] = cb; }
  function emit(event, data) {
    if (state.callbacks[event]) state.callbacks[event](data);
  }

  /* ── Load next question ──────────────────────────────────────── */
  function loadQuestion() {
    state.currentQuestion = QuestionGenerator.generate(state.level);
    state.stepIndex       = 0;
    emit('questionLoaded', { question: state.currentQuestion, index: state.questionIndex });
  }

  /* ── HINT ─────────────────────────────────────────────────────── */
  function useHint() {
    if (state.finished) return null;
    const step = getCurrentStep();
    if (!step) return null;

    // Hint costs 5 points (min 0)
    state.score     = Math.max(0, state.score - 5);
    state.hintsUsed++;
    emit('hintUsed', { step, correctOpType: step.correctOpType, score: state.score });
    return step.correctOpType;
  }

  /* ── Answer logic ────────────────────────────────────────────── */
  function submitAnswer(chosenOpType) {
    if (state.finished) return;
    const step = getCurrentStep();
    if (!step) return;

    state.totalAnswers++;
    if (state.mcfg.timerEnabled) stopTimer();

    const correct = isCorrectAnswer(chosenOpType, step);

    if (correct) {
      state.correctCount++;
      state.streak++;
      state.bestStreak      = Math.max(state.bestStreak, state.streak);
      state.consecutiveWrong = 0;

      const timeBonus   = state.mcfg.timerEnabled ? Math.floor((state.timerValue / state.timerMax) * 5) : 0;
      const streakBonus = state.streak >= 3 ? state.cfg.streakBonus : 0;
      const earned      = state.cfg.scorePerCorrect + timeBonus + streakBonus;
      state.score      += earned;

      emit('correct', {
        step, earned, streak: state.streak,
        timeLeft: state.timerValue, timerMax: state.timerMax,
        consecutiveWrong: state.consecutiveWrong
      });
    } else {
      state.consecutiveWrong++;
      state.streak = 0;
      if (state.mcfg.livesEnabled) state.lives = Math.max(0, state.lives - 1);

      // Record wrong answer for review
      state.wrongAnswers.push({
        expressionStr: tokensToString(state.currentQuestion.tokens),
        correctOpType: step.correctOpType,
        correctDisplay: step.correctGroup?.display || step.correctOpType,
        chosenOpType:  chosenOpType,
        explanation:   step.explanation
      });

      emit('wrong', { step, chosen: chosenOpType });
    }
  }

  function tokensToString(tokens) {
    return tokens.map(t => {
      if (t.type === 'br_open')  return '(';
      if (t.type === 'br_close') return ')';
      if (t.type === 'power')    return `${t.value}²`;
      return t.value;
    }).join(' ');
  }

  function isCorrectAnswer(chosenOpType, step) {
    const chosenP  = QuestionGenerator.PRIORITY[chosenOpType] || 99;
    const correctP = QuestionGenerator.PRIORITY[step.correctOpType];
    return chosenP === correctP;
  }

  /* ── Advance step/question ───────────────────────────────────── */
  function advanceStep() {
    const q = state.currentQuestion;
    if (!q) return;

    if (state.stepIndex < q.steps.length - 1) {
      state.stepIndex++;
      emit('stepAdvanced', { stepIndex: state.stepIndex });
      if (state.mcfg.timerEnabled) startTimer();
    } else {
      state.questionIndex++;

      const outOfQuestions = state.questionIndex >= state.totalQuestions;
      const outOfLives     = state.mcfg.livesEnabled && state.lives <= 0;

      if (outOfQuestions || outOfLives) {
        finishGame();
      } else {
        loadQuestion();
        if (state.mcfg.timerEnabled) startTimer();
      }
    }
  }

  /* ── Per-question timer (normal mode) ───────────────────────── */
  function startTimer() {
    if (!state.mcfg.timerEnabled) return;
    stopTimer();
    state.timerValue = state.timerMax;
    emit('timerTick', { value: state.timerValue, max: state.timerMax });

    state.timerInterval = setInterval(() => {
      state.timerValue--;
      emit('timerTick', { value: state.timerValue, max: state.timerMax });
      if (state.timerValue <= 5 && state.timerValue > 0) AudioEngine.play('timerWarn');
      if (state.timerValue <= 0) {
        stopTimer();
        state.streak = 0;
        state.lives  = Math.max(0, state.mcfg.livesEnabled ? state.lives - 1 : state.lives);
        state.totalAnswers++;
        state.consecutiveWrong++;

        const step = getCurrentStep();
        if (step) {
          state.wrongAnswers.push({
            expressionStr:  tokensToString(state.currentQuestion.tokens),
            correctOpType:  step.correctOpType,
            correctDisplay: step.correctGroup?.display || step.correctOpType,
            chosenOpType:   'timeout',
            explanation:    step.explanation
          });
        }

        emit('timeUp', { step });
        if (state.mcfg.livesEnabled && state.lives <= 0) setTimeout(() => finishGame(), 1200);
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  }

  /* ── Global challenge timer ──────────────────────────────────── */
  function startChallengeTimer() {
    if (!state.mcfg.challengeTimer) return;
    emit('challengeTick', { value: state.challengeTimer, max: state.mcfg.challengeSecs });

    state.challengeInterval = setInterval(() => {
      state.challengeTimer--;
      emit('challengeTick', { value: state.challengeTimer, max: state.mcfg.challengeSecs });
      if (state.challengeTimer <= 10 && state.challengeTimer > 0) AudioEngine.play('timerWarn');
      if (state.challengeTimer <= 0) {
        clearInterval(state.challengeInterval);
        state.challengeInterval = null;
        finishGame();
      }
    }, 1000);
  }

  function stopChallengeTimer() {
    if (state.challengeInterval) { clearInterval(state.challengeInterval); state.challengeInterval = null; }
  }

  /* ── End game ────────────────────────────────────────────────── */
  function finishGame() {
    stopTimer();
    stopChallengeTimer();
    state.finished = true;

    // Save best score (use score for all modes)
    try { Storage.getBest && Storage.submitScore && void 0; } catch (_) {}

    const accuracy = getAccuracy();
    emit('gameOver', {
      score:        state.score,
      correctCount: state.correctCount,
      totalAnswers: state.totalAnswers,
      accuracy,
      bestStreak:   state.bestStreak,
      isNewBest:    state.score > (Storage.getBest(state.level) || 0),
      lives:        state.lives,
      level:        state.level,
      mode:         state.mode,
      hintsUsed:    state.hintsUsed,
      wrongAnswers: state.wrongAnswers
    });
  }

  /* ── Start ────────────────────────────────────────────────────── */
  function start() {
    state.started = true;
    loadQuestion();
    if (state.mcfg.timerEnabled) startTimer();
    if (state.mcfg.challengeTimer) startChallengeTimer();
  }

  return {
    init, start, on,
    getState, getScore, getLives, getStreak, getBestStreak,
    getLevel, getMode, getQuestionIndex, getTotalQuestions, getStepIndex,
    getCurrentQuestion, getCurrentStep, getChallengeTimer,
    getHintsUsed, getWrongAnswers,
    isFinished, getAccuracy,
    submitAnswer, advanceStep, useHint,
    stopTimer, stopChallengeTimer
  };
})();
