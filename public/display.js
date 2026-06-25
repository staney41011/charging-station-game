const db = initFirebase();

function hasActiveBoss(data) {
  const boss = data.boss;
  return boss && boss.active === true && Number(boss.hp || 0) > 0;
}

function gameStatusText(status, bossActive) {
  if (bossActive) return "魔王戰進行中";

  return {
    lobby: "等待主持人開始遊戲",
    running: "遊戲進行中，等待魔王現身",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "等待主持人開始遊戲";
}

function displaySubtitle(data, bossActive) {
  const game = data.game || {};
  const boss = data.boss || {};

  if (bossActive) {
    return `${boss.name || "魔王"} 已鎖定中央電塔，請聽店長指揮進攻！`;
  }

  if (game.status === "running") {
    return "各組累積分數，等待主持人釋放魔王。";
  }

  if (game.status === "ended") {
    return "遊戲結束，請看總分結算。";
  }

  return "請玩家加入遊戲，等待主持人開始。";
}

function renderBattlePanel(data, bossActive) {
  const boss = data.boss;

  if (!bossActive) {
    const order = data.order;

    return `
      <div class="battle-idle">
        <p class="eyebrow">下一波戰役</p>
        <h2>魔王尚未現身</h2>
        <p>現在是蓄能時間，各組請衝分、補庫存、準備下一波魔王戰。</p>
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

  document.body.classList.toggle("boss-alert", bossActive);
  document.body.classList.toggle("display-boss-mode", bossActive);
  $("#displayStatus").textContent = gameStatusText(game.status, bossActive);
  $("#displayMessage").textContent = displaySubtitle(data, bossActive);
  $("#displayCounts").textContent = totalSlots ? `${joined} / ${totalSlots} 人加入` : `${joined} 人加入`;
  $("#battlePanel").innerHTML = renderBattlePanel(data, bossActive);
  $("#rankGrid").innerHTML = renderRanks(data);

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動補訂單失敗", err);
  });
});
