const db = initFirebase();
const teamSelect = $("#teamSelect");

let latestData = defaultState();

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

function renderMembers(players, teamId) {
  const members = players
    .filter(p => p.teamId === teamId)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  if (!members.length) {
    return `<div class="row"><span class="muted">目前沒有組員。</span></div>`;
  }

  return members.map(p => {
    const carrying = p.carrying ? workLabel(p.carrying) : "空手";
    const isNormal = p.status === "normal";
    const negative = p.negativeStatus || {};
    const rescueText = isNormal ? carrying : `${Number(negative.count || 0)} / ${Number(negative.needed || 5)}`;

    return `
      <div class="member-row ${isNormal ? "" : "is-down"}">
        <div>
          <strong>${p.code}</strong>
          <span>${p.nickname || ""}</span>
        </div>
        <div class="member-state">
          <span class="pill ${isNormal ? "ok-pill" : "danger-pill"}">${playerStatusLabel(p)}</span>
          <span>${rescueText}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderTask(task, team) {
  if (!task || task.active !== true) {
    return `
      <div class="empty-state">
        <strong>目前尚未分配任務</strong>
        <span>等待主持人開始下一輪活動任務。</span>
      </div>
    `;
  }

  const pct = taskPercent(task);
  const canSupport = team.canSupport === true;

  return `
    <div class="order-hero">
      <div>
        <span class="muted">完成度只顯示百分比，需求細節不公開。</span>
        <h3>${task.name}</h3>
      </div>
      <strong>${pct}%</strong>
    </div>
    <div class="progress order-progress"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="notice ${canSupport ? "ok-notice" : ""}">
      ${canSupport ? "本組任務已完成，可以支援其他組。" : "請先完成本組任務，再支援別組。"}
    </div>
  `;
}

function renderFinal(finalTask, team) {
  if (!finalTask || finalTask.active !== true) {
    return `<div class="empty-state"><strong>大型任務尚未開始</strong></div>`;
  }

  return `
    <div class="order-hero">
      <div>
        <span class="muted">全場共同任務</span>
        <h3>${finalTask.name}</h3>
      </div>
      <strong>${taskPercent(finalTask)}%</strong>
    </div>
    <div class="progress order-progress"><div class="progress-bar" style="width:${taskPercent(finalTask)}%"></div></div>
    <div class="notice">本組大型任務貢獻：${Math.round(Number(team.finalContribution || 0))}</div>
  `;
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
    $("#taskBox").innerHTML = `<div class="empty-state"><strong>尚未建立遊戲</strong></div>`;
    $("#memberList").innerHTML = "";
    $("#finalBox").innerHTML = "";
    $("#messageText").textContent = data.game?.message || "等待主持人建立遊戲。";
    return;
  }

  const task = data.tasksByTeam?.[selected];

  $("#teamName").textContent = `${teamDisplayName(selected, team)} 戰情頁`;
  $("#teamStats").innerHTML = `
    <div class="stat stat-score"><span>分數</span><strong>${Math.round(Number(team.score || 0))}</strong></div>
    <div class="stat"><span>任務完成</span><strong>${team.completedTasks || 0}</strong></div>
    <div class="stat"><span>支援次數</span><strong>${team.supportDeliveries || 0}</strong></div>
    <div class="stat"><span>大型貢獻</span><strong>${Math.round(Number(team.finalContribution || 0))}</strong></div>
  `;

  $("#taskBox").innerHTML = renderTask(task, team);
  $("#memberList").innerHTML = renderMembers(players, selected);
  $("#finalBox").innerHTML = renderFinal(data.finalTask, team);
  $("#messageText").textContent = data.game?.message || "等待主持人訊息。";
}

document.addEventListener("DOMContentLoaded", () => {
  db.ref("/").on("value", snap => {
    const data = snap.val() || defaultState();
    document.body.classList.toggle("boss-alert", data.global?.ignorance?.active === true);
    renderTeam(data);
  });

  teamSelect.addEventListener("change", () => renderTeam(latestData));
});
