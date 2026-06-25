const db = initFirebase();

function gameStatusText(status, boss) {
  if (status === "running" && (!boss || boss.active !== true)) {
    return "遊戲已開始，等待主持人釋放魔王";
  }

  return {
    lobby: "等待主持人開始遊戲",
    running: "遊戲進行中",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "等待主持人開始遊戲";
}

function renderBoss(boss) {
  if (!boss || boss.active !== true) {
    return `
      <div class="mission-empty">
        <span>目前任務</span>
        <strong>尚未出現魔王</strong>
        <p>請先看店長頁訂單，等主持人釋放魔王後再攻擊中央電塔。</p>
      </div>
    `;
  }

  const hp = Number(boss.hp || 0);
  const maxHp = Number(boss.maxHp || 1);
  const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
  const needs = Object.entries(boss.required || {}).map(([material, need]) => {
    const done = Number(boss.delivered?.[material] || 0);
    return `<span>${materialLabel(material)} ${done}/${need}</span>`;
  }).join("");

  return `
    <div class="mission-label">目前魔王</div>
    <h2>${boss.name || "魔王"}</h2>
    <div class="boss-hp-display">${hp}<small> / ${maxHp}</small></div>
    <div class="progress giant-progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="boss-need-pills">${needs}</div>
  `;
}

function renderOrder(order, teams) {
  if (!order || order.active !== true) {
    return `<div class="order-mini">目前沒有訂單</div>`;
  }

  const teamProgress = sortedTeamEntries(teams)
    .map(([teamId, team]) => {
      const progress = orderTeamProgress(order, team);
      const pct = progress.total > 0 ? Math.round((progress.got / progress.total) * 100) : 0;
      return `<span>${teamDisplayName(teamId, team)} ${pct}%</span>`;
    })
    .join("");

  return `
    <div class="order-mini">
      <strong>${order.name}</strong>
      <small>訂單獎勵 ${order.reward || 0} 分</small>
      <div class="order-team-pills">${teamProgress}</div>
    </div>
  `;
}

function renderMission(data) {
  return `
    ${renderBoss(data.boss)}
    ${renderOrder(data.order, data.teams || {})}
  `;
}

function renderDownPlayers(players) {
  const down = players
    .filter(p => p.status === "down")
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  if (!down.length) {
    return `
      <div class="down-safe">
        <strong>目前沒有人沒電</strong>
        <span>保持奔跑，也記得幫別組補電。</span>
      </div>
    `;
  }

  return `
    <div class="down-count">${down.length}<small> 人沒電</small></div>
    <div class="down-list-projector">
      ${down.map(p => `
        <div class="down-player-item">
          <span>${p.code}｜${p.nickname || "玩家"}</span>
          <strong>${p.rescueCount || 0} / 5</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRanks(data) {
  const rows = sortedTeamEntries(data.teams)
    .map(([id, team]) => ({
      id,
      name: teamDisplayName(id, team),
      letter: team.letter || teamLetter(id),
      score: Number(team.score || 0),
      supportPoints: Number(team.supportPoints || 0),
      bossContribution: Number(team.bossContribution || 0),
      completedOrders: Number(team.completedOrders || 0)
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  if (!rows.length) {
    return `<div class="empty-note">目前尚未建立組別。</div>`;
  }

  return rows.map((team, index) => `
    <div class="team-rank-card ${index === 0 ? "top" : ""}">
      <div class="rank-number">${index + 1}</div>
      <div>
        <div class="team-rank-title">${team.name}</div>
        <div class="team-meta">訂單 ${team.completedOrders}｜支援 ${team.supportPoints}｜魔王 ${team.bossContribution}</div>
      </div>
      <div class="team-score">${team.score}</div>
    </div>
  `).join("");
}

db.ref("/").on("value", snap => {
  const data = snap.val() || defaultState();
  const game = data.game || {};
  const players = Object.values(data.players || {});
  const totalDown = players.filter(p => p.status === "down").length;
  const joined = players.length;
  const totalSlots = Number(game.totalPlayers || 0);

  $("#displayStatus").textContent = gameStatusText(game.status, data.boss);
  $("#displayMessage").textContent = game.message || "等待主持人訊息。";
  $("#displayCounts").textContent = totalSlots ? `${joined} / ${totalSlots} 人加入` : `${joined} 人加入`;
  $("#missionPanel").innerHTML = renderMission(data);
  $("#downPanel").innerHTML = renderDownPlayers(players);
  $("#rankGrid").innerHTML = renderRanks(data);

  if (totalDown > 0) {
    document.body.classList.add("has-down");
  } else {
    document.body.classList.remove("has-down");
  }

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動補訂單失敗", err);
  });
});
