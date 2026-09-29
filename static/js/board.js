// 게시판 페이지 전용 코드

// common.js 가 로그인 확인을 끝낸 뒤 이 함수를 자동으로 불러줍니다.
function onAuthReady() {
  loadNotices();
  loadPosts();
}

async function loadNotices() {
  const section = document.getElementById("noticeSection");
  const list = document.getElementById("noticeList");

  if (!section || !list) {
    return;
  }

  const { data, error } = await db
    .from("notices")
    .select("id, title, content, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("공지 조회 실패:", error);
    section.hidden = true;
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
    date.textContent = new Date(
      notice.created_at
    ).toLocaleString("ko-KR");

    header.appendChild(badge);
    header.appendChild(title);

    item.appendChild(header);
    item.appendChild(content);
    item.appendChild(date);

    list.appendChild(item);
  });
}

async function loadPosts() {
  // 일반 게시글 불러오기
  const { data: posts, error: postsError } = await db
    .from("posts")
   .select(
  "id, user_id, nickname, content, created_at, " +
  "icon_style, name_color_style, text_style, " +
  "border_style, background_style"
)
    .order("created_at", { ascending: false })
    .limit(50);

  if (postsError) {
    console.error("게시글 읽기 실패:", postsError);
    return;
  }

  // 게시글 작성자들의 현재 보유 칩 불러오기
  const { data: chipRows, error: chipsError } =
    await db.rpc("get_post_author_chips");

  if (chipsError) {
    console.error("작성자 칩 조회 실패:", chipsError);
  }

  // user_id를 기준으로 칩을 빠르게 찾기 위한 객체
  const chipsByUserId = {};

  (chipRows || []).forEach(function (row) {
    chipsByUserId[row.user_id] =
      Number(row.chips) || 0;
  });

  const list = document.getElementById("list");
  list.innerHTML = "";

  if (!posts || posts.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "아직 작성된 게시글이 없습니다.";
    list.appendChild(emptyItem);
    return;
  }

  posts.forEach(function (post) {
    const item = document.createElement("li");
const authorLine = document.createElement("div");
const name = document.createElement("strong");
const chipBadge = document.createElement("span");
const content = document.createElement("span");
const time = document.createElement("time");

    authorLine.className = "post-author-line";

    // 상점에서 장착한 게시글 스타일 적용
    const allowedStyles = [
  post.icon_style,
  post.name_color_style,
  post.text_style,
  post.border_style,
  post.background_style,
];

    allowedStyles.forEach(function (styleName) {
      if (
        styleName &&
        /^[a-z0-9_]+$/.test(styleName)
      ) {
        item.classList.add(styleName);
      }
    });

    // 작성자 이름
    name.textContent = post.nickname || "익명";

    // 작성자의 현재 보유 칩
    const authorChips =
      chipsByUserId[post.user_id] || 0;

    chipBadge.className = "post-chip-badge";
    chipBadge.textContent =
      "🪙 " +
      authorChips.toLocaleString("ko-KR") +
      "칩";

      if (post.icon_style) {
  const icon = document.createElement("span");

  icon.className =
    "post-author-icon " + post.icon_style;

  icon.setAttribute("aria-hidden", "true");

  authorLine.appendChild(icon);
}

    authorLine.appendChild(name);
    authorLine.appendChild(chipBadge);

    // 게시글 내용
    content.className = "post-content";
    content.textContent = post.content;

    time.className = "post-created-at";
time.dateTime = post.created_at;
time.textContent = new Date(post.created_at).toLocaleString("ko-KR");

item.appendChild(authorLine);
item.appendChild(content);
item.appendChild(time);

    // 내 글에만 삭제 버튼 표시
    if (
      currentUser &&
      post.user_id === currentUser.id
    ) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = "삭제";

      button.onclick = function () {
        deletePost(post.id);
      };

      item.appendChild(button);
    }

    list.appendChild(item);
  });
}

async function addPost() {
  const box = document.getElementById("content");
  const content = box.value.trim();
  if (!content) return;

  const { error } = await db.from("posts").insert({
    content: content,
    nickname: getCurrentDisplayName(),
  });

  if (error) {
    console.error("쓰기 실패:", error);
    alert("쓰기 실패: " + error.message);
    return;
  }

  box.value = "";
  loadPosts();
}

async function deletePost(id) {
  const { error } = await db.from("posts").delete().eq("id", id);

  if (error) {
    console.error("삭제 실패:", error);
    return;
  }
  loadPosts();
}

// AI 부르기. askAI 함수는 common.js 에 있음
async function polish() {
  const content = document.getElementById("content").value.trim();
  if (!content) return;

  const btn = document.getElementById("aiBtn");
  const box = document.getElementById("aiBox");

  // 응답까지 몇 초 걸리는 것 표시
  btn.disabled = true;
  box.textContent = "생각하는 중...";

  try {
    box.textContent = await askAI(
      "다음 문장을 더 재미있게 다듬어줘. 한 문장으로만 답해줘: " + content
    );
  } catch (e) {
    // Live Server 로 열면 /api/ai 가 없어서 여기로 옴
    box.textContent = "AI 기능은 vercel dev 또는 배포된 주소에서만 동작합니다.";
  } finally {
    btn.disabled = false;
  }
}
