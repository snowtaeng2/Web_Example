// 홈페이지 전용 코드
// common.js가 로그인 상태를 확인한 뒤 이 함수를 자동으로 불러줍니다.

async function onAuthReady() {
  const loginBox = document.getElementById("loginBox");
  const welcomeBox = document.getElementById("welcomeBox");

  if (currentUser) {
    loginBox.hidden = true;
    welcomeBox.hidden = false;

    document.getElementById("hello").textContent =
      currentUser.email.split("@")[0] + "님, 안녕하세요!";

    await loadAttendanceStatus();
    await loadHomeNotices();
  } else {
    loginBox.hidden = false;
    welcomeBox.hidden = true;
  }
}


// ---------------------------------------------------------
// 오늘 출석 상태 확인
// ---------------------------------------------------------

async function loadAttendanceStatus() {
  const btn = document.getElementById("attendanceBtn");
  const message = document.getElementById("attendanceMessage");

  if (!btn || !message || !currentUser) {
    return;
  }

  btn.disabled = true;
  btn.textContent = "확인 중...";

  const { data, error } = await db.rpc("get_today_attendance");

  if (error) {
    console.error("출석 상태 확인 실패:", error);

    btn.disabled = false;
    btn.textContent = "출석 체크";
    message.textContent =
      "출석 상태를 확인하지 못했습니다.";

    return;
  }

  if (data.checked) {
    btn.disabled = true;
    btn.textContent = "오늘 출석 완료";
    message.textContent =
      "오늘의 출석 보상을 이미 받았습니다.";
  } else {
    btn.disabled = false;
    btn.textContent = "1,000칩 받기";
    message.textContent =
      "버튼을 눌러 오늘의 출석 보상을 받으세요.";
  }
}


// ---------------------------------------------------------
// 출석 체크 실행
// ---------------------------------------------------------

async function checkAttendance() {
  const btn = document.getElementById("attendanceBtn");
  const message = document.getElementById("attendanceMessage");

  if (!currentUser) {
    alert("로그인이 필요합니다.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "출석 확인 중...";
  message.textContent = "";

  const { data, error } = await db.rpc("check_in_today");

  if (error) {
    console.error("출석 체크 실패:", error);

    btn.disabled = false;
    btn.textContent = "출석 체크";
    message.textContent =
      "출석 체크에 실패했습니다: " + error.message;

    return;
  }

  message.textContent = data.message;

  if (data.success || data.already_checked) {
    btn.disabled = true;
    btn.textContent = "오늘 출석 완료";
  } else {
    btn.disabled = false;
    btn.textContent = "출석 체크";
  }

  // common.js의 칩 정보를 다시 불러옵니다.
  await loadMyChips();

  // 우측 상단 칩 표시를 즉시 갱신합니다.
  renderNav();
}

// ---------------------------------------------------------
// 홈 화면 공지사항
// 게시판과 동일한 notices 테이블을 사용합니다.
// ---------------------------------------------------------

async function loadHomeNotices() {
  const section =
    document.getElementById("homeNoticeSection");

  const list =
    document.getElementById("homeNoticeList");

  if (!section || !list) {
    return;
  }

  const { data, error } = await db
    .from("notices")
    .select("id, title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("홈 공지 조회 실패:", error);

    section.hidden = true;
    list.innerHTML = "";

    return;
  }

  if (!data || data.length === 0) {
    section.hidden = true;
    list.innerHTML = "";

    return;
  }

  section.hidden = false;
  list.innerHTML = "";

  data.forEach(function (notice) {
    const item = document.createElement("li");
    const header = document.createElement("div");
    const badge = document.createElement("span");
    const title = document.createElement("strong");
    const content = document.createElement("p");
    const date = document.createElement("time");

    item.className = "notice-item";

    header.className = "notice-item-header";

    badge.className = "notice-badge";
    badge.textContent = "공지";

    title.className = "notice-title";
    title.textContent = notice.title || "공지";

    content.className = "notice-content";
    content.textContent = notice.content;

    date.className = "notice-date";
    date.dateTime = notice.created_at;

    date.textContent =
      new Date(notice.created_at).toLocaleString("ko-KR");

    header.appendChild(badge);
    header.appendChild(title);

    item.appendChild(header);
    item.appendChild(content);
    item.appendChild(date);

    list.appendChild(item);
  });
}