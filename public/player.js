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

function statusLabel(status) {
  return status === "down" ? "沒電" : "正常";
}

function normalizePayloadText(text) {
  return String(text || "")
    .trim()
    .replace(/：/g, ":")
    .replace(/\s+/g, "")
    .toUpperCase();
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
    lobby: "等待主持人開始遊戲",
    running: "遊戲進行中",
    paused: "遊戲暫停",
    ended: "遊戲結束"
  }[status] || "等待主持人開始遊戲";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
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
    rescueCount: player.rescueCount || 0,
    rescuedBy: player.rescuedBy || {}
  };

  currentPlayerCode = normalizedPlayer.code;
  const team = latestData.teams?.[normalizedPlayer.teamId];
  const carry = normalizedPlayer.carrying ? materialLabel(normalizedPlayer.carrying) : "無";
  const status = statusLabel(normalizedPlayer.status);
  renderFloatBadge(normalizedPlayer);

  setText("summaryCode", normalizedPlayer.code || "-");
  setText("summaryNickname", normalizedPlayer.nickname || "-");
  setText("summaryTeam", teamDisplayName(normalizedPlayer.teamId, team));
  setText("summaryStatus", status);
  setText("summaryCarry", carry);
  setText("playerTitle", `${normalizedPlayer.code}｜${normalizedPlayer.nickname || normalizedPlayer.code}`);
  setText("playerSubtitle", `${teamDisplayName(normalizedPlayer.teamId, team)}｜目前攜帶：${carry}`);
  setText("playerStatusBadge", status);
  $("#playerStatusBadge").className = `player-status-badge ${normalizedPlayer.status === "down" ? "badge-down" : "badge-normal"}`;

  $("#playerCard").innerHTML = `
    <div class="player-card-line">
      <strong>${normalizedPlayer.code}</strong>
      <span class="pill ${normalizedPlayer.status === "down" ? "danger-pill" : ""}">${status}</span>
    </div>
    <div class="muted">${normalizedPlayer.nickname || ""} · ${teamDisplayName(normalizedPlayer.teamId, team)}</div>
    <div class="muted">目前攜帶：${carry}</div>
  `;

  if (normalizedPlayer.status === "down") {
    $("#activeActionCard").hidden = true;
    $("#downSection").hidden = false;
    setText("downProgress", `${normalizedPlayer.rescueCount || 0} / 5`);
    setText("downQrText", `RESCUE:${normalizedPlayer.code}`);
    renderRescueQr(normalizedPlayer.code);
  } else {
    $("#activeActionCard").hidden = false;
    $("#downSection").hidden = true;
  }
}

function renderRescueQr(code) {
  const mount = $("#downQr");
  if (!mount) return;

  const rescuePayload = `RESCUE:${code}`;
  mount.innerHTML = `
    <div class="rescue-qr-card">
      <div class="rescue-qr-title">請掃我救援</div>
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

      if (player.status === "down") {
        await stopQrScanner();
        showError(`你沒電了！救援進度：${player.rescueCount || 0} / 5`);
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
      rescueCount: 0,
      rescuedBy: {},
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
    const carry = player.carrying ? materialLabel(player.carrying) : "無";

    returnCandidateCode = code;
    $("#returnConfirm").hidden = false;
    $("#confirmReturnBtn").hidden = false;
    $("#returnConfirm").innerHTML = `
      <div class="return-title">你要回到：</div>
      <strong>${player.code}｜${player.nickname || player.code}</strong>
      <div>${teamDisplayName(player.teamId, team)}</div>
      <div>目前狀態：${statusLabel(player.status)}</div>
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

async function handlePickupMaterial(player, material) {
  if (!MATERIALS.includes(material)) {
    throw new Error("未知材料，請確認 QR 是否正確。");
  }

  let changed = false;
  let reason = "取得材料失敗，請再試一次。";

  const result = await db.ref(`/players/${player.code}`).transaction(current => {
    if (!current) {
      reason = "找不到玩家資料，請重新回到遊戲。";
      return current;
    }
    if (current.status !== "normal") {
      reason = "你沒電了，不能行動。";
      return current;
    }
    if (current.carrying) {
      reason = `你已經帶著 ${materialLabel(current.carrying)}，請先交付。`;
      return current;
    }

    changed = true;
    return { ...current, carrying: material };
  });

  if (!changed || !result.committed) {
    throw new Error(reason);
  }

  return `成功取得：${materialLabel(material)}`;
}

async function handleDeliverWarehouse(player, teamId) {
  const current = await getCurrentPlayer();
  const targetTeamSnap = await db.ref(`/teams/${teamId}`).get();
  const targetTeam = targetTeamSnap.val();

  if (!current) throw new Error("請先加入遊戲或回到遊戲。");
  if (current.status !== "normal") throw new Error("你沒電了，不能行動。");
  if (!current.carrying) throw new Error("你現在沒有攜帶材料。");
  if (!targetTeam) throw new Error("這個倉庫目前沒有開放。");

  const material = current.carrying;
  let cleared = false;
  let reason = "交付失敗，請再試一次。";

  const clearResult = await db.ref(`/players/${player.code}`).transaction(active => {
    if (!active) {
      reason = "找不到玩家資料。";
      return active;
    }
    if (active.status !== "normal") {
      reason = "你沒電了，不能行動。";
      return active;
    }
    if (active.carrying !== material) {
      reason = "你手上的材料已改變，請重新確認。";
      return active;
    }

    cleared = true;
    return { ...active, carrying: null };
  });

  if (!cleared || !clearResult.committed) {
    throw new Error(reason);
  }

  await db.ref(`/teams/${teamId}/inventory/${material}`).transaction(v => (v || 0) + 1);

  if (current.teamId !== teamId) {
    await db.ref(`/teams/${current.teamId}/supportPoints`).transaction(v => (v || 0) + 1);
    await db.ref(`/teams/${current.teamId}/score`).transaction(v => (v || 0) + 1);
  }

  return `已送達：${teamDisplayName(teamId, targetTeam)}倉庫`;
}

async function handleDeliverBoss(player) {
  const current = await getCurrentPlayer();

  if (!current) throw new Error("請先加入遊戲或回到遊戲。");
  if (current.status !== "normal") throw new Error("你沒電了，不能行動。");
  if (!current.carrying) throw new Error("你現在沒有攜帶材料。");

  const bossSnap = await db.ref("/boss").get();
  const boss = bossSnap.val();

  if (!boss || boss.active !== true) {
    throw new Error("目前尚未出現魔王，請等待主持人釋放魔王。");
  }

  const material = current.carrying;
  const needed = Number(boss.required?.[material] || 0);
  const delivered = Number(boss.delivered?.[material] || 0);

  if (needed <= 0 || delivered >= needed) {
    throw new Error("目前魔王不需要這個材料。");
  }

  let hit = false;
  const bossTxn = await db.ref("/boss").transaction(active => {
    if (!active || active.active !== true || Number(active.hp || 0) <= 0) return active;

    const activeNeeded = Number(active.required?.[material] || 0);
    const activeDelivered = Number(active.delivered?.[material] || 0);

    if (activeNeeded <= 0 || activeDelivered >= activeNeeded) return active;

    hit = true;
    return {
      ...active,
      delivered: {
        ...(active.delivered || {}),
        [material]: activeDelivered + 1
      },
      hp: Math.max(0, Number(active.hp || 0) - 1)
    };
  });

  if (!hit || !bossTxn.committed) {
    throw new Error("目前魔王不需要這個材料。");
  }

  await db.ref(`/players/${player.code}`).transaction(active => {
    if (!active || active.status !== "normal") return active;
    if (active.carrying !== material) return active;
    return { ...active, carrying: null };
  });

  await db.ref(`/teams/${current.teamId}/bossContribution`).transaction(v => (v || 0) + 1);
  await db.ref(`/teams/${current.teamId}/score`).transaction(v => (v || 0) + 1);

  return "成功攻擊魔王：血量 -1";
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
  if (latestScanner.status !== "normal") throw new Error("你沒電了，不能救人。");

  const targetSnap = await db.ref(`/players/${normalizedTarget}`).get();
  const target = targetSnap.val();

  if (!target) throw new Error(`找不到 ${normalizedTarget} 這位玩家。`);
  if (target.status !== "down") throw new Error("目標玩家目前不是沒電狀態。");
  if (target.rescuedBy && target.rescuedBy[scannerCode]) throw new Error("你已經救過這位玩家。");

  let rescued = false;
  const rescueTxn = await db.ref(`/players/${normalizedTarget}`).transaction(active => {
    if (!active || active.status !== "down") return active;

    const rescuedBy = active.rescuedBy || {};
    if (rescuedBy[scannerCode]) return active;

    const nextCount = Number(active.rescueCount || 0) + 1;
    const nextRescuedBy = {
      ...rescuedBy,
      [scannerCode]: true
    };

    rescued = true;

    if (nextCount >= 5) {
      return {
        ...active,
        status: "normal",
        rescueCount: 0,
        rescuedBy: {}
      };
    }

    return {
      ...active,
      rescueCount: nextCount,
      rescuedBy: nextRescuedBy
    };
  });

  if (!rescued || !rescueTxn.committed) {
    throw new Error("你已經救過這位玩家。");
  }

  await db.ref(`/teams/${latestScanner.teamId}/score`).transaction(v => (v || 0) + 1);

  const updatedTarget = rescueTxn.snapshot.val();
  const targetName = updatedTarget.nickname || updatedTarget.code || normalizedTarget;

  if (updatedTarget.status === "normal") {
    await db.ref("/game/message").set(`${updatedTarget.code || normalizedTarget} ${targetName} 已恢復行動。`);
    return `${targetName} 已恢復行動`;
  }

  return `救援成功：${updatedTarget.code || normalizedTarget} ${updatedTarget.rescueCount || 0} / 5`;
}

async function handleQrPayload(payloadText) {
  const payload = normalizePayloadText(payloadText);

  console.log("Scanned payload:", payload);
  showResult("掃描成功：" + payload);

  if (!currentPlayerCode) {
    throw new Error("請先加入遊戲或回到遊戲。");
  }

  const player = await getCurrentPlayer();

  if (!player) {
    throw new Error("找不到玩家資料，請重新回到遊戲。");
  }

  if (payload.startsWith("MATERIAL:")) {
    const material = payload.split(":")[1]?.toLowerCase();
    return handlePickupMaterial(player, material);
  }

  if (payload.startsWith("WAREHOUSE:")) {
    const teamId = payload.split(":")[1]?.toLowerCase();
    return handleDeliverWarehouse(player, teamId);
  }

  if (payload === "BOSS:CENTRAL") {
    return handleDeliverBoss(player);
  }

  if (payload.startsWith("RESCUE:")) {
    const targetCode = payload.split(":")[1];
    return handleRescuePlayer(player, targetCode);
  }

  throw new Error("不支援的 QR 內容：" + payload);
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

function getQrBoxSize() {
  const width = Math.min(window.innerWidth || 360, 420);
  const size = Math.max(220, Math.min(300, Math.floor(width * 0.72)));

  return { width: size, height: size };
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

    if (player.status === "down") {
      scannerStarting = false;
      showError("你沒電了，不能行動。");
      return;
    }

    if (typeof Html5Qrcode === "undefined") {
      scannerStarting = false;
      showError("掃描器套件未載入，請改用手動輸入。");
      return;
    }

    console.log("Html5Qrcode 已載入");

    const readerEl = document.getElementById("qr-reader");

    if (!readerEl) {
      scannerStarting = false;
      showError("找不到掃描器容器。");
      return;
    }

    console.log("找到 qr-reader");
    readerEl.innerHTML = "";
    await stopQrScanner();
    showScannerSection();

    scannerInstance = new Html5Qrcode("qr-reader");

    console.log("準備啟動相機");
    await scannerInstance.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: getQrBoxSize()
      },
      async decodedText => {
        if (!canTrigger(`${currentPlayerCode}:scan:${decodedText}`)) return;

        console.log("Scanned payload:", decodedText);
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
    console.log("相機啟動成功");
    showResult("相機已啟動，請對準二維碼。");
  } catch (err) {
    console.error("相機啟動失敗", err);
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
    document.body.classList.toggle("boss-alert", latestData.boss && latestData.boss.active === true);
    refreshJoinOptions(latestData);

    if (!currentPlayerCode) {
      renderPlayerToScreen(null);
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
