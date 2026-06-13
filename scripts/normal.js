window.PuzzleTypes = window.PuzzleTypes || {};

(function() {
  let puzzle = null;
  let finalWordInput = null;
  let activeClue = null;
  let activeCells = [];
  let currentCellPosition = null;
  let keyboardTarget = "cell";
  let memoSaveTimer = null;

  function render(targetPuzzle) {
    puzzle = targetPuzzle;
    finalWordInput = null;
    activeClue = null;
    activeCells = [];
    currentCellPosition = null;
    keyboardTarget = "cell";

    puzzleTitle.textContent = puzzle.title;
    crossword.innerHTML = "";
    message.textContent = "";

    const descriptionArea =
      document.getElementById("puzzleDescription");

    if (descriptionArea) {
      descriptionArea.innerHTML = "";
      descriptionArea.classList.add("hidden");
    }

    resetHintTitles();
    showKeywordPanel(true);

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
        if (wordLetter) {
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

        input.addEventListener("click", function() {
          keyboardTarget = "cell";
          selectClueFromCell(rowIndex, colIndex);
          openKeyboard(input);
        });

        wrapper.appendChild(input);
        crossword.appendChild(wrapper);
      });
    });

    renderHints();
    setupMemo();
    updateActiveClueDisplay();

    if (window.CrosswordKeyboard) {
      window.CrosswordKeyboard.hide();
    }
  }

  function renderHints() {
    acrossHints.innerHTML = "";
    downHints.innerHTML = "";
    finalWordArea.innerHTML = "";

    puzzle.hints.across.forEach(function(hint) {
      acrossHints.appendChild(createHintItem("across", hint));
    });

    puzzle.hints.down.forEach(function(hint) {
      downHints.appendChild(createHintItem("down", hint));
    });

    if (!puzzle.finalWordHint) {
      showKeywordPanel(false);
      return;
    }

    const box = document.createElement("div");
    box.className = "final-word-box";

    const title = document.createElement("h4");
    title.textContent = "キーワード";

    const hint = document.createElement("p");
    hint.textContent = puzzle.finalWordHint;

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
      openKeyboard(finalWordInput);
    });

    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(finalWordInput);
    finalWordArea.appendChild(box);
  }

  function createHintItem(direction, hint) {
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
          const input = getInput(cell.row, cell.col);
          return input && input.value === "";
        }) || activeCells[0];

      if (preferredCell) {
        setCurrentCell(preferredCell.row, preferredCell.col);
        openKeyboard(getInput(preferredCell.row, preferredCell.col));
      }
    });

    return li;
  }

  function openKeyboard(target) {
    window.CrosswordKeyboard.setHandlers({
      input: inputCharacter,
      delete: deleteCharacter,
      previous: function() {
        moveCurrentCell(-1);
      },
      next: function() {
        moveCurrentCell(1);
      },
      voicing: cycleVoicing,
      handVoicing: applyHandVoicing
    });

    window.CrosswordKeyboard.show(target);
  }

  function selectClueFromCell(row, col) {
    const availableClues = getCluesContainingCell(row, col);
    if (availableClues.length === 0) return;

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
      const currentIndex = availableClues.findIndex(function(clue) {
        return (
          activeClue &&
          clue.direction === activeClue.direction &&
          clue.number === activeClue.number
        );
      });

      nextClue =
        availableClues[(currentIndex + 1) % availableClues.length];
    }

    setActiveClue(nextClue.direction, nextClue.number);
    setCurrentCell(row, col);
  }

  function getCluesContainingCell(row, col) {
    const result = [];

    ["down", "across"].forEach(function(direction) {
      puzzle.hints[direction].forEach(function(hint) {
        const number = getClueNumberFromHint(hint);
        const cells = getCellsForClue(direction, number);

        if (
          cells.some(function(cell) {
            return cell.row === row && cell.col === col;
          })
        ) {
          result.push({ direction: direction, number: number });
        }
      });
    });

    return result;
  }

  function setActiveClue(direction, number) {
    activeClue = { direction: direction, number: number };
    activeCells = getCellsForClue(direction, number);
    updateSelectionUI();
    updateActiveClueDisplay();
  }

  function getCellsForClue(direction, number) {
    const start = findClueStart(number);
    if (!start) return [];

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
      cells.push({ row: row, col: col });

      if (direction === "across") {
        col += 1;
      } else {
        row += 1;
      }
    }

    return cells;
  }

  function findClueStart(number) {
    for (let row = 0; row < puzzle.numbers.length; row += 1) {
      for (let col = 0; col < puzzle.numbers[row].length; col += 1) {
        if (puzzle.numbers[row][col] === number) {
          return { row: row, col: col };
        }
      }
    }

    return null;
  }

  function getClueNumberFromHint(hint) {
    const match = hint.match(/^(\d+)\./);
    return match ? Number(match[1]) : null;
  }

  function setCurrentCell(row, col) {
    currentCellPosition = { row: row, col: col };
    keyboardTarget = "cell";

    if (finalWordInput) {
      finalWordInput.classList.remove("keyboard-target");
    }

    updateSelectionUI();
  }

  function moveCurrentCell(offset) {
    if (!currentCellPosition || activeCells.length === 0) return;

    const index = activeCells.findIndex(function(cell) {
      return (
        cell.row === currentCellPosition.row &&
        cell.col === currentCellPosition.col
      );
    });

    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= activeCells.length) return;

    const next = activeCells[nextIndex];
    setCurrentCell(next.row, next.col);
  }

  function inputCharacter(char) {
    if (keyboardTarget === "finalWord") {
      const chars = Array.from(finalWordInput.value);
      if (chars.length < finalWordInput.maxLength) {
        chars.push(char);
        finalWordInput.value = chars.join("");
      }
      return;
    }

    if (!currentCellPosition) return;

    const input = getInput(
      currentCellPosition.row,
      currentCellPosition.col
    );

    if (!input) return;

    input.value = char;
    moveCurrentCell(1);
  }

  function deleteCharacter() {
    if (keyboardTarget === "finalWord") {
      const chars = Array.from(finalWordInput.value);
      chars.pop();
      finalWordInput.value = chars.join("");
      return;
    }

    if (!currentCellPosition) return;

    const input = getInput(
      currentCellPosition.row,
      currentCellPosition.col
    );

    if (!input) return;

    if (input.value) {
      input.value = "";
      return;
    }

    moveCurrentCell(-1);

    const previous = getInput(
      currentCellPosition.row,
      currentCellPosition.col
    );

    if (previous) {
      previous.value = "";
    }
  }

  function cycleVoicing() {
    transformCurrentCharacter({
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
    });
  }

  function applyHandVoicing() {
    transformCurrentCharacter({
      ハ: "パ", バ: "パ",
      ヒ: "ピ", ビ: "ピ",
      フ: "プ", ブ: "プ",
      ヘ: "ペ", ベ: "ペ",
      ホ: "ポ", ボ: "ポ"
    });
  }

  function transformCurrentCharacter(map) {
    if (keyboardTarget === "finalWord") {
      const chars = Array.from(finalWordInput.value);
      if (chars.length === 0) return;

      const index = chars.length - 1;
      chars[index] = map[chars[index]] || chars[index];
      finalWordInput.value = chars.join("");
      return;
    }

    if (!currentCellPosition) return;

    const input = getInput(
      currentCellPosition.row,
      currentCellPosition.col
    );

    if (input) {
      input.value = map[input.value] || input.value;
    }
  }

  function updateSelectionUI() {
    document.querySelectorAll(".cell-wrapper").forEach(function(wrapper) {
      wrapper.classList.remove("active-clue", "current-cell");
    });

    document.querySelectorAll(".hints li").forEach(function(hint) {
      hint.classList.remove("selected-clue");
    });

    activeCells.forEach(function(cell) {
      const wrapper = getWrapper(cell.row, cell.col);
      if (wrapper) wrapper.classList.add("active-clue");
    });

    if (currentCellPosition) {
      const wrapper = getWrapper(
        currentCellPosition.row,
        currentCellPosition.col
      );

      if (wrapper) wrapper.classList.add("current-cell");
    }

    if (activeClue) {
      const selectedHint = document.querySelector(
        `.hints li[data-direction="${activeClue.direction}"]` +
        `[data-number="${activeClue.number}"]`
      );

      if (selectedHint) selectedHint.classList.add("selected-clue");
    }
  }

  function updateActiveClueDisplay() {
    const display = document.getElementById("activeClueDisplay");

    if (keyboardTarget === "finalWord") {
      display.textContent = `キーワード　${puzzle.finalWordHint}`;
      return;
    }

    if (!activeClue) {
      display.textContent = "マスまたはカギを選択してください";
      return;
    }

    const directionLabel =
      activeClue.direction === "down" ? "タテ" : "ヨコ";

    const clueText = puzzle.hints[activeClue.direction].find(
      function(hint) {
        return getClueNumberFromHint(hint) === activeClue.number;
      }
    );

    display.textContent = `${directionLabel} ${clueText}`;
  }

  function check() {
    let allCellsCorrect = true;
    let keywordCorrect = true;

    document.querySelectorAll(".cell").forEach(function(input) {
      const correct = input.value === input.dataset.answer;
      input.parentElement.classList.toggle("correct", correct);
      input.parentElement.classList.toggle("incorrect", !correct);

      if (!correct) allCellsCorrect = false;
    });

    if (puzzle.finalWordAnswer) {
      keywordCorrect =
        finalWordInput &&
        finalWordInput.value === puzzle.finalWordAnswer;

      if (finalWordInput) {
        finalWordInput.classList.toggle("correct", keywordCorrect);
        finalWordInput.classList.toggle("incorrect", !keywordCorrect);
      }
    }

    if (allCellsCorrect && keywordCorrect) {
      markPuzzleAsCleared(puzzle);
      message.textContent = "正解です！クリア！";
    } else if (allCellsCorrect) {
      message.textContent =
        "マスは正解です。キーワードを確認してください。";
    } else {
      message.textContent = "まだ間違いがあります。";
    }
  }

  function reset(targetPuzzle) {
    render(targetPuzzle);
  }

  function setupMemo() {
    const memo = document.getElementById("userMemo");
    const clearButton = document.getElementById("clearMemoButton");
    const status = document.getElementById("memoSaveStatus");

    if (!memo || !clearButton || !status) return;

    const key = `normalMemo_${puzzle.category}_${puzzle.id}`;
    memo.value = localStorage.getItem(key) || "";
    status.textContent = memo.value ? "保存済み" : "";

    memo.oninput = function() {
      status.textContent = "保存中…";
      clearTimeout(memoSaveTimer);

      memoSaveTimer = setTimeout(function() {
        localStorage.setItem(key, memo.value);
        status.textContent = "保存済み";
      }, 300);
    };

    clearButton.onclick = function() {
      memo.value = "";
      localStorage.removeItem(key);
      status.textContent = "メモを消去しました";
    };
  }

  function getInput(row, col) {
    return document.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"]`
    );
  }

  function getWrapper(row, col) {
    return document.querySelector(
      `.cell-wrapper[data-row="${row}"][data-col="${col}"]`
    );
  }

  function clearCurrentCellHighlight() {
    document.querySelectorAll(".cell-wrapper").forEach(function(wrapper) {
      wrapper.classList.remove("current-cell");
    });
  }

  function resetHintTitles() {
    const acrossTitle = document.getElementById("acrossHintTitle");
    const downTitle = document.getElementById("downHintTitle");

    if (acrossTitle) acrossTitle.textContent = "ヨコのカギ";
    if (downTitle) downTitle.textContent = "タテのカギ";
  }

  function showKeywordPanel(show) {
    const panel = document.getElementById("keywordPanel");
    if (panel) panel.classList.toggle("hidden", !show);
  }

  window.PuzzleTypes.normal = {
    render: render,
    check: check,
    reset: reset
  };
})();
