// =========================================================
// 상암랜드 동전 던지기
// 실제 금전 가치가 없는 가상 칩만 사용합니다.
// =========================================================

let selectedCoinChoice = "heads";
let selectedCoinBet = 100;
let coinRunning = false;


// common.js가 로그인 확인을 마치면 실행됩니다.
async function onAuthReady() {
  updateCoinControls();
  await loadCoinHistory();
}


// ---------------------------------------------------------
// 앞면 또는 뒷면 선택
// ---------------------------------------------------------

function selectCoinChoice(choice) {
  if (coinRunning) {
    return;
  }

  selectedCoinChoice = choice;
  updateCoinControls();

  const message = document.getElementById("coinMessage");

  message.textContent =
    getCoinChoiceName(choice) +
    "을 선택했습니다.";

  message.className = "coin-message";
}


// ---------------------------------------------------------
// 베팅 칩 선택
// ---------------------------------------------------------

function selectCoinBet(amount) {
  if (coinRunning) {
    return;
  }

  selectedCoinBet = amount;
  updateCoinControls();

  const message = document.getElementById("coinMessage");

  message.textContent =
    amount.toLocaleString("ko-KR") +
    "칩을 선택했습니다.";

  message.className = "coin-message";
}


// ---------------------------------------------------------
// 버튼 상태 갱신
// ---------------------------------------------------------

function updateCoinControls() {
  document
    .querySelectorAll(".coin-choice-button")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.choice === selectedCoinChoice
      );
    });

  document
    .querySelectorAll(".coin-bet-button")
    .forEach(function (button) {
      button.classList.toggle(
        "active",
        Number(button.dataset.bet) === selectedCoinBet
      );
    });

  const playButton =
    document.getElementById("coinFlipButton");

  if (playButton && !coinRunning) {
    playButton.textContent =
      getCoinChoiceName(selectedCoinChoice) +
      "에 " +
      selectedCoinBet.toLocaleString("ko-KR") +
      "칩 걸기";
  }
}


// ---------------------------------------------------------
// 동전 던지기 실행
// ---------------------------------------------------------

async function playCoinFlip() {
  if (coinRunning) {
    return;
  }

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  const playButton =
    document.getElementById("coinFlipButton");

  const message =
    document.getElementById("coinMessage");

  const resultText =
    document.getElementById("coinResultText");

  if (currentChips < selectedCoinBet) {
    message.textContent = "보유 칩이 부족합니다.";
    message.className = "coin-message coin-message-lose";
    return;
  }

  coinRunning = true;

  playButton.disabled = true;
  playButton.textContent = "동전 던지는 중...";

  setCoinControlsDisabled(true);

  message.textContent = "동전이 돌아가고 있습니다...";
  message.className = "coin-message";

  resultText.textContent = "결과 확인 중...";

  startCoinAnimation();

  try {
    const { data, error } = await db.rpc(
      "play_coin_flip",
      {
        p_bet_amount: selectedCoinBet,
        p_user_choice: selectedCoinChoice,
      }
    );

    if (error) {
      throw error;
    }

    await wait(1200);

    stopCoinAnimation();

    if (!data || !data.success) {
      showCoinResult(null);

      message.textContent =
        data && data.message
          ? data.message
          : "게임을 실행하지 못했습니다.";

      message.className =
        "coin-message coin-message-lose";

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

    showCoinResult(data.coin_result);

    currentChips = Number(data.chips) || 0;
    renderNav();

    const resultName =
      getCoinChoiceName(data.coin_result);

    resultText.textContent =
      "결과: " + resultName;

    const chipChange =
      Number(data.chip_change) || 0;

    if (data.is_win) {
      message.textContent =
        data.message +
        " 순수익 +" +
        chipChange.toLocaleString("ko-KR") +
        "칩";

      message.className =
        "coin-message coin-message-win";

      playCoinWinEffect();
    } else {
      message.textContent =
        data.message +
        " " +
        Math.abs(chipChange).toLocaleString("ko-KR") +
        "칩을 잃었습니다.";

      message.className =
        "coin-message coin-message-lose";
    }

    await loadCoinHistory();
  } catch (error) {
    stopCoinAnimation();

    console.error("동전 던지기 실패:", error);

    showCoinResult(null);

    resultText.textContent =
      "결과를 불러오지 못했습니다.";

    message.textContent =
      "동전 던지기에 실패했습니다: " +
      error.message;

    message.className =
      "coin-message coin-message-lose";

    if (typeof loadMyChips === "function") {
      await loadMyChips();
      renderNav();
    }
  } finally {
    coinRunning = false;

    playButton.disabled = false;
    setCoinControlsDisabled(false);
    updateCoinControls();
  }
}


// ---------------------------------------------------------
// 동전 애니메이션
// ---------------------------------------------------------

function startCoinAnimation() {
  const coin = document.getElementById("coinObject");

  coin.classList.remove(
    "coin-show-heads",
    "coin-show-tails"
  );

  coin.classList.add("coin-flipping");
}


function stopCoinAnimation() {
  const coin = document.getElementById("coinObject");

  coin.classList.remove("coin-flipping");
}


function showCoinResult(result) {
  const coin = document.getElementById("coinObject");

  coin.classList.remove(
    "coin-flipping",
    "coin-show-heads",
    "coin-show-tails"
  );

  void coin.offsetWidth;

  if (result === "heads") {
    coin.classList.add("coin-show-heads");
  } else if (result === "tails") {
    coin.classList.add("coin-show-tails");
  }
}


function playCoinWinEffect() {
  const machine = document.querySelector(".coin-machine");

  machine.classList.remove("coin-win");
  void machine.offsetWidth;
  machine.classList.add("coin-win");

  setTimeout(function () {
    machine.classList.remove("coin-win");
  }, 1200);
}


// ---------------------------------------------------------
// 컨트롤 잠금
// ---------------------------------------------------------

function setCoinControlsDisabled(disabled) {
  document
    .querySelectorAll(
      ".coin-choice-button, .coin-bet-button"
    )
    .forEach(function (button) {
      button.disabled = disabled;
    });
}


// ---------------------------------------------------------
// 최근 기록 불러오기
// ---------------------------------------------------------

async function loadCoinHistory() {
  const list = document.getElementById("coinHistory");

  if (!list || !currentUser) {
    return;
  }

  list.innerHTML =
    "<li>게임 기록을 불러오는 중입니다.</li>";

  const { data, error } = await db
    .from("coin_flip_history")
    .select(
      "id, bet_amount, user_choice, coin_result, " +
      "is_win, chip_change, created_at"
    )
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("동전 기록 조회 실패:", error);

    list.innerHTML =
      "<li>게임 기록을 불러오지 못했습니다.</li>";

    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML =
      "<li>아직 동전 던지기 기록이 없습니다.</li>";

    return;
  }

  list.innerHTML = "";

  data.forEach(function (record) {
    const item = document.createElement("li");
    const result = document.createElement("div");
    const details = document.createElement("div");
    const change = document.createElement("strong");
    const time = document.createElement("small");

    result.className = "coin-history-result";

    result.textContent =
      getCoinChoiceName(record.user_choice) +
      " 선택 → " +
      getCoinChoiceName(record.coin_result);

    details.className = "coin-history-details";

    change.className =
      record.is_win
        ? "coin-history-win"
        : "coin-history-loss";

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


// ---------------------------------------------------------
// 공통 도우미
// ---------------------------------------------------------

function getCoinChoiceName(choice) {
  return choice === "heads" ? "앞면" : "뒷면";
}


function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}