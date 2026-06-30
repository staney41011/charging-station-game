const db = initFirebase();
const ACTION_COOLDOWN_MS = 1500;
const lastActionAt = new Map();

let scannerInstance = null;
let scannerStarting = false;
let scannerRunning = false;
let currentPlayerCode = "";
let latestData = defaultState();
let returnCandidateCode = "";
let currentPlayerRef = null;

function normalizePayloadText(text) {
  return String(text || "")
    .trim()
    .replace(/：/g, ":")
    .replace(/\s+/g, "");
}

function showResult(text) {
  const el = $("#resultBanner");
  if (!el) return;
  el.textContent = text;
  el.className = "result-banner";
}

function showSuccess(text) {
  const el = $("#resultBanner");
  if (!el) return;
  el.textContent = text;
  el.className = "result-banner result-success";
}

function showError(text) {
  const el = $("#resultBanner");
  if (!el) return;
  el.textContent = text;
  el.className = "result-banner result-danger";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function canTrigger(key) {
  const now = Date.now();
  const last = lastActionAt.get(key) || 0;

  if (now - last < ACTION_COOLDOWN_MS) {
    showError("動作太快了，請等一下再掃。");
    return false;
  }

  lastActionAt.set(key, now);
  return true;
}

function gameStatusText(status) {
  return {
    lobby: "等待活動開始",
    running: "遊戲進行中",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "等待活動開始";
}

function renderFloatBadge(player) {
  const badge = $("#playerFloatBadge");
  if (!badge) return;

  if (!player) {
    badge.hidden = true;
    return;
  }

  badge.hidden = false;
  setText("floatCode", normalizeCode(player.code));
  setText("floatNickname", player.nickname || normalizeCode(player.code));
}

function taskProgressLine(task) {
  if (!task) return "目前尚未分配任務";
  return `${task.name}｜${taskPercent(task)}%`;
}

function proficiencyLine(player) {
  const profile = normalizedProficiency(player?.proficiency);
  const top = WORK_TYPES
    .map(workType => ({ workType, value: Number(profile[workType] || 1) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(item => `${workLabel(item.workType)} ${item.value.toFixed(1)}`)
    .join("、");

  return `${personalBalanceLabel(profile)}｜最高熟練：${top}`;
}

function renderPlayerToScreen(player) {
  if (!player) {
    document.body.classList.remove("player-in-game");
    renderFloatBadge(null);
    currentPlayerCode = "";
    setText("summaryCode", "-");
    setText("summaryNickname", "-");
    setText("summaryTeam", "-");
    setText("summaryStatus", "-");
    setText("summaryCarry", "-");
    setText("playerTitle", "請先加入遊戲");
    setText("playerSubtitle", `${gameStatusText(latestData.game?.status)}，請先完成加入。`);
    setText("playerStatusBadge", "尚未加入");
    $("#playerStatusBadge").className = "player-status-badge";
    $("#playerCard").innerHTML = `<span class="muted">尚未加入玩家</span>`;
    $("#activeActionCard").hidden = false;
    $("#downSection").hidden = true;
    return;
  }

  document.body.classList.add("player-in-game");

  const normalizedPlayer = {
    ...player,
    code: normalizeCode(player.code),
    proficiency: normalizedProficiency(player.proficiency)
  };
  const isNormal = normalizedPlayer.status === "normal";
  const team = latestData.teams?.[normalizedPlayer.teamId];
  const task = latestData.tasksByTeam?.[normalizedPlayer.teamId];
  const carry = normalizedPlayer.carrying ? workLabel(normalizedPlayer.carrying) : "無";
  const status = playerStatusLabel(normalizedPlayer);

  currentPlayerCode = normalizedPlayer.code;
  renderFloatBadge(normalizedPlayer);

  setText("summaryCode", normalizedPlayer.code || "-");
  setText("summaryNickname", normalizedPlayer.nickname || "-");
  setText("summaryTeam", teamDisplayName(normalizedPlayer.teamId, team));
  setText("summaryStatus", status);
  setText("summaryCarry", carry);
  setText("playerTitle", `${normalizedPlayer.code}｜${normalizedPlayer.nickname || normalizedPlayer.code}`);
  setText("playerSubtitle", `${teamDisplayName(normalizedPlayer.teamId, team)}｜${taskProgressLine(task)}`);
  setText("playerStatusBadge", status);
  $("#playerStatusBadge").className = `player-status-badge ${isNormal ? "badge-normal" : "badge-down"}`;

  $("#playerCard").innerHTML = `
    <div class="player-card-line">
      <strong>${normalizedPlayer.code}</strong>
      <span class="pill ${isNormal ? "ok-pill" : "danger-pill"}">${status}</span>
    </div>
    <div class="muted">${normalizedPlayer.nickname || ""} · ${teamDisplayName(normalizedPlayer.teamId, team)}</div>
    <div class="muted">目前任務：${taskProgressLine(task)}</div>
    <div class="muted">目前攜帶：${carry}</div>
    <div class="muted">${proficiencyLine(normalizedPlayer)}</div>
    <div class="muted">${team?.canSupport ? "本組任務已完成，可以支援其他組。" : "本組任務完成前，請先交付自己的任務。"}</div>
  `;

  if (!isNormal) {
    const negative = normalizedPlayer.negativeStatus || {};
    const needed = Number(negative.needed || 5);
    const count = Number(negative.count || 0);

    $("#activeActionCard").hidden = true;
    $("#downSection").hidden = false;
    setText("downTitle", status);
    setText("downProgress", `${count} / ${needed}`);
    setText("downNote", `請讓 ${needed} 位不同玩家掃你的救援 QR，你才會恢復行動。`);
    setText("downQrText", `RESCUE:${normalizedPlayer.code}`);
    renderRescueQr(normalizedPlayer.code, status);
  } else {
    $("#activeActionCard").hidden = false;
    $("#downSection").hidden = true;
  }
}

function renderRescueQr(code, title) {
  const mount = $("#downQr");
  if (!mount) return;

  const rescuePayload = `RESCUE:${code}`;
  mount.innerHTML = `
    <div class="rescue-qr-card">
      <div class="rescue-qr-title">請協助我：${title || "需要協助"}</div>
      <div class="rescue-qr-mount"></div>
      <div class="rescue-qr-code">${rescuePayload}</div>
    </div>
  `;

  const qrMount = $(".rescue-qr-mount", mount);

  try {
    const QrCtor = window.QRCode || QRCode;
    new QrCtor(qrMount, {
      text: rescuePayload,
      width: 320,
      height: 320,
      correctLevel: QrCtor.CorrectLevel?.H ?? 2
    });
  } catch (err) {
    qrMount.innerHTML = `<div class="qr-fallback">二維碼產生失敗<br><strong>${rescuePayload}</strong></div>`;
  }
}

function watchCurrentPlayer(code) {
  const normalized = normalizeCode(code);

  if (!normalized) return;

  if (currentPlayerRef) {
    currentPlayerRef.off();
    currentPlayerRef = null;
  }

  currentPlayerCode = normalized;
  currentPlayerRef = db.ref(`/players/${normalized}`);

  currentPlayerRef.on(
    "value",
    async snap => {
      const player = snap.val();

      if (!player) {
        await stopQrScanner();
        renderPlayerToScreen(null);
        showError("玩家資料不存在，請重新加入或請主持人協助。");
        return;
      }

      renderPlayerToScreen(player);

      if (player.status !== "normal") {
        await stopQrScanner();
      }
    },
    err => {
      showError("玩家狀態讀取失敗：" + (err && err.message ? err.message : String(err)));
    }
  );
}

async function getCurrentPlayer() {
  if (!currentPlayerCode) return null;
  const snap = await db.ref(`/players/${currentPlayerCode}`).get();
  return snap.val();
}

async function renderPlayer(code) {
  const normalized = normalizeCode(code || currentPlayerCode);

  if (!normalized) {
    renderPlayerToScreen(null);
    return;
  }

  const snap = await db.ref(`/players/${normalized}`).get();
  renderPlayerToScreen(snap.val());
}

function renderTeamOptions(data) {
  const teamSelect = $("#team");
  if (!teamSelect) return;

  const current = teamSelect.value;
  const teams = sortedTeamEntries(data.teams);

  teamSelect.innerHTML = "";

  if (!teams.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "請先請主持人建立遊戲";
    option.disabled = true;
    teamSelect.appendChild(option);
    return;
  }

  teams.forEach(([teamId, team]) => {
    const option = document.createElement("option");
    option.value = teamId;
    option.textContent = `${teamDisplayName(teamId, team)} (${team.letter || teamLetter(teamId)})`;
    teamSelect.appendChild(option);
  });

  if (current && data.teams?.[current]) {
    teamSelect.value = current;
  }
}

function buildCodeOptions(data) {
  latestData = data;

  const teamId = $("#team").value;
  const select = $("#code");
  select.innerHTML = "";

  if (!teamId || !data.teams?.[teamId]) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "尚未建立可加入的組別";
    option.disabled = true;
    select.appendChild(option);
    setText("joinPreview", "請先請主持人建立遊戲與組別。");
    return;
  }

  const team = data.teams[teamId];
  const capacity = Number(team.capacity || 0);
  const players = Object.values(data.players || {}).filter(p => p.teamId === teamId);
  const used = new Map(players.map(p => [normalizeCode(p.code), p]));
  const letter = team.letter || teamLetter(teamId);

  for (let i = 1; i <= capacity; i++) {
    const code = `${letter}${String(i).padStart(2, "0")}`;
    const player = used.get(code);
    const option = document.createElement("option");

    option.value = code;
    option.textContent = player ? `${code}（已使用：${player.nickname || code}）` : `${code}（空位）`;
    option.disabled = !!player;
    select.appendChild(option);
  }

  const firstEnabled = Array.from(select.options).find(opt => !opt.disabled);

  if (firstEnabled) {
    select.value = firstEnabled.value;
    setText("joinPreview", `準備加入：${firstEnabled.value}`);
  } else {
    setText("joinPreview", `${teamDisplayName(teamId, team)} 目前沒有空位。`);
  }
}

function refreshJoinOptions(data) {
  renderTeamOptions(data);
  buildCodeOptions(data);
}

async function refreshCodeDropdown() {
  const snap = await db.ref("/").get();
  refreshJoinOptions(snap.val() || defaultState());
}

async function joinGame() {
  try {
    const code = normalizeCode($("#code").value);
    const teamId = $("#team").value;
    const nickname = $("#nickname").value.trim() || code;

    if (!teamId || !latestData.teams?.[teamId]) {
      showError("請先等待主持人建立遊戲與組別。");
      return;
    }

    if (!code) {
      showError("請選擇玩家代碼。");
      return;
    }

    const player = {
      code,
      nickname,
      teamId,
      number: Number(code.slice(1)) || 1,
      status: "normal",
      carrying: null,
      proficiency: makeInitialProficiency(),
      joinedAt: Date.now()
    };

    let created = false;
    const result = await db.ref(`/players/${code}`).transaction(current => {
      if (current) return current;
      created = true;
      return player;
    });

    if (!created || !result.committed) {
      showError("這個玩家代碼已被使用，請重新選擇。");
      await refreshCodeDropdown();
      return;
    }

    renderPlayerToScreen(player);
    watchCurrentPlayer(code);
    showSuccess(`加入成功：${code}｜${nickname}`);
    await refreshCodeDropdown();
  } catch (err) {
    showError("加入失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function lookupReturnPlayer() {
  try {
    const code = normalizeCode($("#returnCode").value);

    returnCandidateCode = "";
    $("#confirmReturnBtn").hidden = true;
    $("#returnConfirm").hidden = true;

    if (!code) {
      showError("請輸入玩家代號，例如 A01。");
      return;
    }

    const snap = await db.ref(`/players/${code}`).get();
    const player = snap.val();

    if (!player) {
      showError("找不到這個玩家代號，請確認是否已加入遊戲。");
      return;
    }

    const team = latestData.teams?.[player.teamId];
    const carry = player.carrying ? workLabel(player.carrying) : "無";

    returnCandidateCode = code;
    $("#returnConfirm").hidden = false;
    $("#confirmReturnBtn").hidden = false;
    $("#returnConfirm").innerHTML = `
      <div class="return-title">你要回到：</div>
      <strong>${player.code}｜${player.nickname || player.code}</strong>
      <div>${teamDisplayName(player.teamId, team)}</div>
      <div>目前狀態：${playerStatusLabel(player)}</div>
      <div>目前攜帶：${carry}</div>
    `;

    showResult(`已找到玩家：${code}，請確認後回到遊戲。`);
  } catch (err) {
    showError("查詢失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function confirmReturnGame() {
  try {
    if (!returnCandidateCode) {
      await lookupReturnPlayer();
      return;
    }

    const snap = await db.ref(`/players/${returnCandidateCode}`).get();
    const player = snap.val();

    if (!player) {
      showError("找不到這個玩家代號，請重新查詢。");
      return;
    }

    renderPlayerToScreen(player);
    watchCurrentPlayer(player.code);
    showSuccess(`已回到遊戲：${player.code}｜${player.nickname || player.code}`);
  } catch (err) {
    showError("回到遊戲失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function handlePickupWork(player, workType) {
  if (!WORK_TYPES.includes(workType)) {
    throw new Error("未知工作小組，請確認 QR 是否正確。");
  }

  let changed = false;
  let reason = "取得工作記錄失敗，請再試一次。";

  const result = await db.ref(`/players/${player.code}`).transaction(current => {
    if (!current) {
      reason = "找不到玩家資料，請重新回到遊戲。";
      return current;
    }
    if (current.status !== "normal") {
      reason = "你目前需要協助，不能行動。";
      return current;
    }
    if (current.carrying) {
      reason = `你已經帶著 ${workLabel(current.carrying)} 工作記錄，請先交付。`;
      return current;
    }

    changed = true;
    return { ...current, carrying: workType };
  });

  if (!changed || !result.committed) {
    throw new Error(reason);
  }

  return `成功取得：${workLabel(workType)}工作記錄`;
}

async function consumeWorkRecord(playerCode, workType) {
  let consumed = false;
  let reason = "交付失敗，請再試一次。";
  let contribution = 1;
  let before = 1;
  let multiplier = 1;

  const result = await db.ref(`/players/${playerCode}`).transaction(current => {
    if (!current) {
      reason = "找不到玩家資料，請重新回到遊戲。";
      return current;
    }
    if (current.status !== "normal") {
      reason = "你目前需要協助，不能行動。";
      return current;
    }
    if (current.carrying !== workType) {
      reason = "你手上的工作記錄已改變，請重新確認。";
      return current;
    }

    const profile = normalizedProficiency(current.proficiency);
    before = Number(profile[workType] || 1);
    multiplier = personalBalanceMultiplier(profile);
    contribution = Number((before * multiplier).toFixed(2));
    profile[workType] = Number(Math.min(MAX_PROFICIENCY, before + PROFICIENCY_STEP).toFixed(1));
    consumed = true;

    return {
      ...current,
      carrying: null,
      proficiency: profile
    };
  });

  if (!consumed || !result.committed) {
    throw new Error(reason);
  }

  return { contribution, before, multiplier };
}

async function addContributionToTask(taskPath, workType, contribution) {
  let completedNow = false;
  let accepted = false;

  const result = await db.ref(taskPath).transaction(task => {
    if (!task || task.active !== true || task.completed === true) return task;
    if (!Number(task.required?.[workType] || 0)) return task;

    const required = task.required || {};
    const progress = { ...(task.progress || {}) };
    progress[workType] = Number((Number(progress[workType] || 0) + contribution).toFixed(2));

    const nextTask = {
      ...task,
      progress,
      updatedAt: Date.now()
    };

    accepted = true;

    if (isTaskComplete(nextTask)) {
      completedNow = true;
      nextTask.completed = true;
      nextTask.completedAt = Date.now();
    }

    return nextTask;
  });

  if (!accepted || !result.committed) {
    throw new Error("這個任務目前不需要這項工作，或任務已完成。");
  }

  return {
    task: result.snapshot.val(),
    completedNow
  };
}

async function handleDeliverTeam(player, teamId) {
  const current = await getCurrentPlayer();
  const targetTeamSnap = await db.ref(`/teams/${teamId}`).get();
  const targetTeam = targetTeamSnap.val();

  if (!current) throw new Error("請先加入遊戲或回到遊戲。");
  if (current.status !== "normal") throw new Error("你目前需要協助，不能行動。");
  if (!current.carrying) throw new Error("你現在沒有攜帶工作記錄。");
  if (!targetTeam) throw new Error("這個任務交付處目前沒有開放。");

  const ownTeamSnap = await db.ref(`/teams/${current.teamId}`).get();
  const ownTeam = ownTeamSnap.val();
  const isOwnTeam = current.teamId === teamId;

  if (!isOwnTeam && ownTeam?.canSupport !== true) {
    throw new Error("本組任務完成後，才可以支援別組任務。");
  }

  const taskSnap = await db.ref(`/tasksByTeam/${teamId}`).get();
  const task = taskSnap.val();

  if (!task || task.active !== true) {
    throw new Error("這一組目前沒有可交付的活動任務。");
  }

  if (task.completed === true) {
    throw new Error("這一組任務已完成，請改支援其他尚未完成的組別。");
  }

  const workType = current.carrying;
  const contributionInfo = await consumeWorkRecord(current.code, workType);
  const taskResult = await addContributionToTask(`/tasksByTeam/${teamId}`, workType, contributionInfo.contribution);

  await db.ref(`/teams/${current.teamId}/score`).transaction(v => Number((Number(v || 0) + contributionInfo.contribution).toFixed(2)));

  if (!isOwnTeam) {
    await db.ref(`/teams/${current.teamId}/supportDeliveries`).transaction(v => Number(v || 0) + 1);
  }

  if (taskResult.completedNow) {
    await db.ref(`/teams/${teamId}`).transaction(team => {
      if (!team) return team;
      return {
        ...team,
        canSupport: true,
        completedTasks: Number(team.completedTasks || 0) + 1,
        score: Number((Number(team.score || 0) + 20).toFixed(2))
      };
    });
    await db.ref("/game/message").set(`${teamDisplayName(teamId, targetTeam)} 完成任務：${task.name}，可以開始支援其他組。`);
    return `任務完成：${teamDisplayName(teamId, targetTeam)} 100%`;
  }

  return `已交付：${teamDisplayName(teamId, targetTeam)}｜${workLabel(workType)} +${contributionInfo.contribution}`;
}

async function handleDeliverFinal(player) {
  const current = await getCurrentPlayer();

  if (!current) throw new Error("請先加入遊戲或回到遊戲。");
  if (current.status !== "normal") throw new Error("你目前需要協助，不能行動。");
  if (!current.carrying) throw new Error("你現在沒有攜帶工作記錄。");

  const finalSnap = await db.ref("/finalTask").get();
  const finalTask = finalSnap.val();

  if (!finalTask || finalTask.active !== true) {
    throw new Error("目前還沒有開放大型任務交付。");
  }

  if (finalTask.completed === true) {
    throw new Error("最終大型活動已完成。");
  }

  const workType = current.carrying;
  const contributionInfo = await consumeWorkRecord(current.code, workType);
  const taskResult = await addContributionToTask("/finalTask", workType, contributionInfo.contribution);

  await db.ref(`/teams/${current.teamId}`).transaction(team => {
    if (!team) return team;
    return {
      ...team,
      finalContribution: Number((Number(team.finalContribution || 0) + contributionInfo.contribution).toFixed(2)),
      score: Number((Number(team.score || 0) + contributionInfo.contribution).toFixed(2))
    };
  });

  if (taskResult.completedNow) {
    await db.ref("/game").update({
      phase: "final-complete",
      message: `${FINAL_TASK_DEF.name} 完成！全場共同完成最後的大型活動。`
    });
    return `最終大型活動完成：100%`;
  }

  return `已交付大型任務：${workLabel(workType)} +${contributionInfo.contribution}`;
}

async function handleKouqiu(player) {
  const current = await getCurrentPlayer();

  if (!current) throw new Error("請先加入遊戲或回到遊戲。");
  if (current.status !== "normal") throw new Error("你目前需要協助，不能行動。");

  let nextCount = 0;
  let target = 0;
  let cleared = false;
  let accepted = false;

  const result = await db.ref("/global/ignorance").transaction(currentIgnorance => {
    if (!currentIgnorance || currentIgnorance.active !== true) return currentIgnorance;

    target = Number(currentIgnorance.target || 0);
    nextCount = Number(currentIgnorance.count || 0) + 1;
    accepted = true;

    if (target > 0 && nextCount >= target) {
      cleared = true;
      return null;
    }

    return {
      ...currentIgnorance,
      count: nextCount,
      updatedAt: Date.now()
    };
  });

  if (!accepted || !result.committed) {
    throw new Error("目前沒有無明來襲需要叩求。");
  }

  if (cleared) {
    await db.ref("/game/message").set("本次無明已通過，請各組回到活動任務。");
    return `叩求完成：本次無明已通過`;
  }

  return `叩求成功：${nextCount} / ${target}`;
}

async function handleRescuePlayer(scannerPlayer, targetCode) {
  const normalizedTarget = normalizeCode(targetCode);
  const scannerCode = normalizeCode(scannerPlayer.code);

  if (!normalizedTarget) throw new Error("救援 QR 內容不完整。");
  if (!scannerCode) throw new Error("請先加入遊戲或回到遊戲。");
  if (scannerCode === normalizedTarget) throw new Error("你不能救自己。");

  const scannerSnap = await db.ref(`/players/${scannerCode}`).get();
  const latestScanner = scannerSnap.val();

  if (!latestScanner) throw new Error("找不到你的玩家資料，請重新回到遊戲。");
  if (latestScanner.status !== "normal") throw new Error("你目前需要協助，不能救人。");

  const targetSnap = await db.ref(`/players/${normalizedTarget}`).get();
  const target = targetSnap.val();

  if (!target) throw new Error(`找不到 ${normalizedTarget} 這位玩家。`);
  if (!target.status || target.status === "normal") throw new Error("目標玩家目前不需要救援。");

  const needed = Number(target.negativeStatus?.needed || 5);
  if (target.negativeStatus?.rescuedBy && target.negativeStatus.rescuedBy[scannerCode]) {
    throw new Error("你已經協助過這位玩家。");
  }

  let rescued = false;
  let restored = false;

  const rescueTxn = await db.ref(`/players/${normalizedTarget}`).transaction(active => {
    if (!active || !active.status || active.status === "normal") return active;

    const negativeStatus = active.negativeStatus || {
      id: active.status,
      label: negativeStatusLabel(active.status),
      needed,
      count: 0,
      rescuedBy: {}
    };
    const rescuedBy = negativeStatus.rescuedBy || {};

    if (rescuedBy[scannerCode]) return active;

    const nextCount = Number(negativeStatus.count || 0) + 1;
    rescued = true;

    if (nextCount >= Number(negativeStatus.needed || needed)) {
      restored = true;
      return {
        ...active,
        status: "normal",
        negativeStatus: null
      };
    }

    return {
      ...active,
      negativeStatus: {
        ...negativeStatus,
        count: nextCount,
        rescuedBy: {
          ...rescuedBy,
          [scannerCode]: true
        }
      }
    };
  });

  if (!rescued || !rescueTxn.committed) {
    throw new Error("你已經協助過這位玩家。");
  }

  await db.ref(`/teams/${latestScanner.teamId}/score`).transaction(v => Number((Number(v || 0) + 1).toFixed(2)));

  const updatedTarget = rescueTxn.snapshot.val();
  const targetName = target.nickname || target.code || normalizedTarget;

  if (restored || updatedTarget.status === "normal") {
    await db.ref("/game/message").set(`${normalizedTarget} ${targetName} 已恢復行動。`);
    return `${targetName} 已恢復行動`;
  }

  const negative = updatedTarget.negativeStatus || {};
  return `協助成功：${normalizedTarget} ${Number(negative.count || 0)} / ${Number(negative.needed || needed)}`;
}

async function handleQrPayload(payloadText) {
  const normalizedPayload = normalizePayloadText(payloadText);
  const payload = parsePayload(normalizedPayload);
  const type = payload.type;
  const value = payload.value;

  console.log("Scanned payload:", normalizedPayload);
  showResult("掃描成功：" + normalizedPayload);

  if (!currentPlayerCode) {
    throw new Error("請先加入遊戲或回到遊戲。");
  }

  const player = await getCurrentPlayer();

  if (!player) {
    throw new Error("找不到玩家資料，請重新回到遊戲。");
  }

  if (type === "WORK") {
    return handlePickupWork(player, value.toLowerCase());
  }

  if (type === "DELIVERY") {
    return handleDeliverTeam(player, value.toLowerCase());
  }

  if (type === "FINAL" && value.toUpperCase() === "MAIN") {
    return handleDeliverFinal(player);
  }

  if (type === "KOUQIU" && value.toUpperCase() === "MAIN") {
    return handleKouqiu(player);
  }

  if (type === "RESCUE") {
    return handleRescuePlayer(player, value);
  }

  throw new Error("不支援的 QR 內容：" + normalizedPayload);
}

function showScannerSection() {
  const section = $("#scannerSection");
  const readerEl = document.getElementById("qr-reader");

  if (section) section.hidden = false;
  if (readerEl) readerEl.style.display = "block";

  setTimeout(() => section?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

async function stopQrScanner() {
  if (!scannerInstance) {
    scannerRunning = false;
    scannerStarting = false;
    return;
  }

  try {
    if (scannerRunning) await scannerInstance.stop();
  } catch (e) {
    console.warn("停止掃描器失敗", e);
  }

  try {
    await scannerInstance.clear();
  } catch (e) {
    console.warn("清空掃描器失敗", e);
  }

  scannerInstance = null;
  scannerRunning = false;
  scannerStarting = false;
}

async function startQrScanner() {
  console.log("已按下掃描按鈕");

  if (scannerStarting) {
    showResult("掃描器正在啟動，請稍候。");
    return;
  }

  if (scannerRunning) {
    showResult("掃描器已開啟，請對準二維碼。");
    return;
  }

  scannerStarting = true;

  try {
    showScannerSection();
    showResult("正在開啟相機，請允許相機權限……");

    if (!currentPlayerCode) {
      scannerStarting = false;
      showError("請先加入遊戲或回到遊戲。");
      return;
    }

    const player = await getCurrentPlayer();

    if (!player) {
      scannerStarting = false;
      showError("找不到玩家資料，請重新回到遊戲。");
      return;
    }

    if (player.status !== "normal") {
      scannerStarting = false;
      showError("你目前需要協助，不能行動。");
      return;
    }

    if (typeof Html5Qrcode === "undefined") {
      scannerStarting = false;
      showError("掃描器套件未載入，請改用手動輸入。");
      return;
    }

    const readerEl = document.getElementById("qr-reader");

    if (!readerEl) {
      scannerStarting = false;
      showError("找不到掃描器容器。");
      return;
    }

    readerEl.style.display = "block";
    readerEl.innerHTML = "";
    await stopQrScanner();
    showScannerSection();

    scannerInstance = new Html5Qrcode("qr-reader");

    await scannerInstance.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      async decodedText => {
        if (!canTrigger(`${currentPlayerCode}:scan:${decodedText}`)) return;

        showResult("掃描成功：" + decodedText);

        await stopQrScanner();

        try {
          const result = await handleQrPayload(decodedText);
          showSuccess(result);
          await renderPlayer(currentPlayerCode);
        } catch (err) {
          showError(err && err.message ? err.message : String(err));
        }
      },
      () => {}
    );

    scannerRunning = true;
    scannerStarting = false;
    showResult("相機已啟動，請對準二維碼。");
  } catch (err) {
    console.error("掃描器啟動失敗", err);
    scannerStarting = false;
    await stopQrScanner();
    showError("掃描器啟動失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function testCameraOnly() {
  try {
    showResult("正在測試相機權限……");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("這個瀏覽器不支援相機權限功能，請使用 Chrome 或 Safari。");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    showSuccess("相機權限測試成功，瀏覽器可以開啟相機。");
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    showError("相機權限測試失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function applyManualPayload() {
  try {
    const payload = $("#payload").value.trim();

    if (!currentPlayerCode) {
      throw new Error("請先加入遊戲或回到遊戲。");
    }

    if (!canTrigger(`${currentPlayerCode}:manual:${payload}`)) return;

    const result = await handleQrPayload(payload);
    showSuccess(result);
    await renderPlayer(currentPlayerCode);
  } catch (err) {
    showError(err && err.message ? err.message : String(err));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  db.ref("/").on("value", snap => {
    latestData = snap.val() || defaultState();
    document.body.classList.toggle("boss-alert", latestData.global?.ignorance?.active === true);
    refreshJoinOptions(latestData);

    if (!currentPlayerCode) {
      renderPlayerToScreen(null);
    } else {
      renderPlayer(currentPlayerCode).catch(err => console.warn("重新渲染玩家失敗", err));
    }
  });

  $("#team").addEventListener("change", () => buildCodeOptions(latestData));
  $("#refreshBtn").addEventListener("click", refreshCodeDropdown);
  $("#joinBtn").addEventListener("click", joinGame);
  $("#lookupReturnBtn").addEventListener("click", lookupReturnPlayer);
  $("#confirmReturnBtn").addEventListener("click", confirmReturnGame);
  $("#scanQrBtn").addEventListener("click", startQrScanner);
  $("#testCameraBtn").addEventListener("click", testCameraOnly);
  $("#applyPayloadBtn").addEventListener("click", applyManualPayload);

  const stopScannerBtn = $("#stopScannerBtn");

  if (stopScannerBtn) {
    stopScannerBtn.addEventListener("click", async () => {
      await stopQrScanner();
      showResult("已停止掃描器。");
    });
  }

  await refreshCodeDropdown();
});
