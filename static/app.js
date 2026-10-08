const LETTERS = ["A", "B", "C", "D", "E", "F", "G"];
const SOLFEGE = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const TOTAL_QUESTIONS = 20;

const state = {
  question: null,
  selectedLetter: null,
  selectedSolfege: null,
  answered: false,
  levelId: "position-1",
  levels: [],
  questionNumber: 1,
};

const elements = {
  levelList: document.querySelector("#level-list"),
  levelSummary: document.querySelector("#level-summary"),
  levelLabel: document.querySelector("#level-label"),
  rangeText: document.querySelector("#range-text"),
  levelModal: document.querySelector("#level-modal"),
  openLevelModal: document.querySelector("#open-level-modal"),
  closeLevelModal: document.querySelector("#close-level-modal"),
  progressLevelButton: document.querySelector("#progress-level-button"),
  practiceView: document.querySelector("#practice-view"),
  progressView: document.querySelector("#progress-view"),
  practiceContent: document.querySelector("#practice-content"),
  completionScreen: document.querySelector("#completion-screen"),
  completionTitle: document.querySelector("#completion-title"),
  completionMessage: document.querySelector("#completion-message"),
  completionOpenLevels: document.querySelector("#completion-open-levels"),
  completionOpenProgress: document.querySelector("#completion-open-progress"),
  positionProgress: document.querySelector("#position-progress"),
  reviewProgress: document.querySelector("#review-progress"),
  dashboardAttempts: document.querySelector("#dashboard-attempts"),
  dashboardAccuracy: document.querySelector("#dashboard-accuracy"),
  dashboardCompleted: document.querySelector("#dashboard-completed"),
  dashboardMistakes: document.querySelector("#dashboard-mistakes"),
  dashboardLevelOverview: document.querySelector("#dashboard-level-overview"),
  pageTitle: document.querySelector("#page-title"),
  navItems: document.querySelectorAll("[data-view]"),
  letterOptions: document.querySelector("#letter-options"),
  solfegeOptions: document.querySelector("#solfege-options"),
  letterState: document.querySelector("#letter-state"),
  solfegeState: document.querySelector("#solfege-state"),
  questionStatus: document.querySelector("#question-status"),
  roundNumber: document.querySelector("#round-number"),
  feedback: document.querySelector("#feedback"),
  nextButton: document.querySelector("#next-button"),
  noteShape: document.querySelector("#note-shape"),
  ledgerLines: document.querySelector("#ledger-lines"),
  stem: document.querySelector("#note-shape .stem"),
  correctCount: document.querySelector("#correct-count"),
  attemptCount: document.querySelector("#attempt-count"),
  accuracy: document.querySelector("#accuracy"),
  letterCorrect: document.querySelector("#letter-correct"),
  solfegeCorrect: document.querySelector("#solfege-correct"),
  donut: document.querySelector("#donut"),
  mistakeCount: document.querySelector("#mistake-count"),
  mistakeList: document.querySelector("#mistake-list"),
};

function createOption(group, value, label) {
  const button = document.createElement("button");
  button.className = "answer-button";
  button.type = "button";
  button.dataset.group = group;
  button.dataset.value = value;
  button.textContent = label;
  button.addEventListener("click", () => selectAnswer(group, value, button));
  return button;
}

function renderOptions() {
  elements.letterOptions.replaceChildren(...LETTERS.map((value) => createOption("letter", value, value)));
  elements.solfegeOptions.replaceChildren(...SOLFEGE.map((value) => createOption("solfege", value, value)));
}

function renderLevels() {
  const completed = state.levels.filter((level) => level.completed).length;
  elements.levelSummary.textContent = `${completed} / ${state.levels.length} 關已完成`;
  elements.levelList.replaceChildren(...state.levels.map((level) => {
    const button = document.createElement("button");
    const activeClass = level.id === state.levelId ? "is-active" : "";
    const completeClass = level.completed ? "is-complete" : "";
    button.className = `level-button is-${level.kind} ${activeClass} ${completeClass}`;
    button.type = "button";
    button.setAttribute("aria-pressed", String(level.id === state.levelId));
    button.innerHTML = `<span class="level-number">${level.position || (level.kind === "total" ? "總" : "複")}</span><span class="level-copy"><span class="level-name">${level.label}</span><span class="level-meta">${level.completed ? "已完成" : `${level.attempts} / ${level.question_count} 題`}</span></span>`;
    button.addEventListener("click", () => selectLevel(level.id));
    return button;
  }));
  const currentLevel = state.levels.find((level) => level.id === state.levelId);
  if (currentLevel) {
    elements.levelLabel.textContent = currentLevel.label;
    elements.rangeText.textContent = `目前範圍：${currentLevel.range_label}`;
  }
  renderProgress();
}

function createProgressCard(level) {
  const card = document.createElement("article");
  const progress = Math.min(level.attempts / level.question_count * 100, 100);
  card.className = `progress-card is-${level.kind}`;
  card.innerHTML = `<div class="progress-card-heading"><span class="progress-card-badge">${level.position || (level.kind === "total" ? "總" : "複")}</span><div><h4>${level.label}</h4><p>${level.attempts} / ${level.question_count} 題 · ${level.completed ? "已完成" : "進行中"}</p></div></div><div class="progress-track"><span style="width: ${progress}%"></span></div><div class="progress-card-footer"><span class="progress-stat">正確率<strong>${level.accuracy}%</strong></span><span class="progress-stat">錯題<strong>${level.mistakes}</strong></span><button class="progress-enter" type="button">進入 →</button></div>`;
  card.querySelector(".progress-enter").addEventListener("click", () => selectLevel(level.id));
  return card;
}

function createLevelOverviewRow(level) {
  const row = document.createElement("div");
  const progress = Math.min(level.attempts / level.question_count * 100, 100);
  row.className = `dashboard-level-row is-${level.kind}`;
  row.innerHTML = `<div class="dashboard-level-name"><span class="dashboard-level-badge">${level.position || (level.kind === "total" ? "總" : "複")}</span><strong>${level.label}</strong></div><div class="dashboard-level-track"><span style="width: ${progress}%"></span></div><span class="dashboard-level-count">${level.attempts} / ${level.question_count}</span><strong class="dashboard-level-accuracy">${level.accuracy}%</strong>`;
  row.addEventListener("click", () => selectLevel(level.id));
  return row;
}

function renderProgress() {
  const positionLevels = state.levels.filter((level) => level.kind === "position");
  const reviewLevels = state.levels.filter((level) => level.kind !== "position");
  const totalAttempts = state.levels.reduce((sum, level) => sum + level.attempts, 0);
  const totalCorrect = state.levels.reduce((sum, level) => sum + level.fully_correct, 0);
  const totalMistakes = state.levels.reduce((sum, level) => sum + level.mistakes, 0);
  const completedLevels = state.levels.filter((level) => level.completed).length;
  elements.dashboardAttempts.textContent = totalAttempts;
  elements.dashboardAccuracy.textContent = `${totalAttempts ? Math.round(totalCorrect / totalAttempts * 100) : 0}%`;
  elements.dashboardCompleted.textContent = `${completedLevels} / ${state.levels.length}`;
  elements.dashboardMistakes.textContent = totalMistakes;
  elements.dashboardLevelOverview.replaceChildren(...state.levels.map(createLevelOverviewRow));
  elements.positionProgress.replaceChildren(...positionLevels.map(createProgressCard));
  elements.reviewProgress.replaceChildren(...reviewLevels.map(createProgressCard));
}

async function loadLevels() {
  const response = await fetch("/api/levels");
  if (!response.ok) throw new Error("無法取得關卡");
  const payload = await response.json();
  state.levels = payload.levels;
  if (!state.levels.some((level) => level.id === state.levelId)) state.levelId = state.levels[0].id;
  renderLevels();
}

async function selectLevel(levelId) {
  state.levelId = levelId;
  state.questionNumber = 1;
  closeLevelModal();
  setView("practice");
  renderLevels();
  await Promise.all([loadQuestion(), refreshReport()]);
}

function setView(view) {
  const isProgress = view === "progress";
  elements.practiceView.hidden = isProgress;
  elements.progressView.hidden = !isProgress;
  elements.pageTitle.textContent = isProgress ? "學習進度" : "視譜練習";
  elements.navItems.forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
  if (isProgress) renderProgress();
}

function openLevelModal() {
  elements.levelModal.hidden = false;
  elements.closeLevelModal.focus();
}

function closeLevelModal() {
  elements.levelModal.hidden = true;
}

function selectAnswer(group, value, button) {
  if (state.answered) return;
  const selector = `.answer-button[data-group="${group}"]`;
  document.querySelectorAll(selector).forEach((option) => option.classList.remove("is-selected"));
  button.classList.add("is-selected");
  if (group === "letter") {
    state.selectedLetter = value;
    elements.letterState.textContent = value;
  } else {
    state.selectedSolfege = value;
    elements.solfegeState.textContent = value;
  }
  elements.questionStatus.textContent = state.selectedLetter && state.selectedSolfege ? "正在判定" : "還差一個答案";
  if (state.selectedLetter && state.selectedSolfege) submitAnswer();
}

async function loadQuestion() {
  const response = await fetch(`/api/question?level_id=${encodeURIComponent(state.levelId)}`);
  if (!response.ok) throw new Error("無法取得題目");
  state.question = await response.json();
  state.selectedLetter = null;
  state.selectedSolfege = null;
  state.answered = false;
  elements.rangeText.textContent = `目前範圍：${state.question.range_label}`;
  elements.practiceContent.hidden = false;
  elements.completionScreen.hidden = true;
  elements.roundNumber.textContent = String(state.questionNumber).padStart(2, "0");
  elements.questionStatus.textContent = "請選擇兩個答案";
  elements.letterState.textContent = "尚未選擇";
  elements.solfegeState.textContent = "尚未選擇";
  elements.feedback.hidden = true;
  elements.nextButton.hidden = true;
  elements.nextButton.textContent = state.questionNumber === TOTAL_QUESTIONS ? "完成關卡 →" : "下一題 →";
  setNotePosition(state.question.staff_position);
  renderOptions();
}

function setNotePosition(position) {
  const y = 155 - position * 10;
  elements.noteShape.setAttribute("transform", `translate(0 ${y - 115})`);
  const stemDown = position >= 5;
  elements.stem.setAttribute("x1", stemDown ? "417" : "443");
  elements.stem.setAttribute("x2", stemDown ? "417" : "443");
  elements.stem.setAttribute("y1", "115");
  elements.stem.setAttribute("y2", stemDown ? "181" : "49");
  elements.ledgerLines.replaceChildren();
  const ledgerPositions = [];
  if (position < 0) {
    for (let current = -2; current >= position; current -= 2) ledgerPositions.push(current);
  }
  if (position > 8) {
    for (let current = 10; current <= position; current += 2) ledgerPositions.push(current);
  }
  ledgerPositions.forEach((ledgerPosition) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const ledgerY = 155 - ledgerPosition * 10;
    line.setAttribute("x1", "402");
    line.setAttribute("x2", "458");
    line.setAttribute("y1", String(ledgerY));
    line.setAttribute("y2", String(ledgerY));
    elements.ledgerLines.appendChild(line);
  });
}

async function submitAnswer() {
  state.answered = true;
  document.querySelectorAll(".answer-button").forEach((button) => { button.disabled = true; });
  let response;
  try {
    response = await fetch("/api/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level_id: state.levelId,
        question_number: state.questionNumber,
        note_id: state.question.id,
        letter_answer: state.selectedLetter,
        solfege_answer: state.selectedSolfege,
      }),
    });
  } catch (error) {
    state.answered = false;
    document.querySelectorAll(".answer-button").forEach((button) => { button.disabled = false; });
    showError("紀錄答題時發生問題，請再試一次。");
    return;
  }
  if (!response.ok) {
    state.answered = false;
    document.querySelectorAll(".answer-button").forEach((button) => { button.disabled = false; });
    showError("紀錄答題時發生問題，請再試一次。");
    return;
  }
  const result = await response.json();
  markAnswers(result);
  await Promise.all([refreshReport(), loadLevels()]);
}

function markAnswers(result) {
  document.querySelectorAll(".answer-button").forEach((button) => {
    const group = button.dataset.group;
    const value = button.dataset.value;
    const correctValue = group === "letter" ? result.correct_letter : result.correct_solfege;
    button.classList.toggle("is-correct", value === correctValue);
    button.classList.toggle("is-wrong", value !== correctValue && value === (group === "letter" ? state.selectedLetter : state.selectedSolfege));
  });
  const resultText = result.fully_correct
    ? `答對了！${result.correct_letter} 就是 ${result.correct_solfege}。`
    : `這題是 ${result.correct_letter}／${result.correct_solfege}。${result.letter_correct ? "代號正確" : "代號需要再看一次"}，${result.solfege_correct ? "音名正確" : "音名需要再看一次"}。`;
  elements.feedback.textContent = resultText;
  elements.feedback.className = `feedback ${result.fully_correct ? "is-correct" : "is-wrong"}`;
  elements.feedback.hidden = false;
  elements.nextButton.hidden = false;
  elements.questionStatus.textContent = result.fully_correct ? "全對" : "再練一次";
}

async function handleNext() {
  if (!state.answered) return;
  if (state.questionNumber >= TOTAL_QUESTIONS) {
    const currentLevel = state.levels.find((level) => level.id === state.levelId);
    elements.practiceContent.hidden = true;
    elements.completionScreen.hidden = false;
    elements.completionTitle.textContent = `${currentLevel ? currentLevel.label : "本關"}完成！`;
    elements.completionMessage.textContent = `你完成了本關 ${TOTAL_QUESTIONS} 題，可以繼續挑戰其他關卡或查看學習進度。`;
    await loadLevels();
    return;
  }
  state.questionNumber += 1;
  await loadQuestion();
}

async function refreshReport() {
  const response = await fetch(`/api/report?level_id=${encodeURIComponent(state.levelId)}`);
  if (!response.ok) throw new Error("無法取得報表");
  renderReport(await response.json());
}

function renderReport(report) {
  const { summary, notes } = report;
  elements.correctCount.textContent = summary.fully_correct;
  elements.attemptCount.textContent = `/ ${summary.attempts}`;
  elements.accuracy.textContent = `${summary.accuracy}%`;
  elements.letterCorrect.textContent = summary.letter_correct;
  elements.solfegeCorrect.textContent = summary.solfege_correct;
  const accuracyAngle = summary.attempts ? (summary.fully_correct / summary.attempts) * 360 : 0;
  elements.donut.style.background = `conic-gradient(var(--green) 0deg ${accuracyAngle}deg, var(--lavender-deep) ${accuracyAngle}deg 360deg)`;

  const practiced = notes.filter((note) => note.attempts > 0);
  elements.mistakeCount.textContent = practiced.filter((note) => note.mistakes > 0).length;
  const ranked = [...notes].sort((left, right) => right.mistakes - left.mistakes || right.attempts - left.attempts);
  const maxMistakes = Math.max(...ranked.map((note) => note.mistakes), 1);
  if (!practiced.length) {
    elements.mistakeList.innerHTML = `<p class="empty-report">完成幾題後，這裡會顯示需要加強的音符。</p>`;
    return;
  }
  elements.mistakeList.replaceChildren(...ranked.slice(0, 7).map((note) => {
    const row = document.createElement("div");
    row.className = "mistake-row";
    row.innerHTML = `<span class="mistake-label">${note.id}</span><span></span><span class="mistake-value">${note.mistakes}</span><div class="mistake-track"><div class="mistake-bar" style="width: ${Math.max((note.mistakes / maxMistakes) * 100, note.attempts ? 3 : 0)}%"></div></div>`;
    return row;
  }));
}

function showError(message) {
  elements.feedback.textContent = message;
  elements.feedback.className = "feedback is-wrong";
  elements.feedback.hidden = false;
}

elements.nextButton.addEventListener("click", () => handleNext().catch(() => showError("無法載入下一題。")));
elements.openLevelModal.addEventListener("click", openLevelModal);
elements.progressLevelButton.addEventListener("click", openLevelModal);
elements.completionOpenLevels.addEventListener("click", openLevelModal);
elements.completionOpenProgress.addEventListener("click", () => setView("progress"));
elements.closeLevelModal.addEventListener("click", closeLevelModal);
elements.levelModal.addEventListener("click", (event) => {
  if (event.target === elements.levelModal) closeLevelModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.levelModal.hidden) closeLevelModal();
});
elements.navItems.forEach((item) => item.addEventListener("click", (event) => {
  event.preventDefault();
  setView(item.dataset.view);
}));

async function init() {
  await loadLevels();
  await Promise.all([loadQuestion(), refreshReport()]);
}

init().catch(() => showError("無法連線到練習服務，請確認後端已啟動。"));
