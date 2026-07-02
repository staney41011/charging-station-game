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
  if (game.status === "ended") return "請看各組完成度，準備進入收束。";
  if (game.status === "running") return "各組請確認分工，準備開始第一輪活動任務。";
  return "請玩家加入遊戲，一起預備這場活動。";
}

function joinedCount(data) {
  return Object.keys(data.players || {}).length;
}

function renderIgnoranceOverlay(ignorance) {
  if (!ignorance?.active) return "";

  const count = Number(ignorance?.count || 0);
  const target = Number(ignorance?.target || 1);
  const pct = Math.max(0, Math.min(100, Math.round((count / target) * 100)));

  return `
    <div class="ignorance-overlay-card">
      <div class="ignorance-siren" aria-hidden="true"></div>
      <div>
        <p class="eyebrow">全場事件</p>
        <h2>無明來襲</h2>
        <p>請到固定叩求點掃描 QR。各組任務完成度會持續顯示，叩求完成後立刻回到任務。</p>
      </div>
      <div class="ignorance-meter">
        <strong>${count}</strong>
        <span>/ ${target}</span>
        <div class="ignorance-progress"><i style="width:${pct}%"></i></div>
      </div>
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
        <p class="eyebrow">最終大型任務</p>
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

  const taskRows = teams
    .map(([teamId, team]) => {
      const task = data.tasksByTeam?.[teamId];
      const percent = taskPercent(task);

      return {
        teamId,
        team,
        task,
        percent
      };
    })
    .sort((a, b) => b.percent - a.percent || teamNumber(a.teamId) - teamNumber(b.teamId));

  const topTeam = taskRows[0];
  const average = taskRows.length
    ? Math.round(taskRows.reduce((sum, row) => sum + row.percent, 0) / taskRows.length)
    : 0;

  const cards = taskRows.map((row, index) => {
    const complete = row.percent >= 100;

    return `
      <div class="completion-card ${complete ? "complete" : ""} ${index === 0 ? "leading" : ""}">
        <div class="completion-rank">${index + 1}</div>
        <div class="completion-copy">
          <strong>${teamDisplayName(row.teamId, row.team)}</strong>
          <span>${row.task ? row.task.name : "尚未分配任務"}</span>
        </div>
        <div class="completion-percent">${row.percent}%</div>
        <div class="completion-track"><i style="width:${row.percent}%"></i></div>
      </div>
    `;
  }).join("");

  return `
    <div class="completion-hero">
      <div>
        <p class="eyebrow">第 ${game.round || 1} 輪活動任務</p>
        <h2>各組完成度揭示</h2>
        <p>需求明細不公開，投影幕只顯示每組目前推進比例。</p>
      </div>
      <div class="completion-spotlight">
        <span>目前領先</span>
        <strong>${topTeam ? teamDisplayName(topTeam.teamId, topTeam.team) : "-"}</strong>
        <b>${topTeam ? topTeam.percent : 0}%</b>
      </div>
      <div class="completion-average">
        <span>全場平均</span>
        <strong>${average}%</strong>
      </div>
    </div>
    <div class="completion-grid">${cards}</div>
  `;
}

function renderMainPanel(data) {
  const game = data.game || {};

  if (game.phase === "final" || game.phase === "final-complete") return renderFinalPanel(data.finalTask);
  return renderRoundPanel(data);
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
  $("#ignoranceOverlay").hidden = data.global?.ignorance?.active !== true;
  $("#ignoranceOverlay").innerHTML = renderIgnoranceOverlay(data.global?.ignorance);
});
