let currentNormalPuzzle = null;
let finalWordInput = null;

// 選択中のカギとマス
let activeClue = null;
let activeCells = [];
let currentCellPosition = null;

// カスタムキーボードの入力先
// "cell" または "finalWord"
let keyboardTarget = "cell";

// フリック入力の状態
let activeFlickKey = null;
let flickStartX = 0;
let flickStartY = 0;
let flickPreview = null;

// ユーザーメモ
let memoSaveTimer = null;

const FLICK_DISTANCE = 24;

const FLICK_KEY_GROUPS = [
  { center: "ア", left: "イ", up: "ウ", right: "エ", down: "オ" },
  { center: "カ", left: "キ", up: "ク", right: "ケ", down: "コ" },
  { center: "サ", left: "シ", up: "ス", right: "セ", down: "ソ" },
  { center: "タ", left: "チ", up: "ツ", right: "テ", down: "ト" },
  { center: "ナ", left: "ニ", up: "ヌ", right: "ネ", down: "ノ" },
  { center: "ハ", left: "ヒ", up: "フ", right: "ヘ", down: "ホ" },
  { center: "マ", left: "ミ", up: "ム", right: "メ", down: "モ" },
  { center: "ヤ", left: "ユ", up: "ヨ", right: "ー", down: "" },
  { center: "ラ", left: "リ", up: "ル", right: "レ", down: "ロ" },
  { center: "ワ", left: "ヲ", up: "ン", right: "", down: "" }
];

const GRID_KANA_ROWS = [
  ["ア", "イ", "ウ", "エ", "オ"],
  ["カ", "キ", "ク", "ケ", "コ"],
  ["サ", "シ", "ス", "セ", "ソ"],
  ["タ", "チ", "ツ", "テ", "ト"],
  ["ナ", "ニ", "ヌ", "ネ", "ノ"],
  ["ハ", "ヒ", "フ", "ヘ", "ホ"],
  ["マ", "ミ", "ム", "メ", "モ"],
  ["ヤ", "ユ", "ヨ", "", ""],
  ["ラ", "リ", "ル", "レ", "ロ"],
  ["ワ", "ヲ", "ン", "ー", ""]
];

// ==============================
// 通常クロスワード描画
// ==============================
function renderNormalPuzzle(puzzle) {
  currentNormalPuzzle = puzzle;
  finalWordInput = null;
  activeClue = null;
  activeCells = [];
  currentCellPosition = null;
  keyboardTarget = "cell";

  puzzleTitle.textContent = puzzle.title;
  crossword.innerHTML = "";
  message.textContent = "";

  crossword.style.gridTemplateColumns = `repeat(${puzzle.size}, 50px)`;

  puzzle.grid.forEach(function(row, rowIndex) {
    row.forEach(function(answer, colIndex) {
      if (answer === null) {
        const blackCell = document.createElement("div");
        blackCell.className = "black";
        crossword.appendChild(blackCell);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "cell-wrapper";
      wrapper.dataset.row = rowIndex;
      wrapper.dataset.col = colIndex;

      const number = puzzle.numbers?.[rowIndex]?.[colIndex];
      if (number !== null && number !== undefined) {
        const numberLabel = document.createElement("span");
        numberLabel.className = "clue-number";
        numberLabel.textContent = number;
        wrapper.appendChild(numberLabel);
      }

      const wordLetter = puzzle.wordLetters?.[rowIndex]?.[colIndex];
      if (wordLetter !== null && wordLetter !== undefined) {
        const wordLabel = document.createElement("span");
        wordLabel.className = "word-letter";
        wordLabel.textContent = wordLetter;
        wrapper.appendChild(wordLabel);
      }

      const input = document.createElement("input");
      input.className = "cell";
      input.readOnly = true;
      input.inputMode = "none";
      input.maxLength = 1;
      input.dataset.answer = answer;
      input.dataset.row = rowIndex;
      input.dataset.col = colIndex;
      input.setAttribute("aria-label", `${rowIndex + 1}行${colIndex + 1}列`);

      setupNormalCellInputEvents(input);

      wrapper.appendChild(input);
      crossword.appendChild(wrapper);
    });
  });

  renderHints(puzzle);
  setupKeyboardModeButtons();
  setupKeyboardControls();
  renderCustomKeyboard();
  hideCustomKeyboard();
  setupUserMemo(puzzle);
  updateActiveClueDisplay();
}

// ==============================
// マス操作
// ==============================
function setupNormalCellInputEvents(input) {
  input.addEventListener("click", function() {
    keyboardTarget = "cell";

    const row = Number(input.dataset.row);
    const col = Number(input.dataset.col);

    selectClueFromCell(row, col);
    showCustomKeyboard();
  });

  input.addEventListener("keydown", function(event) {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      deleteCurrentCharacter();
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveCurrentCell(1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveCurrentCell(-1);
      return;
    }
  });

  input.addEventListener("focus", function() {
    keyboardTarget = "cell";
    updateCurrentCellHighlight(input);
  });
}

// クリックしたマスを含むカギを取得し、
// 初回はタテ優先、同じマスを再クリックするとタテ・ヨコを切り替える
function selectClueFromCell(row, col) {
  const availableClues = getCluesContainingCell(row, col);

  if (availableClues.length === 0) {
    return;
  }

  const sameCell =
    currentCellPosition &&
    currentCellPosition.row === row &&
    currentCellPosition.col === col;

  let nextClue;

  if (!sameCell) {
    nextClue =
      availableClues.find(function(clue) {
        return clue.direction === "down";
      }) || availableClues[0];
  } else {
    nextClue = getNextClueForCell(activeClue, availableClues);
  }

  setActiveClue(nextClue.direction, nextClue.number);
  setCurrentCell(row, col);
}

function getCluesContainingCell(row, col) {
  if (!currentNormalPuzzle) {
    return [];
  }

  const clues = [];

  ["down", "across"].forEach(function(direction) {
    const hintList = currentNormalPuzzle.hints[direction] || [];

    hintList.forEach(function(hint) {
      const clueNumber = getClueNumberFromHint(hint);
      const cells = getCellsForClue(
        currentNormalPuzzle,
        direction,
        clueNumber
      );

      const containsCell = cells.some(function(cell) {
        return cell.row === row && cell.col === col;
      });

      if (containsCell) {
        clues.push({
          direction: direction,
          number: clueNumber
        });
      }
    });
  });

  return clues;
}

function getNextClueForCell(currentClue, availableClues) {
  if (availableClues.length === 1 || !currentClue) {
    return availableClues[0];
  }

  const currentIndex = availableClues.findIndex(function(clue) {
    return (
      clue.direction === currentClue.direction &&
      clue.number === currentClue.number
    );
  });

  if (currentIndex === -1) {
    return availableClues[0];
  }

  return availableClues[(currentIndex + 1) % availableClues.length];
}

// ==============================
// ヒント描画
// ==============================
function renderHints(puzzle) {
  acrossHints.innerHTML = "";
  downHints.innerHTML = "";
  finalWordArea.innerHTML = "";
  finalWordInput = null;

  puzzle.hints.across.forEach(function(hint) {
    const li = createHintListItem("across", hint);
    acrossHints.appendChild(li);
  });

  puzzle.hints.down.forEach(function(hint) {
    const li = createHintListItem("down", hint);
    downHints.appendChild(li);
  });

  if (puzzle.finalWordHint) {
    const keywordBox = document.createElement("div");
    keywordBox.className = "final-word-box";

    const keywordTitle = document.createElement("h4");
    keywordTitle.textContent = "キーワード";

    const keywordHint = document.createElement("p");
    keywordHint.textContent = puzzle.finalWordHint;

    finalWordInput = document.createElement("input");
    finalWordInput.className = "final-word-input";
    finalWordInput.placeholder = "ここを選択して入力";
    finalWordInput.readOnly = true;
    finalWordInput.inputMode = "none";
    finalWordInput.maxLength = puzzle.finalWordAnswer
      ? Array.from(puzzle.finalWordAnswer).length
      : 20;

    finalWordInput.addEventListener("click", function() {
      keyboardTarget = "finalWord";
      clearCurrentCellHighlight();
      finalWordInput.classList.add("keyboard-target");
      updateActiveClueDisplay();
      showCustomKeyboard();
    });

    keywordBox.appendChild(keywordTitle);
    keywordBox.appendChild(keywordHint);
    keywordBox.appendChild(finalWordInput);

    finalWordArea.appendChild(keywordBox);
  }
}

function createHintListItem(direction, hint) {
  const li = document.createElement("li");
  li.textContent = hint;

  const clueNumber = getClueNumberFromHint(hint);
  li.dataset.direction = direction;
  li.dataset.number = clueNumber;

  li.addEventListener("click", function() {
    keyboardTarget = "cell";
    setActiveClue(direction, clueNumber);

    const preferredCell =
      activeCells.find(function(cell) {
        const input = getInputByPosition(cell.row, cell.col);
        return input && input.value === "";
      }) || activeCells[0];

    if (preferredCell) {
      setCurrentCell(preferredCell.row, preferredCell.col);
    }

    showCustomKeyboard();
  });

  return li;
}

// ==============================
// カギ選択
// ==============================
function setActiveClue(direction, clueNumber) {
  if (!currentNormalPuzzle) {
    return;
  }

  activeClue = {
    direction: direction,
    number: clueNumber
  };

  activeCells = getCellsForClue(
    currentNormalPuzzle,
    direction,
    clueNumber
  );

  updateSelectionUI();
  updateActiveClueDisplay();
}

function getCellsForClue(puzzle, direction, clueNumber) {
  const start = findClueStartPosition(puzzle, clueNumber);

  if (!start) {
    return [];
  }

  const cells = [];
  let row = start.row;
  let col = start.col;

  while (
    row >= 0 &&
    row < puzzle.grid.length &&
    col >= 0 &&
    col < puzzle.grid[row].length &&
    puzzle.grid[row][col] !== null
  ) {
    cells.push({
      row: row,
      col: col
    });

    if (direction === "across") {
      col += 1;
    } else {
      row += 1;
    }
  }

  return cells;
}

function findClueStartPosition(puzzle, clueNumber) {
  for (let row = 0; row < puzzle.numbers.length; row += 1) {
    for (let col = 0; col < puzzle.numbers[row].length; col += 1) {
      if (puzzle.numbers[row][col] === clueNumber) {
        return {
          row: row,
          col: col
        };
      }
    }
  }

  return null;
}

function getClueNumberFromHint(hint) {
  const match = hint.match(/^(\d+)\./);
  return match ? Number(match[1]) : null;
}

function getClueText(direction, clueNumber) {
  if (!currentNormalPuzzle) {
    return "";
  }

  const list = currentNormalPuzzle.hints[direction] || [];

  return (
    list.find(function(hint) {
      return getClueNumberFromHint(hint) === clueNumber;
    }) || ""
  );
}

// ==============================
// 現在マス
// ==============================
function setCurrentCell(row, col) {
  currentCellPosition = {
    row: row,
    col: col
  };

  keyboardTarget = "cell";

  if (finalWordInput) {
    finalWordInput.classList.remove("keyboard-target");
  }

  const input = getInputByPosition(row, col);

  if (input) {
    input.focus({
      preventScroll: true
    });
  }

  updateSelectionUI();
}

function moveCurrentCell(offset) {
  if (!currentCellPosition || activeCells.length === 0) {
    return;
  }

  const index = activeCells.findIndex(function(cell) {
    return (
      cell.row === currentCellPosition.row &&
      cell.col === currentCellPosition.col
    );
  });

  if (index === -1) {
    return;
  }

  const nextIndex = index + offset;

  if (nextIndex < 0 || nextIndex >= activeCells.length) {
    return;
  }

  const nextCell = activeCells[nextIndex];
  setCurrentCell(nextCell.row, nextCell.col);
}

// ==============================
// キーボード表示・非表示
// ==============================
function showCustomKeyboard() {
  const keyboardPanel = document.getElementById("keyboardPanel");
  const backdrop = document.getElementById("keyboardBackdrop");

  if (!keyboardPanel) {
    return;
  }

  keyboardPanel.classList.remove("hidden");

  if (backdrop) {
    backdrop.classList.remove("hidden");
  }

  document.body.classList.add("keyboard-open");

  // キーボード表示後も、選択中のマスが見える位置へ調整する
  window.setTimeout(function() {
    scrollCurrentTargetAboveKeyboard();
  }, 50);
}

function hideCustomKeyboard() {
  const keyboardPanel = document.getElementById("keyboardPanel");
  const backdrop = document.getElementById("keyboardBackdrop");

  if (keyboardPanel) {
    keyboardPanel.classList.add("hidden");
  }

  if (backdrop) {
    backdrop.classList.add("hidden");
  }

  document.body.classList.remove("keyboard-open");
  hideFlickPreview();
}

function setupKeyboardControls() {
  const closeButton = document.getElementById("closeKeyboardButton");
  const backdrop = document.getElementById("keyboardBackdrop");

  if (closeButton) {
    closeButton.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      hideCustomKeyboard();
    });

    closeButton.addEventListener("pointerup", function(event) {
      event.preventDefault();
      event.stopPropagation();
      hideCustomKeyboard();
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", function() {
      hideCustomKeyboard();
    });
  }

  document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
      hideCustomKeyboard();
    }
  });
}

function scrollCurrentTargetAboveKeyboard() {
  let target = null;

  if (keyboardTarget === "finalWord") {
    target = finalWordInput;
  } else if (currentCellPosition) {
    target = getInputByPosition(
      currentCellPosition.row,
      currentCellPosition.col
    );
  }

  if (!target) {
    return;
  }

  const keyboardPanel = document.getElementById("keyboardPanel");

  if (!keyboardPanel || keyboardPanel.classList.contains("hidden")) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const keyboardRect = keyboardPanel.getBoundingClientRect();

  if (targetRect.bottom > keyboardRect.top - 16) {
    const amount = targetRect.bottom - keyboardRect.top + 32;

    window.scrollBy({
      top: amount,
      behavior: "smooth"
    });
  }
}

// ==============================
// カスタムキーボード
// ==============================
function setupKeyboardModeButtons() {
  const flickButton = document.getElementById("flickModeButton");
  const gridButton = document.getElementById("gridModeButton");

  if (!flickButton || !gridButton) {
    return;
  }

  flickButton.onclick = function() {
    localStorage.setItem("preferredNormalKeyboard", "flick");
    renderCustomKeyboard();
  };

  gridButton.onclick = function() {
    localStorage.setItem("preferredNormalKeyboard", "grid");
    renderCustomKeyboard();
  };
}

function getPreferredKeyboardMode() {
  const saved = localStorage.getItem("preferredNormalKeyboard");

  if (saved === "flick" || saved === "grid") {
    return saved;
  }

  const touchPrimary = window.matchMedia(
    "(pointer: coarse) and (hover: none)"
  ).matches;

  return touchPrimary ? "flick" : "grid";
}

function renderCustomKeyboard() {
  const keyboard = document.getElementById("customKeyboard");

  if (!keyboard) {
    return;
  }

  const mode = getPreferredKeyboardMode();
  keyboard.innerHTML = "";
  keyboard.className = `custom-keyboard ${mode}-keyboard`;

  updateKeyboardModeButtons(mode);

  if (mode === "flick") {
    renderFlickKeyboard(keyboard);
  } else {
    renderGridKeyboard(keyboard);
    renderKeyboardControlRow(keyboard);
  }
}

function updateKeyboardModeButtons(mode) {
  const flickButton = document.getElementById("flickModeButton");
  const gridButton = document.getElementById("gridModeButton");

  if (!flickButton || !gridButton) {
    return;
  }

  flickButton.classList.toggle("selected", mode === "flick");
  gridButton.classList.toggle("selected", mode === "grid");
}

function renderGridKeyboard(keyboard) {
  GRID_KANA_ROWS.forEach(function(row) {
    const rowElement = document.createElement("div");
    rowElement.className = "kana-grid-row";

    row.forEach(function(char) {
      const button = createKanaButton(char);
      rowElement.appendChild(button);
    });

    keyboard.appendChild(rowElement);
  });
}

function renderFlickKeyboard(keyboard) {
  const keysContainer = document.createElement("div");
  keysContainer.className = "flick-keys";

  FLICK_KEY_GROUPS.forEach(function(group) {
    const button = createFlickGroupButton(group);
    keysContainer.appendChild(button);
  });

  // スマホ標準の日本語フリックに近い4段目
  const dakutenButton = createFlickUtilityButton("゛゜", function() {
    cycleVoicingMark();
  });

  const longSoundButton = createFlickUtilityButton("ー", function() {
    inputCharacter("ー");
  });

  const deleteButton = createFlickUtilityButton("削除", function() {
    deleteCurrentCharacter();
  });

  keysContainer.appendChild(dakutenButton);
  keysContainer.appendChild(longSoundButton);
  keysContainer.appendChild(deleteButton);

  keyboard.appendChild(keysContainer);

  const navigationRow = document.createElement("div");
  navigationRow.className = "flick-navigation-row";

  navigationRow.appendChild(
    createControlButton("←", function() {
      moveCurrentCell(-1);
    })
  );

  navigationRow.appendChild(
    createControlButton("→", function() {
      moveCurrentCell(1);
    })
  );

  keyboard.appendChild(navigationRow);
}

function createFlickGroupButton(group) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flick-key";
  button.textContent = group.center;
  button.setAttribute(
    "aria-label",
    `${group.center}${group.left}${group.up}${group.right}${group.down}`
  );

  button.addEventListener("pointerdown", function(event) {
    event.preventDefault();

    activeFlickKey = {
      button: button,
      group: group,
      pointerId: event.pointerId,
      direction: "center"
    };

    flickStartX = event.clientX;
    flickStartY = event.clientY;

    button.setPointerCapture(event.pointerId);
    showFlickPreview(button, group, "center");
  });

  button.addEventListener("pointermove", function(event) {
    if (
      !activeFlickKey ||
      activeFlickKey.button !== button ||
      activeFlickKey.pointerId !== event.pointerId
    ) {
      return;
    }

    const direction = getFlickDirection(
      event.clientX - flickStartX,
      event.clientY - flickStartY
    );

    activeFlickKey.direction = direction;
    showFlickPreview(button, group, direction);
  });

  button.addEventListener("pointerup", function(event) {
    if (
      !activeFlickKey ||
      activeFlickKey.button !== button ||
      activeFlickKey.pointerId !== event.pointerId
    ) {
      return;
    }

    const char = group[activeFlickKey.direction];

    hideFlickPreview();
    activeFlickKey = null;

    if (char) {
      inputCharacter(char);
    }
  });

  button.addEventListener("pointercancel", function() {
    hideFlickPreview();
    activeFlickKey = null;
  });

  return button;
}

function createFlickUtilityButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "flick-key flick-utility-key";
  button.textContent = label;

  button.addEventListener("click", handler);

  return button;
}

function cycleVoicingMark() {
  if (keyboardTarget === "finalWord") {
    if (!finalWordInput) {
      return;
    }

    const chars = Array.from(finalWordInput.value);

    if (chars.length === 0) {
      return;
    }

    const lastIndex = chars.length - 1;
    chars[lastIndex] = getNextVoicedCharacter(chars[lastIndex]);
    finalWordInput.value = chars.join("");
    return;
  }

  if (!currentCellPosition) {
    return;
  }

  const input = getInputByPosition(
    currentCellPosition.row,
    currentCellPosition.col
  );

  if (!input || !input.value) {
    return;
  }

  input.value = getNextVoicedCharacter(input.value);
}

function getNextVoicedCharacter(char) {
  const cycleMap = {
    カ: "ガ", ガ: "カ",
    キ: "ギ", ギ: "キ",
    ク: "グ", グ: "ク",
    ケ: "ゲ", ゲ: "ケ",
    コ: "ゴ", ゴ: "コ",

    サ: "ザ", ザ: "サ",
    シ: "ジ", ジ: "シ",
    ス: "ズ", ズ: "ス",
    セ: "ゼ", ゼ: "セ",
    ソ: "ゾ", ゾ: "ソ",

    タ: "ダ", ダ: "タ",
    チ: "ヂ", ヂ: "チ",
    ツ: "ヅ", ヅ: "ツ",
    テ: "デ", デ: "テ",
    ト: "ド", ド: "ト",

    ハ: "バ", バ: "パ", パ: "ハ",
    ヒ: "ビ", ビ: "ピ", ピ: "ヒ",
    フ: "ブ", ブ: "プ", プ: "フ",
    ヘ: "ベ", ベ: "ペ", ペ: "ヘ",
    ホ: "ボ", ボ: "ポ", ポ: "ホ",

    ウ: "ヴ", ヴ: "ウ"
  };

  return cycleMap[char] || char;
}

function getFlickDirection(dx, dy) {
  if (Math.abs(dx) < FLICK_DISTANCE && Math.abs(dy) < FLICK_DISTANCE) {
    return "center";
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? "left" : "right";
  }

  return dy < 0 ? "up" : "down";
}

function showFlickPreview(button, group, selectedDirection) {
  hideFlickPreview();

  const preview = document.createElement("div");
  preview.className = "flick-preview";

  ["center", "left", "up", "right", "down"].forEach(function(direction) {
    const item = document.createElement("span");
    item.className = `flick-preview-${direction}`;
    item.textContent = group[direction];

    if (!group[direction]) {
      item.classList.add("empty");
    }

    if (direction === selectedDirection && group[direction]) {
      item.classList.add("selected");
    }

    preview.appendChild(item);
  });

  document.body.appendChild(preview);

  const rect = button.getBoundingClientRect();
  preview.style.left = `${rect.left + rect.width / 2}px`;
  preview.style.top = `${rect.top + rect.height / 2}px`;

  flickPreview = preview;
}

function hideFlickPreview() {
  if (flickPreview) {
    flickPreview.remove();
    flickPreview = null;
  }
}

function createKanaButton(char) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kana-key";
  button.textContent = char;

  if (!char) {
    button.disabled = true;
    button.classList.add("empty-key");
    button.setAttribute("aria-hidden", "true");
    return button;
  }

  button.addEventListener("click", function() {
    inputCharacter(char);
  });

  return button;
}

function renderKeyboardControlRow(keyboard) {
  const row = document.createElement("div");
  row.className = "keyboard-control-row";

  const previousButton = createControlButton("←", function() {
    moveCurrentCell(-1);
  });

  const dakutenButton = createControlButton("゛", function() {
    applyDakuten();
  });

  const handakutenButton = createControlButton("゜", function() {
    applyHandakuten();
  });

  const deleteButton = createControlButton("削除", function() {
    deleteCurrentCharacter();
  });

  const nextButton = createControlButton("→", function() {
    moveCurrentCell(1);
  });

  row.appendChild(previousButton);
  row.appendChild(dakutenButton);
  row.appendChild(handakutenButton);
  row.appendChild(deleteButton);
  row.appendChild(nextButton);

  keyboard.appendChild(row);
}

function createControlButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "keyboard-control-key";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

// ==============================
// 文字入力
// ==============================
function inputCharacter(char) {
  if (keyboardTarget === "finalWord") {
    inputFinalWordCharacter(char);
    return;
  }

  if (!currentCellPosition || activeCells.length === 0) {
    return;
  }

  const input = getInputByPosition(
    currentCellPosition.row,
    currentCellPosition.col
  );

  if (!input) {
    return;
  }

  input.value = char;

  const currentIndex = activeCells.findIndex(function(cell) {
    return (
      cell.row === currentCellPosition.row &&
      cell.col === currentCellPosition.col
    );
  });

  if (currentIndex >= 0 && currentIndex < activeCells.length - 1) {
    const nextCell = activeCells[currentIndex + 1];
    setCurrentCell(nextCell.row, nextCell.col);
  } else {
    updateSelectionUI();
  }
}

function inputFinalWordCharacter(char) {
  if (!finalWordInput) {
    return;
  }

  const maxLength = Number(finalWordInput.maxLength) || 20;
  const chars = Array.from(finalWordInput.value);

  if (chars.length >= maxLength) {
    return;
  }

  chars.push(char);
  finalWordInput.value = chars.join("");
}

function deleteCurrentCharacter() {
  if (keyboardTarget === "finalWord") {
    if (!finalWordInput) {
      return;
    }

    const chars = Array.from(finalWordInput.value);
    chars.pop();
    finalWordInput.value = chars.join("");
    return;
  }

  if (!currentCellPosition || activeCells.length === 0) {
    return;
  }

  const input = getInputByPosition(
    currentCellPosition.row,
    currentCellPosition.col
  );

  if (!input) {
    return;
  }

  if (input.value !== "") {
    input.value = "";
    return;
  }

  const currentIndex = activeCells.findIndex(function(cell) {
    return (
      cell.row === currentCellPosition.row &&
      cell.col === currentCellPosition.col
    );
  });

  if (currentIndex > 0) {
    const previousCell = activeCells[currentIndex - 1];
    const previousInput = getInputByPosition(
      previousCell.row,
      previousCell.col
    );

    if (previousInput) {
      previousInput.value = "";
      setCurrentCell(previousCell.row, previousCell.col);
    }
  }
}

function applyDakuten() {
  transformCurrentCharacter({
    カ: "ガ", キ: "ギ", ク: "グ", ケ: "ゲ", コ: "ゴ",
    サ: "ザ", シ: "ジ", ス: "ズ", セ: "ゼ", ソ: "ゾ",
    タ: "ダ", チ: "ヂ", ツ: "ヅ", テ: "デ", ト: "ド",
    ハ: "バ", ヒ: "ビ", フ: "ブ", ヘ: "ベ", ホ: "ボ",
    ウ: "ヴ"
  });
}

function applyHandakuten() {
  transformCurrentCharacter({
    ハ: "パ", ヒ: "ピ", フ: "プ", ヘ: "ペ", ホ: "ポ",
    バ: "パ", ビ: "ピ", ブ: "プ", ベ: "ペ", ボ: "ポ"
  });
}

function transformCurrentCharacter(map) {
  if (keyboardTarget === "finalWord") {
    if (!finalWordInput) {
      return;
    }

    const chars = Array.from(finalWordInput.value);

    if (chars.length === 0) {
      return;
    }

    const lastIndex = chars.length - 1;
    chars[lastIndex] = map[chars[lastIndex]] || chars[lastIndex];
    finalWordInput.value = chars.join("");
    return;
  }

  if (!currentCellPosition) {
    return;
  }

  const input = getInputByPosition(
    currentCellPosition.row,
    currentCellPosition.col
  );

  if (!input) {
    return;
  }

  input.value = map[input.value] || input.value;
}

// ==============================
// UI更新
// ==============================
function updateSelectionUI() {
  document.querySelectorAll(".cell-wrapper").forEach(function(wrapper) {
    wrapper.classList.remove("active-clue", "current-cell");
  });

  document.querySelectorAll(".hints li").forEach(function(hint) {
    hint.classList.remove("selected-clue");
  });

  activeCells.forEach(function(cell) {
    const wrapper = getWrapperByPosition(cell.row, cell.col);

    if (wrapper) {
      wrapper.classList.add("active-clue");
    }
  });

  if (currentCellPosition) {
    const currentWrapper = getWrapperByPosition(
      currentCellPosition.row,
      currentCellPosition.col
    );

    if (currentWrapper) {
      currentWrapper.classList.add("current-cell");
    }
  }

  if (activeClue) {
    const selectedHint = document.querySelector(
      `.hints li[data-direction="${activeClue.direction}"][data-number="${activeClue.number}"]`
    );

    if (selectedHint) {
      selectedHint.classList.add("selected-clue");
    }
  }
}

function updateActiveClueDisplay() {
  const display = document.getElementById("activeClueDisplay");

  if (!display) {
    return;
  }

  if (keyboardTarget === "finalWord") {
    display.textContent = currentNormalPuzzle?.finalWordHint
      ? `キーワード　${currentNormalPuzzle.finalWordHint}`
      : "キーワードを入力";
    return;
  }

  if (!activeClue) {
    display.textContent = "マスまたはカギを選択してください";
    return;
  }

  const directionLabel =
    activeClue.direction === "down" ? "タテ" : "ヨコ";

  display.textContent =
    `${directionLabel} ${getClueText(
      activeClue.direction,
      activeClue.number
    )}`;
}

function updateCurrentCellHighlight(input) {
  clearCurrentCellHighlight();

  const wrapper = input.parentElement;

  if (wrapper) {
    wrapper.classList.add("current-cell");
  }
}

function clearCurrentCellHighlight() {
  document.querySelectorAll(".cell-wrapper").forEach(function(wrapper) {
    wrapper.classList.remove("current-cell");
  });
}

function getWrapperByPosition(row, col) {
  return document.querySelector(
    `.cell-wrapper[data-row="${row}"][data-col="${col}"]`
  );
}

function getInputByPosition(row, col) {
  return document.querySelector(
    `.cell[data-row="${row}"][data-col="${col}"]`
  );
}

// ==============================
// ユーザーメモ
// ==============================
function setupUserMemo(puzzle) {
  const memo = document.getElementById("userMemo");
  const clearButton = document.getElementById("clearMemoButton");
  const status = document.getElementById("memoSaveStatus");

  if (!memo || !clearButton || !status) {
    return;
  }

  const memoKey = getNormalMemoKey(puzzle);

  memo.value = localStorage.getItem(memoKey) || "";
  status.textContent = memo.value ? "保存済み" : "";

  memo.oninput = function() {
    status.textContent = "保存中…";

    if (memoSaveTimer) {
      clearTimeout(memoSaveTimer);
    }

    memoSaveTimer = setTimeout(function() {
      localStorage.setItem(memoKey, memo.value);
      status.textContent = "保存済み";
    }, 300);
  };

  clearButton.onclick = function() {
    memo.value = "";
    localStorage.removeItem(memoKey);
    status.textContent = "メモを消去しました";

    memo.focus();
  };
}

function getNormalMemoKey(puzzle) {
  return `normalMemo_${puzzle.category}_${puzzle.title}`;
}

// ==============================
// 正誤判定
// ==============================
function checkNormalAnswer(puzzle) {
  const inputs = document.querySelectorAll(".cell");

  let allCellsCorrect = true;
  let keywordCorrect = true;

  inputs.forEach(function(input) {
    if (input.value !== input.dataset.answer) {
      allCellsCorrect = false;
      input.parentElement.classList.add("incorrect");
      input.parentElement.classList.remove("correct");
    } else {
      input.parentElement.classList.add("correct");
      input.parentElement.classList.remove("incorrect");
    }
  });

  if (puzzle.finalWordAnswer) {
    if (!finalWordInput || finalWordInput.value !== puzzle.finalWordAnswer) {
      keywordCorrect = false;

      if (finalWordInput) {
        finalWordInput.classList.add("incorrect");
        finalWordInput.classList.remove("correct");
      }
    } else {
      finalWordInput.classList.add("correct");
      finalWordInput.classList.remove("incorrect");
    }
  }

  if (allCellsCorrect && keywordCorrect) {
    markPuzzleAsCleared(puzzle);
    message.textContent = "正解です！クリア！";
  } else if (allCellsCorrect && !keywordCorrect) {
    message.textContent = "マスは正解です。キーワードを確認してください。";
  } else if (!allCellsCorrect && keywordCorrect) {
    message.textContent = "キーワードは正解です。マスの答えを確認してください。";
  } else {
    message.textContent = "まだ間違いがあります。";
  }
}
