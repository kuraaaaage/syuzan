(() => {
  const storageKeys = {
    dividendMin: 'div_dvsMin',
    dividendMax: 'div_dvsMax',
    divisorMin: 'div_divMin',
    divisorMax: 'div_divMax',
    exactOnly: 'div_exactOnly',
    mode: 'div_mode',
    ppm: 'div_ppm',
    revealDelay: 'div_reveal',
    autoAdvance: 'div_auto',
    score: 'div_score',
    best: 'div_best',
    streak: 'div_streak',
    basePoint: 'div_basePoint',
    penaltyPoint: 'div_penaltyPoint',
    target: 'div_target',
    rewardText: 'div_rewardText',
    seed: 'div_seed',
    showReveal: 'div_showReveal',
    manualReveal: 'div_manualReveal'
  };

  const defaultSettings = {
    dividendMin: 7,
    dividendMax: 9,
    divisorMin: 3,
    divisorMax: 6,
    exactOnly: false,
    mode: 'leading',
    ppm: 30,
    revealDelay: 0,
    autoAdvance: true,
    basePoint: 10,
    penaltyPoint: 10,
    target: 100,
    rewardText: '目標達成おめでとう！',
    seed: '',
    showReveal: true,
    manualReveal: false
  };

  const elements = {};
  const state = {
    running: false,
    awaitingAnswer: false,
    timerId: null,
    progressId: null,
    revealTimeoutId: null,
    correctRevealId: null,
    currentProblem: null,
    history: [],
    startTimestamp: 0,
    deadline: 0,
    score: 0,
    bestScore: 0,
    questionCount: 0,
    correctCount: 0,
    streak: 0,
    rewardShown: false,
    lastRt: null,
    recentProblems: []
  };

  let rng = Math.random;

  function getElement(id) {
    return document.getElementById(id);
  }

  function initElements() {
    [
      'startButton', 'ppmSlider', 'ppmValue', 'targetInput', 'modeSelect',
      'autoAdvance', 'showReveal', 'revealDelay', 'detailsToggle', 'detailsPanel',
      'dividendMin', 'dividendMax', 'divisorMin', 'divisorMax', 'exactOnly', 'manualReveal',
      'seedInput', 'basePoint', 'penaltyPoint', 'rewardText', 'problemText', 'progressBar',
      'resultIndicator', 'reactionTime', 'streakInfo', 'currentScore', 'bestScore',
      'targetProgress', 'answerInput', 'submitAnswer', 'clearAnswer', 'nextButton',
      'revealButton', 'correctDisplay', 'questionCount', 'accuracy', 'recentRt',
      'streakCount', 'exportCsv', 'rewardModal', 'rewardMessage', 'closeModal',
      'themeToggle', 'testResults'
    ].forEach(id => {
      elements[id] = getElement(id);
    });

    elements.keypadButtons = Array.from(document.querySelectorAll('.keypad button[data-key]'));
  }

  function loadSettings() {
    const settings = { ...defaultSettings };
    try {
      Object.keys(storageKeys).forEach(key => {
        const stored = localStorage.getItem(storageKeys[key]);
        if (stored === null) return;
        if (['dividendMin', 'dividendMax', 'divisorMin', 'divisorMax', 'ppm', 'revealDelay', 'basePoint', 'penaltyPoint', 'target', 'score', 'best', 'streak'].includes(key)) {
          const num = Number(stored);
          if (!Number.isNaN(num)) settings[key] = num;
        } else if (['exactOnly', 'autoAdvance', 'showReveal', 'manualReveal'].includes(key)) {
          settings[key] = stored === 'true';
        } else {
          settings[key] = stored;
        }
      });
    } catch (err) {
      console.warn('設定の読み込みに失敗しました', err);
    }
    applySettingsToUI(settings);
    updateRng(settings.seed);
    state.score = Number.isFinite(settings.score) ? settings.score : 0;
    state.bestScore = Number.isFinite(settings.best) ? settings.best : 0;
    state.streak = Number.isFinite(settings.streak) ? settings.streak : 0;
    if (!Number.isFinite(state.bestScore)) state.bestScore = 0;
    updateScoreUI();
    updateStatsUI();
  }

  function applySettingsToUI(settings) {
    elements.dividendMin.value = settings.dividendMin;
    elements.dividendMax.value = settings.dividendMax;
    elements.divisorMin.value = settings.divisorMin;
    elements.divisorMax.value = settings.divisorMax;
    elements.exactOnly.checked = settings.exactOnly;
    elements.modeSelect.value = settings.mode;
    elements.ppmSlider.value = settings.ppm;
    elements.ppmValue.textContent = settings.ppm;
    elements.revealDelay.value = settings.revealDelay;
    elements.autoAdvance.checked = settings.autoAdvance;
    elements.showReveal.checked = settings.showReveal;
    elements.manualReveal.checked = settings.manualReveal;
    elements.basePoint.value = settings.basePoint;
    elements.penaltyPoint.value = settings.penaltyPoint;
    elements.targetInput.value = settings.target;
    elements.rewardText.value = settings.rewardText;
    elements.seedInput.value = settings.seed;
    elements.rewardMessage.textContent = settings.rewardText || defaultSettings.rewardText;
  }

  function saveSetting(key, value) {
    const storageKey = storageKeys[key];
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, value);
    } catch (err) {
      console.warn('設定の保存に失敗しました', err);
    }
  }

  function multiplierFromStreak(streak) {
    return 1 + Math.floor(streak / 5) * 0.5;
  }

  function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function validateDigitRanges() {
    let dMin = Number(elements.dividendMin.value) || defaultSettings.dividendMin;
    let dMax = Number(elements.dividendMax.value) || defaultSettings.dividendMax;
    let rMin = Number(elements.divisorMin.value) || defaultSettings.divisorMin;
    let rMax = Number(elements.divisorMax.value) || defaultSettings.divisorMax;

    if (dMin > dMax) [dMin, dMax] = [dMax, dMin];
    if (rMin > rMax) [rMin, rMax] = [rMax, rMin];

    dMin = clampNumber(dMin, 1, 12);
    dMax = clampNumber(dMax, 1, 12);
    rMin = clampNumber(rMin, 1, 6);
    rMax = clampNumber(rMax, 1, 6);

    elements.dividendMin.value = dMin;
    elements.dividendMax.value = dMax;
    elements.divisorMin.value = rMin;
    elements.divisorMax.value = rMax;

    saveSetting('dividendMin', dMin);
    saveSetting('dividendMax', dMax);
    saveSetting('divisorMin', rMin);
    saveSetting('divisorMax', rMax);
  }

  function updateRng(seedValue) {
    if (seedValue === '' || seedValue === null) {
      rng = Math.random;
      return;
    }
    const seedNumber = Number(seedValue);
    if (!Number.isFinite(seedNumber)) {
      rng = Math.random;
      return;
    }
    let seed = (seedNumber >>> 0) || 1;
    rng = () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomInt(min, max) {
    const value = Math.floor(rng() * (max - min + 1)) + min;
    return value;
  }

  function generateNumberWithDigits(digits) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return randomInt(min, max);
  }

  function pickDigits(rangeMin, rangeMax) {
    if (rangeMin === rangeMax) return rangeMin;
    return randomInt(rangeMin, rangeMax);
  }

  function generateProblem() {
    const dividendDigits = pickDigits(Number(elements.dividendMin.value), Number(elements.dividendMax.value));
    const divisorDigits = pickDigits(Number(elements.divisorMin.value), Number(elements.divisorMax.value));
    const exactOnly = elements.exactOnly.checked;

    let attempt = 0;
    let dividend;
    let divisor;
    const maxAttempts = exactOnly ? 400 : 80;

    while (attempt < maxAttempts) {
      attempt += 1;
      divisor = generateNumberWithDigits(divisorDigits);
      if (divisor % 10 === 0) {
        continue;
      }

      dividend = generateNumberWithDigits(dividendDigits);
      if (exactOnly && dividend % divisor !== 0) {
        continue;
      }

      const key = `${dividend}-${divisor}`;
      if (!state.recentProblems.includes(key)) {
        state.recentProblems.push(key);
        if (state.recentProblems.length > 12) {
          state.recentProblems.shift();
        }
        return { dividend, divisor };
      }
    }

    if (exactOnly && dividend % divisor !== 0) {
      // fallback to avoid infinite loop
      console.warn('割り切れる問題を生成できませんでした。割り切り限定を一時解除します。');
    }

    if (!divisor || divisor % 10 === 0) {
      divisor = generateNumberWithDigits(divisorDigits);
      while (divisor % 10 === 0) {
        divisor += 1;
      }
    }
    if (!dividend) {
      dividend = generateNumberWithDigits(dividendDigits);
    }

    const key = `${dividend}-${divisor}`;
    state.recentProblems.push(key);
    if (state.recentProblems.length > 12) state.recentProblems.shift();
    return { dividend, divisor };
  }

  function formatNumber(value) {
    return value.toLocaleString('ja-JP');
  }

  function startSession() {
    if (state.running) return;
    const targetValue = Number(elements.targetInput.value);
    if (!targetValue || targetValue <= 0) {
      elements.targetInput.value = defaultSettings.target;
      saveSetting('target', elements.targetInput.value);
      updateScoreUI();
    }
    elements.rewardModal.classList.add('hidden');
    resetSessionStats();
    state.running = true;
    elements.startButton.textContent = 'ストップ';
    state.rewardShown = false;
    prepareNextProblem();
  }

  function stopSession() {
    state.running = false;
    clearTimers();
    elements.startButton.textContent = 'スタート';
    state.awaitingAnswer = false;
    elements.progressBar.style.width = '0%';
  }

  function resetSessionStats() {
    state.history = [];
    state.score = 0;
    state.questionCount = 0;
    state.correctCount = 0;
    state.streak = 0;
    state.lastRt = null;
    saveSetting('score', state.score);
    saveSetting('streak', state.streak);
    updateScoreUI();
    updateStatsUI();
    state.recentProblems = [];
  }

  function clearTimers() {
    if (state.timerId) {
      clearTimeout(state.timerId);
      state.timerId = null;
    }
    if (state.progressId) {
      cancelAnimationFrame(state.progressId);
      state.progressId = null;
    }
    if (state.revealTimeoutId) {
      clearTimeout(state.revealTimeoutId);
      state.revealTimeoutId = null;
    }
    if (state.correctRevealId) {
      clearTimeout(state.correctRevealId);
      state.correctRevealId = null;
    }
  }

  function prepareNextProblem() {
    clearTimers();
    state.currentProblem = generateProblem();
    state.awaitingAnswer = true;
    elements.problemText.textContent = `${formatNumber(state.currentProblem.dividend)} ÷ ${formatNumber(state.currentProblem.divisor)}`;
    elements.resultIndicator.textContent = '—';
    elements.resultIndicator.classList.remove('correct', 'incorrect');
    elements.reactionTime.textContent = 'RT: — ms';
    elements.correctDisplay.classList.add('hidden');
    elements.correctDisplay.textContent = '';
    elements.streakInfo.textContent = `連続: ${state.streak} (×${multiplierFromStreak(state.streak).toFixed(1)})`;
    elements.answerInput.value = '';
    elements.answerInput.focus();

    const intervalMs = Math.max(1000, Math.round(60000 / Number(elements.ppmSlider.value)));
    state.startTimestamp = performance.now();
    state.deadline = state.startTimestamp + intervalMs;

    if (elements.autoAdvance.checked) {
      state.timerId = setTimeout(() => handleTimeout(), intervalMs);
      startProgress(intervalMs);
    } else {
      startProgress(intervalMs);
    }
  }

  function startProgress(intervalMs) {
    const start = performance.now();
    const update = () => {
      const now = performance.now();
      let ratio = (now - start) / intervalMs;
      ratio = Math.max(0, Math.min(1, ratio));
      elements.progressBar.style.width = `${ratio * 100}%`;
      if (ratio < 1 && state.awaitingAnswer) {
        state.progressId = requestAnimationFrame(update);
      }
    };
    elements.progressBar.style.width = '0%';
    state.progressId = requestAnimationFrame(update);
  }

  function handleTimeout() {
    if (!state.awaitingAnswer) return;
    evaluateAnswer('', true);
  }

  function getCorrectAnswer(problem, mode) {
    if (!problem) return '';
    if (mode === 'rounded') {
      return String(Math.round(problem.dividend / problem.divisor));
    }
    const quotient = Math.floor(problem.dividend / problem.divisor);
    return String(String(quotient)[0] || '0');
  }

  function evaluateAnswer(answer, isTimeout = false) {
    state.awaitingAnswer = false;
    clearTimers();

    const now = performance.now();
    const reaction = isTimeout ? null : Math.round(now - state.startTimestamp);
    state.lastRt = reaction;
    const mode = elements.modeSelect.value;
    const correct = getCorrectAnswer(state.currentProblem, mode);
    const isCorrect = !isTimeout && answer !== '' && answer === correct;

    state.questionCount += 1;
    if (isCorrect) {
      state.correctCount += 1;
      state.streak += 1;
      const multiplier = multiplierFromStreak(state.streak);
      const basePoint = Number(elements.basePoint.value) || defaultSettings.basePoint;
      const gain = Math.round(basePoint * multiplier);
      state.score += gain;
      elements.resultIndicator.textContent = `〇 +${gain}`;
      elements.resultIndicator.classList.add('correct');
      elements.resultIndicator.classList.remove('incorrect');
    } else {
      state.streak = 0;
      const penalty = Number(elements.penaltyPoint.value) || defaultSettings.penaltyPoint;
      if (!isTimeout) {
        elements.resultIndicator.textContent = `× -${penalty}`;
      } else {
        elements.resultIndicator.textContent = `時間切れ -${penalty}`;
      }
      elements.resultIndicator.classList.add('incorrect');
      elements.resultIndicator.classList.remove('correct');
      state.score -= penalty;
    }

    saveSetting('score', state.score);
    saveSetting('streak', state.streak);

    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      saveSetting('best', state.bestScore);
    }

    const rtText = reaction === null ? 'RT: — ms' : `RT: ${reaction} ms`;
    elements.reactionTime.textContent = rtText;
    elements.streakInfo.textContent = `連続: ${state.streak} (×${multiplierFromStreak(state.streak).toFixed(1)})`;

    const record = {
      time: new Date().toISOString(),
      dividend: state.currentProblem?.dividend,
      divisor: state.currentProblem?.divisor,
      userAnswer: answer,
      correctAnswer: correct,
      correct: isCorrect ? 1 : 0,
      mode,
      reaction: reaction,
      score: state.score
    };
    state.history.push(record);

    updateScoreUI();
    updateStatsUI();
    updateCorrectDisplay(correct);
    checkTargetAchieved();

    if (elements.autoAdvance.checked) {
      const delay = Math.max(Number(elements.revealDelay.value) || 0, 0);
      const wait = elements.manualReveal.checked ? delay : delay;
      state.revealTimeoutId = setTimeout(() => {
        if (!state.running) return;
        prepareNextProblem();
      }, wait);
    }
  }

  function updateCorrectDisplay(correct) {
    const revealEnabled = elements.showReveal.checked;
    if (!revealEnabled) {
      elements.correctDisplay.classList.add('hidden');
      elements.correctDisplay.textContent = '';
      return;
    }

    const delay = Math.max(Number(elements.revealDelay.value) || 0, 0);
    if (state.correctRevealId) {
      clearTimeout(state.correctRevealId);
      state.correctRevealId = null;
    }
    if (delay === 0 && !elements.manualReveal.checked) {
      showCorrect(correct);
    } else if (!elements.manualReveal.checked) {
      state.correctRevealId = setTimeout(() => {
        showCorrect(correct);
        state.correctRevealId = null;
      }, delay);
    }
  }

  function showCorrect(correct) {
    elements.correctDisplay.textContent = `正解: ${correct}`;
    elements.correctDisplay.classList.remove('hidden');
  }

  function checkTargetAchieved() {
    const target = Number(elements.targetInput.value);
    if (!target || target <= 0) return;
    const rewardText = elements.rewardText.value || defaultSettings.rewardText;
    elements.rewardMessage.textContent = rewardText;
    if (state.score >= target && !state.rewardShown) {
      state.rewardShown = true;
      elements.rewardModal.classList.remove('hidden');
      saveSetting('best', state.bestScore);
    }
  }

  function updateScoreUI() {
    elements.currentScore.textContent = state.score;
    elements.bestScore.textContent = state.bestScore;
    const target = Number(elements.targetInput.value);
    if (target > 0) {
      const ratio = Math.max(0, Math.min(1, state.score / target));
      elements.targetProgress.style.width = `${ratio * 100}%`;
    } else {
      elements.targetProgress.style.width = '0%';
    }
  }

  function updateStatsUI() {
    elements.questionCount.textContent = state.questionCount;
    const accuracy = state.questionCount === 0 ? 0 : Math.round((state.correctCount / state.questionCount) * 100);
    elements.accuracy.textContent = `${accuracy}%`;
    elements.recentRt.textContent = state.lastRt === null ? '—' : `${state.lastRt} ms`;
    elements.streakCount.textContent = state.streak;
  }

  function handleSubmit() {
    if (!state.running || !state.awaitingAnswer) return;
    const answer = elements.answerInput.value.trim();
    evaluateAnswer(answer, false);
  }

  function handleNext() {
    if (!state.running) return;
    if (state.awaitingAnswer) {
      // unanswered -> treat as timeout before moving on
      evaluateAnswer('', true);
      return;
    }
    prepareNextProblem();
  }

  function clearAnswer() {
    elements.answerInput.value = '';
    elements.answerInput.focus();
  }

  function exportCsv() {
    if (state.history.length === 0) {
      alert('まだ出題がありません');
      return;
    }
    const headers = ['time', '被除数(N)', '除数(d)', '回答(user)', '正解(target)', '正誤(correct:1/0)', 'mode', 'RT(ms)', 'score'];
    const rows = state.history.map(item => [
      item.time,
      item.dividend,
      item.divisor,
      item.userAnswer,
      item.correctAnswer,
      item.correct,
      item.mode,
      item.reaction ?? '',
      item.score
    ]);
    const csv = createCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'syoate_sprint.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function createCsv(headers, rows) {
    const escapeCell = (cell) => {
      if (cell === null || cell === undefined) return '';
      const text = String(cell);
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return '"' + text.replace(/"/g, '""') + '"';
      }
      return text;
    };
    const lines = [];
    lines.push(headers.map(escapeCell).join(','));
    rows.forEach(row => {
      const filled = row.map(escapeCell).join(',');
      lines.push(filled);
    });
    return lines.join("\n");
  }

  function toggleDetails() {
    elements.detailsPanel.classList.toggle('hidden');
  }

  function attachEvents() {
    elements.startButton.addEventListener('click', () => {
      if (!state.running) {
        startSession();
      } else {
        stopSession();
      }
    });

    elements.ppmSlider.addEventListener('input', () => {
      elements.ppmValue.textContent = elements.ppmSlider.value;
      saveSetting('ppm', elements.ppmSlider.value);
    });

    elements.targetInput.addEventListener('change', () => {
      const value = Number(elements.targetInput.value);
      if (Number.isNaN(value) || value <= 0) {
        elements.targetInput.value = defaultSettings.target;
      }
      saveSetting('target', elements.targetInput.value);
      updateScoreUI();
    });

    elements.modeSelect.addEventListener('change', () => {
      saveSetting('mode', elements.modeSelect.value);
    });

    elements.autoAdvance.addEventListener('change', () => {
      saveSetting('autoAdvance', elements.autoAdvance.checked);
    });

    elements.showReveal.addEventListener('change', () => {
      saveSetting('showReveal', elements.showReveal.checked);
      if (!elements.showReveal.checked) {
        elements.correctDisplay.classList.add('hidden');
      } else if (!state.awaitingAnswer && state.currentProblem && !elements.manualReveal.checked) {
        const correct = getCorrectAnswer(state.currentProblem, elements.modeSelect.value);
        showCorrect(correct);
      }
    });

    elements.manualReveal.addEventListener('change', () => {
      saveSetting('manualReveal', elements.manualReveal.checked);
      if (!elements.manualReveal.checked && elements.showReveal.checked && !state.awaitingAnswer && state.currentProblem) {
        const correct = getCorrectAnswer(state.currentProblem, elements.modeSelect.value);
        showCorrect(correct);
      }
    });

    elements.revealDelay.addEventListener('change', () => {
      let value = Number(elements.revealDelay.value);
      if (Number.isNaN(value) || value < 0) value = 0;
      elements.revealDelay.value = value;
      saveSetting('revealDelay', value);
    });

    ['dividendMin', 'dividendMax', 'divisorMin', 'divisorMax'].forEach(id => {
      elements[id].addEventListener('change', validateDigitRanges);
    });

    elements.exactOnly.addEventListener('change', () => {
      saveSetting('exactOnly', elements.exactOnly.checked);
    });

    elements.basePoint.addEventListener('change', () => {
      const value = Number(elements.basePoint.value);
      if (Number.isNaN(value)) elements.basePoint.value = defaultSettings.basePoint;
      saveSetting('basePoint', elements.basePoint.value);
    });

    elements.penaltyPoint.addEventListener('change', () => {
      const value = Number(elements.penaltyPoint.value);
      if (Number.isNaN(value)) elements.penaltyPoint.value = defaultSettings.penaltyPoint;
      saveSetting('penaltyPoint', elements.penaltyPoint.value);
    });

    elements.rewardText.addEventListener('change', () => {
      saveSetting('rewardText', elements.rewardText.value);
      elements.rewardMessage.textContent = elements.rewardText.value || defaultSettings.rewardText;
    });

    elements.seedInput.addEventListener('change', () => {
      const value = elements.seedInput.value.trim();
      saveSetting('seed', value);
      updateRng(value);
    });

    elements.submitAnswer.addEventListener('click', handleSubmit);
    elements.clearAnswer.addEventListener('click', clearAnswer);
    elements.nextButton.addEventListener('click', handleNext);
    elements.revealButton.addEventListener('click', () => {
      if (!state.currentProblem) return;
      const correct = getCorrectAnswer(state.currentProblem, elements.modeSelect.value);
      showCorrect(correct);
    });

    elements.answerInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit();
      }
    });

    elements.exportCsv.addEventListener('click', exportCsv);
    elements.detailsToggle.addEventListener('click', toggleDetails);

    elements.closeModal.addEventListener('click', () => {
      elements.rewardModal.classList.add('hidden');
    });

    elements.themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('contrast');
    });

    elements.keypadButtons.forEach(button => {
      button.addEventListener('click', () => appendDigit(button.dataset.key));
    });

    document.addEventListener('keydown', globalHotkeys);
  }

  function appendDigit(digit) {
    const input = elements.answerInput;
    input.value += digit;
    input.focus();
  }

  function globalHotkeys(event) {
    const targetIsInput = event.target === elements.answerInput;
    if (targetIsInput) {
      if (event.key === 'Escape') {
        event.preventDefault();
        clearAnswer();
        return;
      }
      if ((event.key >= '0' && event.key <= '9') || event.key === 'Backspace' || event.key === 'Enter') {
        return;
      }
      if (['s', 'S', 'n', 'N', 'a', 'A', 'r', 'R'].includes(event.key)) {
        event.preventDefault();
      }
    }

    if (event.key >= '0' && event.key <= '9') {
      appendDigit(event.key);
    } else if (event.key === 'Backspace') {
      const value = elements.answerInput.value;
      elements.answerInput.value = value.slice(0, -1);
    } else if (event.key === 'Enter') {
      handleSubmit();
    } else if (event.key.toLowerCase() === 's') {
      if (state.running) {
        stopSession();
      } else {
        startSession();
      }
    } else if (event.key.toLowerCase() === 'n') {
      handleNext();
    } else if (event.key.toLowerCase() === 'a') {
      if (!state.currentProblem) return;
      if (elements.correctDisplay.classList.contains('hidden')) {
        const correct = getCorrectAnswer(state.currentProblem, elements.modeSelect.value);
        showCorrect(correct);
      } else {
        elements.correctDisplay.classList.add('hidden');
      }
    } else if (event.key.toLowerCase() === 'r') {
      state.score = 0;
      state.streak = 0;
      saveSetting('score', state.score);
      saveSetting('streak', state.streak);
      updateScoreUI();
      updateStatsUI();
    }
  }

  function runSelfTests() {
    const tests = [];

    const csv = createCsv(['h1', 'h2'], [['a', 'b'], ['c', 'd']]);
    const lines = csv.split('\n');
    const csvPass = lines.length === 3 && !csv.includes('\r');
    tests.push({ name: 'T-CSV-LF', pass: csvPass });

    const problem = { dividend: 915, divisor: 27 };
    const firstDigit = getCorrectAnswer(problem, 'leading') === '3';
    const rounded = getCorrectAnswer(problem, 'rounded') === '34';
    tests.push({ name: 'T-商立て(先頭桁)', pass: firstDigit });
    tests.push({ name: 'T-商立て(概算)', pass: rounded });

    const mult0 = multiplierFromStreak(0) === 1.0;
    const mult4 = multiplierFromStreak(4) === 1.0;
    const mult5 = multiplierFromStreak(5) === 1.5;
    const mult10 = multiplierFromStreak(10) === 2.0;
    const multiplierPass = mult0 && mult4 && mult5 && mult10;
    tests.push({ name: 'T-倍率', pass: multiplierPass });

    elements.testResults.innerHTML = tests.map(test => {
      const cls = test.pass ? 'pass' : 'fail';
      return `<span class="${cls}">${test.name}: ${test.pass ? 'PASS' : 'FAIL'}</span>`;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    initElements();
    attachEvents();
    loadSettings();
    runSelfTests();
    validateDigitRanges();
  });
})();
