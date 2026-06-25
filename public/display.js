const db = initFirebase();

function hasActiveBoss(data) {
  return data.boss && data.boss.active === true;
}

function gameStatusText(status, boss) {
  if (status === "running" && (!boss || boss.active !== true)) {
    return "遊戲已開始，等待魔王現身";
  }

  return {
    lobby: "等待主持人開始遊戲",
    running: "魔王戰進行中",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "等待主持人開始遊戲";
}

function renderBossNeeds(boss) {
  return Object.entries(boss.required || {}).map(([material, need]) => {
    const done = Number(boss.delivered?.[material] || 0);
    const pct = Math.max(0, Math.min(100, Math.round((done / Number(need || 1)) * 100)));

    return `
      <div class="battle-need-chip">
        <span>${materialLabel(material)}</span>
        <strong>${done}/${need}</strong>
        <i style="width:${pct}%"></i>
      </div>
    `;
  }).join("");
}

function renderBattlePanel(data) {
  const boss = data.boss;

  if (!boss || boss.active !== true) {
    const order = data.order;

    return `
      <div class="battle-idle">
        <p class="eyebrow">Next Battle</p>
        <h2>尚未出現魔王</h2>
        <p>請各組先累積材料與訂單分數，等待主持人釋放魔王。</p>
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
      <div class="boss-battle-copy">
        <p class="eyebrow">Boss Encounter</p>
        <h2>${boss.name || "魔王"}</h2>
        <div class="battle-callout">中央電塔遭到攻擊，請立刻送出需要材料！</div>
      </div>
      <div class="boss-core" aria-label="魔王核心">
        <span>${hp}</span>
        <small>/ ${maxHp}</small>
      </div>
      <div class="boss-hp-track">
        <div class="boss-hp-fill" style="width:${pct}%"></div>
      </div>
      <div class="battle-needs">
        ${renderBossNeeds(boss)}
      </div>
    </div>
  `;
}

function rankedTeams(data) {
  return sortedTeamEntries(data.teams)
    .map(([id, team]) => ({
      id,
      name: teamDisplayName(id, team),
      letter: team.letter || teamLetter(id),
      score: Number(team.score || 0),
      bossContribution: Number(team.bossContribution || 0),
      completedOrders: Number(team.completedOrders || 0)
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function renderRanks(data) {
  const rows = rankedTeams(data);

  if (!rows.length) {
    return `<div class="empty-note">目前尚未建立組別。</div>`;
  }

  const maxScore = Math.max(1, ...rows.map(team => team.score));

  return rows.map((team, index) => {
    const width = Math.max(6, Math.round((team.score / maxScore) * 100));

    return `
      <div class="score-wall-row ${index === 0 ? "top" : ""}">
        <div class="score-rank">${index + 1}</div>
        <div class="score-team">
          <strong>${team.name}</strong>
          <span>訂單 ${team.completedOrders}｜魔王 ${team.bossContribution}</span>
        </div>
        <div class="score-bar"><i style="width:${width}%"></i></div>
        <div class="score-value">${team.score}</div>
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
  const activeBoss = hasActiveBoss(data);

  document.body.classList.toggle("boss-alert", activeBoss);
  document.body.classList.toggle("display-boss-mode", activeBoss);
  $("#displayStatus").textContent = gameStatusText(game.status, data.boss);
  $("#displayMessage").textContent = game.message || "等待主持人訊息。";
  $("#displayCounts").textContent = totalSlots ? `${joined} / ${totalSlots} 人加入` : `${joined} 人加入`;
  $("#battlePanel").innerHTML = renderBattlePanel(data);
  $("#rankGrid").innerHTML = renderRanks(data);

  ensureRandomOrder(db, data).catch(err => {
    console.warn("自動補訂單失敗", err);
  });
});
