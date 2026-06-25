const db = initFirebase();

function teamEntries(data) {
  return Object.entries(data.teams || {}).sort(([a], [b]) => a.localeCompare(b));
}

function renderBoss(data) {
  const boss = data.boss;

  if (!boss || boss.active !== true) {
    return `
      <h2 class="projector-title">目前尚未出現魔王</h2>
      <div class="projector-subtitle">主持人釋放魔王後，這裡會顯示魔王血量。</div>
    `;
  }

  const hp = boss.hp || 0;
  const maxHp = boss.maxHp || 1;
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));

  return `
    <h2 class="projector-title">${boss.name || "魔王"}</h2>
    <div class="projector-subtitle">血量 ${hp} / ${maxHp}</div>
    <div class="progress" style="margin-top:16px;">
      <div class="progress-bar" style="width:${pct}%"></div>
    </div>
    <div class="projector-subtitle">請各組注意主持人口令與中央電塔任務。</div>
  `;
}

function renderOrder(data) {
  const order = data.order;
  const teams = data.teams || {};

  if (!order || order.active !== true) {
    return `
      <h2 class="projector-title">等待新訂單</h2>
      <div class="projector-subtitle">主持人可按「下一張亂數訂單」，或遊戲開始後由系統自動產生。</div>
    `;
  }

  const teamProgress = Object.entries(teams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([teamId, team]) => {
      const progress = orderTeamProgress(order, team);
      const pct = progress.total > 0 ? Math.round((progress.got / progress.total) * 100) : 0;

      return `
        <div class="order-progress-team">
          <strong>${team.name || `第 ${teamId.slice(-1)} 組`}</strong>
          <span>${pct}%</span>
        </div>
      `;
    })
    .join("");

  return `
    <h2 class="projector-title">新訂單進行中</h2>
    <div class="projector-subtitle">
      訂單內容請各組店長查看店長頁，並分派材料任務。
    </div>
    <div class="order-progress-grid">
      ${teamProgress}
    </div>
  `;
}

function renderDownPlayers(players) {
  const down = players.filter(p => p.status === "down");

  if (!down.length) {
    return `<div class="empty-note">目前沒有沒電玩家，所有人都可以行動。</div>`;
  }

  return `
    <div class="down-list-projector">
      ${down.map(p => `
        <div class="down-player-item">
          <span>${p.code}｜${p.nickname || "未命名玩家"}</span>
          <span>${p.rescueCount || 0} / 5</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRanks(data) {
  const rows = teamEntries(data)
    .map(([id, team]) => ({
      id,
      name: team.name || `第 ${id.slice(-1)} 組`,
      score: Number(team.score || 0),
      supportPoints: Number(team.supportPoints || 0),
      bossContribution: Number(team.bossContribution || 0),
      completedOrders: Number(team.completedOrders || 0)
    }))
    .sort((a, b) => b.score - a.score);

  if (!rows.length) {
    return `<div class="empty-note">目前尚未建立組別。</div>`;
  }

  return rows.map((team, index) => `
    <div class="team-rank-card ${index === 0 ? "top" : ""}">
      <div class="team-rank-title">${index + 1}. ${team.name}</div>
      <div class="team-score">${team.score}</div>
      <div class="team-meta">
        訂單 ${team.completedOrders}｜支援 ${team.supportPoints}｜魔王 ${team.bossContribution}
      </div>
    </div>
  `).join("");
}

db.ref("/").on("value", snap => {
  const data = snap.val() || defaultState();
  const game = data.game || {};
  const players = Object.values(data.players || {});
  const totalDown = players.filter(p => p.status === "down").length;

  const phaseText = {
    lobby: "尚未開始",
    running: "遊戲進行中",
    paused: "暫停",
    ended: "已結束"
  }[game.status] || "尚未開始";

  const gameMessage = game.message || "等待主持人開始遊戲";

  $("#displayGrid").innerHTML = `
    <div class="projector-card">
      <div class="projector-label">目前遊戲狀態</div>
      <h2 class="projector-title">${phaseText}</h2>
      <div class="projector-subtitle">${gameMessage}</div>
    </div>

    <div class="projector-card highlight-danger">
      <div class="projector-label">救援狀態</div>
      <h2 class="projector-title">${totalDown} 人沒電</h2>
      <div class="projector-subtitle">正常玩家 ${players.length - totalDown} 人</div>
    </div>
  `;

  $("#orderPanel").innerHTML = renderOrder(data);
  $("#bossPanel").innerHTML = renderBoss(data);
  $("#rankGrid").innerHTML = renderRanks(data);
  $("#downList").innerHTML = renderDownPlayers(players);

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動產生訂單失敗", err);
  });
});