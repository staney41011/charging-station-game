const db = initFirebase();

function hasActiveBoss(data) {
  const boss = data.boss;
  return boss && boss.active === true && Number(boss.hp || 0) > 0;
}

function gameStatusText(status, bossActive) {
  if (bossActive) return "魔王戰進行中";

  return {
    lobby: "充電站準備中",
    running: "遊戲進行中",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "充電站準備中";
}

function displaySubtitle(data, bossActive) {
  const game = data.game || {};
  const boss = data.boss || {};

  if (bossActive) {
    return `${boss.name || "魔王"} 已鎖定中央電塔，請聽店長指揮進攻！`;
  }

  if (game.status === "running") {
    return "各組正在累積能量，完成任務、互相支援。";
  }

  if (game.status === "ended") {
    return "遊戲結束，請看總分結算。";
  }

  return "請玩家加入遊戲，一起把充電站準備好。";
}

function renderBattlePanel(data, bossActive) {
  const boss = data.boss;

  if (!bossActive) {
    const order = data.order;

    return `
      <div class="battle-idle">
        <p class="eyebrow">充電站補給時間</p>
        <h2>各組蓄能中</h2>
        <p>完成訂單、互相支援、補足庫存，把全場能量一起拉起來。</p>
        <div class="idle-order">
          <span>目前訂單</span>
          <strong>${order && order.active === true ? order.name : "等待下一張訂單"}</strong>
        </div>
      </div>
    `;
  }

  const hp = Number(boss.hp || 0);
  const maxHp = Number(boss.maxHp || 1);
  const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));

  return `
    <div class="boss-battle-card">
      <div class="boss-alert-banner" aria-hidden="true">
        <span>危機警報</span>
        <span>中央電塔遭攻擊</span>
        <span>魔王鎖定</span>
      </div>
      <div class="boss-battle-copy">
        <p class="eyebrow">高壓魔王戰</p>
        <h2>${boss.name || "魔王"}</h2>
        <div class="battle-callout">全場進入警戒狀態，聽店長調度，集中火力進攻！</div>
      </div>
      <div class="boss-core" aria-label="魔王核心">
        <b>剩餘血量</b>
        <span>${hp}</span>
        <small>/ ${maxHp}</small>
      </div>
      <div class="boss-hp-track">
        <div class="boss-hp-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function rankedTeams(data) {
  return sortedTeamEntries(data.teams)
    .map(([id, team]) => ({
      id,
      name: teamDisplayName(id, team),
      score: Number(team.score || 0),
      bossContribution: Number(team.bossContribution || 0),
      completedOrders: Number(team.completedOrders || 0)
    }))
    .sort((a, b) => b.score - a.score || teamNumber(a.id) - teamNumber(b.id));
}

function renderRanks(data) {
  const rows = rankedTeams(data).slice(0, 15);

  if (!rows.length) {
    return `<div class="empty-note">目前尚未建立組別。</div>`;
  }

  const maxScore = Math.max(1, ...rows.map(team => team.score));

  return rows.map((team, index) => {
    const width = Math.max(4, Math.round((team.score / maxScore) * 100));

    return `
      <div class="score-wall-row ${index === 0 ? "top" : ""}">
        <div class="score-rank">${index + 1}</div>
        <div class="score-team">
          <strong>${team.name}</strong>
          <span>訂單 ${team.completedOrders}｜魔王 ${team.bossContribution}</span>
        </div>
        <div class="score-value">${team.score}</div>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
    `;
  }).join("");
}

db.ref("/").on("value", snap => {
  const data = snap.val() || defaultState();
  const game = data.game || {};
  const players = Object.values(data.players || {});
  const joined = players.length;
  const totalSlots = Number(game.totalPlayers || 0);
  const bossActive = hasActiveBoss(data);

  document.body.classList.remove("boss-alert", "display-boss-mode", "display-rest-mode");
  if (bossActive) {
    document.body.classList.add("boss-alert", "display-boss-mode");
  } else {
    document.body.classList.add("display-rest-mode");
  }
  $("#displayStatus").textContent = gameStatusText(game.status, bossActive);
  $("#displayMessage").textContent = displaySubtitle(data, bossActive);
  $("#displayCounts").textContent = totalSlots ? `${joined} / ${totalSlots} 人加入` : `${joined} 人加入`;
  $("#battlePanel").innerHTML = renderBattlePanel(data, bossActive);
  $("#rankGrid").innerHTML = renderRanks(data);

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動補訂單失敗", err);
  });
});
