const socket = io();

const playerBoard = document.getElementById("player-board");
const enemyBoard = document.getElementById("enemy-board");
const ships = document.querySelectorAll(".ship");
const rotateButton = document.getElementById("rotate-btn");
const startButton = document.getElementById("start-btn");
const statusText = document.getElementById("status");

// Create Play Again button dynamically
const playAgainBtn = document.createElement("button");
playAgainBtn.textContent = "Play Again";
playAgainBtn.style.display = "none";
playAgainBtn.style.position = "fixed";
playAgainBtn.style.top = "60%";
playAgainBtn.style.left = "50%";
playAgainBtn.style.transform = "translate(-50%, -50%)";
playAgainBtn.style.padding = "15px 30px";
playAgainBtn.style.fontSize = "20px";
playAgainBtn.style.cursor = "pointer";
playAgainBtn.style.zIndex = "1001";
document.body.appendChild(playAgainBtn);

// Create overlay for win/loss message
const overlay = document.createElement("div");
overlay.style.position = "fixed";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
overlay.style.display = "none";
overlay.style.zIndex = "1000";
document.body.appendChild(overlay);

let totalShipCells = 0;
let playerHits = 0;
let enemyHits = 0;
let playerCells = [];
let enemyCells = [];
let currentShip = null;
let currentShipLength = 0;
let currentOrientation = "horizontal";
let placedShips = 0;
let isPlayerTurn = false;
let gameStarted = false;
let shipDragOffset = 0;

// === Create Boards ===
function createBoard(container, cellsArray, isEnemy = false) {
  container.innerHTML = ""; // Clear any existing cells
  cellsArray.length = 0; // Clear array

  for (let i = 0; i < 100; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = i;

    if (!isEnemy) {
      cell.addEventListener("dragover", e => {
        e.preventDefault();
        if (currentShip) {
          highlightPreview(cell, cellsArray, currentShipLength, currentOrientation);
        }
      });

      cell.addEventListener("dragleave", () => {
        clearPreview(cellsArray);
      });

      cell.addEventListener("drop", e => {
        e.preventDefault();
        clearPreview(cellsArray);
        placeShip(parseInt(cell.dataset.index));
      });
    }

    container.appendChild(cell);
    cellsArray.push(cell);
  }
}

function placeShip(startIdx) {
  if (!currentShip) return;

  const length = currentShipLength;
  const indices = [];

  // Adjust for offset
  startIdx = currentOrientation === "horizontal"
    ? startIdx - shipDragOffset
    : startIdx - shipDragOffset * 10;

  for (let i = 0; i < length; i++) {
    let idx = currentOrientation === "horizontal"
      ? startIdx + i
      : startIdx + i * 10;

    if (!playerCells[idx]) return;

    const rowStart = Math.floor(startIdx / 10);
    const rowIdx = Math.floor(idx / 10);

    if (
      playerCells[idx].classList.contains("ship") ||
      (currentOrientation === "horizontal" && rowStart !== rowIdx)
    ) {
      return;
    }

    indices.push(idx);
  }

  indices.forEach(idx => {
    playerCells[idx].classList.add("ship");
  });

  currentShip.remove();
  currentShip = null;
  currentShipLength = 0;
  placedShips++;

  if (placedShips === 5) {
    startButton.disabled = false;
    statusText.textContent = "Waiting for opponent...";
    socket.emit("ready");
  }

  totalShipCells += indices.length; // Count placed ship cells
}

function highlightPreview(cell, boardCells, length, orientation) {
  clearPreview(boardCells);
  let startIdx = parseInt(cell.dataset.index);

  // Adjust for offset
  startIdx = orientation === "horizontal"
    ? startIdx - shipDragOffset
    : startIdx - shipDragOffset * 10;

  const previewCells = [];

  for (let i = 0; i < length; i++) {
    let idx = orientation === "horizontal"
      ? startIdx + i
      : startIdx + i * 10;

    const testCell = boardCells[idx];
    if (!testCell) return;

    if (orientation === "horizontal" &&
        Math.floor(idx / 10) !== Math.floor(startIdx / 10)) {
      return;
    }

    previewCells.push(testCell);
  }

  previewCells.forEach(cell => cell.classList.add("preview"));
}

function clearPreview(boardCells) {
  boardCells.forEach(cell => cell.classList.remove("preview"));
}

// === Drag Events ===
ships.forEach(ship => {
  ship.addEventListener("dragstart", e => {
    currentShip = ship;
    currentShipLength = parseInt(ship.dataset.length);

    const rect = ship.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    shipDragOffset = currentOrientation === "horizontal"
      ? Math.floor(x / 30)
      : Math.floor(y / 30);
  });
});

rotateButton.addEventListener("click", () => {
  currentOrientation = currentOrientation === "horizontal" ? "vertical" : "horizontal";
  rotateButton.textContent = `Rotate (${currentOrientation.charAt(0).toUpperCase()}${currentOrientation.slice(1)})`;

  document.querySelectorAll(".ship").forEach(ship => {
    ship.setAttribute("data-orientation", currentOrientation);
  });
});

// === Game Start ===
startButton.addEventListener("click", () => {
  if (!startButton.disabled) {
    socket.emit("start", { yourTurn: true });
    gameStarted = true;
    statusText.textContent = "Your turn!";
    startButton.disabled = true;
  }
});

// === Game Logic ===
enemyBoard.addEventListener("click", e => {
  if (!isPlayerTurn || !gameStarted) return;

  const cell = e.target;
  if (!cell.classList.contains("cell") || cell.classList.contains("hit") || cell.classList.contains("miss")) return;

  socket.emit("move", { index: parseInt(cell.dataset.index) });
  isPlayerTurn = false;
  statusText.textContent = "Waiting for opponent...";
});

socket.on("start", data => {
  isPlayerTurn = data.yourTurn;
  gameStarted = true;
  statusText.textContent = isPlayerTurn ? "Your turn!" : "Opponent's turn";
});

socket.on("player-ready", () => {
  if (placedShips === 5) {
    socket.emit("start", { yourTurn: true });
  }
});

socket.on("move", data => {
  const cell = playerCells[data.index];
  const isHit = cell.classList.contains("ship");

  if (isHit) {
    cell.classList.add("hit");
    enemyHits++;
    if (enemyHits === totalShipCells) {
      socket.emit("game-over");
      showEndMessage("You lost!");
    }
  } else {
    cell.classList.add("miss");
  }

  socket.emit("move-result", {
    index: data.index,
    result: isHit ? "hit" : "miss"
  });

  if (enemyHits < totalShipCells) {
    isPlayerTurn = true;
    statusText.textContent = "Your turn!";
  }
});

socket.on("move-result", data => {
  const cell = enemyCells[data.index];
  cell.classList.add(data.result);

  if (data.result === "hit") {
    playerHits++;
    if (playerHits === totalShipCells) {
      socket.emit("game-over");
      showEndMessage("You win!");
      gameStarted = false;
      return;
    }
  }

  isPlayerTurn = false;
  statusText.textContent = "Opponent's turn";
});

socket.on("game-over", () => {
  if (playerHits < totalShipCells) {
    showEndMessage("You lost!");
  } else {
    showEndMessage("You win!");
  }
  gameStarted = false;
});

// === Play Again Logic ===
playAgainBtn.addEventListener("click", () => {
  socket.emit("reset");
  resetGame();
  hideEndMessage();
});

socket.on("game-reset", () => {
  resetGame();
  hideEndMessage();
});

// === Helper Functions ===

function showEndMessage(message) {
  statusText.textContent = message;
  overlay.style.display = "block";
  playAgainBtn.style.display = "block";
  // Make everything except overlay and message opaque
  document.body.style.pointerEvents = "none"; // disable interactions
  overlay.style.pointerEvents = "auto";
  playAgainBtn.style.pointerEvents = "auto";
  statusText.style.position = "fixed";
  statusText.style.top = "50%";
  statusText.style.left = "50%";
  statusText.style.transform = "translate(-50%, -50%)";
  statusText.style.fontSize = "48px";
  statusText.style.color = "white";
  statusText.style.zIndex = "1002";
}

function hideEndMessage() {
  overlay.style.display = "none";
  playAgainBtn.style.display = "none";
  statusText.style.position = "";
  statusText.style.top = "";
  statusText.style.left = "";
  statusText.style.transform = "";
  statusText.style.fontSize = "";
  statusText.style.color = "";
  statusText.style.zIndex = "";
  statusText.textContent = "Place your ships...";
  document.body.style.pointerEvents = "auto";
  placedShips = 0;
  totalShipCells = 0;
  playerHits = 0;
  enemyHits = 0;
  isPlayerTurn = false;
  gameStarted = false;
  startButton.disabled = true;

  // Reset ships container (re-add ships)
  const shipsContainer = document.getElementById("ships");
  shipsContainer.innerHTML = `
    <div class="ship-wrapper"><div class="ship" draggable="true" data-length="5" data-orientation="horizontal"></div></div>
    <div class="ship-wrapper"><div class="ship" draggable="true" data-length="4" data-orientation="horizontal"></div></div>
    <div class="ship-wrapper"><div class="ship" draggable="true" data-length="3" data-orientation="horizontal"></div></div>
    <div class="ship-wrapper"><div class="ship" draggable="true" data-length="3" data-orientation="horizontal"></div></div>
    <div class="ship-wrapper"><div class="ship" draggable="true" data-length="2" data-orientation="horizontal"></div></div>
  `;

  // Re-assign drag events to new ships
  const newShips = document.querySelectorAll(".ship");
  newShips.forEach(ship => {
    ship.addEventListener("dragstart", e => {
      currentShip = ship;
      currentShipLength = parseInt(ship.dataset.length);

      const rect = ship.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      shipDragOffset = currentOrientation === "horizontal"
        ? Math.floor(x / 30)
        : Math.floor(y / 30);
    });
  });

  createBoard(playerBoard, playerCells);
  createBoard(enemyBoard, enemyCells, true);

  // Reset orientation and rotate button text
  currentOrientation = "horizontal";
  rotateButton.textContent = "Rotate (Horizontal)";
};

// === INIT ===
createBoard(playerBoard, playerCells);
createBoard(enemyBoard, enemyCells, true);
