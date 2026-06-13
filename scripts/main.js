const categories = [
  { id: "1.small", name: "小規模クロスワード" },
  { id: "2.medium", name: "中規模クロスワード" },
  { id: "3.large", name: "大規模クロスワード" },
  { id: "4.cube", name: "立体クロスワード" },
  { id: "5.gimmick", name: "ギミッククロスワード" },
  { id: "6.english", name: "英語クロスワード" }
];

// 読み込まれた問題だけを登録する
const puzzles = [];

if (typeof summer3x3_1 !== "undefined") {
  puzzles.push(summer3x3_1);
}

if (typeof birthday5x5_1 !== "undefined") {
  puzzles.push(birthday5x5_1);
}

if (typeof cube2x2x2_1 !== "undefined") {
  puzzles.push(cube2x2x2_1);
}

// puzzle.html と normal.js から利用するDOM
const puzzleTitle = document.getElementById("puzzleTitle");
const crossword = document.getElementById("crossword");
const acrossHints = document.getElementById("acrossHints");
const downHints = document.getElementById("downHints");
const finalWordArea = document.getElementById("finalWordArea");
const message = document.getElementById("message");
const checkButton = document.getElementById("checkButton");
const resetButton = document.getElementById("resetButton");

let currentPuzzle = null;

function getPageName() {
  return document.body.dataset.page || "";
}

function getUrlParameters() {
  return new URLSearchParams(window.location.search);
}

function getPuzzleId(puzzle) {
  if (puzzle.id) {
    return String(puzzle.id);
  }

  const titleMatch = String(puzzle.title || "").match(/^(\d+)/);
  return titleMatch ? titleMatch[1] : "";
}

function getPuzzleById(id) {
  return puzzles.find(function(puzzle) {
    return getPuzzleId(puzzle) === String(id);
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
  return `cleared_${getPuzzleId(puzzle) || puzzle.title}`;
}

function markPuzzleAsCleared(puzzle) {
  localStorage.setItem(getPuzzleStorageKey(puzzle), "true");
}

function isPuzzleCleared(puzzle) {
  return localStorage.getItem(getPuzzleStorageKey(puzzle)) === "true";
}

// ==============================
// search.html
// ==============================
function initializeSearchPage() {
  const params = getUrlParameters();
  const mode = params.get("mode") === "category" ? "category" : "all";

  const pageTitle = document.getElementById("searchPageTitle");
  const categorySection = document.getElementById("categorySection");
  const categoryList = document.getElementById("categoryList");
  const puzzleListSection = document.getElementById("puzzleListSection");
  const puzzleList = document.getElementById("puzzleList");
  const listTitle = document.getElementById("listTitle");
  const backToCategoriesButton = document.getElementById(
    "backToCategoriesButton"
  );

  if (
    !pageTitle ||
    !categorySection ||
    !categoryList ||
    !puzzleListSection ||
    !puzzleList ||
    !listTitle ||
    !backToCategoriesButton
  ) {
    return;
  }

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
      puzzles.filter(function(puzzle) {
        return puzzle.category === category.id;
      })
    );

    pageTitle.textContent = "カテゴリから探す";
    categorySection.classList.add("hidden");
    puzzleListSection.classList.remove("hidden");
    backToCategoriesButton.classList.remove("hidden");
    listTitle.textContent = category.name;

    renderPuzzleList(targetPuzzles, {
      listElement: puzzleList,
      emptyText: "このカテゴリにはまだ問題がありません。",
      from: "category",
      categoryId: category.id
    });
  }

  function showAllPuzzles() {
    pageTitle.textContent = "一覧から探す";
    categorySection.classList.add("hidden");
    puzzleListSection.classList.remove("hidden");
    backToCategoriesButton.classList.add("hidden");
    listTitle.textContent = "クロスワード一覧";

    renderPuzzleList(sortPuzzlesByTitle(puzzles), {
      listElement: puzzleList,
      emptyText: "クロスワードがまだありません。",
      from: "all",
      categoryId: ""
    });
  }

  backToCategoriesButton.addEventListener("click", showCategories);

  if (mode === "category") {
    showCategories();
  } else {
    showAllPuzzles();
  }
}

function renderPuzzleList(targetPuzzles, options) {
  const listElement = options.listElement;
  listElement.innerHTML = "";

  if (targetPuzzles.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = options.emptyText;
    listElement.appendChild(emptyMessage);
    return;
  }

  targetPuzzles.forEach(function(puzzle) {
    const link = document.createElement("a");
    link.className = "selection-button puzzle-link";
    link.textContent = puzzle.title;

    const url = new URL("puzzle.html", window.location.href);
    url.searchParams.set("id", getPuzzleId(puzzle));
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

// ==============================
// puzzle.html
// ==============================
function initializePuzzlePage() {
  const params = getUrlParameters();
  const puzzleId = params.get("id");
  const backLink = document.getElementById("backToSearchLink");

  if (backLink) {
    if (params.get("from") === "category") {
      backLink.href = "search.html?mode=category";
      backLink.textContent = "カテゴリに戻る";
    } else {
      backLink.href = "search.html?mode=all";
      backLink.textContent = "一覧に戻る";
    }
  }

  currentPuzzle = getPuzzleById(puzzleId);

  if (!currentPuzzle) {
    if (puzzleTitle) {
      puzzleTitle.textContent = "問題が見つかりません";
    }

    if (message) {
      message.textContent =
        "URLの問題番号、またはindex内の問題ファイル読み込みを確認してください。";
    }

    return;
  }

  document.title = `${currentPuzzle.title} | クロスワードWeb`;
  renderCurrentPuzzle();

  if (checkButton) {
    checkButton.addEventListener("click", checkCurrentPuzzleAnswer);
  }

  if (resetButton) {
    resetButton.addEventListener("click", renderCurrentPuzzle);
  }
}

function renderCurrentPuzzle() {
  if (!currentPuzzle) {
    return;
  }

  if (currentPuzzle.type === "normal") {
    renderNormalPuzzle(currentPuzzle);
    return;
  }

  if (currentPuzzle.type === "gimmick") {
    if (typeof renderGimmickPuzzle === "function") {
      renderGimmickPuzzle(currentPuzzle);
    } else if (message) {
      message.textContent = "ギミッククロスワードはまだ未実装です。";
    }
    return;
  }

  if (currentPuzzle.type === "cube") {
    if (typeof renderCubePuzzle === "function") {
      renderCubePuzzle(currentPuzzle);
    } else if (message) {
      message.textContent = "立体クロスワードはまだ未実装です。";
    }
    return;
  }

  if (message) {
    message.textContent = "未対応のクロスワードタイプです。";
  }
}

function checkCurrentPuzzleAnswer() {
  if (!currentPuzzle) {
    return;
  }

  if (
    currentPuzzle.type === "normal" &&
    typeof checkNormalAnswer === "function"
  ) {
    checkNormalAnswer(currentPuzzle);
    return;
  }

  if (message) {
    message.textContent =
      "このタイプの答え合わせはまだ実装されていません。";
  }
}

// ==============================
// 起動
// ==============================
const currentPage = getPageName();

if (currentPage === "search") {
  initializeSearchPage();
}

if (currentPage === "puzzle") {
  initializePuzzlePage();
}
