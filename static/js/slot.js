// =========================================================
// 상암 슬롯
// 실제 금전 가치가 없는 상암랜드 가상 칩만 사용합니다.
// =========================================================

let selectedSlotBet = 100;
let slotRunning = false;

const SLOT_SYMBOLS = [
  "🍒",
  "🍋",
  "🍇",
];


// common.js가 로그인 확인을 끝낸 뒤 실행합니다.
function onAuthReady() {
  updateSlotBetButtons();
}


// ---------------------------------------------------------
// 베팅 금액 선택
// ---------------------------------------------------------

function selectSlotBet(amount) {
  if (slotRunning) {
    return;
  }

  selectedSlotBet = amount;
  updateSlotBetButtons();

  const message = document.getElementById("slotMessage");

  if (message) {
    message.textContent =
      amount.toLocaleString("ko-KR") +
      "칩을 선택했습니다.";

    message.className = "slot-message";
  }
}


function updateSlotBetButtons() {
  const buttons =
    document.querySelectorAll(".slot-bet-button");

  buttons.forEach(function (button) {
    const buttonBet = Number(button.dataset.bet);

    button.classList.toggle(
      "active",
      buttonBet === selectedSlotBet
    );
  });

  const spinButton =
    document.getElementById("slotSpinButton");

  if (spinButton && !slotRunning) {
    spinButton.textContent =
      selectedSlotBet.toLocaleString("ko-KR") +
      "칩으로 돌리기";
  }
}


// ---------------------------------------------------------
// 슬롯 실행
// ---------------------------------------------------------

async function playSlot() {
  if (slotRunning) {
    return;
  }

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  const spinButton =
    document.getElementById("slotSpinButton");

  const message =
    document.getElementById("slotMessage");

  // 화면에 저장된 칩으로 먼저 확인합니다.
  // 최종 검사는 Supabase SQL 함수가 다시 수행합니다.
  if (currentChips < selectedSlotBet) {
    message.textContent =
      "보유 칩이 부족합니다.";

    message.className =
      "slot-message slot-message-lose";

    return;
  }

  slotRunning = true;

  spinButton.disabled = true;
  spinButton.textContent = "돌아가는 중...";

  setSlotBetButtonsDisabled(true);

  message.textContent =
    "상암 슬롯이 돌아가고 있습니다...";

  message.className = "slot-message";

  const animationId = startSlotAnimation();

  try {
    const { data, error } = await db.rpc(
      "play_sangam_slot",
      {
        p_bet_amount: selectedSlotBet,
      }
    );

    if (error) {
      throw error;
    }

    // 애니메이션이 너무 빨리 끝나지 않도록 잠시 기다립니다.
    await wait(1100);

    clearInterval(animationId);

    if (!data || !data.success) {
      showSlotResult("❔", "❔", "❔");

      message.textContent =
        data && data.message
          ? data.message
          : "슬롯을 실행하지 못했습니다.";

      message.className =
        "slot-message slot-message-lose";

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

    showSlotResult(
      data.symbol_1,
      data.symbol_2,
      data.symbol_3
    );

    // Supabase에서 반환한 최신 칩 잔액 반영
    currentChips = Number(data.chips) || 0;
    renderNav();

    const chipChange =
      Number(data.chip_change) || 0;

    const multiplier =
      Number(data.multiplier) || 0;

    if (multiplier > 0) {
      message.textContent =
        data.message +
        " 순수익 +" +
        chipChange.toLocaleString("ko-KR") +
        "칩";

      message.className =
        "slot-message slot-message-win";

      playSlotWinEffect();
    } else {
      message.textContent =
        data.message +
        " " +
        Math.abs(chipChange).toLocaleString("ko-KR") +
        "칩을 잃었습니다.";

      message.className =
        "slot-message slot-message-lose";
    }
  } catch (error) {
    clearInterval(animationId);

    console.error("슬롯 실행 실패:", error);

    showSlotResult("❔", "❔", "❔");

    message.textContent =
      "슬롯 실행에 실패했습니다: " +
      error.message;

    message.className =
      "slot-message slot-message-lose";

    // 오류 발생 시 실제 DB 잔액을 다시 불러옵니다.
    if (typeof loadMyChips === "function") {
      await loadMyChips();
      renderNav();
    }
  } finally {
    slotRunning = false;

    spinButton.disabled = false;

    setSlotBetButtonsDisabled(false);
    updateSlotBetButtons();
  }
}


// ---------------------------------------------------------
// 슬롯 회전 애니메이션
// 실제 결과는 Supabase가 결정합니다.
// ---------------------------------------------------------

function startSlotAnimation() {
  return setInterval(function () {
    showSlotResult(
      getRandomSlotSymbol(),
      getRandomSlotSymbol(),
      getRandomSlotSymbol()
    );

    document
      .querySelectorAll(".slot-reel")
      .forEach(function (reel) {
        reel.classList.add("spinning");

        setTimeout(function () {
          reel.classList.remove("spinning");
        }, 80);
      });
  }, 100);
}


function getRandomSlotSymbol() {
  const index = Math.floor(
    Math.random() * SLOT_SYMBOLS.length
  );

  return SLOT_SYMBOLS[index];
}


function showSlotResult(first, second, third) {
  document.getElementById("slotReel1").textContent =
    first;

  document.getElementById("slotReel2").textContent =
    second;

  document.getElementById("slotReel3").textContent =
    third;
}


function setSlotBetButtonsDisabled(disabled) {
  const buttons =
    document.querySelectorAll(".slot-bet-button");

  buttons.forEach(function (button) {
    button.disabled = disabled;
  });
}


function playSlotWinEffect() {
  const machine =
    document.querySelector(".slot-machine");

  if (!machine) {
    return;
  }

  machine.classList.remove("slot-win");

  // 같은 클래스를 다시 적용해도 애니메이션이 실행되도록 합니다.
  void machine.offsetWidth;

  machine.classList.add("slot-win");

  setTimeout(function () {
    machine.classList.remove("slot-win");
  }, 1200);
}


function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}