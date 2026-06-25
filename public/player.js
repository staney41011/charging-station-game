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
let currentPlayerPollTimer = null;
let lastRenderedPlayerJson = "";

function materialLabel(m) {
  return {
    wire: "充電線",
    outlet: "插座",
    wifi: "無線網路",
    fast_cable: "快充線",
    power_bank: "行動電源",
    reboot: "重開機",
    reminder: "提醒卡",
    companion: "同行卡",
    support: "陪伴卡"
  }[m] || m || "無";
}

function teamLabel(teamId) {
  if (!teamId) return "-";
  const n = String(teamId).replace("team", "");
  return `第 ${n} 組`;
}

function statusLabel(status) {
  return status === "down" ? "沒電" : "正常";
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
    showError("同一個動作太快了，請稍候再試");
    return false;
  }

  lastActionAt.set(key, now);
  return true;
}

function normalizePayloadText(text) {
  return String(text || "")
    .trim()
    .replace(/：/g, ":")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function renderPlayerToScreen(player) {
  if (!player) {
    currentPlayerCode = "";
    lastRenderedPlayerJson = "";

    $("#summaryCode").textContent = "-";
    $("#summaryNickname").textContent = "-";
    $("#summaryTeam").textContent = "-";
    $("#summaryStatus").textContent = "-";
    $("#summaryCarry").textContent = "-";

    $("#playerTitle").textContent = "請先加入遊戲";
    $("#playerSubtitle").textContent = "等待主持人開始遊戲，請先完成加入。";
    $("#playerStatusBadge").textContent = "尚未加入";
    $("#playerStatusBadge").className = "player-status-badge";

    $("#playerCard").innerHTML = `<span class="muted">尚未加入玩家</span>`;
    $("#activeActionCard").hidden = false;
    $("#downSection").hidden = true;
    return;
  }

  const normalizedPlayer = {
    ...player,
    code: normalizeCode(player.code),
    rescueCount: player.rescueCount || 0,
    rescuedBy: player.rescuedBy || {}
  };

  currentPlayerCode = normalizeCode(normalizedPlayer.code);
  lastRenderedPlayerJson = JSON.stringify(normalizedPlayer);

  $("#summaryCode").textContent = normalizedPlayer.code || "-";
  $("#summaryNickname").textContent = normalizedPlayer.nickname || "-";
  $("#summaryTeam").textContent = teamLabel(normalizedPlayer.teamId);
  $("#summaryStatus").textContent = statusLabel(normalizedPlayer.status);
  $("#summaryCarry").textContent = normalizedPlayer.carrying ? materialLabel(normalizedPlayer.carrying) : "無";

  $("#playerTitle").textContent = `${normalizedPlayer.code}｜${normalizedPlayer.nickname || normalizedPlayer.code}`;
  $("#playerSubtitle").textContent = `${teamLabel(normalizedPlayer.teamId)}｜目前攜帶：${normalizedPlayer.carrying ? materialLabel(normalizedPlayer.carrying) : "無"}`;
  $("#playerStatusBadge").textContent = statusLabel(normalizedPlayer.status);
  $("#playerStatusBadge").className = `player-status-badge ${normalizedPlayer.status === "down" ? "badge-down" : "badge-normal"}`;

  $("#playerCard").innerHTML = `
    <div class="player-card-line">
      <strong>${normalizedPlayer.code}</strong>
      <span class="pill">${statusLabel(normalizedPlayer.status)}</span>
    </div>
    <div class="muted">${normalizedPlayer.nickname || ""} · ${teamLabel(normalizedPlayer.teamId)}</div>
    <div class="muted">目前攜帶：${normalizedPlayer.carrying ? materialLabel(normalizedPlayer.carrying) : "無"}</div>
  `;

  if (normalizedPlayer.status === "down") {
    $("#activeActionCard").hidden = true;
    $("#downSection").hidden = false;
    $("#downProgress").textContent = `${normalizedPlayer.rescueCount || 0} / 5`;
    $("#downQrText").textContent = `RESCUE:${normalizedPlayer.code}`;

    const mount = $("#downQr");
    mount.innerHTML = "";

    const rescuePayload = `RESCUE:${normalizedPlayer.code}`;

    const card = document.createElement("div");
    card.className = "rescue-qr-card";

    const title = document.createElement("div");
    title.className = "rescue-qr-title";
    title.textContent = "請掃描救援我";

    const qrMount = document.createElement("div");

    const codeText = document.createElement("div");
    codeText.className = "rescue-qr-code";
    codeText.textContent = rescuePayload;

    card.appendChild(title);
    card.appendChild(qrMount);
    card.appendChild(codeText);
    mount.appendChild(card);

    try {
      const QrCtor = window.QRCode || QRCode;
      new QrCtor(qrMount, {
        text: rescuePayload,
        width: 320,
        height: 320,
        correctLevel: QrCtor.CorrectLevel.H
      });
    } catch (err) {
      qrMount.innerHTML = `<div class="qr-fallback">系統掃碼內容：<strong>${rescuePayload}</strong></div>`;
    }
  } else {
    $("#activeActionCard").hidden = false;
    $("#downSection").hidden = true;
  }
}

function watchCurrentPlayer(code) {
  const normalized = normalizeCode(code);

  if (!normalized) return;

  if (currentPlayerRef) {
    currentPlayerRef.off();
    currentPlayerRef = null;
  }

  if (currentPlayerPollTimer) {
    clearInterval(currentPlayerPollTimer);
    currentPlayerPollTimer = null;
  }

  currentPlayerCode = normalized;
  currentPlayerRef = db.ref(`/players/${normalized}`);

  currentPlayerRef.on(
    "value",
    async snap => {
      const player = snap.val();

      if (!player) {
        renderPlayerToScreen(null);
        showError("這個玩家資料已不存在，請重新加入或找主持人處理。");
        return;
      }

      const beforeStatus = $("#summaryStatus")?.textContent || "";
      const beforeJson = lastRenderedPlayerJson;

      renderPlayerToScreen(player);

      const afterJson = JSON.stringify({
        ...player,
        code: normalizeCode(player.code),
        rescueCount: player.rescueCount || 0,
        rescuedBy: player.rescuedBy || {}
      });

      if (player.status === "down") {
        await stopQrScanner();

        if (beforeStatus !== "沒電" || beforeJson !== afterJson) {
          showError(`你沒電了！救援進度：${player.rescueCount || 0} / 5`);
        }
      }
    },
    err => {
      showError("玩家狀態同步失敗：" + (err && err.message ? err.message : String(err)));
    }
  );

  currentPlayerPollTimer = setInterval(async () => {
    if (!currentPlayerCode) return;

    try {
      const snap = await db.ref(`/players/${currentPlayerCode}`).get();
      const player = snap.val();

      if (!player) return;

      const nextJson = JSON.stringify({
        ...player,
        code: normalizeCode(player.code),
        rescueCount: player.rescueCount || 0,
        rescuedBy: player.rescuedBy || {}
      });

      if (nextJson !== lastRenderedPlayerJson) {
        renderPlayerToScreen(player);

        if (player.status === "down") {
          showError(`你沒電了！救援進度：${player.rescueCount || 0} / 5`);
        }
      }
    } catch (err) {
      console.warn("玩家狀態輪詢失敗", err);
    }
  }, 1000);
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
  const player = snap.val();

  if (!player) {
    renderPlayerToScreen(null);
    return;
  }

  renderPlayerToScreen(player);
}

function buildTeamOptions() {
  const teamSelect = $("#team");
  teamSelect.innerHTML = "";

  TEAM_LETTERS.forEach((letter, i) => {
    const option = document.createElement("option");
    option.value = `team${i + 1}`;
    option.textContent = `第 ${i + 1} 組 (${letter})`;
    teamSelect.appendChild(option);
  });
}

function buildCodeOptions(data) {
  latestData = data;

  const teamId = $("#team").value || "team1";
  const capacity = Number(data.teams?.[teamId]?.capacity || 0);
  const players = Object.values(data.players || {}).filter(p => p.teamId === teamId);
  const used = new Map(players.map(p => [normalizeCode(p.code), p]));
  const select = $("#code");
  const letter = TEAM_NAMES[teamId] || "A";

  select.innerHTML = "";

  if (capacity <= 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "請先請主持人建立組別";
    option.disabled = true;
    select.appendChild(option);
    $("#joinPreview").textContent = "請先請主持人建立組別";
    return;
  }

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
    $("#joinPreview").textContent = `你要加入：${firstEnabled.value}`;
  } else {
    $("#joinPreview").textContent = "這組目前沒有可用空位";
  }
}

async function refreshCodeDropdown() {
  const snap = await db.ref("/").get();
  buildCodeOptions(snap.val() || defaultState());
}

async function joinGame() {
  try {
    const code = normalizeCode($("#code").value);
    const teamId = $("#team").value;
    const nickname = $("#nickname").value.trim() || code;

    if (!code) {
      showError("請先選擇玩家代碼");
      return;
    }

    if (latestData.players?.[code]) {
      showError("這個代碼已被使用，請選擇空位");
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

    await db.ref(`/players/${code}`).set(player);

    currentPlayerCode = code;
    renderPlayerToScreen(player);
    watchCurrentPlayer(code);
    showSuccess(`已加入遊戲：${code}｜${nickname}`);

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
      showError("請輸入玩家代號，例如 A01");
      return;
    }

    const snap = await db.ref(`/players/${code}`).get();
    const player = snap.val();

    if (!player) {
      showError("找不到這個玩家代號，請確認是否已加入遊戲。");
      return;
    }

    returnCandidateCode = code;
    $("#returnConfirm").hidden = false;
    $("#confirmReturnBtn").hidden = false;

    $("#returnConfirm").innerHTML = `
      <div>你要回到：</div>
      <strong>${player.code}｜${player.nickname || player.code}</strong>
      <div>${teamLabel(player.teamId)}</div>
      <div>目前狀態：${statusLabel(player.status)}</div>
      <div>目前攜帶：${player.carrying ? materialLabel(player.carrying) : "無"}</div>
    `;

    showResult(`已找到玩家：${code}，請按「確認回到遊戲」`);
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
      showError("找不到這個玩家代號，請重新查詢");
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
  const result = await db.ref(`/players/${player.code}`).transaction(current => {
    if (!current || current.status !== "normal") return current;
    if (current.carrying) return current;

    return { ...current, carrying: material };
  });

  if (!result.committed) {
    throw new Error("你已經帶著材料，請先交付");
  }

  return `成功取得：${materialLabel(material)}`;
}

async function handleDeliverWarehouse(player, teamId) {
  const current = await getCurrentPlayer();

  if (!current) throw new Error("請先加入遊戲或回到遊戲");
  if (current.status !== "normal") throw new Error("你沒電了，不能行動");
  if (!current.carrying) throw new Error("你手上沒有材料");

  const material = current.carrying;

  const cleared = await db.ref(`/players/${player.code}`).transaction(active => {
    if (!active || active.status !== "normal") return active;
    if (active.carrying !== material) return active;

    return { ...active, carrying: null };
  });

  if (!cleared.committed) {
    throw new Error("交付失敗，請再試一次");
  }

  await db.ref(`/teams/${teamId}/inventory/${material}`).transaction(v => (v || 0) + 1);

  if (current.teamId !== teamId) {
    await db.ref(`/teams/${current.teamId}/supportPoints`).transaction(v => (v || 0) + 1);
    await db.ref(`/teams/${current.teamId}/score`).transaction(v => (v || 0) + 1);
  }

  return `已送達：第 ${teamId.slice(-1)} 組倉庫`;
}

async function handleDeliverBoss(player) {
  const current = await getCurrentPlayer();

  if (!current) throw new Error("請先加入遊戲或回到遊戲");
  if (current.status !== "normal") throw new Error("你沒電了，不能行動");
  if (!current.carrying) throw new Error("你手上沒有材料");

  const bossSnap = await db.ref("/boss").get();
  const boss = bossSnap.val();

  if (!boss || boss.active !== true) {
    throw new Error("目前尚未出現魔王，請等待主持人釋放魔王");
  }

  const material = current.carrying;

  const bossTxn = await db.ref("/boss").transaction(active => {
    if (!active || active.active !== true || active.hp <= 0) return active;
    if ((active.required?.[material] || 0) <= (active.delivered?.[material] || 0)) return active;

    return {
      ...active,
      delivered: {
        ...(active.delivered || {}),
        [material]: (active.delivered?.[material] || 0) + 1
      },
      hp: Math.max(0, (active.hp || 0) - 1)
    };
  });

  if (!bossTxn.committed) {
    throw new Error("目前魔王不需要這個材料");
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

  if (!normalizedTarget) {
    throw new Error("救援 QR 內容錯誤，找不到目標玩家代號");
  }

  if (!scannerCode) {
    throw new Error("請先加入遊戲或回到遊戲");
  }

  const scannerSnap = await db.ref(`/players/${scannerCode}`).get();
  const latestScanner = scannerSnap.val();

  if (!latestScanner) {
    throw new Error("找不到你的玩家資料，請重新回到遊戲");
  }

  if (latestScanner.status !== "normal") {
    throw new Error("你沒電了，不能救援別人");
  }

  if (scannerCode === normalizedTarget) {
    throw new Error("你不能救自己");
  }

  const targetSnap = await db.ref(`/players/${normalizedTarget}`).get();
  const target = targetSnap.val();

  if (!target) {
    throw new Error(`找不到 ${normalizedTarget} 這位玩家`);
  }

  if (target.status !== "down") {
    throw new Error(`${normalizedTarget} 目前不是沒電狀態`);
  }

  if (target.rescuedBy && target.rescuedBy[scannerCode]) {
    throw new Error(`你已經救過 ${normalizedTarget}，不能重複救援`);
  }

  const rescueTxn = await db.ref(`/players/${normalizedTarget}`).transaction(active => {
    if (!active) return active;
    if (active.status !== "down") return active;

    const rescuedBy = active.rescuedBy || {};

    if (rescuedBy[scannerCode]) {
      return active;
    }

    const nextCount = (active.rescueCount || 0) + 1;
    const nextRescuedBy = {
      ...rescuedBy,
      [scannerCode]: true
    };

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

  if (!rescueTxn.committed) {
    throw new Error("救援失敗，請再試一次");
  }

  await db.ref(`/teams/${latestScanner.teamId}/score`).transaction(v => (v || 0) + 1);

  const updatedTarget = rescueTxn.snapshot.val();
  const targetName = updatedTarget.nickname || updatedTarget.code || normalizedTarget;

  if (updatedTarget.status === "normal") {
    await db.ref("/game/message").set(`${targetName} 已恢復行動`);
    return `${targetName} 已恢復行動`;
  }

  return `救援成功：${targetName} ${updatedTarget.rescueCount || 0} / 5`;
}

async function handleQrPayload(payloadText) {
  const payload = normalizePayloadText(payloadText);

  console.log("掃到內容：", payload);
  showResult("掃描成功：" + payload);

  if (!currentPlayerCode) {
    throw new Error("請先加入遊戲或回到遊戲");
  }

  const player = await getCurrentPlayer();

  if (!player) {
    throw new Error("找不到玩家資料，請重新回到遊戲");
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

  throw new Error("不支援的掃碼內容：" + payload);
}

function showScannerSection() {
  const section = $("#scannerSection");
  const readerEl = document.getElementById("qr-reader");

  if (section) {
    section.hidden = false;
  }

  if (readerEl) {
    readerEl.style.display = "block";
    readerEl.style.minHeight = "320px";
    readerEl.style.background = "#f2f2f2";
    readerEl.style.border = "3px solid #333";
  }

  setTimeout(() => {
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 50);
}

async function stopQrScanner() {
  if (!scannerInstance) {
    scannerRunning = false;
    scannerStarting = false;
    return;
  }

  try {
    if (scannerRunning) {
      await scannerInstance.stop();
    }
  } catch (e) {
    console.warn("停止掃描器時發生狀況", e);
  }

  try {
    await scannerInstance.clear();
  } catch (e) {
    console.warn("清除掃描器時發生狀況", e);
  }

  scannerInstance = null;
  scannerRunning = false;
  scannerStarting = false;
}

function getQrBoxSize() {
  const width = Math.min(window.innerWidth || 360, 420);
  const size = Math.max(220, Math.min(300, Math.floor(width * 0.72)));

  return {
    width: size,
    height: size
  };
}

async function startQrScanner() {
  if (scannerStarting) {
    showResult("掃描器正在啟動，請稍候……");
    return;
  }

  if (scannerRunning) {
    showResult("掃描器已經開啟，請對準二維碼");
    return;
  }

  scannerStarting = true;

  try {
    showResult("正在開啟相機，請允許相機權限……");

    if (!currentPlayerCode) {
      scannerStarting = false;
      showResult("請先加入遊戲或回到遊戲");
      return;
    }

    const player = await getCurrentPlayer();

    if (!player) {
      scannerStarting = false;
      showResult("找不到玩家資料，請重新回到遊戲");
      return;
    }

    if (player.status === "down") {
      scannerStarting = false;
      showResult("你沒電了，不能行動");
      return;
    }

    if (typeof Html5Qrcode === "undefined") {
      scannerStarting = false;
      showError("掃描器套件未載入，請改用手動輸入");
      return;
    }

    const readerEl = document.getElementById("qr-reader");

    if (!readerEl) {
      scannerStarting = false;
      showError("找不到掃描器容器");
      return;
    }

    showScannerSection();
    readerEl.innerHTML = "";

    await stopQrScanner();

    showScannerSection();

    scannerInstance = new Html5Qrcode("qr-reader");

    const config = {
      fps: 10,
      qrbox: getQrBoxSize()
    };

    await scannerInstance.start(
      { facingMode: "environment" },
      config,
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
    showResult("相機已啟動，請對準二維碼");
  } catch (err) {
    scannerStarting = false;
    await stopQrScanner();
    showError("掃描器啟動失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function testCameraOnly() {
  try {
    showResult("正在測試相機權限……");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("這個瀏覽器不支援相機權限功能，請改用 Chrome 或 Safari");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    showSuccess("相機測試成功，手機相機可用");

    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    showError("相機測試失敗：" + (err && err.message ? err.message : String(err)));
  }
}

async function applyManualPayload() {
  try {
    const payload = $("#payload").value.trim();

    if (!currentPlayerCode) {
      throw new Error("請先加入遊戲或回到遊戲");
    }

    if (!canTrigger(`${currentPlayerCode}:${payload}`)) {
      return;
    }

    const result = await handleQrPayload(payload);
    showSuccess(result);
    await renderPlayer(currentPlayerCode);
  } catch (err) {
    showError(err && err.message ? err.message : String(err));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  buildTeamOptions();
  await refreshCodeDropdown();

  $("#team").addEventListener("change", refreshCodeDropdown);
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
      showResult("已停止掃描器");
    });
  }
});