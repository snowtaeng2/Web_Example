// =========================================================
// 운명의 도박
// 천사의 축복 1%, 악마의 심판 99%
// 실제 금전 가치가 없는 가상 칩만 사용합니다.
// =========================================================

let fateRunning = false;


// common.js가 로그인 확인을 마친 뒤 실행합니다.
function onAuthReady() {
  updateFateBalance();
  updateFateButton();
}


// ---------------------------------------------------------
// 현재 보유 칩 표시
// ---------------------------------------------------------

function updateFateBalance() {
  const balance =
    document.getElementById("fateCurrentChips");

  if (!balance) {
    return;
  }

  balance.textContent =
    Number(currentChips || 0).toLocaleString("ko-KR") +
    "칩";
}


// ---------------------------------------------------------
// 실행 버튼 상태
// ---------------------------------------------------------

function updateFateButton() {
  const agreement =
    document.getElementById("fateAgreement");

  const button =
    document.getElementById("fatePlayButton");

  const message =
    document.getElementById("fateMessage");

  if (!agreement || !button) {
    return;
  }

  if (fateRunning) {
    button.disabled = true;
    return;
  }

  if (currentChips <= 0) {
    button.disabled = true;
    button.textContent = "보유 칩이 없습니다";

    if (message) {
      message.textContent =
        "출석 체크 등으로 칩을 획득한 뒤 다시 도전해 주세요.";

      message.className =
        "fate-message fate-message-lose";
    }

    return;
  }

  button.disabled = !agreement.checked;

  button.textContent = agreement.checked
    ? "전 재산으로 운명의 문 열기"
    : "운명의 문 열기";

  if (message && !agreement.checked) {
    message.textContent =
      "확인란에 체크하면 게임을 실행할 수 있습니다.";

    message.className = "fate-message";
  }
}


// ---------------------------------------------------------
// 게임 실행
// ---------------------------------------------------------

async function playFateGame() {
  if (fateRunning) {
    return;
  }

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  if (currentChips <= 0) {
    alert("보유한 칩이 없습니다.");
    return;
  }

  const agreement =
    document.getElementById("fateAgreement");

  const button =
    document.getElementById("fatePlayButton");

  const message =
    document.getElementById("fateMessage");

  if (!agreement.checked) {
    message.textContent =
      "전액 손실 가능성을 먼저 확인해 주세요.";

    message.className =
      "fate-message fate-message-lose";

    return;
  }

  const chipText =
    Number(currentChips).toLocaleString("ko-KR");

  const confirmed = confirm(
    "현재 보유한 " +
    chipText +
    "칩을 전부 사용합니다.\n\n" +
    "천사의 축복: 30%, 총 20배\n" +
    "악마의 심판: 70%, 전액 손실\n\n" +
    "정말 운명의 문을 열겠습니까?"
  );

  if (!confirmed) {
    return;
  }

  fateRunning = true;

  button.disabled = true;
  button.textContent = "운명이 결정되는 중...";

  agreement.disabled = true;

  resetFateScene();

  message.textContent =
    "천사와 악마가 운명을 결정하고 있습니다...";

  message.className = "fate-message";

  startFateAnimation();

  try {
    // 이 함수는 베팅 금액을 전달받지 않습니다.
    // Supabase가 현재 보유 칩 전부를 직접 확인합니다.
    const { data, error } = await db.rpc(
      "play_fate_game"
    );

    if (error) {
      throw error;
    }

    await wait(2200);
    stopFateAnimation();

    if (!data || !data.success) {
      message.textContent =
        data && data.message
          ? data.message
          : "운명의 도박을 실행하지 못했습니다.";

      message.className =
        "fate-message fate-message-lose";

      if (
        data &&
        data.chips !== undefined &&
        data.chips !== null
      ) {
        currentChips = Number(data.chips) || 0;
        renderNav();
        updateFateBalance();
      }

      return;
    }

    currentChips = Number(data.chips) || 0;

    renderNav();
    updateFateBalance();

    const chipChange =
      Number(data.chip_change) || 0;

    if (data.result_type === "angel") {
      showAngelResult();

      message.textContent =
        data.message +
        " 순수익 +" +
        chipChange.toLocaleString("ko-KR") +
        "칩";

      message.className =
        "fate-message fate-message-angel";

      playAngelEffect();
    } else {
      showDevilResult();

      message.textContent =
        data.message +
        " " +
        Math.abs(chipChange).toLocaleString("ko-KR") +
        "칩을 잃었습니다.";

      message.className =
        "fate-message fate-message-lose";

      playDevilEffect();
    }

    agreement.checked = false;

  } catch (error) {
    stopFateAnimation();

    console.error("운명의 도박 실행 실패:", error);

    message.textContent =
      "게임 실행에 실패했습니다: " +
      error.message;

    message.className =
      "fate-message fate-message-lose";

    if (typeof loadMyChips === "function") {
      await loadMyChips();
      renderNav();
      updateFateBalance();
    }
  } finally {
    fateRunning = false;

    agreement.disabled = false;

    updateFateButton();
  }
}


// ---------------------------------------------------------
// 운명 결정 애니메이션
// ---------------------------------------------------------

function startFateAnimation() {
  const machine =
    document.getElementById("fateMachine");

  const seal =
    document.getElementById("fateSeal");

  machine.classList.add("fate-deciding");
  seal.textContent = "?";
}


function stopFateAnimation() {
  const machine =
    document.getElementById("fateMachine");

  machine.classList.remove("fate-deciding");
}


function resetFateScene() {
  const machine =
    document.getElementById("fateMachine");

  const seal =
    document.getElementById("fateSeal");

  machine.classList.remove(
    "fate-angel-result",
    "fate-devil-result"
  );

  seal.textContent = "운명";
}


function showAngelResult() {
  const machine =
    document.getElementById("fateMachine");

  const seal =
    document.getElementById("fateSeal");

  machine.classList.remove("fate-devil-result");
  machine.classList.add("fate-angel-result");

  seal.textContent = "축복";
}


function showDevilResult() {
  const machine =
    document.getElementById("fateMachine");

  const seal =
    document.getElementById("fateSeal");

  machine.classList.remove("fate-angel-result");
  machine.classList.add("fate-devil-result");

  seal.textContent = "심판";
}


function playAngelEffect() {
  const machine =
    document.getElementById("fateMachine");

  machine.classList.remove("fate-angel-flash");
  void machine.offsetWidth;
  machine.classList.add("fate-angel-flash");

  setTimeout(function () {
    machine.classList.remove("fate-angel-flash");
  }, 1800);
}


function playDevilEffect() {
  const machine =
    document.getElementById("fateMachine");

  machine.classList.remove("fate-devil-flash");
  void machine.offsetWidth;
  machine.classList.add("fate-devil-flash");

  setTimeout(function () {
    machine.classList.remove("fate-devil-flash");
  }, 1800);
}

function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}