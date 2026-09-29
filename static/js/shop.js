let shopItems = [];
let ownedItemIds = new Set();
let equippedStyles = {};
let currentShopCategory = "all";


async function onAuthReady() {
  updateShopBalance();
  setupShopFilters();

  await loadOwnedItems();
  await loadEquippedStyles();
  await loadShopItems();
}


function updateShopBalance() {
  const balance = document.getElementById("shopBalance");

  if (!balance) return;

  balance.textContent =
    "보유 칩: " +
    Number(currentChips || 0).toLocaleString("ko-KR") +
    "칩";
}


async function loadShopItems() {
  const list = document.getElementById("shopList");

  const { data, error } = await db
    .from("shop_items")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("상점 조회 실패:", error);
    list.innerHTML = "<p>상점 상품을 불러오지 못했습니다.</p>";
    return;
  }

  shopItems = data || [];
  renderShopItems();
}


async function loadOwnedItems() {
  const { data, error } = await db
    .from("user_shop_items")
    .select("item_id")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("보유 상품 조회 실패:", error);
    return;
  }

  ownedItemIds = new Set(
    (data || []).map(function (row) {
      return row.item_id;
    })
  );
}


async function loadEquippedStyles() {
  const { data, error } = await db
    .from("user_equipped_styles")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("장착 상품 조회 실패:", error);
    return;
  }

  equippedStyles = data || {};

  updateShopPreview();
}


function renderShopItems() {
  const list = document.getElementById("shopList");

  const filtered = shopItems.filter(function (item) {
    return (
      currentShopCategory === "all" ||
      item.category === currentShopCategory
    );
  });

  list.innerHTML = "";

  filtered.forEach(function (item) {
    const article = document.createElement("article");
    const owned = ownedItemIds.has(item.item_id);
    const equipped = isShopItemEquipped(item);

    article.className =
      "shop-item-card rarity-" + item.rarity;

    article.innerHTML =
      '<div class="shop-item-top">' +
        '<span class="shop-rarity">' +
          getRarityName(item.rarity) +
        "</span>" +
        "<strong>" +
          escapeShopHTML(item.item_name) +
        "</strong>" +
      "</div>" +

      '<div class="shop-item-preview ' +
        item.item_id +
      '">' +
        getCategoryPreview(item.category) +
      "</div>" +

      "<p>" +
        escapeShopHTML(item.description) +
      "</p>" +

      '<strong class="shop-price">🪙 ' +
        Number(item.price).toLocaleString("ko-KR") +
        "칩</strong>";

    const button = document.createElement("button");

    if (equipped) {
  button.textContent = "장착 해제";
  button.className = "shop-unequip-button";

  button.onclick = function () {
    unequipShopItem(item);
  };
} else if (owned) {
  button.textContent = "장착하기";

  button.onclick = function () {
    equipShopItem(item.item_id);
  };
} else {
  button.textContent = "구매하기";

  button.onclick = function () {
    purchaseShopItem(item.item_id);
  };
}

    const previewButton = document.createElement("button");
    previewButton.textContent = "미리보기";
    previewButton.className = "shop-preview-button";
    previewButton.onclick = function () {
      previewShopItem(item);
    };

    const actions = document.createElement("div");
    actions.className = "shop-item-actions";
    actions.appendChild(previewButton);
    actions.appendChild(button);

    article.appendChild(actions);
    list.appendChild(article);
  });
}


async function purchaseShopItem(itemId) {
  const item = shopItems.find(function (entry) {
    return entry.item_id === itemId;
  });

  if (!item) return;

  const confirmed = confirm(
    item.item_name +
    "을(를) " +
    Number(item.price).toLocaleString("ko-KR") +
    "칩에 구매할까요?"
  );

  if (!confirmed) return;

  const { data, error } = await db.rpc(
    "purchase_shop_item",
    {
      p_item_id: itemId,
    }
  );

  if (error) {
    showShopMessage(
      "구매 실패: " + error.message,
      "error"
    );
    return;
  }

  if (!data.success) {
    showShopMessage(data.message, "error");
    return;
  }

  currentChips = Number(data.chips) || 0;
  ownedItemIds.add(itemId);

  renderNav();
  updateShopBalance();
  renderShopItems();

  showShopMessage(data.message, "success");
}


async function equipShopItem(itemId) {
  const { data, error } = await db.rpc(
    "equip_shop_item",
    {
      p_item_id: itemId,
    }
  );

  if (error) {
    showShopMessage(
      "장착 실패: " + error.message,
      "error"
    );
    return;
  }

  await loadEquippedStyles();
  renderShopItems();

  showShopMessage(data.message, "success");
}

async function unequipShopItem(item) {
  const confirmed = confirm(
    item.item_name +
    " 장착을 해제할까요?\n\n" +
    "구매한 상품은 사라지지 않으며 언제든 다시 장착할 수 있습니다."
  );

  if (!confirmed) {
    return;
  }

  const { data, error } = await db.rpc(
    "unequip_shop_category",
    {
      p_category: item.category,
    }
  );

  if (error) {
    console.error("장착 해제 실패:", error);

    showShopMessage(
      "장착 해제 실패: " + error.message,
      "error"
    );

    return;
  }

  if (!data || !data.success) {
    showShopMessage(
      data && data.message
        ? data.message
        : "장착을 해제하지 못했습니다.",
      "error"
    );

    return;
  }

  await loadEquippedStyles();
  renderShopItems();

  showShopMessage(
    data.message,
    "success"
  );
}

function isShopItemEquipped(item) {
  if (item.category === "icon_style") {
    return equippedStyles.icon_style === item.item_id;
  }

  if (item.category === "name_color") {
    return equippedStyles.name_color === item.item_id;
  }

  if (item.category === "text_style") {
    return equippedStyles.text_style === item.item_id;
  }

  if (item.category === "border_style") {
    return equippedStyles.border_style === item.item_id;
  }

  if (item.category === "background_style") {
    return equippedStyles.background_style === item.item_id;
  }

  return false;
}


function previewShopItem(item) {
  const preview = document.getElementById("shopPreview");

  preview.className = "shop-post-preview";

  [
    equippedStyles.icon_style,
    equippedStyles.name_color,
    equippedStyles.text_style,
    equippedStyles.border_style,
    equippedStyles.background_style,
  ].forEach(function (styleName) {
    if (styleName) {
      preview.classList.add(styleName);
    }
  });

  preview.classList.add(item.item_id);

  showShopMessage(
    item.item_name + " 미리보기입니다.",
    "normal"
  );
}


function updateShopPreview() {
  const preview = document.getElementById("shopPreview");

  if (!preview) return;

  preview.className = "shop-post-preview";

  [
    equippedStyles.icon_style,
    equippedStyles.name_color,
    equippedStyles.text_style,
    equippedStyles.border_style,
    equippedStyles.background_style,
  ].forEach(function (styleName) {
    if (styleName) {
      preview.classList.add(styleName);
    }
  });
}


function setupShopFilters() {
  document
    .querySelectorAll(".shop-filter")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        currentShopCategory = button.dataset.category;

        document
          .querySelectorAll(".shop-filter")
          .forEach(function (other) {
            other.classList.remove("active");
          });

        button.classList.add("active");
        renderShopItems();
      });
    });
}


function getCategoryPreview(category) {
  if (category === "icon_style") {
    return "<strong>상암랜드 이름</strong>";
  }

  if (category === "name_color") {
    return "<strong>상암랜드 이름</strong>";
  }

  if (category === "text_style") {
    return "<span>꾸며진 게시글입니다.</span>";
  }

  if (category === "border_style") {
    return "<span>테두리 미리보기</span>";
  }

  return "<span>배경 미리보기</span>";
}


function getRarityName(rarity) {
  const names = {
    normal: "일반",
    rare: "희귀",
    epic: "영웅",
    legendary: "전설",
  };

  return names[rarity] || rarity;
}


function showShopMessage(text, type) {
  const message = document.getElementById("shopMessage");

  message.textContent = text;
  message.className =
    "shop-message shop-message-" + type;
}


function escapeShopHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}