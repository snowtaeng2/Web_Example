// 내 정보 페이지 전용 코드

function onAuthReady() {
  document.getElementById("myEmail").textContent =
    currentUser.email;

  updateNicknameView();
  loadMyPosts();
}

function updateNicknameView() {
  const displayName =
    document.getElementById("myDisplayName");

  const input =
    document.getElementById("myNickname");

  if (displayName) {
    displayName.textContent =
      getCurrentDisplayName();
  }

  if (input) {
    input.value =
      currentNickname || "";
  }
}


async function saveNickname() {
  const input =
    document.getElementById("myNickname");

  const message =
    document.getElementById("nicknameMessage");

  const nickname =
    input.value.trim();

  if (nickname) {
    if (
      nickname.length < 2 ||
      nickname.length > 16
    ) {
      showNicknameMessage(
        "닉네임은 2자 이상 16자 이하로 입력해 주세요.",
        "error"
      );

      return;
    }

    if (!/^[가-힣A-Za-z0-9_]+$/.test(nickname)) {
      showNicknameMessage(
        "닉네임에는 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.",
        "error"
      );

      return;
    }
  }

  const { data, error } = await db.rpc(
    "update_my_nickname",
    {
      p_nickname: nickname || null,
    }
  );

  if (error) {
    console.error("닉네임 변경 실패:", error);

    const errorText = error.message || "";

    if (
      errorText.includes(
        "user_profiles_nickname_unique"
      ) ||
      errorText.includes(
        "이미 사용 중인 닉네임"
      ) ||
      errorText.includes(
        "duplicate key"
      )
    ) {
      showNicknameMessage(
        "이미 사용 중인 닉네임입니다.",
        "error"
      );

      return;
    }

    showNicknameMessage(
      "닉네임 변경 실패: " + errorText,
      "error"
    );

    return;
  }

  currentNickname =
    data.nickname || null;

  updateNicknameView();
  renderNav();

  showNicknameMessage(
    data.message,
    "success"
  );
}


function showNicknameMessage(text, type) {
  const message =
    document.getElementById("nicknameMessage");

  if (!message) {
    return;
  }

  message.textContent = text;
  message.className =
    "nickname-message nickname-message-" + type;
}

async function loadMyPosts() {
  // eq 로 조건을 걸어서 내 글만 가져옵니다.
  const { data, error } = await db
    .from("posts")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("읽기 실패:", error);
    return;
  }

  document.getElementById("myCount").textContent = data.length;

  document.getElementById("myList").innerHTML = data
    .map(function (p) {
      const when = new Date(p.created_at).toLocaleString("ko-KR");
      return (
        "<li>" + p.content +
        '<span class="when">' + when + "</span>" +
        '<button onclick="deletePost(' + p.id + ')">삭제</button></li>'
      );
    })
    .join("");
}

async function deletePost(id) {
  const { error } = await db.from("posts").delete().eq("id", id);

  if (error) {
    console.error("삭제 실패:", error);
    return;
  }
  loadMyPosts();
}
