const db = initFirebase();
const teamSelect = $("#teamSelect");
const helpSelect = $("#helpMaterial");

let latestData = defaultState();
let submittingOrder = false;

function statusLabel(status) {
  return status === "down" ? "沒電" : "正常";
}

function initHelpOptions() {
  helpSelect.innerHTML = MATERIALS.map(material => `
    <option value="${material}">${materialLabel(material)}</option>
  `).join("");
}

function renderTeamOptions(data) {
  const current = teamSelect.value;
  const teams = sortedTeamEntries(data.teams);

  teamSelect.innerHTML = "";

  if (!teams.length) {
    teamSelect.innerHTML = `<option value="">請先請主持人建立遊戲</option>`;
    return;
  }

  teamSelect.innerHTML = teams.map(([id, team]) => `
    <option value="${id}">${teamDisplayName(id, team)} (${team.letter || teamLetter(id)})</option>
  `).join("");

  if (current && data.teams?.[current]) {
    teamSelect.value = current;
  }
}

function renderInventory(team) {
  const inv = team.inventory || {};

  return MATERIALS.map(m => `
    <div class="inventory-tile ${Number(inv[m] || 0) > 0 ? "has-stock" : ""}">
      <span>${materialLabel(m)}</span>
      <strong>${inv[m] || 0}</strong>
    </div>
  `).join("");
}

function renderMembers(players, teamId) {
  const members = players
    .filter(p => p.teamId === teamId)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  if (!members.length) {
    return `<div class="row"><span class="muted">目前沒有組員。</span></div>`;
  }

  return members.map(p => {
    const carrying = p.carrying ? materialLabel(p.carrying) : "空手";
    const isDown = p.status === "down";

    return `
      <div class="member-row ${isDown ? "is-down" : ""}">
        <div>
          <strong>${p.code}</strong>
          <span>${p.nickname || ""}</span>
        </div>
        <div class="member-state">
          <span class="pill ${isDown ? "danger-pill" : "ok-pill"}">${statusLabel(p.status)}</span>
          <span>${isDown ? `${p.rescueCount || 0} / 5` : carrying}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderOrderForTeam(order, team) {
  if (!order || order.active !== true) {
    return `
      <div class="empty-state">
        <strong>目前沒有訂單</strong>
        <span>等待主持人發布下一張訂單。</span>
      </div>
    `;
  }

  const progress = orderTeamProgress(order, team);
  const canComplete = canTeamCompleteOrder(order, team);
  const required = order.required || {};
  const inventory = team.inventory || {};
  const pct = progress.total > 0 ? Math.round((progress.got / progress.total) * 100) : 0;

  const needs = Object.entries(required).map(([material, need]) => {
    const have = Number(inventory[material] || 0);
    const enough = have >= Number(need || 0);

    return `
      <div class="need-row ${enough ? "complete" : ""}">
        <span>${materialLabel(material)}</span>
        <strong>${have} / ${need}</strong>
      </div>
    `;
  }).join("");

  return `
    <div class="order-hero">
      <div>
        <span class="muted">訂單獎勵 ${order.reward || 0} 分</span>
        <h3>${order.name}</h3>
      </div>
      <strong>${progress.got} / ${progress.total}</strong>
    </div>
    <div class="progress order-progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="need-grid">${needs}</div>
    <div class="notice ${canComplete ? "ok-notice" : ""}">
      ${canComplete ? "材料已足夠，可以交付訂單。" : "材料尚未足夠，請派組員收集或發出求援。"}
    </div>
    <button id="submitOrderBtn" class="primary-action" ${canComplete ? "" : "disabled"}>交付訂單</button>
  `;
}

function renderBossNeed(boss) {
  if (!boss || boss.active !== true) {
    return `
      <div class="empty-state">
        <strong>目前尚未出現魔王</strong>
        <span>等主持人開啟魔王後，再把需要材料送到中央電塔。</span>
      </div>
    `;
  }

  return Object.entries(boss.required || {}).map(([material, need]) => {
    const done = Number(boss.delivered?.[material] || 0);
    const pct = Math.max(0, Math.min(100, Math.round((done / Number(need || 1)) * 100)));

    return `
      <div class="boss-need-row">
        <span>${materialLabel(material)}</span>
        <strong>${done} / ${need}</strong>
        <div class="mini-progress"><span style="width:${pct}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderTeam(data) {
  latestData = data;
  renderTeamOptions(data);

  const selected = teamSelect.value;
  const team = data.teams?.[selected];
  const players = Object.values(data.players || {});

  if (!team) {
    $("#teamName").textContent = "請先請主持人建立組別";
    $("#teamStats").innerHTML = "";
    $("#orderBox").innerHTML = `<div class="empty-state"><strong>尚未建立遊戲</strong></div>`;
    $("#memberList").innerHTML = "";
    $("#inventoryList").innerHTML = "";
    $("#bossNeed").innerHTML = "";
    $("#messageText").textContent = data.game?.message || "等待主持人建立遊戲。";
    return;
  }

  $("#teamName").textContent = `${teamDisplayName(selected, team)} 指揮台`;
  $("#teamStats").innerHTML = `
    <div class="stat stat-score"><span>分數</span><strong>${team.score || 0}</strong></div>
    <div class="stat"><span>支援點</span><strong>${team.supportPoints || 0}</strong></div>
    <div class="stat"><span>魔王貢獻</span><strong>${team.bossContribution || 0}</strong></div>
    <div class="stat"><span>完成訂單</span><strong>${team.completedOrders || 0}</strong></div>
  `;

  $("#orderBox").innerHTML = renderOrderForTeam(data.order, team);
  $("#memberList").innerHTML = renderMembers(players, selected);
  $("#inventoryList").innerHTML = renderInventory(team);
  $("#bossNeed").innerHTML = renderBossNeed(data.boss);
  $("#messageText").textContent = data.game?.message || "等待主持人訊息。";

  const submitBtn = $("#submitOrderBtn");

  if (submitBtn) {
    submitBtn.addEventListener("click", () => submitOrder(selected).catch(err => {
      alert(err.message || String(err));
    }));
  }
}

async function submitOrder(teamId) {
  if (submittingOrder) return;
  submittingOrder = true;

  try {
    const dataSnap = await db.ref("/").get();
    const data = dataSnap.val() || defaultState();
    const order = data.order;
    const team = data.teams?.[teamId];

    if (!order || order.active !== true) {
      throw new Error("目前沒有可以交付的訂單。");
    }

    if (!team) {
      throw new Error("找不到本組資料。");
    }

    if (!canTeamCompleteOrder(order, team)) {
      throw new Error("材料尚未足夠，還不能交付訂單。");
    }

    const teamTxn = await db.ref(`/teams/${teamId}`).transaction(currentTeam => {
      if (!currentTeam) return currentTeam;

      const inventory = { ...(currentTeam.inventory || {}) };

      for (const [material, need] of Object.entries(order.required || {})) {
        if (Number(inventory[material] || 0) < Number(need || 0)) {
          return currentTeam;
        }
      }

      for (const [material, need] of Object.entries(order.required || {})) {
        inventory[material] = Number(inventory[material] || 0) - Number(need || 0);
      }

      return {
        ...currentTeam,
        inventory,
        score: Number(currentTeam.score || 0) + Number(order.reward || 0),
        completedOrders: Number(currentTeam.completedOrders || 0) + 1
      };
    });

    if (!teamTxn.committed) {
      throw new Error("交付失敗，請再試一次。");
    }

    const orderClaim = await db.ref("/order").transaction(current => {
      if (!current || current.active !== true) return current;
      if (current.id !== order.id) return current;

      return {
        ...current,
        active: false,
        completedBy: teamId,
        completedAt: Date.now()
      };
    });

    if (!orderClaim.committed) {
      throw new Error("訂單已被其他組完成，請等待下一張訂單。");
    }

    const teamName = teamDisplayName(teamId, data.teams?.[teamId]);

    await db.ref("/game/message").set(`${teamName} 完成訂單：${order.name}，獲得 ${order.reward || 0} 分。`);

    setTimeout(async () => {
      const snap = await db.ref("/").get();
      await ensureRandomOrder(db, snap.val() || defaultState());
    }, 1000);
  } finally {
    submittingOrder = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHelpOptions();

  db.ref("/").on("value", snap => {
    const data = snap.val() || defaultState();
    document.body.classList.toggle("boss-alert", data.boss && data.boss.active === true);
    renderTeam(data);

    ensureRandomOrder(db, data).catch(err => {
      console.warn("自動補訂單失敗", err);
    });
  });

  teamSelect.addEventListener("change", () => renderTeam(latestData));

  $("#requestHelpBtn").addEventListener("click", async () => {
    const selected = teamSelect.value;
    const team = latestData.teams?.[selected];
    const material = helpSelect.value;

    if (!selected || !team) {
      alert("請先選擇組別。");
      return;
    }

    await db.ref("/game/message").set(`${teamDisplayName(selected, team)} 急缺：${materialLabel(material)}`);
  });
});
