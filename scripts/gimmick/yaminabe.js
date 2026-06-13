window.PuzzleTypes = window.PuzzleTypes || {};

(function() {
  let puzzle = null;
  let direction = "across";
  let currentCell = null;
  let finalWordInput = null;
  let keyboardTarget = "cell";
  let memoSaveTimer = null;

  function render(targetPuzzle) {
    puzzle = targetPuzzle;
    direction = "across";
    currentCell = null;
    finalWordInput = null;
    keyboardTarget = "cell";

    puzzleTitle.textContent = puzzle.title;
    crossword.innerHTML = "";
    message.textContent = "";

    renderDescription();
    setHintTitles();
    renderKeywordPanel();

    crossword.style.gridTemplateColumns =
      `repeat(${puzzle.size}, 50px)`;

    puzzle.grid.forEach(function(row, rowIndex) {
      row.forEach(function(answer, colIndex) {
        const wrapper = document.createElement("div");
        wrapper.className = "cell-wrapper";
        wrapper.dataset.row = rowIndex;
        wrapper.dataset.col = colIndex;

        const number =
          puzzle.numbers?.[rowIndex]?.[colIndex];

        if (number !== null && number !== undefined) {
          const numberLabel = document.createElement("span");
          numberLabel.className = "clue-number";
          numberLabel.textContent = number;
          wrapper.appendChild(numberLabel);
        }

        const keyLetter =
          puzzle.keyLetters?.[rowIndex]?.[colIndex];

        if (keyLetter) {
          const keyLabel = document.createElement("span");
          keyLabel.className = "word-letter";
          keyLabel.textContent = keyLetter;
          wrapper.appendChild(keyLabel);
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
          selectCell(rowIndex, colIndex);
          openKeyboard(input);
        });

        wrapper.appendChild(input);
        crossword.appendChild(wrapper);
      });
    });

    renderClues();
    setupMemo();
    updateSelectionUI();

    if (window.CrosswordKeyboard) {
      window.CrosswordKeyboard.hide();
    }
  }

  function renderDescription() {
    const descriptionArea =
      document.getElementById("puzzleDescription");

    if (!descriptionArea) {
      return;
    }

    descriptionArea.innerHTML = "";

    if (!puzzle.description) {
      descriptionArea.classList.add("hidden");
      return;
    }

    const heading = document.createElement("h2");
    heading.textContent = "闇鍋クロスワードとは？";

    const text = document.createElement("p");
    text.textContent = puzzle.description;

    descriptionArea.appendChild(heading);
    descriptionArea.appendChild(text);
    descriptionArea.classList.remove("hidden");
  }

  function renderClues() {
    acrossHints.innerHTML = "";
    downHints.innerHTML = "";

    acrossHints.appendChild(
      createMixedClueItem("across", puzzle.clues.across)
    );

    downHints.appendChild(
      createMixedClueItem("down", puzzle.clues.down)
    );
  }

  function createMixedClueItem(clueDirection, text) {
    const li = document.createElement("li");
    li.className = "yaminabe-clue";
    li.dataset.direction = clueDirection;
    li.textContent = text;

    li.addEventListener("click", function() {
      direction = clueDirection;
      keyboardTarget = "cell";

      if (!currentCell) {
        currentCell = { row: 0, col: 0 };
      }

      if (finalWordInput) {
        finalWordInput.classList.remove("keyboard-target");
      }

      updateSelectionUI();
      openKeyboard(getInput(currentCell.row, currentCell.col));
    });

    return li;
  }

  function renderKeywordPanel() {
    const panel = document.getElementById("keywordPanel");

    finalWordArea.innerHTML = "";

    if (!puzzle.finalWordAnswer) {
      if (panel) {
        panel.classList.add("hidden");
      }
      return;
    }

    if (panel) {
      panel.classList.remove("hidden");
    }

    const box = document.createElement("div");
    box.className = "final-word-box";

    const title = document.createElement("h4");
    title.textContent = "最後のキーワード";

    const hint = document.createElement("p");
    hint.textContent = puzzle.finalWordHint || "";

    finalWordInput = document.createElement("input");
    finalWordInput.className = "final-word-input";
    finalWordInput.placeholder = "ここを選択して入力";
    finalWordInput.readOnly = true;
    finalWordInput.inputMode = "none";
    finalWordInput.maxLength =
      Array.from(puzzle.finalWordAnswer).length;

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

  function selectCell(row, col) {
    keyboardTarget = "cell";

    if (finalWordInput) {
      finalWordInput.classList.remove("keyboard-target");
    }

    const sameCell =
      currentCell &&
      currentCell.row === row &&
      currentCell.col === col;

    if (sameCell) {
      direction =
        direction === "across" ? "down" : "across";
    }

    currentCell = { row: row, col: col };
    updateSelectionUI();
  }

  function openKeyboard(target) {
    if (!window.CrosswordKeyboard) {
      return;
    }

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

  function inputCharacter(char) {
    if (keyboardTarget === "finalWord") {
      if (!finalWordInput) {
        return;
      }

      const chars = Array.from(finalWordInput.value);

      if (chars.length < finalWordInput.maxLength) {
        chars.push(char);
        finalWordInput.value = chars.join("");
      }

      return;
    }

    if (!currentCell) {
      return;
    }

    const input = getInput(currentCell.row, currentCell.col);

    if (!input) {
      return;
    }

    input.value = char;
    moveCurrentCell(1);
  }

  function deleteCharacter() {
    if (keyboardTarget === "finalWord") {
      if (!finalWordInput) {
        return;
      }

      const chars = Array.from(finalWordInput.value);
      chars.pop();
      finalWordInput.value = chars.join("");
      return;
    }

    if (!currentCell) {
      return;
    }

    const input = getInput(currentCell.row, currentCell.col);

    if (!input) {
      return;
    }

    if (input.value) {
      input.value = "";
      return;
    }

    moveCurrentCell(-1);

    const previous = getInput(currentCell.row, currentCell.col);

    if (previous) {
      previous.value = "";
    }
  }

  function moveCurrentCell(offset) {
    if (keyboardTarget === "finalWord" || !currentCell) {
      return;
    }

    const next = {
      row: currentCell.row,
      col: currentCell.col
    };

    if (direction === "across") {
      next.col += offset;
    } else {
      next.row += offset;
    }

    if (
      next.row < 0 ||
      next.row >= puzzle.size ||
      next.col < 0 ||
      next.col >= puzzle.size
    ) {
      return;
    }

    currentCell = next;
    updateSelectionUI();
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
      if (!finalWordInput) {
        return;
      }

      const chars = Array.from(finalWordInput.value);

      if (chars.length === 0) {
        return;
      }

      const lastIndex = chars.length - 1;
      chars[lastIndex] =
        map[chars[lastIndex]] || chars[lastIndex];

      finalWordInput.value = chars.join("");
      return;
    }

    if (!currentCell) {
      return;
    }

    const input = getInput(currentCell.row, currentCell.col);

    if (input) {
      input.value = map[input.value] || input.value;
    }
  }

  function updateSelectionUI() {
    document
      .querySelectorAll(".cell-wrapper")
      .forEach(function(wrapper) {
        wrapper.classList.remove(
          "active-clue",
          "current-cell"
        );
      });

    document
      .querySelectorAll(".hints li")
      .forEach(function(item) {
        item.classList.remove("selected-clue");
      });

    if (!currentCell) {
      updateActiveClueDisplay();
      return;
    }

    for (
      let index = 0;
      index < puzzle.size;
      index += 1
    ) {
      const row =
        direction === "across"
          ? currentCell.row
          : index;

      const col =
        direction === "across"
          ? index
          : currentCell.col;

      const wrapper = getWrapper(row, col);

      if (wrapper) {
        wrapper.classList.add("active-clue");
      }
    }

    const currentWrapper = getWrapper(
      currentCell.row,
      currentCell.col
    );

    if (currentWrapper) {
      currentWrapper.classList.add("current-cell");
    }

    const selectedClue = document.querySelector(
      `.yaminabe-clue[data-direction="${direction}"]`
    );

    if (selectedClue) {
      selectedClue.classList.add("selected-clue");
    }

    updateActiveClueDisplay();
  }

  function updateActiveClueDisplay() {
    const display =
      document.getElementById("activeClueDisplay");

    if (!display) {
      return;
    }

    if (keyboardTarget === "finalWord") {
      display.textContent =
        `最後のキーワード　${puzzle.finalWordHint || ""}`;
      return;
    }

    if (!currentCell) {
      display.textContent =
        "マスまたは闇鍋カギを選択してください";
      return;
    }

    const directionLabel =
      direction === "across" ? "ヨコ" : "タテ";

    const positionLabel =
      direction === "across"
        ? `${currentCell.row + 1}行目`
        : `${currentCell.col + 1}列目`;

    display.textContent =
      `${directionLabel}方向・${positionLabel}に入力中`;
  }

  function check() {
    let allCellsCorrect = true;

    document
      .querySelectorAll(".cell")
      .forEach(function(input) {
        const correct =
          input.value === input.dataset.answer;

        input.parentElement.classList.toggle(
          "correct",
          correct
        );

        input.parentElement.classList.toggle(
          "incorrect",
          !correct
        );

        if (!correct) {
          allCellsCorrect = false;
        }
      });

    const keywordCorrect =
      !puzzle.finalWordAnswer ||
      (
        finalWordInput &&
        finalWordInput.value === puzzle.finalWordAnswer
      );

    if (finalWordInput) {
      finalWordInput.classList.toggle(
        "correct",
        keywordCorrect
      );

      finalWordInput.classList.toggle(
        "incorrect",
        !keywordCorrect
      );
    }

    if (allCellsCorrect && keywordCorrect) {
      markPuzzleAsCleared(puzzle);
      message.textContent =
        "正解です！闇鍋クロスワード完成！";
    } else if (allCellsCorrect) {
      message.textContent =
        "盤面は正解です。最後のキーワードを確認してください。";
    } else {
      message.textContent =
        "まだ間違いがあります。";
    }
  }

  function reset(targetPuzzle) {
    render(targetPuzzle);
  }

  function setupMemo() {
    const memo = document.getElementById("userMemo");
    const clearButton =
      document.getElementById("clearMemoButton");
    const status =
      document.getElementById("memoSaveStatus");

    if (!memo || !clearButton || !status) {
      return;
    }

    const key =
      `gimmickMemo_${puzzle.category}_${puzzle.id}`;

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
    document
      .querySelectorAll(".cell-wrapper")
      .forEach(function(wrapper) {
        wrapper.classList.remove("current-cell");
      });
  }

  function setHintTitles() {
    const acrossTitle =
      document.getElementById("acrossHintTitle");

    const downTitle =
      document.getElementById("downHintTitle");

    if (acrossTitle) {
      acrossTitle.textContent = "ヨコの闇鍋カギ";
    }

    if (downTitle) {
      downTitle.textContent = "タテの闇鍋カギ";
    }
  }

  window.PuzzleTypes.gimmick = {
    render: render,
    check: check,
    reset: reset
  };
})();
