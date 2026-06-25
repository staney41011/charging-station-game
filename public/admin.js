const db = initFirebase();
const scoreTeamSelect = $("#scoreTeam");

let latestData = defaultState();

function log(msg) {
  const logBox = $("#adminLog");
  if (!logBox) return;
  logBox.textContent = `${new Date().toLocaleString()}｜${msg}\n` + logBox.textContent;
}

function bossById(id) {
  const def = BOSS_DEFS[id];

  return {
    id,
    name: def.name,
    hp: def.hp,
    maxHp: def.hp,
    active: true,
    required: def.required,
    delivered: {}
  };
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

function emptyTeams(teamCount, teamSize) {
  return makeTeams(teamCount, teamSize);
}

async function getData() {
  const snap = await db.ref("/").get();
  return snap.val() || defaultState();
}

async function updateGame(patch) {
  await db.ref("/game").update(patch);
}

async function bootstrap() {
  const setup = readGameSetup();

  await db.ref("/").set({
    game: {
      status: "lobby",
      totalPlayers: setup.totalPlayers,
      teamCount: setup.teamCount,
      teamSize: setup.teamSize,
      currentBoss: 1,
      phase: "lobby",
      startedAt: null,
      message: `已建立 ${setup.teamCount} 組，每組 ${setup.teamSize} 人。等待主持人開始遊戲。`
    },
    teams: emptyTeams(setup.teamCount, setup.teamSize),
    players: {},
    boss: null,
    order: null
  });

  log(`已建立 ${setup.teamCount} 組、每組 ${setup.teamSize} 人，共 ${setup.totalPlayers} 個名額，並清空舊資料。`);
}

async function startGame() {
  const data = await getData();

  if (!Object.keys(data.teams || {}).length) {
    log("請先建立遊戲與組別。");
    return;
  }

  const firstOrder = makeRandomOrder(null);

  await db.ref("/").update({
    game: {
      ...(data.game || {}),
      status: "running",
      phase: "running",
      startedAt: Date.now(),
      message: "遊戲開始！請各組店長查看第一張訂單，準備迎戰魔王。"
    },
    order: firstOrder
  });

  log(`遊戲開始，第一張訂單：${firstOrder.name}`);
}

async function nextRandomOrder() {
  const data = await getData();
  const previousDefId = data.order?.defId || null;
  const nextOrder = makeRandomOrder(previousDefId);

  await db.ref("/").update({
    order: nextOrder,
    game: {
      ...(data.game || {}),
      status: "running",
      phase: "running",
      message: "新訂單已發布，請各組店長查看店長頁。"
    }
  });

  log(`已發布下一張訂單：${nextOrder.name}`);
}

async function clearOrder() {
  await db.ref("/order").set(null);
  await db.ref("/game/message").set("目前沒有訂單，請等待主持人發布下一張。");
  log("已清空目前訂單。");
}

async function openBoss(id) {
  await db.ref("/boss").set(bossById(id));

  await updateGame({
    currentBoss: Number(id.replace("boss", "")),
    phase: id,
    status: "running",
    message: `${BOSS_DEFS[id].name} 出現！請把需要的材料送到中央電塔。`
  });

  log(`已開啟 ${BOSS_DEFS[id].name}`);
}

async function openCustomBoss() {
  const name = String($("#customBossName").value || "").trim();
  const hp = Number($("#customBossHp").value || 0);

  if (!name) return log("請輸入魔王名稱。");
  if (!Number.isInteger(hp) || hp < 1) return log("請輸入有效血量。");

  const required = {};
  const delivered = {};

  MATERIALS.forEach(material => {
    const inputEl = $(`#bossNeed_${material}`);
    const input = Number(inputEl?.value || 0);

    if (input > 0) {
      required[material] = input;
      delivered[material] = 0;
    }
  });

  if (!Object.keys(required).length) {
    return log("請至少設定一種需要的材料。");
  }

  await db.ref("/boss").set({
    id: "custom",
    name,
    hp,
    maxHp: hp,
    active: true,
    required,
    delivered
  });

  await updateGame({
    status: "running",
    phase: "custom",
    currentBoss: 0,
    message: `自訂魔王 ${name} 出現！請各組支援中央電塔。`
  });

  log(`已開啟自訂魔王：${name}`);
}

async function clearPlayers() {
  await db.ref("/players").set({});
  log("已清空舊玩家。");
}

async function clearBoss() {
  await db.ref("/boss").set(null);
  await db.ref("/game/message").set("目前尚未出現魔王。");
  log("已清空魔王。");
}

async function clearTeamData() {
  const data = await getData();

  for (const [id] of sortedTeamEntries(data.teams)) {
    await db.ref(`/teams/${id}`).update({
      score: 0,
      supportPoints: 0,
      bossContribution: 0,
      completedOrders: 0,
      inventory: {}
    });
  }

  log("已清空各組庫存、分數、支援點、魔王貢獻與完成訂單數。");
}

async function releaseNumbers() {
  const data = await getData();

  for (const [code] of Object.entries(data.players || {})) {
    const nextNumber = Number(String(code).replace(/^\D+/, "")) || null;
    await db.ref(`/players/${code}`).update({ number: nextNumber });
  }

  log("已重新寫入玩家號碼。");
}

async function clearCarryForTarget() {
  const code = normalizeCode($("#targetPlayerCode").value);

  if (!code) return log("請輸入玩家代號。");

  await db.ref(`/players/${code}/carrying`).set(null);
  log(`已清空 ${code} 攜帶材料。`);
}

async function randomDown() {
  const data = await getData();
  const players = Object.values(data.players || {}).filter(p => p.status === "normal");

  if (!players.length) return log("沒有可沒電的正常玩家。");

  const picked = players[Math.floor(Math.random() * players.length)];

  await db.ref(`/players/${picked.code}`).update({
    status: "down",
    rescueCount: 0,
    rescuedBy: {}
  });

  await db.ref("/game/message").set(`${picked.code} 沒電了！需要 5 位不同玩家救援。`);

  log(`${picked.code} 已設為沒電。`);
}

async function restoreAllDown() {
  const data = await getData();
  const players = Object.values(data.players || {}).filter(p => p.status === "down");

  for (const p of players) {
    await db.ref(`/players/${p.code}`).update({
      status: "normal",
      rescueCount: 0,
      rescuedBy: {}
    });
  }

  await db.ref("/game/message").set("所有沒電玩家已恢復行動。");

  log("已恢復所有沒電玩家。");
}

async function fullReset() {
  await db.ref("/").set(defaultState());
  log("已重置全部資料。");
}

async function createTestPlayers() {
  const data = await getData();
  const teams = sortedTeamEntries(data.teams);

  if (!teams.length) {
    log("請先建立遊戲與組別。");
    return;
  }

  for (const [teamId, team] of teams) {
    const letter = team.letter || teamLetter(teamId);
    const count = Math.min(2, Number(team.capacity || 2));

    for (let i = 1; i <= count; i++) {
      const code = `${letter}${String(i).padStart(2, "0")}`;

      await db.ref(`/players/${code}`).set({
        code,
        nickname: `${code}測試`,
        teamId,
        number: i,
        status: "normal",
        carrying: null,
        rescueCount: 0,
        rescuedBy: {},
        joinedAt: Date.now()
      });
    }
  }

  log("已為每個開放組別建立最多 2 位測試玩家。");
}

async function giveCarry() {
  const code = normalizeCode($("#targetPlayerCode").value);
  const material = String($("#carryMaterial").value || "").trim();

  if (!code || !material) return log("請輸入玩家代號並選擇材料。");

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) return log(`找不到玩家：${code}`);

  await db.ref(`/players/${code}/carrying`).set(material);
  log(`已給 ${code} 材料：${materialLabel(material)}`);
}

async function setDown() {
  const code = normalizeCode($("#targetPlayerCode").value);

  if (!code) return log("請輸入玩家代號。");

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) return log(`找不到玩家：${code}`);

  await db.ref(`/players/${code}`).update({
    status: "down",
    rescueCount: 0,
    rescuedBy: {}
  });

  await db.ref("/game/message").set(`${code} 沒電了！需要 5 位不同玩家救援。`);

  log(`${code} 已設為沒電。`);
}

async function addScore() {
  const teamId = scoreTeamSelect.value;

  if (!teamId) return log("請先選擇組別。");

  await db.ref(`/teams/${teamId}/score`).transaction(v => (v || 0) + 10);
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

function initMaterialOptions() {
  const carryMaterial = $("#carryMaterial");
  if (!carryMaterial) return;

  carryMaterial.innerHTML = MATERIALS.map(material => `
    <option value="${material}">${materialLabel(material)}</option>
  `).join("");
}

function renderScoreTeamOptions(data) {
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

function initCustomBossInputs() {
  const mount = $("#customBossMaterials");

  if (!mount) return;

  mount.innerHTML = MATERIALS.map(material => `
    <label class="custom-boss-item">
      ${materialLabel(material)}
      <input id="bossNeed_${material}" type="number" min="0" value="0" />
    </label>
  `).join("");
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
      const carry = p.carrying ? materialLabel(p.carrying) : "無";
      const teamName = teamDisplayName(p.teamId, data.teams?.[p.teamId]);

      return `
        <div class="row admin-player-row">
          <span><strong>${p.code}</strong> ${p.nickname || ""} · ${teamName}</span>
          <span class="pill ${p.status === "down" ? "danger-pill" : ""}">
            ${p.status === "down" ? "沒電" : `正常 · ${carry}`}
          </span>
        </div>
      `;
    })
    .join("");
}

function renderGameConfig(data) {
  const game = data.game || {};
  const teamCount = Object.keys(data.teams || {}).length || Number(game.teamCount || 0);
  const teamSize = Number(game.teamSize || 0);
  const summary = $("#gameConfigSummary");

  if (summary) {
    summary.textContent = teamCount
      ? `${teamCount} 組 · 每組 ${teamSize || "-"} 人`
      : "尚未建立";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMaterialOptions();
  initCustomBossInputs();
  updateTotalPreview();

  $("#teamCount")?.addEventListener("input", updateTotalPreview);
  $("#teamSize")?.addEventListener("input", updateTotalPreview);

  bind("bootstrapBtn", bootstrap);
  bind("gameStartBtn", startGame);
  bind("nextOrderBtn", nextRandomOrder);
  bind("clearOrderBtn", clearOrder);

  bind("boss1Btn", () => openBoss("boss1"));
  bind("boss2Btn", () => openBoss("boss2"));
  bind("boss3Btn", () => openBoss("boss3"));
  bind("boss4Btn", () => openBoss("boss4"));
  bind("openCustomBossBtn", openCustomBoss);

  bind("randomDownBtn", randomDown);
  bind("restoreDownBtn", restoreAllDown);
  bind("clearPlayersBtn", clearPlayers);
  bind("clearBossBtn", clearBoss);
  bind("clearTeamDataBtn", clearTeamData);
  bind("releaseNumbersBtn", releaseNumbers);
  bind("clearCarryBtn", clearCarryForTarget);
  bind("fullResetBtn", fullReset);

  bind("createTestPlayersBtn", createTestPlayers);
  bind("setCarryBtn", giveCarry);
  bind("setDownBtn", setDown);
  bind("addScoreBtn", addScore);

  db.ref("/").on("value", snap => {
    latestData = snap.val() || defaultState();
    renderScoreTeamOptions(latestData);
    renderPlayers(Object.values(latestData.players || {}), latestData);
    renderGameConfig(latestData);
  });
});
