window.PuzzleTypes = window.PuzzleTypes || {};
window.puzzles = window.puzzles || [];

const categories = [
  { id: "1.small", name: "小規模クロスワード" },
  { id: "2.medium", name: "中規模クロスワード" },
  { id: "3.large", name: "大規模クロスワード" },
  { id: "4.cube", name: "立体クロスワード" },
  { id: "5.gimmick", name: "ギミッククロスワード" },
  { id: "6.english", name: "英語クロスワード" }
];

const puzzleTitle = document.getElementById("puzzleTitle");
const crossword = document.getElementById("crossword");
const acrossHints = document.getElementById("acrossHints");
const downHints = document.getElementById("downHints");
const finalWordArea = document.getElementById("finalWordArea");
const message = document.getElementById("message");
const checkButton = document.getElementById("checkButton");
const resetButton = document.getElementById("resetButton");

let currentPuzzle = null;

function getUrlParameters() {
  return new URLSearchParams(window.location.search);
}

function getPuzzleById(id) {
  return window.puzzles.find(function(puzzle) {
    return String(puzzle.id) === String(id);
  });
}

function sortPuzzlesByTitle(targetPuzzles) {
  return targetPuzzles.slice().sort(function(a, b) {
    return String(a.title).localeCompare(String(b.title), "ja", {
      numeric: true,
      sensitivity: "base"
    });
  });
}

function getPuzzleStorageKey(puzzle) {
  return `cleared_${puzzle.id}`;
}

function markPuzzleAsCleared(puzzle) {
  localStorage.setItem(getPuzzleStorageKey(puzzle), "true");
}

function isPuzzleCleared(puzzle) {
  return localStorage.getItem(getPuzzleStorageKey(puzzle)) === "true";
}

function initializeSearchPage() {
  const mode =
    getUrlParameters().get("mode") === "category"
      ? "category"
      : "all";

  const pageTitle = document.getElementById("searchPageTitle");
  const categorySection = document.getElementById("categorySection");
  const categoryList = document.getElementById("categoryList");
  const puzzleListSection =
    document.getElementById("puzzleListSection");
  const puzzleList = document.getElementById("puzzleList");
  const listTitle = document.getElementById("listTitle");
  const backButton =
    document.getElementById("backToCategoriesButton");

  function showCategories() {
    pageTitle.textContent = "カテゴリから探す";
    categorySection.classList.remove("hidden");
    puzzleListSection.classList.add("hidden");
    categoryList.innerHTML = "";

    categories.forEach(function(category) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "selection-button";
      button.textContent = category.name;

      button.addEventListener("click", function() {
        showCategoryPuzzles(category);
      });

      categoryList.appendChild(button);
    });
  }

  function showCategoryPuzzles(category) {
    const targetPuzzles = sortPuzzlesByTitle(
      window.puzzles.filter(function(puzzle) {
        return puzzle.category === category.id;
      })
    );

    categorySection.classList.add("hidden");
    puzzleListSection.classList.remove("hidden");
    backButton.classList.remove("hidden");
    listTitle.textContent = category.name;

    renderPuzzleList(targetPuzzles, puzzleList, {
      from: "category",
      categoryId: category.id
    });
  }

  function showAllPuzzles() {
    pageTitle.textContent = "一覧から探す";
    categorySection.classList.add("hidden");
    puzzleListSection.classList.remove("hidden");
    backButton.classList.add("hidden");
    listTitle.textContent = "クロスワード一覧";

    renderPuzzleList(
      sortPuzzlesByTitle(window.puzzles),
      puzzleList,
      { from: "all", categoryId: "" }
    );
  }

  backButton.addEventListener("click", showCategories);

  if (mode === "category") {
    showCategories();
  } else {
    showAllPuzzles();
  }
}

function renderPuzzleList(targetPuzzles, listElement, options) {
  listElement.innerHTML = "";

  if (targetPuzzles.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = "このカテゴリにはまだ問題がありません。";
    listElement.appendChild(emptyMessage);
    return;
  }

  targetPuzzles.forEach(function(puzzle) {
    const link = document.createElement("a");
    link.className = "selection-button puzzle-link";
    link.textContent = puzzle.title;

    const url = new URL("puzzle.html", window.location.href);
    url.searchParams.set("id", puzzle.id);
    url.searchParams.set("from", options.from);

    if (options.categoryId) {
      url.searchParams.set("category", options.categoryId);
    }

    link.href = url.pathname + url.search;

    if (isPuzzleCleared(puzzle)) {
      link.classList.add("cleared");
    }

    listElement.appendChild(link);
  });
}

function initializePuzzlePage() {
  const params = getUrlParameters();
  const backLink = document.getElementById("backToSearchLink");

  if (params.get("from") === "category") {
    backLink.href = "search.html?mode=category";
    backLink.textContent = "カテゴリに戻る";
  }

  currentPuzzle = getPuzzleById(params.get("id"));

  if (!currentPuzzle) {
    puzzleTitle.textContent = "問題が見つかりません";
    message.textContent =
      "問題IDか、問題ファイルの読み込みを確認してください。";
    return;
  }

  document.title = `${currentPuzzle.title} | クロスワードWeb`;

  if (window.CrosswordKeyboard) {
    window.CrosswordKeyboard.initialize();
  }

  renderCurrentPuzzle();

  checkButton.addEventListener("click", checkCurrentPuzzleAnswer);
  resetButton.addEventListener("click", resetCurrentPuzzle);
}

function getCurrentPuzzleHandler() {
  if (!currentPuzzle) return null;
  return window.PuzzleTypes[currentPuzzle.type] || null;
}

function renderCurrentPuzzle() {
  const handler = getCurrentPuzzleHandler();

  if (!handler || typeof handler.render !== "function") {
    message.textContent = "未対応のクロスワードタイプです。";
    return;
  }

  handler.render(currentPuzzle);
}

function checkCurrentPuzzleAnswer() {
  const handler = getCurrentPuzzleHandler();

  if (!handler || typeof handler.check !== "function") {
    message.textContent = "答え合わせに対応していません。";
    return;
  }

  handler.check(currentPuzzle);
}

function resetCurrentPuzzle() {
  const handler = getCurrentPuzzleHandler();

  if (handler && typeof handler.reset === "function") {
    handler.reset(currentPuzzle);
  } else {
    renderCurrentPuzzle();
  }
}

const page = document.body.dataset.page;

if (page === "search") {
  initializeSearchPage();
}

if (page === "puzzle") {
  initializePuzzlePage();
}
