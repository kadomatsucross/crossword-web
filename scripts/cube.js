(function() {
  function render(puzzle) {
    puzzleTitle.textContent = puzzle.title;
    crossword.innerHTML = "";
    acrossHints.innerHTML = "";
    downHints.innerHTML = "";
    finalWordArea.innerHTML = "";
    message.textContent = "立体クロスワードはまだ未実装です。";
  }

  function check() {
    message.textContent = "立体クロスワードはまだ未実装です。";
  }

  window.PuzzleTypes.cube = {
    render: render,
    check: check,
    reset: render
  };
})();
