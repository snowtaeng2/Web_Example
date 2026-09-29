// =========================================================
// 상암 광산
// 보석과 칩은 실제 금전 가치가 없는 가상 재화입니다.
// =========================================================

let mineState = {
  gems: 0,
  totalClicks: 0,
  clicksTowardFever: 0,
  feverActive: false,
  feverRemainingMs: 0,
};

let feverEndTime = 0;
let feverTimerId = null;
let chestRunning = false;
let mineRequestRunning = false;
let criticalOverlayTimerId = null;


// common.js가 로그인을 확인한 뒤 실행합니다.
async function onAuthReady() {
  await loadMineState();
}


// ---------------------------------------------------------
// 광산 상태 불러오기
// ---------------------------------------------------------

async function loadMineState() {
  const { data, error } = await db.rpc("get_my_mine");

  if (error) {
    console.error("광산 상태 조회 실패:", error);

    showMineMessage(
      "광산 정보를 불러오지 못했습니다.",
      "error"
    );

    return;
  }

  applyMineState(data);
}


function applyMineState(data) {
  mineState.gems =
    Number(data.gems) || 0;

  mineState.totalClicks =
    Number(data.total_clicks) || 0;

  mineState.clicksTowardFever =
    Number(data.clicks_toward_fever) || 0;

  mineState.feverActive =
    Boolean(data.fever_active);

  mineState.feverRemainingMs =
    Number(data.fever_remaining_ms) || 0;

  if (mineState.feverActive) {
    startFeverCountdown(
      mineState.feverRemainingMs
    );
  } else {
    stopFeverCountdown();
  }

  renderMineState();
}


// ---------------------------------------------------------
// 화면 갱신
// ---------------------------------------------------------

function renderMineState() {
  document.getElementById("mineGems").textContent =
    "💎 " +
    mineState.gems.toLocaleString("ko-KR") +
    "개";

  document.getElementById(
    "mineTotalClicks"
  ).textContent =
    mineState.totalClicks.toLocaleString("ko-KR") +
    "회";

  document.getElementById(
    "mineProgressText"
  ).textContent =
    mineState.clicksTowardFever.toLocaleString("ko-KR") +
    " / 500";

  const progressPercent = Math.min(
  100,
  (mineState.clicksTowardFever / 500) * 100
);

  document.getElementById(
    "mineProgressBar"
  ).style.width =
    progressPercent + "%";

  document
    .getElementById("mineMachine")
    .classList.toggle(
      "fever-active",
      mineState.feverActive
    );

  document
    .getElementById("oreButton")
    .classList.toggle(
      "fever-ore",
      mineState.feverActive
    );
}


// ---------------------------------------------------------
// 광석 클릭
// ---------------------------------------------------------

async function mineOre() {
  /*
    요청 한 번이 끝나기 전에 연속 RPC가 지나치게 쌓이는 것을
    방지합니다. 클릭 연출은 계속 표시됩니다.
  */

  playOreHitEffect();

  if (mineRequestRunning) {
    return;
  }

  mineRequestRunning = true;

  try {
    const { data, error } = await db.rpc("mine_ore");

    if (error) {
      console.error("채굴 실패:", error);

      showMineMessage(
        "채굴에 실패했습니다: " + error.message,
        "error"
      );

      return;
    }

    if (!data || !data.success) {
      if (!data || !data.rate_limited) {
        showMineMessage(
          data && data.message
            ? data.message
            : "채굴하지 못했습니다.",
          "error"
        );
      }

      return;
    }

    applyMineState(data);

    if (data.fever_started) {
  showMineMessage(
    data.message,
    "fever"
  );

  playFeverStartEffect();

  showCriticalOverlay(
    Number(data.reward) || 100,
    Number(data.gauge_gain) || 0,
    false
  );
    } else if (data.critical) {
  showMineMessage(
    data.message,
    "critical"
  );

  playCriticalOreEffect();

  showCriticalOverlay(
    Number(data.reward) || 100,
    Number(data.gauge_gain) || 0,
    Boolean(data.fever_active)
  );
} else {
      showMineMessage(
        data.message,
        "normal"
      );
    }

    showFloatingGem(
      Number(data.reward) || 0,
      Boolean(data.critical)
    );
  } finally {
    mineRequestRunning = false;
  }
}


// ---------------------------------------------------------
// 광석 클릭 연출
// ---------------------------------------------------------

function playOreHitEffect() {
  const ore =
    document.getElementById("oreButton");

  ore.classList.remove("mine-hit");
  void ore.offsetWidth;
  ore.classList.add("mine-hit");

  setTimeout(function () {
    ore.classList.remove("mine-hit");
  }, 220);
}


function playCriticalOreEffect() {
  const ore =
    document.getElementById("oreButton");

  ore.classList.remove("mine-critical-hit");
  void ore.offsetWidth;
  ore.classList.add("mine-critical-hit");

  setTimeout(function () {
    ore.classList.remove("mine-critical-hit");
  }, 650);
}

function showCriticalOverlay(
  reward,
  gaugeGain,
  feverActive
) {
  const overlay =
    document.getElementById(
      "mineCriticalOverlay"
    );

  const rewardText =
    overlay.querySelector(
      ".mine-critical-content strong"
    );

  const gaugeText =
    document.getElementById(
      "mineCriticalGaugeText"
    );

  if (!overlay || !rewardText || !gaugeText) {
    return;
  }

  rewardText.textContent =
    "+" +
    Number(reward).toLocaleString("ko-KR") +
    " 💎";

  if (feverActive && gaugeGain === 0) {
    gaugeText.textContent =
      "FEVER 크리티컬";
  } else {
    gaugeText.textContent =
      "피버 게이지 +" +
      Number(gaugeGain).toLocaleString("ko-KR");
  }

  /*
    새 크리티컬이 발생하면 기존 타이머를 취소하고
    표시 시간을 다시 1.5초로 연장합니다.

    따라서 연타 중 크리티컬이 연속으로 나와도
    이전 효과가 즉시 사라지지 않습니다.
  */
  if (criticalOverlayTimerId) {
    clearTimeout(criticalOverlayTimerId);
  }

  overlay.classList.remove("show");
  void overlay.offsetWidth;
  overlay.classList.add("show");

  criticalOverlayTimerId = setTimeout(
    function () {
      overlay.classList.remove("show");
      criticalOverlayTimerId = null;
    },
    1500
  );
}

function playFeverStartEffect() {
  const machine =
    document.getElementById("mineMachine");

  machine.classList.remove("mine-fever-start");
  void machine.offsetWidth;
  machine.classList.add("mine-fever-start");

  setTimeout(function () {
    machine.classList.remove("mine-fever-start");
  }, 1200);
}


// ---------------------------------------------------------
// 피버타임
// ---------------------------------------------------------

function startFeverCountdown(milliseconds) {
  stopFeverCountdown();

  const banner =
    document.getElementById("feverBanner");

  banner.hidden = false;

  feverEndTime =
    Date.now() + milliseconds;

  updateFeverTimer();

  feverTimerId = setInterval(
    updateFeverTimer,
    50
  );
}


function updateFeverTimer() {
  const remaining =
    Math.max(
      0,
      feverEndTime - Date.now()
    );

  document.getElementById(
    "feverTimer"
  ).textContent =
    (remaining / 1000).toFixed(1) +
    "초";

  if (remaining <= 0) {
    mineState.feverActive = false;
    stopFeverCountdown();
    renderMineState();

    showMineMessage(
      "피버타임이 종료되었습니다.",
      "normal"
    );
  }
}


function stopFeverCountdown() {
  if (feverTimerId) {
    clearInterval(feverTimerId);
    feverTimerId = null;
  }

  const banner =
    document.getElementById("feverBanner");

  if (banner) {
    banner.hidden = true;
  }
}


// ---------------------------------------------------------
// 떠오르는 보석 숫자
// ---------------------------------------------------------

function showFloatingGem(amount, critical) {
  const cave =
    document.querySelector(".mine-cave");

  const effect =
    document.createElement("span");

  effect.className =
    critical
      ? "mine-floating-gem critical"
      : "mine-floating-gem";

  effect.textContent =
    "+" +
    amount.toLocaleString("ko-KR") +
    " 💎";

  effect.style.left =
    35 + Math.random() * 30 + "%";

  effect.style.top =
    25 + Math.random() * 25 + "%";

  cave.appendChild(effect);

  setTimeout(function () {
    effect.remove();
  }, 950);
}


// ---------------------------------------------------------
// 보석을 칩으로 교환
// ---------------------------------------------------------

async function exchangeMineGems() {
  const amount = Number(
    document.getElementById(
      "gemExchangeAmount"
    ).value
  );

  const chipAmount =
    amount / 100;

  const confirmed = confirm(
    "보석 " +
    amount.toLocaleString("ko-KR") +
    "개를 칩 " +
    chipAmount.toLocaleString("ko-KR") +
    "개로 교환할까요?"
  );

  if (!confirmed) {
    return;
  }

  const { data, error } = await db.rpc(
    "exchange_gems_for_chips",
    {
      p_gems: amount,
    }
  );

  if (error) {
    console.error("보석 교환 실패:", error);

    showMineMessage(
      "교환 실패: " + error.message,
      "error"
    );

    return;
  }

  if (!data || !data.success) {
    showMineMessage(
      data && data.message
        ? data.message
        : "교환하지 못했습니다.",
      "error"
    );

    return;
  }

  mineState.gems =
    Number(data.gems) || 0;

  currentChips =
    Number(data.chips) || 0;

  renderMineState();
  renderNav();

  showMineMessage(
    data.message,
    "success"
  );
}


// ---------------------------------------------------------
// 보물상자
// ---------------------------------------------------------

async function openMineChest() {
  if (chestRunning) {
    return;
  }

  const confirmed = confirm(
    "보석 1,000개를 사용해 보물상자를 열까요?"
  );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById("mineChestButton");

  const icon =
    document.getElementById("mineChestIcon");

  chestRunning = true;

  button.disabled = true;
  button.textContent = "상자 여는 중...";

  icon.classList.add("opening");

  try {
    const { data, error } = await db.rpc(
      "open_mine_chest"
    );

    if (error) {
      throw error;
    }

    await wait(800);

    if (!data || !data.success) {
      showMineMessage(
        data && data.message
          ? data.message
          : "보물상자를 열지 못했습니다.",
        "error"
      );

      return;
    }

    mineState.gems =
      Number(data.gems) || 0;

    renderMineState();

    if (data.result_type === "legendary") {
      showMineMessage(
        data.message,
        "legendary"
      );

      playLegendaryChestEffect();
    } else if (Number(data.gem_change) > 0) {
      showMineMessage(
        data.message,
        "success"
      );
    } else if (Number(data.gem_change) === 0) {
      showMineMessage(
        data.message,
        "normal"
      );
    } else {
      showMineMessage(
        data.message,
        "error"
      );
    }
  } catch (error) {
    console.error("보물상자 오류:", error);

    showMineMessage(
      "보물상자를 열지 못했습니다: " +
      error.message,
      "error"
    );
  } finally {
    chestRunning = false;

    button.disabled = false;
    button.textContent =
      "보석 1,000개로 열기";

    icon.classList.remove("opening");
  }
}


function playLegendaryChestEffect() {
  const card =
    document.querySelector(".mine-chest-card");

  card.classList.remove("legendary-open");
  void card.offsetWidth;
  card.classList.add("legendary-open");

  setTimeout(function () {
    card.classList.remove("legendary-open");
  }, 1600);
}


// ---------------------------------------------------------
// 안내 문구
// ---------------------------------------------------------

function showMineMessage(text, type) {
  const message =
    document.getElementById("mineMessage");

  message.textContent = text;

  message.className =
    "mine-message mine-message-" + type;
}


function wait(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}