// =========================================================
// 상암 광산
// 보석과 칩은 실제 금전 가치가 없는 가상 재화입니다.
// =========================================================

let currentSwordState = null;
let forgeRunning = false;

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
  await loadSwordState();
  await loadForgeTable();
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
// =========================================================
// 상암 대장간
// =========================================================


// ---------------------------------------------------------
// 검 상태 불러오기
// ---------------------------------------------------------

async function loadSwordState() {
  const { data, error } = await db.rpc(
    "get_my_sword"
  );

  if (error) {
    console.error("검 상태 조회 실패:", error);

    showForgeMessage(
      "검 정보를 불러오지 못했습니다: " +
      error.message,
      "error"
    );

    return;
  }

  currentSwordState = data;

  renderSwordState();
}


// ---------------------------------------------------------
// 대장간 UI 초기화
// ---------------------------------------------------------

function resetForgeUI() {
  const sword =
    document.getElementById("forgeSword");

  const emptyState =
    document.getElementById("forgeEmptyState");

  const rates =
    document.getElementById("forgeRates");

  const craftButton =
    document.getElementById("forgeCraftButton");

  const enhanceButton =
    document.getElementById("forgeEnhanceButton");

  const dismantleButton =
    document.getElementById(
      "forgeDismantleButton"
    );

  sword.hidden = true;
  sword.className = "forge-sword";

  emptyState.hidden = false;

  rates.hidden = true;

  craftButton.hidden = false;
  craftButton.disabled = false;

  enhanceButton.hidden = true;
  enhanceButton.disabled = false;
  enhanceButton.textContent = "검 강화";

  dismantleButton.hidden = true;
  dismantleButton.disabled = false;

  document.getElementById(
    "forgeLevelBadge"
  ).textContent = "검 없음";

  document.getElementById(
    "forgeSwordName"
  ).textContent =
    "검을 제작해 보세요";

  document.getElementById(
    "forgeSwordValue"
  ).textContent =
    "제작 비용: 보석 1,000개";
}


// ---------------------------------------------------------
// 검 상태 표시
// ---------------------------------------------------------

function renderSwordState() {
  resetForgeUI();

  if (
    !currentSwordState ||
    !currentSwordState.has_sword
  ) {
    showForgeMessage(
      "검을 제작하면 강화에 도전할 수 있습니다.",
      "normal"
    );

    return;
  }

  const level =
    Number(currentSwordState.level);

  const sword =
    document.getElementById("forgeSword");

  const emptyState =
    document.getElementById("forgeEmptyState");

  const rates =
    document.getElementById("forgeRates");

  const craftButton =
    document.getElementById("forgeCraftButton");

  const enhanceButton =
    document.getElementById("forgeEnhanceButton");

  const dismantleButton =
    document.getElementById(
      "forgeDismantleButton"
    );

  emptyState.hidden = true;

  sword.hidden = false;
  sword.className =
    "forge-sword sword-level-" + level;

  craftButton.hidden = true;
  dismantleButton.hidden = false;

  document.getElementById(
    "forgeLevelBadge"
  ).textContent =
    "+" + level + "강";

  document.getElementById(
    "forgeSwordName"
  ).textContent =
    currentSwordState.name;

  document.getElementById(
    "forgeSwordValue"
  ).textContent =
    "분해 가치: 💎 " +
    Number(
      currentSwordState.value
    ).toLocaleString("ko-KR") +
    "개";

  if (currentSwordState.max_level) {
    rates.hidden = true;
    enhanceButton.hidden = true;

    showForgeMessage(
      "최고 단계인 +15강 검입니다!",
      "legendary"
    );

    return;
  }

  rates.hidden = false;
  enhanceButton.hidden = false;

  document.getElementById(
    "forgeSuccessRate"
  ).textContent =
    formatForgeRate(
      currentSwordState.success_rate
    );

  document.getElementById(
    "forgeMaintainRate"
  ).textContent =
    formatForgeRate(
      currentSwordState.maintain_rate
    );

  document.getElementById(
    "forgeDowngradeRate"
  ).textContent =
    formatForgeRate(
      currentSwordState.downgrade_rate
    );

  document.getElementById(
    "forgeDestroyRate"
  ).textContent =
    formatForgeRate(
      currentSwordState.destroy_rate
    );

  enhanceButton.textContent =
    "💎 " +
    Number(
      currentSwordState.upgrade_cost
    ).toLocaleString("ko-KR") +
    "개로 +" +
    (level + 1) +
    "강 도전";
}


function formatForgeRate(value) {
  return (
    Number(value || 0).toLocaleString(
      "ko-KR",
      {
        maximumFractionDigits: 2,
      }
    ) + "%"
  );
}


// ---------------------------------------------------------
// 검 제작
// ---------------------------------------------------------

async function craftSword() {
  if (forgeRunning) {
    return;
  }

  const confirmed = confirm(
    "보석 1,000개로 낡은 철검을 제작할까요?"
  );

  if (!confirmed) {
    return;
  }

  forgeRunning = true;
  setForgeButtonsDisabled(true);

  try {
    const { data, error } = await db.rpc(
      "craft_mine_sword"
    );

    if (error) {
      throw error;
    }

    if (!data || !data.success) {
      showForgeMessage(
        data && data.message
          ? data.message
          : "검을 제작하지 못했습니다.",
        "error"
      );

      return;
    }

    mineState.gems =
      Number(data.gems) || 0;

    renderMineState();

    showForgeMessage(
      data.message,
      "success"
    );

    playForgeEffect("success");

    await loadSwordState();
  } catch (error) {
    console.error("검 제작 실패:", error);

    showForgeMessage(
      "검 제작 실패: " + error.message,
      "error"
    );
  } finally {
    forgeRunning = false;
    setForgeButtonsDisabled(false);
  }
}


// ---------------------------------------------------------
// 검 강화
// ---------------------------------------------------------

async function enhanceSword() {
  if (
    forgeRunning ||
    !currentSwordState ||
    !currentSwordState.has_sword
  ) {
    return;
  }

  const oldLevel =
    Number(currentSwordState.level);

  const confirmed = confirm(
    "+" +
    oldLevel +
    "강 검을 강화할까요?\n\n" +

    "강화 비용: " +
    Number(
      currentSwordState.upgrade_cost
    ).toLocaleString("ko-KR") +
    "보석\n\n" +

    "성공: " +
    formatForgeRate(
      currentSwordState.success_rate
    ) +
    "\n" +

    "유지: " +
    formatForgeRate(
      currentSwordState.maintain_rate
    ) +
    "\n" +

    "하락: " +
    formatForgeRate(
      currentSwordState.downgrade_rate
    ) +
    "\n" +

    "파괴: " +
    formatForgeRate(
      currentSwordState.destroy_rate
    )
  );

  if (!confirmed) {
    return;
  }

  forgeRunning = true;
  setForgeButtonsDisabled(true);

  showForgeMessage(
    "대장장이가 검을 강화하고 있습니다...",
    "normal"
  );

  /*
    서버 결과를 먼저 요청합니다.
    결과가 도착하는 동안 망치 연출을 보여줍니다.
  */
  const rpcPromise = db.rpc(
    "enhance_mine_sword"
  );

  try {
    await playForgeHammerAnimation();

    const { data, error } =
      await rpcPromise;

    if (error) {
      throw error;
    }

    if (!data || !data.success) {
      showForgeMessage(
        data && data.message
          ? data.message
          : "강화하지 못했습니다.",
        "error"
      );

      return;
    }

    mineState.gems =
      Number(data.gems) || 0;

    renderMineState();

    /*
      망치 연출이 끝난 다음 결과를 공개합니다.
    */
    if (data.result === "success") {
      await playForgeSuccessResult(
        Number(data.level)
      );
    } else if (data.result === "maintain") {
      /*
        유지 결과는 별도 화면 효과 없이
        안내 문구만 표시합니다.
      */
      clearForgeResultEffects();
    } else if (data.result === "downgrade") {
      await playForgeDowngradeResult(
        Number(data.level)
      );
    } else if (data.result === "destroy") {
      await playForgeDestroyResult();
    }

    showForgeMessage(
      data.message,
      data.result
    );

    /*
      파괴 시 서버 재조회 전에 화면을 즉시 초기화합니다.
    */
    if (data.result === "destroy") {
      currentSwordState = {
        has_sword: false,
        craft_cost: 1000,
      };

      renderSwordState();

      /*
        renderSwordState가 기본 메시지를 덮어쓸 수 있으므로
        파괴 메시지를 마지막에 다시 표시합니다.
      */
      showForgeMessage(
        data.message,
        "destroy"
      );
    }

    await loadSwordState();

    if (data.result === "destroy") {
      showForgeMessage(
        data.message,
        "destroy"
      );
    }
  } catch (error) {
    console.error("검 강화 실패:", error);

    clearForgeResultEffects();

    showForgeMessage(
      "검 강화 실패: " + error.message,
      "error"
    );
  } finally {
    forgeRunning = false;
    setForgeButtonsDisabled(false);
  }
}


// ---------------------------------------------------------
// 검 분해
// ---------------------------------------------------------

async function dismantleSword() {
  if (
    forgeRunning ||
    !currentSwordState ||
    !currentSwordState.has_sword
  ) {
    return;
  }

  const confirmed = confirm(
    currentSwordState.name +
    "을(를) 분해할까요?\n\n" +

    "획득 보석: " +
    Number(
      currentSwordState.value
    ).toLocaleString("ko-KR") +
    "개\n\n" +

    "분해한 검은 복구할 수 없습니다."
  );

  if (!confirmed) {
    return;
  }

  forgeRunning = true;
  setForgeButtonsDisabled(true);

  try {
    const { data, error } = await db.rpc(
      "dismantle_mine_sword"
    );

    if (error) {
      throw error;
    }

    if (!data || !data.success) {
      showForgeMessage(
        data && data.message
          ? data.message
          : "검을 분해하지 못했습니다.",
        "error"
      );

      return;
    }

    mineState.gems =
      Number(data.gems) || 0;

    renderMineState();

    /*
      분해 직후 이전 검, 확률, 버튼을 즉시 제거합니다.
    */
    currentSwordState = {
      has_sword: false,
      craft_cost: 1000,
    };

    renderSwordState();

    showForgeMessage(
      data.message,
      "success"
    );

    await loadSwordState();
  } catch (error) {
    console.error("검 분해 실패:", error);

    showForgeMessage(
      "검 분해 실패: " + error.message,
      "error"
    );
  } finally {
    forgeRunning = false;
    setForgeButtonsDisabled(false);
  }
}


// ---------------------------------------------------------
// 강화 확률표
// ---------------------------------------------------------

async function loadForgeTable() {
  const body =
    document.getElementById(
      "forgeTableBody"
    );

  if (!body) {
    return;
  }

  const { data, error } = await db.rpc(
    "get_sword_upgrade_table"
  );

  if (error) {
    console.error(
      "강화 확률표 조회 실패:",
      error
    );

    body.innerHTML =
      '<tr><td colspan="8">' +
      "강화 정보를 불러오지 못했습니다." +
      "</td></tr>";

    return;
  }

  body.innerHTML = "";

  (data || []).forEach(function (row) {
    const tr =
      document.createElement("tr");

    tr.innerHTML =
      "<td>+" +
      row.current_level +
      " → +" +
      row.next_level +
      "</td>" +

      "<td>💎 " +
      Number(
        row.upgrade_cost
      ).toLocaleString("ko-KR") +
      "</td>" +

      "<td>💎 " +
      Number(
        row.current_value
      ).toLocaleString("ko-KR") +
      "</td>" +

      "<td>💎 " +
      Number(
        row.next_value
      ).toLocaleString("ko-KR") +
      "</td>" +

      '<td class="rate-success">' +
      formatForgeRate(
        row.success_rate
      ) +
      "</td>" +

      '<td class="rate-maintain">' +
      formatForgeRate(
        row.maintain_rate
      ) +
      "</td>" +

      '<td class="rate-downgrade">' +
      formatForgeRate(
        row.downgrade_rate
      ) +
      "</td>" +

      '<td class="rate-destroy">' +
      formatForgeRate(
        row.destroy_rate
      ) +
      "</td>";

    body.appendChild(tr);
  });
}


// ---------------------------------------------------------
// 대장간 공통 효과
// ---------------------------------------------------------

function setForgeButtonsDisabled(disabled) {
  [
    "forgeCraftButton",
    "forgeEnhanceButton",
    "forgeDismantleButton",
  ].forEach(function (id) {
    const button =
      document.getElementById(id);

    if (button) {
      button.disabled = disabled;
    }
  });
}


function playForgeEffect(result) {
  const section =
    document.querySelector(
      ".forge-section"
    );

  if (!section) {
    return;
  }

  section.classList.remove(
    "forge-success",
    "forge-maintain",
    "forge-downgrade",
    "forge-destroy"
  );

  void section.offsetWidth;

  section.classList.add(
    "forge-" + result
  );

  setTimeout(function () {
    section.classList.remove(
      "forge-" + result
    );
  }, 1400);
}


function showForgeMessage(text, type) {
  const message =
    document.getElementById(
      "forgeMessage"
    );

  if (!message) {
    return;
  }

  message.textContent = text;

  message.className =
    "forge-message forge-message-" +
    (type || "normal");
}

// ---------------------------------------------------------
// 강화 망치 연출
// ---------------------------------------------------------

function playForgeHammerAnimation() {
  const stage =
    document.querySelector(".forge-fire-stage");

  const hammer =
    document.getElementById("forgeHammerEffect");

  const sword =
    document.getElementById("forgeSword");

  if (!stage || !hammer || !sword) {
    return Promise.resolve();
  }

  clearForgeResultEffects();

  stage.classList.add("forge-working");
  hammer.classList.add("active");
  sword.classList.add("being-forged");

  /*
    CSS에서 망치 세 번 치는 시간이 약 1.35초입니다.
  */
  return new Promise(function (resolve) {
    setTimeout(function () {
      stage.classList.remove("forge-working");
      hammer.classList.remove("active");
      sword.classList.remove("being-forged");

      resolve();
    }, 1400);
  });
}

// ---------------------------------------------------------
// 강화 결과 연출
// ---------------------------------------------------------

function playForgeSuccessResult(level) {
  const stage =
    document.querySelector(".forge-fire-stage");

  const sword =
    document.getElementById("forgeSword");

  const overlay =
    document.getElementById("forgeResultOverlay");

  const title =
    document.getElementById("forgeResultTitle");

  const subtitle =
    document.getElementById("forgeResultSubtitle");

  clearForgeResultEffects();

  title.textContent = "강화 성공!";
  subtitle.textContent =
    "+" + level + "강 달성";

  overlay.classList.add(
    "show",
    "result-success"
  );

  stage.classList.add("result-success");
  sword.classList.add("result-success");

  return waitForForgeEffect(1200);
}


function playForgeDowngradeResult(level) {
  const stage =
    document.querySelector(".forge-fire-stage");

  const sword =
    document.getElementById("forgeSword");

  const overlay =
    document.getElementById("forgeResultOverlay");

  const title =
    document.getElementById("forgeResultTitle");

  const subtitle =
    document.getElementById("forgeResultSubtitle");

  clearForgeResultEffects();

  title.textContent = "강화 하락";
  subtitle.textContent =
    "+" + level + "강으로 하락";

  overlay.classList.add(
    "show",
    "result-downgrade"
  );

  stage.classList.add("result-downgrade");
  sword.classList.add("result-downgrade");

  return waitForForgeEffect(1100);
}


function playForgeDestroyResult() {
  const stage =
    document.querySelector(".forge-fire-stage");

  const sword =
    document.getElementById("forgeSword");

  const overlay =
    document.getElementById("forgeResultOverlay");

  const pieces =
    document.getElementById("forgeDestroyPieces");

  const title =
    document.getElementById("forgeResultTitle");

  const subtitle =
    document.getElementById("forgeResultSubtitle");

  clearForgeResultEffects();

  title.textContent = "검 파괴!";
  subtitle.textContent =
    "검이 산산조각 났습니다";

  overlay.classList.add(
    "show",
    "result-destroy"
  );

  stage.classList.add("result-destroy");
  sword.classList.add("result-destroy");
  pieces.classList.add("active");

  return waitForForgeEffect(1400);
}

function clearForgeResultEffects() {
  const stage =
    document.querySelector(".forge-fire-stage");

  const sword =
    document.getElementById("forgeSword");

  const overlay =
    document.getElementById("forgeResultOverlay");

  const pieces =
    document.getElementById("forgeDestroyPieces");

  if (stage) {
    stage.classList.remove(
      "forge-working",
      "result-success",
      "result-downgrade",
      "result-destroy"
    );
  }

  if (sword) {
    sword.classList.remove(
      "being-forged",
      "result-success",
      "result-downgrade",
      "result-destroy"
    );
  }

  if (overlay) {
    overlay.classList.remove(
      "show",
      "result-success",
      "result-downgrade",
      "result-destroy"
    );
  }

  if (pieces) {
    pieces.classList.remove("active");
  }
}


function waitForForgeEffect(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      clearForgeResultEffects();
      resolve();
    }, milliseconds);
  });
}