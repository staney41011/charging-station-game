const db = initFirebase();

let latestData = defaultState();

function log(msg) {
  const logBox = $("#adminLog");
  if (!logBox) return;
  logBox.textContent = `${new Date().toLocaleString()}｜${msg}\n` + logBox.textContent;
}

function readGameSetup() {
  const teamCount = normalizeTeamCount($("#teamCount")?.value);
  const teamSize = normalizeTeamSize($("#teamSize")?.value);

  return {
    teamCount,
    teamSize,
    totalPlayers: teamCount * teamSize
  };
}

function updateTotalPreview() {
  const setup = readGameSetup();
  const preview = $("#totalPlayersPreview");
  if (preview) preview.value = setup.totalPlayers;
}

async function getData() {
  const snap = await db.ref("/").get();
  return snap.val() || defaultState();
}

async function bootstrap() {
  const setup = readGameSetup();

  await db.ref("/").set({
    game: {
      status: "lobby",
      phase: "lobby",
      round: 0,
      maxRounds: 3,
      totalPlayers: setup.totalPlayers,
      teamCount: setup.teamCount,
      teamSize: setup.teamSize,
      startedAt: null,
      roundStartedAt: null,
      roundEndsAt: null,
      message: `已建立 ${setup.teamCount} 組，每組 ${setup.teamSize} 人。請玩家加入，準備開始活動籌備挑戰。`
    },
    teams: makeTeams(setup.teamCount, setup.teamSize),
    players: {},
    tasksByTeam: {},
    finalTask: null,
    global: {
      ignorance: null
    },
    boss: null,
    order: null
  });

  log(`已建立 ${setup.teamCount} 組、每組 ${setup.teamSize} 人，共 ${setup.totalPlayers} 個名額。`);
}

async function startGame() {
  const data = await getData();

  if (!Object.keys(data.teams || {}).length) {
    log("請先建立遊戲與組別。");
    return;
  }

  await db.ref("/game").update({
    status: "running",
    phase: "ready",
    startedAt: Date.now(),
    message: "遊戲開始！請各組先聚焦在自己的活動任務，分工累積工作進度。"
  });

  log("遊戲開始。");
}

async function startRound(roundNumber) {
  const data = await getData();
  const game = data.game || {};
  const teamCount = normalizeTeamCount(game.teamCount || Object.keys(data.teams || {}).length || DEFAULT_TEAM_COUNT);

  if (!Object.keys(data.teams || {}).length) {
    log("請先建立遊戲與組別。");
    return;
  }

  const tasksByTeam = makeRoundTasks(teamCount, roundNumber);
  const teamUpdates = {};

  sortedTeamEntries(data.teams).forEach(([teamId, team]) => {
    const task = tasksByTeam[teamId];
    teamUpdates[`teams/${teamId}`] = {
      ...team,
      score: Number(team.score || 0),
      completedTasks: Number(team.completedTasks || 0),
      supportDeliveries: Number(team.supportDeliveries || 0),
      finalContribution: Number(team.finalContribution || 0),
      canSupport: false,
      currentTaskId: task?.id || null,
      currentTaskName: task?.name || null
    };
  });

  await db.ref("/").update({
    ...teamUpdates,
    tasksByTeam,
    finalTask: null,
    "game/status": "running",
    "game/phase": "round",
    "game/round": roundNumber,
    "game/roundStartedAt": Date.now(),
    "game/roundEndsAt": Date.now() + ROUND_DURATION_MS,
    "game/message": `第 ${roundNumber} 輪開始！各組請完成自己的活動任務，完成後即可支援其他組。`
  });

  log(`第 ${roundNumber} 輪已開始，已隨機分配各組任務。`);
}

async function startFinalTask() {
  const data = await getData();
  const game = data.game || {};
  const teamCount = normalizeTeamCount(game.teamCount || Object.keys(data.teams || {}).length || DEFAULT_TEAM_COUNT);
  const finalTask = makeFinalTask(teamCount);

  await db.ref("/").update({
    finalTask,
    tasksByTeam: data.tasksByTeam || {},
    "game/status": "running",
    "game/phase": "final",
    "game/round": 4,
    "game/roundStartedAt": Date.now(),
    "game/roundEndsAt": Date.now() + FINAL_DURATION_MS,
    "game/message": `${finalTask.name} 開始！全場一起完成最後的大型活動。`
  });

  log(`最終大型活動已開始：${finalTask.name}。`);
}

async function endGame() {
  await db.ref("/game").update({
    status: "ended",
    phase: "ended",
    message: "活動籌備挑戰結束，請看投影幕結算。"
  });
  log("遊戲已結束。");
}

async function triggerIgnorance() {
  const target = randomIgnoranceTarget();

  await db.ref("/global/ignorance").set({
    active: true,
    count: 0,
    target,
    startedAt: Date.now()
  });
  await db.ref("/game/message").set(`無明來襲！全場請到固定地點叩求，累積 ${target} 次後即可通過。`);
  log(`已觸發無明來襲，目標 ${target} 次。`);
}

async function clearIgnorance() {
  await db.ref("/global/ignorance").set(null);
  await db.ref("/game/message").set("本次無明已通過，請各組回到活動任務。");
  log("已清除本次無明。");
}

async function randomNegative() {
  const data = await getData();
  const players = Object.values(data.players || {}).filter(p => p.status === "normal");

  if (!players.length) {
    log("沒有可進入負面狀態的正常玩家。");
    return;
  }

  const picked = players[Math.floor(Math.random() * players.length)];
  const negativeStatus = randomNegativeStatus();

  await db.ref(`/players/${picked.code}`).update({
    status: negativeStatus.id,
    carrying: null,
    negativeStatus
  });

  await db.ref("/game/message").set(`${picked.code} 進入「${negativeStatus.label}」，需要 ${negativeStatus.needed} 位不同玩家協助。`);
  log(`${picked.code} 已進入負面狀態：${negativeStatus.label}，需求 ${negativeStatus.needed} 次救援。`);
}

async function restoreAllNegative() {
  const data = await getData();
  const players = Object.values(data.players || {}).filter(p => p.status && p.status !== "normal");

  for (const p of players) {
    await db.ref(`/players/${p.code}`).update({
      status: "normal",
      negativeStatus: null
    });
  }

  await db.ref("/game/message").set("所有需要協助的玩家已恢復行動。");
  log("已恢復所有負面狀態玩家。");
}

async function clearPlayers() {
  await db.ref("/players").set({});
  log("已清空玩家。");
}

async function clearTeamProgress() {
  const data = await getData();
  const updates = {
    tasksByTeam: {},
    finalTask: null
  };

  sortedTeamEntries(data.teams).forEach(([teamId, team]) => {
    updates[`teams/${teamId}`] = {
      ...team,
      score: 0,
      completedTasks: 0,
      supportDeliveries: 0,
      finalContribution: 0,
      canSupport: false,
      currentTaskId: null,
      currentTaskName: null
    };
  });

  await db.ref("/").update(updates);
  log("已清空各組任務進度與分數。");
}

async function fullReset() {
  await db.ref("/").set(defaultState());
  log("已重置全部資料。");
}

function makeTestPlayer(code, nickname, teamId, number) {
  return {
    code,
    nickname,
    teamId,
    number,
    status: "normal",
    carrying: null,
    proficiency: makeInitialProficiency(),
    joinedAt: Date.now()
  };
}

async function createTestPlayers() {
  const data = await getData();
  const teams = sortedTeamEntries(data.teams);

  if (!teams.length) {
    log("請先建立遊戲與組別。");
    return;
  }

  const updates = {};

  teams.forEach(([teamId, team]) => {
    const letter = team.letter || teamLetter(teamId);
    const count = Math.min(2, Number(team.capacity || 2));

    for (let i = 1; i <= count; i++) {
      const code = `${letter}${String(i).padStart(2, "0")}`;
      updates[`players/${code}`] = makeTestPlayer(code, `${code}測試`, teamId, i);
    }
  });

  await db.ref("/").update(updates);
  log("已為每個開放組別建立最多 2 位測試玩家。");
}

async function giveCarry() {
  const code = normalizeCode($("#targetPlayerCode").value);
  const workType = String($("#carryWork").value || "").trim();

  if (!code || !workType) {
    log("請輸入玩家代號並選擇工作記錄。");
    return;
  }

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) {
    log(`找不到玩家：${code}`);
    return;
  }

  await db.ref(`/players/${code}/carrying`).set(workType);
  log(`已給 ${code} 工作記錄：${workLabel(workType)}`);
}

async function clearCarryForTarget() {
  const code = normalizeCode($("#targetPlayerCode").value);

  if (!code) {
    log("請輸入玩家代號。");
    return;
  }

  await db.ref(`/players/${code}/carrying`).set(null);
  log(`已清空 ${code} 攜帶工作記錄。`);
}

async function setNegativeForTarget() {
  const code = normalizeCode($("#targetPlayerCode").value);

  if (!code) {
    log("請輸入玩家代號。");
    return;
  }

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) {
    log(`找不到玩家：${code}`);
    return;
  }

  const negativeStatus = randomNegativeStatus();

  await db.ref(`/players/${code}`).update({
    status: negativeStatus.id,
    carrying: null,
    negativeStatus
  });

  await db.ref("/game/message").set(`${code} 進入「${negativeStatus.label}」，需要 ${negativeStatus.needed} 位不同玩家協助。`);
  log(`${code} 已進入負面狀態：${negativeStatus.label}。`);
}

async function addScore() {
  const teamId = $("#scoreTeam")?.value;

  if (!teamId) {
    log("請先選擇組別。");
    return;
  }

  await db.ref(`/teams/${teamId}/score`).transaction(v => Number(v || 0) + 10);
  log(`${teamDisplayName(teamId, latestData.teams?.[teamId])} 分數 +10。`);
}

function bind(btnId, fn) {
  const btn = document.getElementById(btnId);

  if (!btn) {
    console.warn(`找不到按鈕：${btnId}`);
    return;
  }

  btn.addEventListener("click", () => {
    fn().catch(err => {
      console.error(err);
      log(err.message || String(err));
    });
  });
}

function initWorkOptions() {
  const carryWork = $("#carryWork");
  if (!carryWork) return;

  carryWork.innerHTML = WORK_TYPES.map(workType => `
    <option value="${workType}">${workLabel(workType)}</option>
  `).join("");
}

function renderScoreTeamOptions(data) {
  const scoreTeamSelect = $("#scoreTeam");
  if (!scoreTeamSelect) return;

  const current = scoreTeamSelect.value;
  const teams = sortedTeamEntries(data.teams);

  scoreTeamSelect.innerHTML = teams.map(([id, team]) => `
    <option value="${id}">${teamDisplayName(id, team)} (${team.letter || teamLetter(id)})</option>
  `).join("");

  if (current && data.teams?.[current]) {
    scoreTeamSelect.value = current;
  }
}

function renderGameConfig(data) {
  const game = data.game || {};
  const teamCount = Object.keys(data.teams || {}).length || Number(game.teamCount || 0);
  const teamSize = Number(game.teamSize || 0);
  const summary = $("#gameConfigSummary");
  const roundStatus = $("#roundStatus");
  const ignoranceStatus = $("#ignoranceStatus");
  const ignorance = data.global?.ignorance;

  if (summary) {
    summary.textContent = teamCount
      ? `${teamCount} 組 · 每組 ${teamSize || "-"} 人`
      : "尚未建立";
  }

  if (roundStatus) {
    if (game.phase === "final") roundStatus.textContent = "最終大型活動";
    else if (game.phase === "round") roundStatus.textContent = `第 ${game.round || 0} 輪進行中`;
    else if (game.status === "running") roundStatus.textContent = "遊戲已開始";
    else roundStatus.textContent = "尚未開始";
  }

  if (ignoranceStatus) {
    ignoranceStatus.textContent = ignorance?.active
      ? `${Number(ignorance.count || 0)} / ${Number(ignorance.target || 0)}`
      : "未啟動";
  }
}

function renderPlayers(players, data) {
  const playerList = $("#playerList");
  const countBadge = $("#playerCountBadge");

  if (countBadge) countBadge.textContent = `${players.length} 人`;
  if (!playerList) return;

  if (!players.length) {
    playerList.innerHTML = `<div class="row"><span class="muted">目前沒有玩家。</span></div>`;
    return;
  }

  playerList.innerHTML = players
    .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    .map(p => {
      const carry = p.carrying ? workLabel(p.carrying) : "空手";
      const teamName = teamDisplayName(p.teamId, data.teams?.[p.teamId]);
      const status = playerStatusLabel(p);
      const isNormal = p.status === "normal";

      return `
        <div class="row admin-player-row">
          <span><strong>${p.code}</strong> ${p.nickname || ""} · ${teamName}</span>
          <span class="pill ${isNormal ? "ok-pill" : "danger-pill"}">${status} · ${carry}</span>
        </div>
      `;
    })
    .join("");
}

function renderTaskBoard(data) {
  const taskBoard = $("#taskBoard");
  if (!taskBoard) return;

  const teams = sortedTeamEntries(data.teams);

  if (!teams.length) {
    taskBoard.innerHTML = `<div class="empty-state"><strong>尚未建立組別</strong></div>`;
    return;
  }

  taskBoard.innerHTML = teams.map(([teamId, team]) => {
    const task = data.tasksByTeam?.[teamId];
    const percent = task ? taskPercent(task) : 0;
    const canSupport = team.canSupport === true;

    return `
      <div class="row">
        <span>
          <strong>${teamDisplayName(teamId, team)}</strong>
          ${task ? `｜${task.name}` : "｜尚未分配任務"}
        </span>
        <span class="pill ${canSupport ? "ok-pill" : ""}">${percent}% ${canSupport ? "可支援" : ""}</span>
      </div>
    `;
  }).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initWorkOptions();
  updateTotalPreview();

  $("#teamCount")?.addEventListener("input", updateTotalPreview);
  $("#teamSize")?.addEventListener("input", updateTotalPreview);

  bind("bootstrapBtn", bootstrap);
  bind("gameStartBtn", startGame);
  bind("round1Btn", () => startRound(1));
  bind("round2Btn", () => startRound(2));
  bind("round3Btn", () => startRound(3));
  bind("finalTaskBtn", startFinalTask);
  bind("endGameBtn", endGame);
  bind("triggerIgnoranceBtn", triggerIgnorance);
  bind("clearIgnoranceBtn", clearIgnorance);
  bind("randomNegativeBtn", randomNegative);
  bind("restoreNegativeBtn", restoreAllNegative);
  bind("clearPlayersBtn", clearPlayers);
  bind("clearTeamProgressBtn", clearTeamProgress);
  bind("fullResetBtn", fullReset);
  bind("createTestPlayersBtn", createTestPlayers);
  bind("setCarryBtn", giveCarry);
  bind("clearCarryBtn", clearCarryForTarget);
  bind("setNegativeBtn", setNegativeForTarget);
  bind("addScoreBtn", addScore);

  db.ref("/").on("value", snap => {
    latestData = snap.val() || defaultState();
    renderScoreTeamOptions(latestData);
    renderPlayers(Object.values(latestData.players || {}), latestData);
    renderGameConfig(latestData);
    renderTaskBoard(latestData);
  });
});
