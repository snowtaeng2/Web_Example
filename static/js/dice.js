// =========================================================
// 상암 주사위
// 실제 금전 가치가 없는 가상 칩만 사용합니다.
// =========================================================

let selectedDiceNumber = 1;
let selectedDiceBet = 100;
let diceRunning = false;

const DICE_FACES = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
};


async function onAuthReady() {
  updateDiceControls();
  await loadDiceHistory();
}


// ---------------------------------------------------------
// 숫자 선택
// ---------------------------------------------------------

function selectDiceNumber(number) {
  if (diceRunning) return;

  selectedDiceNumber = number;
  updateDiceControls();

  const message = document.getElementById("diceMessage");

  message.textContent =
    "숫자 " + number + "을 선택했습니다.";

  message.className = "dice-message";
}


// ---------------------------------------------------------
// 베팅 금액 선택
// ---------------------------------------------------------

function selectDiceBet(amount) {
  if (diceRunning) return;

  selectedDiceBet = amount;
  updateDiceControls();

  const message = document.getElementById("diceMessage");

  message.textContent =
    amount.toLocaleString("ko-KR") +
    "칩을 선택했습니다.";

  message.className = "dice-message";
}


// ---------------------------------------------------------
// 버튼 상태 갱신
// ---------------------------------------------------------

function updateDiceControls() {
  document
    .querySelectorAll(".dice-number-button")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        Number(button.dataset.number) === selectedDiceNumber
      );
    });

  document
    .querySelectorAll(".dice-bet-button")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        Number(button.dataset.bet) === selectedDiceBet
      );
    });

  const button =
    document.getElementById("diceRollButton");

  if (button && !diceRunning) {
    button.textContent =
      "숫자 " +
      selectedDiceNumber +
      "에 " +
      selectedDiceBet.toLocaleString("ko-KR") +
      "칩 걸기";
  }
}


// ---------------------------------------------------------
// 주사위 실행
// ---------------------------------------------------------

async function playDice() {
  if (diceRunning) return;

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  const button =
    document.getElementById("diceRollButton");

  const message =
    document.getElementById("diceMessage");

  const resultText =
    document.getElementById("diceResultText");

  if (currentChips < selectedDiceBet) {
    message.textContent = "보유 칩이 부족합니다.";
    message.className = "dice-message dice-message-lose";
    return;
  }

  diceRunning = true;

  button.disabled = true;
  button.textContent = "주사위 굴리는 중...";

  setDiceControlsDisabled(true);

  message.textContent =
    "주사위가 굴러가고 있습니다...";

  message.className = "dice-message";

  resultText.textContent = "결과 확인 중...";

  const animationId = startDiceAnimation();

  try {
    const { data, error } = await db.rpc(
      "play_sangam_dice",
      {
        p_bet_amount: selectedDiceBet,
        p_selected_number: selectedDiceNumber,
      }
    );

    if (error) {
      throw error;
    }

    await wait(1200);
    clearInterval(animationId);

    if (!data || !data.success) {
      showDiceResult(null);

      message.textContent =
        data && data.message
          ? data.message
          : "주사위 게임을 실행하지 못했습니다.";

      message.className =
        "dice-message dice-message-lose";

      if (
        data &&
        data.chips !== undefined &&
        data.chips !== null
      ) {
        currentChips = Number(data.chips) || 0;
        renderNav();
      }

      return;
    }

    const result = Number(data.dice_result);

    showDiceResult(result);

    resultText.textContent =
      "주사위 결과: " + result;

    currentChips = Number(data.chips) || 0;
    renderNav();

    const chipChange =
      Number(data.chip_change) || 0;

    if (data.is_win) {
      message.textContent =
        data.message +
        " 순수익 +" +
        chipChange.toLocaleString("ko-KR") +
        "칩";

      message.className =
        "dice-message dice-message-win";

      playDiceWinEffect();
    } else {
      message.textContent =
        data.message +
        " " +
        Math.abs(chipChange).toLocaleString("ko-KR") +
        "칩을 잃었습니다.";

      message.className =
        "dice-message dice-message-lose";
    }

    await loadDiceHistory();
  } catch (error) {
    clearInterval(animationId);

    console.error("주사위 실행 실패:", error);

    showDiceResult(null);

    resultText.textContent =
      "결과를 불러오지 못했습니다.";

    message.textContent =
      "주사위 실행에 실패했습니다: " +
      error.message;

    message.className =
      "dice-message dice-message-lose";

    if (typeof loadMyChips === "function") {
      await loadMyChips();
      renderNav();
    }
  } finally {
    diceRunning = false;

    button.disabled = false;
    setDiceControlsDisabled(false);
    updateDiceControls();
  }
}


// ---------------------------------------------------------
// 애니메이션
// ---------------------------------------------------------

function startDiceAnimation() {
  const dice = document.getElementById("diceObject");

  dice.classList.add("rolling");

  return setInterval(function () {
    const temporaryResult =
      Math.floor(Math.random() * 6) + 1;

    dice.textContent = DICE_FACES[temporaryResult];
  }, 90);
}


function showDiceResult(result) {
  const dice = document.getElementById("diceObject");

  dice.classList.remove("rolling");

  if (!result) {
    dice.textContent = "🎲";
    return;
  }

  dice.textContent = DICE_FACES[result];

  dice.classList.remove("dice-stop");
  void dice.offsetWidth;
  dice.classList.add("dice-stop");
}


function playDiceWinEffect() {
  const machine =
    document.querySelector(".dice-machine");

  machine.classList.remove("dice-win");
  void machine.offsetWidth;
  machine.classList.add("dice-win");

  setTimeout(function () {
    machine.classList.remove("dice-win");
  }, 1200);
}


function setDiceControlsDisabled(disabled) {
  document
    .querySelectorAll(
      ".dice-number-button, .dice-bet-button"
    )
    .forEach(function (button) {
      button.disabled = disabled;
    });
}


// ---------------------------------------------------------
// 최근 기록
// ---------------------------------------------------------

async function loadDiceHistory() {
  const list = document.getElementById("diceHistory");

  if (!list || !currentUser) return;

  list.innerHTML =
    "<li>게임 기록을 불러오는 중입니다.</li>";

  const { data, error } = await db
    .from("dice_history")
    .select(
      "id, bet_amount, selected_number, dice_result, " +
      "is_win, chip_change, created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("주사위 기록 조회 실패:", error);

    list.innerHTML =
      "<li>게임 기록을 불러오지 못했습니다.</li>";

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      "<li>아직 주사위 기록이 없습니다.</li>";

    return;
  }

  list.innerHTML = "";

  data.forEach(function (record) {
    const item = document.createElement("li");
    const result = document.createElement("div");
    const details = document.createElement("div");
    const change = document.createElement("strong");
    const time = document.createElement("small");

    result.className = "dice-history-result";

    result.textContent =
      "숫자 " +
      record.selected_number +
      " 선택 → 결과 " +
      record.dice_result;

    details.className = "dice-history-details";

    change.className =
      record.is_win
        ? "dice-history-win"
        : "dice-history-loss";

    change.textContent =
      (record.chip_change > 0 ? "+" : "") +
      Number(record.chip_change).toLocaleString("ko-KR") +
      "칩";

    time.textContent =
      "베팅 " +
      Number(record.bet_amount).toLocaleString("ko-KR") +
      "칩 · " +
      new Date(record.created_at).toLocaleString("ko-KR");

    details.appendChild(change);
    details.appendChild(time);

    item.appendChild(result);
    item.appendChild(details);

    list.appendChild(item);
  });
}


function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}