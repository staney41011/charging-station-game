const db = initFirebase();
const teamSelect = $("#teamSelect");
const helpSelect = $("#helpMaterial");

let latestData = defaultState();
let submittingOrder = false;

TEAM_LETTERS.forEach((letter, i) => {
  const opt = document.createElement("option");
  opt.value = `team${i + 1}`;
  opt.textContent = `第 ${i + 1} 組 (${letter})`;
  teamSelect.appendChild(opt);
});

MATERIALS.forEach(material => {
  const opt = document.createElement("option");
  opt.value = material;
  opt.textContent = materialLabel(material);
  helpSelect.appendChild(opt);
});

function renderInventory(team) {
  const inv = team.inventory || {};

  return MATERIALS.map(m => `
    <div class="row">
      <span>${materialLabel(m)}</span>
      <span class="pill">${inv[m] || 0}</span>
    </div>
  `).join("");
}

function renderMembers(players, teamId) {
  const members = players.filter(p => p.teamId === teamId);

  if (!members.length) {
    return `<div class="row"><span class="muted">目前沒有組員</span></div>`;
  }

  return members.map(p => {
    const carrying = p.carrying ? `攜帶 ${materialLabel(p.carrying)}` : "無攜帶";

    return `
      <div class="row">
        <span><strong>${p.code}</strong> ${p.nickname || ""}</span>
        <span class="pill ${p.status === "down" ? "danger" : ""}">
          ${p.status === "down" ? "沒電" : "正常"} · ${carrying}
        </span>
      </div>
    `;
  }).join("");
}

function renderOrderForTeam(order, team) {
  if (!order || order.active !== true) {
    return `
      <div class="row">
        <span class="muted">目前沒有進行中的訂單</span>
        <span class="pill">等待系統產生</span>
      </div>
      <div class="muted">遊戲開始後，系統會自動亂數出現訂單，不需要主持人手動發單。</div>
    `;
  }

  const progress = orderTeamProgress(order, team);
  const canComplete = canTeamCompleteOrder(order, team);
  const required = order.required || {};
  const inventory = team.inventory || {};

  const needs = Object.entries(required).map(([material, need]) => {
    const have = Number(inventory[material] || 0);
    const enough = have >= Number(need || 0);

    return `
      <div class="row">
        <span>${materialLabel(material)}</span>
        <span class="pill ${enough ? "" : "danger"}">${have} / ${need}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="stat stat-hero">
      <div class="muted">亂數訂單</div>
      <div class="display-title">${order.name}</div>
      <div class="big-line">完成獎勵：${order.reward || 0} 分</div>
      <div class="muted">本組進度：${progress.got} / ${progress.total}</div>
    </div>

    <div class="list" style="margin-top:12px;">
      ${needs}
    </div>

    <div class="notice ${canComplete ? "ok" : ""}" style="margin-top:12px;">
      ${canComplete ? "材料已足夠，可以交付訂單。" : "材料尚未足夠，請派組員去收集材料。"}
    </div>

    <div class="toolbar" style="margin-top:12px;">
      <button id="submitOrderBtn" ${canComplete ? "" : "disabled"}>交付訂單</button>
    </div>
  `;
}

function renderTeam(data) {
  latestData = data;

  const selected = teamSelect.value || "team1";
  const team = data.teams?.[selected] || {};
  const players = Object.values(data.players || {});
  const boss = data.boss;
  const hasBoss = boss && boss.active === true;
  const required = boss?.required || {};
  const delivered = boss?.delivered || {};

  const needs = hasBoss
    ? Object.keys(required).map(m => `${materialLabel(m)} ${delivered[m] || 0}/${required[m]}`).join("｜")
    : "目前尚未出現魔王";

  $("#teamName").textContent = team.name || `第 ${selected.slice(-1)} 組`;

  $("#teamStats").innerHTML = `
    <div class="stat"><div class="muted">分數</div><div class="value">${team.score || 0}</div></div>
    <div class="stat"><div class="muted">支援點</div><div class="value">${team.supportPoints || 0}</div></div>
    <div class="stat"><div class="muted">魔王貢獻</div><div class="value">${team.bossContribution || 0}</div></div>
    <div class="stat"><div class="muted">完成訂單</div><div class="value">${team.completedOrders || 0}</div></div>
  `;

  $("#orderBox").innerHTML = renderOrderForTeam(data.order, team);
  $("#memberList").innerHTML = renderMembers(players, selected);
  $("#inventoryList").innerHTML = renderInventory(team);
  $("#bossNeed").textContent = needs;
  $("#messageText").textContent = data.game?.message || "等待主持人開始遊戲";

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
      throw new Error("目前沒有可以交付的訂單");
    }

    if (!team) {
      throw new Error("找不到本組資料");
    }

    if (!canTeamCompleteOrder(order, team)) {
      throw new Error("材料不足，尚不能交付訂單");
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
      throw new Error("交付失敗，請再試一次");
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
      throw new Error("訂單已被其他組完成，請等待下一張訂單");
    }

    const teamName = data.teams?.[teamId]?.name || `第 ${teamId.slice(-1)} 組`;

    await db.ref("/game/message").set(`${teamName} 完成訂單：${order.name}，獲得 ${order.reward || 0} 分`);

    setTimeout(async () => {
      const snap = await db.ref("/").get();
      await ensureRandomOrder(db, snap.val() || defaultState());
    }, 1000);
  } finally {
    submittingOrder = false;
  }
}

db.ref("/").on("value", snap => {
  const data = snap.val() || defaultState();
  renderTeam(data);

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動產生訂單失敗", err);
  });
});

teamSelect.addEventListener("change", async () => {
  const snap = await db.ref("/").get();
  renderTeam(snap.val() || defaultState());
});

$("#requestHelpBtn").addEventListener("click", async () => {
  const selected = teamSelect.value || "team1";
  const material = helpSelect.value;

  await db.ref("/game/message").set(`第 ${selected.slice(-1)} 組急缺：${materialLabel(material)}`);
});