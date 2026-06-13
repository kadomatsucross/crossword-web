(function() {
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

  let handlers = {};
  let initialized = false;
  let activeFlickKey = null;
  let flickStartX = 0;
  let flickStartY = 0;
  let flickPreview = null;

  function initialize() {
    if (initialized) return;
    initialized = true;

    const closeButton = document.getElementById("closeKeyboardButton");
    const backdrop = document.getElementById("keyboardBackdrop");
    const flickButton = document.getElementById("flickModeButton");
    const gridButton = document.getElementById("gridModeButton");

    if (closeButton) {
      closeButton.addEventListener("click", hide);
    }

    if (backdrop) {
      backdrop.addEventListener("click", hide);
    }

    if (flickButton) {
      flickButton.addEventListener("click", function() {
        localStorage.setItem("preferredNormalKeyboard", "flick");
        render();
      });
    }

    if (gridButton) {
      gridButton.addEventListener("click", function() {
        localStorage.setItem("preferredNormalKeyboard", "grid");
        render();
      });
    }

    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {
        hide();
      }
    });

    render();
    hide();
  }

  function setHandlers(nextHandlers) {
    handlers = nextHandlers || {};
  }

  function show(targetElement) {
    const panel = document.getElementById("keyboardPanel");
    const backdrop = document.getElementById("keyboardBackdrop");

    if (!panel) return;

    panel.classList.remove("hidden");

    if (backdrop) {
      backdrop.classList.remove("hidden");
    }

    document.body.classList.add("keyboard-open");

    if (targetElement) {
      window.setTimeout(function() {
        scrollTargetAboveKeyboard(targetElement);
      }, 50);
    }
  }

  function hide() {
    const panel = document.getElementById("keyboardPanel");
    const backdrop = document.getElementById("keyboardBackdrop");

    if (panel) {
      panel.classList.add("hidden");
    }

    if (backdrop) {
      backdrop.classList.add("hidden");
    }

    document.body.classList.remove("keyboard-open");
    hideFlickPreview();
  }

  function getMode() {
    const saved = localStorage.getItem("preferredNormalKeyboard");

    if (saved === "flick" || saved === "grid") {
      return saved;
    }

    const touchPrimary = window.matchMedia(
      "(pointer: coarse) and (hover: none)"
    ).matches;

    return touchPrimary ? "flick" : "grid";
  }

  function render() {
    const keyboard = document.getElementById("customKeyboard");
    if (!keyboard) return;

    const mode = getMode();
    keyboard.innerHTML = "";
    keyboard.className = `custom-keyboard ${mode}-keyboard`;

    updateModeButtons(mode);

    if (mode === "flick") {
      renderFlickKeyboard(keyboard);
    } else {
      renderGridKeyboard(keyboard);
      renderControlRow(keyboard);
    }
  }

  function updateModeButtons(mode) {
    const flickButton = document.getElementById("flickModeButton");
    const gridButton = document.getElementById("gridModeButton");

    if (flickButton) {
      flickButton.classList.toggle("selected", mode === "flick");
    }

    if (gridButton) {
      gridButton.classList.toggle("selected", mode === "grid");
    }
  }

  function renderGridKeyboard(keyboard) {
    GRID_KANA_ROWS.forEach(function(row) {
      const rowElement = document.createElement("div");
      rowElement.className = "kana-grid-row";

      row.forEach(function(char) {
        rowElement.appendChild(createKanaButton(char));
      });

      keyboard.appendChild(rowElement);
    });
  }

  function renderFlickKeyboard(keyboard) {
    const keysContainer = document.createElement("div");
    keysContainer.className = "flick-keys";

    FLICK_KEY_GROUPS.forEach(function(group) {
      keysContainer.appendChild(createFlickGroupButton(group));
    });

    keysContainer.appendChild(
      createUtilityButton("゛゜", function() {
        callHandler("voicing");
      })
    );

    keysContainer.appendChild(
      createUtilityButton("ー", function() {
        callHandler("input", "ー");
      })
    );

    keysContainer.appendChild(
      createUtilityButton("削除", function() {
        callHandler("delete");
      })
    );

    keyboard.appendChild(keysContainer);

    const navigationRow = document.createElement("div");
    navigationRow.className = "flick-navigation-row";

    navigationRow.appendChild(
      createControlButton("←", function() {
        callHandler("previous");
      })
    );

    navigationRow.appendChild(
      createControlButton("→", function() {
        callHandler("next");
      })
    );

    keyboard.appendChild(navigationRow);
  }

  function createFlickGroupButton(group) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flick-key";
    button.textContent = group.center;

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
        callHandler("input", char);
      }
    });

    button.addEventListener("pointercancel", function() {
      hideFlickPreview();
      activeFlickKey = null;
    });

    return button;
  }

  function createUtilityButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flick-key flick-utility-key";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function createKanaButton(char) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kana-key";
    button.textContent = char;

    if (!char) {
      button.disabled = true;
      button.classList.add("empty-key");
      return button;
    }

    button.addEventListener("click", function() {
      callHandler("input", char);
    });

    return button;
  }

  function renderControlRow(keyboard) {
    const row = document.createElement("div");
    row.className = "keyboard-control-row";

    row.appendChild(
      createControlButton("←", function() {
        callHandler("previous");
      })
    );

    row.appendChild(
      createControlButton("゛", function() {
        callHandler("voicing");
      })
    );

    row.appendChild(
      createControlButton("゜", function() {
        callHandler("handVoicing");
      })
    );

    row.appendChild(
      createControlButton("削除", function() {
        callHandler("delete");
      })
    );

    row.appendChild(
      createControlButton("→", function() {
        callHandler("next");
      })
    );

    keyboard.appendChild(row);
  }

  function createControlButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "keyboard-control-key";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function callHandler(name, value) {
    if (typeof handlers[name] === "function") {
      handlers[name](value);
    }
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

  function scrollTargetAboveKeyboard(target) {
    const panel = document.getElementById("keyboardPanel");

    if (!panel || panel.classList.contains("hidden")) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    if (targetRect.bottom > panelRect.top - 16) {
      window.scrollBy({
        top: targetRect.bottom - panelRect.top + 32,
        behavior: "smooth"
      });
    }
  }

  window.CrosswordKeyboard = {
    initialize: initialize,
    setHandlers: setHandlers,
    show: show,
    hide: hide
  };
})();
