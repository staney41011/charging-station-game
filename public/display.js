const db = initFirebase();

function phaseTitle(game, data) {
  const ignorance = data.global?.ignorance;

  if (ignorance?.active) return "無明來襲";
  if (game.status === "ended") return "活動結算";
  if (game.phase === "final" || game.phase === "final-complete") return "最終大型活動";
  if (game.phase === "round") return `第 ${game.round || 1} 輪任務進行中`;
  if (game.status === "running") return "遊戲已開始";
  return "活動準備中";
}

function safeMessage(game, data) {
  const ignorance = data.global?.ignorance;
  if (ignorance?.active) return `全場叩求進度：${Number(ignorance.count || 0)} / ${Number(ignorance.target || 0)}`;
  if (game.phase === "final") return "全場一起完成最後的大型活動。";
  if (game.phase === "round") return "各組先完成自己的任務，完成後即可支援其他組。";
  if (game.status === "ended") return "請看組別比分牆，準備進入收束。";
  if (game.status === "running") return "各組請確認分工，準備開始第一輪活動任務。";
  return "請玩家加入遊戲，一起預備這場活動。";
}

function joinedCount(data) {
  return Object.keys(data.players || {}).length;
}

function renderIgnorancePanel(ignorance) {
  const count = Number(ignorance?.count || 0);
  const target = Number(ignorance?.target || 1);
  const pct = Math.max(0, Math.min(100, Math.round((count / target) * 100)));

  return `
    <div class="boss-battle-card">
      <div class="boss-alert-banner" aria-hidden="true">
        <span>全場事件</span>
        <span>叩求進行中</span>
        <span>保持穩定</span>
      </div>
      <div class="boss-battle-copy">
        <p class="eyebrow">IGNORANCE ALERT</p>
        <h2>無明來襲</h2>
        <div class="battle-callout">請全場輪流到固定地點叩求，累積完成後回到任務。</div>
      </div>
      <div class="boss-core" aria-label="叩求進度">
        <b>叩求進度</b>
        <span>${count}</span>
        <small>/ ${target}</small>
      </div>
      <div class="boss-hp-track"><div class="boss-hp-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function renderFinalPanel(finalTask) {
  if (!finalTask || finalTask.active !== true) {
    return `
      <div class="battle-idle">
        <p class="eyebrow">共同預備</p>
        <h2>各組分工暖身</h2>
        <p>現在是累積能力與默契的時間，準備迎接後面的共同任務。</p>
      </div>
    `;
  }

  const percent = taskPercent(finalTask);
  const got = Math.round(taskProgressTotal(finalTask));
  const total = taskRequiredTotal(finalTask);

  return `
    <div class="boss-battle-card">
      <div class="boss-battle-copy">
        <p class="eyebrow">FINAL MISSION</p>
        <h2>${finalTask.name}</h2>
        <div class="battle-callout">全場共同推進，所有工作記錄都交到大型任務交付處。</div>
      </div>
      <div class="boss-core" aria-label="大型任務完成度">
        <b>完成度</b>
        <span>${percent}</span>
        <small>%</small>
      </div>
      <div class="boss-hp-track"><div class="boss-hp-fill" style="width:${percent}%"></div></div>
      <div class="order-team-pills"><span>${got} / ${total}</span></div>
    </div>
  `;
}

function renderRoundPanel(data) {
  const game = data.game || {};
  const teams = sortedTeamEntries(data.teams);

  if (game.phase !== "round") {
    return `
      <div class="battle-idle">
        <p class="eyebrow">共同預備</p>
        <h2>活動即將展開</h2>
        <p>請各組確認人員、熟悉現場 QR 位置，準備用分工完成任務。</p>
      </div>
    `;
  }

  const taskCards = teams.map(([teamId, team]) => {
    const task = data.tasksByTeam?.[teamId];
    const percent = taskPercent(task);

    return `
      <div class="team-rank-card ${percent >= 100 ? "top" : ""}">
        <div class="rank-number">${teamNumber(teamId)}</div>
        <div>
          <div class="team-rank-title">${teamDisplayName(teamId, team)}</div>
          <div class="team-meta">${task ? task.name : "尚未分配任務"}</div>
        </div>
        <div class="team-score">${percent}%</div>
      </div>
    `;
  }).join("");

  return `
    <div class="mission-empty">
      <span>第 ${game.round || 1} 輪活動任務</span>
      <strong>完成度戰情</strong>
      <p>需求明細由各組自行摸索，投影幕只顯示目前推進比例。</p>
    </div>
    <div class="rank-grid-projector">${taskCards}</div>
  `;
}

function renderMainPanel(data) {
  const game = data.game || {};
  const ignorance = data.global?.ignorance;

  if (ignorance?.active) return renderIgnorancePanel(ignorance);
  if (game.phase === "final" || game.phase === "final-complete") return renderFinalPanel(data.finalTask);
  return renderRoundPanel(data);
}

function rankedTeams(data) {
  return sortedTeamEntries(data.teams)
    .map(([id, team]) => ({
      id,
      name: teamDisplayName(id, team),
      score: Number(team.score || 0),
      completedTasks: Number(team.completedTasks || 0),
      supportDeliveries: Number(team.supportDeliveries || 0),
      finalContribution: Number(team.finalContribution || 0)
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
          <span>完成 ${team.completedTasks}｜支援 ${team.supportDeliveries}｜大型 ${Math.round(team.finalContribution)}</span>
        </div>
        <div class="score-value">${Math.round(team.score)}</div>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
    `;
  }).join("");
}

db.ref("/").on("value", snap => {
  const data = snap.val() || defaultState();
  const game = data.game || {};
  const joined = joinedCount(data);
  const totalSlots = Number(game.totalPlayers || 0);
  const isAlert = data.global?.ignorance?.active === true || game.phase === "final";

  document.body.classList.remove("boss-alert", "display-boss-mode", "display-rest-mode");
  document.body.classList.add(isAlert ? "display-boss-mode" : "display-rest-mode");
  if (data.global?.ignorance?.active === true) document.body.classList.add("boss-alert");

  $("#displayStatus").textContent = phaseTitle(game, data);
  $("#displayMessage").textContent = safeMessage(game, data);
  $("#displayCounts").textContent = totalSlots ? `${joined} / ${totalSlots} 人加入` : `${joined} 人加入`;
  $("#battlePanel").innerHTML = renderMainPanel(data);
  $("#rankGrid").innerHTML = renderRanks(data);
});
