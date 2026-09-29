// =========================================================
// 행운의 룰렛
// 실제 금전 가치가 없는 가상 칩 전용 게임입니다.
// =========================================================

let selectedRouletteBet = 100;
let rouletteRunning = false;
let rouletteRotation = 0;


async function onAuthReady() {
  updateRouletteBetButtons();
  await loadRouletteHistory();
}


// ---------------------------------------------------------
// 베팅 금액 선택
// ---------------------------------------------------------

function selectRouletteBet(amount) {
  if (rouletteRunning) return;

  selectedRouletteBet = amount;
  updateRouletteBetButtons();

  const message =
    document.getElementById("rouletteMessage");

  message.textContent =
    amount.toLocaleString("ko-KR") +
    "칩을 선택했습니다.";

  message.className = "roulette-message";
}


function updateRouletteBetButtons() {
  document
    .querySelectorAll(".roulette-bet-button")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        Number(button.dataset.bet) === selectedRouletteBet
      );
    });

  const button =
    document.getElementById("rouletteSpinButton");

  if (button && !rouletteRunning) {
    button.textContent =
      selectedRouletteBet.toLocaleString("ko-KR") +
      "칩으로 룰렛 돌리기";
  }
}


// ---------------------------------------------------------
// 룰렛 실행
// ---------------------------------------------------------

async function playRoulette() {
  if (rouletteRunning) return;

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  const button =
    document.getElementById("rouletteSpinButton");

  const message =
    document.getElementById("rouletteMessage");

  const resultText =
    document.getElementById("rouletteResultText");

  if (currentChips < selectedRouletteBet) {
    message.textContent = "보유 칩이 부족합니다.";
    message.className =
      "roulette-message roulette-message-lose";
    return;
  }

  rouletteRunning = true;

  button.disabled = true;
  button.textContent = "룰렛 돌아가는 중...";

  setRouletteButtonsDisabled(true);

  message.textContent =
    "행운의 룰렛이 돌아가고 있습니다...";

  message.className = "roulette-message";

  resultText.textContent = "결과 확인 중...";

  try {
    const { data, error } = await db.rpc(
      "play_lucky_roulette",
      {
        p_bet_amount: selectedRouletteBet,
      }
    );

    if (error) {
      throw error;
    }

    if (!data || !data.success) {
      message.textContent =
        data && data.message
          ? data.message
          : "룰렛을 실행하지 못했습니다.";

      message.className =
        "roulette-message roulette-message-lose";

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

    await spinRouletteToResult(
      data.result_type,
      Number(data.result_slot)
    );

    currentChips = Number(data.chips) || 0;
    renderNav();

    const multiplier =
      Number(data.multiplier) || 0;

    const chipChange =
      Number(data.chip_change) || 0;

    resultText.textContent =
      getRouletteResultName(data.result_type);

    if (chipChange > 0) {
      message.textContent =
        data.message +
        " 순수익 +" +
        chipChange.toLocaleString("ko-KR") +
        "칩";

      message.className =
        "roulette-message roulette-message-win";

      playRouletteWinEffect();
    } else if (chipChange === 0) {
      message.textContent =
        data.message +
        " 칩 변화는 없습니다.";

      message.className =
        "roulette-message roulette-message-refund";
    } else {
      message.textContent =
        data.message +
        " " +
        Math.abs(chipChange).toLocaleString("ko-KR") +
        "칩을 잃었습니다.";

      message.className =
        "roulette-message roulette-message-lose";
    }

    await loadRouletteHistory();
  } catch (error) {
    console.error("룰렛 실행 실패:", error);

    message.textContent =
      "룰렛 실행에 실패했습니다: " +
      error.message;

    message.className =
      "roulette-message roulette-message-lose";

    resultText.textContent =
      "결과를 불러오지 못했습니다.";

    if (typeof loadMyChips === "function") {
      await loadMyChips();
      renderNav();
    }
  } finally {
    rouletteRunning = false;

    button.disabled = false;
    setRouletteButtonsDisabled(false);
    updateRouletteBetButtons();
  }
}


// ---------------------------------------------------------
// 결과에 맞춰 룰렛 회전
// ---------------------------------------------------------

function spinRouletteToResult(resultType, resultSlot) {
  const wheel =
    document.getElementById("rouletteWheel");

  /*
    룰렛은 총 40칸입니다.

    360도 / 40칸 = 한 칸당 9도

    resultSlot:
    1       = 20배
    2~3     = 5배
    4~6     = 2배
    7~10    = 1배 환급
    11~40   = 꽝
  */

  const degreesPerSlot = 360 / 40;

  // 결과 칸의 정확한 중앙 각도
  // 경계가 아니라 중앙에 멈추게 합니다.
  const slotCenterAngle =
    (resultSlot - 0.5) * degreesPerSlot;

  /*
    포인터는 원판의 위쪽 0도 위치에 고정되어 있습니다.
    선택된 칸의 중앙을 포인터 방향으로 이동시킵니다.
  */
  const targetRotation =
    (360 - slotCenterAngle) % 360;

  /*
    현재 룰렛 각도에서 목표 각도까지 추가로 돌아갈 값입니다.
    이전 회전값이 누적되어 있어도 정확한 위치에 멈춥니다.
  */
  const currentRotation =
    ((rouletteRotation % 360) + 360) % 360;

  const correction =
    (targetRotation - currentRotation + 360) % 360;

  // 5회에서 7회 회전한 뒤 목표 칸에 정지
  const extraRounds =
    5 + Math.floor(Math.random() * 3);

  rouletteRotation +=
    extraRounds * 360 + correction;

  wheel.style.transform =
    "rotate(" + rouletteRotation + "deg)";

  return wait(3200);
}

function getRouletteResultName(resultType) {
  const names = {
    jackpot: "20배 슈퍼 잭팟",
    five: "5배 대박",
    double: "2배 당첨",
    refund: "1배 환급",
    lose: "꽝",
  };

  return names[resultType] || "결과 확인";
}


function playRouletteWinEffect() {
  const machine =
    document.querySelector(".roulette-machine");

  machine.classList.remove("roulette-win");
  void machine.offsetWidth;
  machine.classList.add("roulette-win");

  setTimeout(function () {
    machine.classList.remove("roulette-win");
  }, 1400);
}


function setRouletteButtonsDisabled(disabled) {
  document
    .querySelectorAll(".roulette-bet-button")
    .forEach(function (button) {
      button.disabled = disabled;
    });
}


// ---------------------------------------------------------
// 최근 기록
// ---------------------------------------------------------

async function loadRouletteHistory() {
  const list =
    document.getElementById("rouletteHistory");

  if (!list || !currentUser) return;

  list.innerHTML =
    "<li>게임 기록을 불러오는 중입니다.</li>";

  const { data, error } = await db
    .from("roulette_history")
    .select(
      "id, bet_amount, result_type, multiplier, " +
      "chip_change, created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("룰렛 기록 조회 실패:", error);

    list.innerHTML =
      "<li>게임 기록을 불러오지 못했습니다.</li>";

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      "<li>아직 룰렛 기록이 없습니다.</li>";

    return;
  }

  list.innerHTML = "";

  data.forEach(function (record) {
    const item = document.createElement("li");
    const result = document.createElement("div");
    const details = document.createElement("div");
    const change = document.createElement("strong");
    const time = document.createElement("small");

    result.className = "roulette-history-result";
    result.textContent =
      getRouletteResultName(record.result_type);

    details.className = "roulette-history-details";

    if (record.chip_change > 0) {
      change.className = "roulette-history-win";
    } else if (record.chip_change === 0) {
      change.className = "roulette-history-refund";
    } else {
      change.className = "roulette-history-loss";
    }

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