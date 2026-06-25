const db = initFirebase();
const scoreTeamSelect = $("#scoreTeam");

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

function emptyTeams(totalPlayers) {
  const teams = {};

  TEAM_LETTERS.forEach((letter, i) => {
    teams[`team${i + 1}`] = {
      name: `第 ${i + 1} 組`,
      letter,
      capacity: teamCapacity(totalPlayers, i),
      score: 0,
      supportPoints: 0,
      bossContribution: 0,
      completedOrders: 0,
      inventory: {}
    };
  });

  return teams;
}

async function getData() {
  const snap = await db.ref("/").get();
  return snap.val() || defaultState();
}

async function updateGame(patch) {
  await db.ref("/game").update(patch);
}

async function bootstrap(totalPlayers) {
  await db.ref("/").update({
    game: {
      status: "lobby",
      totalPlayers,
      currentBoss: 1,
      phase: "lobby",
      startedAt: null,
      message: "等待主持人開始遊戲"
    },
    teams: emptyTeams(totalPlayers),
    players: {},
    boss: null,
    order: null
  });

  log(`已建立 ${totalPlayers} 人的 6 組資料，並清空目前訂單`);
}

async function startGame() {
  if (typeof makeRandomOrder !== "function") {
    log("錯誤：找不到 makeRandomOrder，請確認 app.js 已正確載入");
    return;
  }

  const firstOrder = makeRandomOrder(null);

  await db.ref("/").update({
    game: {
      status: "running",
      phase: "running",
      startedAt: Date.now(),
      message: "遊戲開始！請各組店長查看第一張訂單。"
    },
    order: firstOrder
  });

  log(`已開始遊戲，並產生第一張訂單：${firstOrder.name}`);
}

async function nextRandomOrder() {
  if (typeof makeRandomOrder !== "function") {
    log("錯誤：找不到 makeRandomOrder，請確認 app.js 已正確載入");
    return;
  }

  const data = await getData();
  const previousDefId = data.order?.defId || null;
  const nextOrder = makeRandomOrder(previousDefId);

  await db.ref("/").update({
    order: nextOrder
  });

  await db.ref("/game").update({
    status: "running",
    phase: "running",
    message: "新訂單已發布，請各組店長查看店長頁。"
  });

  log(`已手動產生下一張訂單：${nextOrder.name}`);
}

async function clearOrder() {
  await db.ref("/order").set(null);
  await db.ref("/game/message").set("目前訂單已清空，等待下一張訂單。");
  log("已清空目前訂單");
}

async function openBoss(id) {
  await db.ref("/boss").set(bossById(id));

  await updateGame({
    currentBoss: Number(id.replace("boss", "")),
    phase: id,
    status: "running",
    message: `${BOSS_DEFS[id].name} 已出現！`
  });

  log(`已開啟 ${BOSS_DEFS[id].name}`);
}

async function openCustomBoss() {
  const name = String($("#customBossName").value || "").trim();
  const hp = Number($("#customBossHp").value || 0);

  if (!name) return log("請輸入魔王名稱");
  if (!Number.isInteger(hp) || hp < 1) return log("請輸入有效血量");

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
    return log("請至少設定一種需要的材料");
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
    message: `自訂魔王 ${name} 已開啟`
  });

  log(`已開啟自訂魔王：${name}`);
}

async function clearPlayers() {
  await db.ref("/players").set({});
  log("已清空舊玩家");
}

async function clearBoss() {
  await db.ref("/boss").set(null);
  log("已清空舊魔王");
}

async function clearTeamData() {
  const data = await getData();

  for (const [id] of Object.entries(data.teams || {})) {
    await db.ref(`/teams/${id}`).update({
      score: 0,
      supportPoints: 0,
      bossContribution: 0,
      completedOrders: 0,
      inventory: {}
    });
  }

  log("已清空各組庫存、分數、支援點、魔王貢獻與完成訂單數");
}

async function releaseNumbers() {
  const data = await getData();

  for (const [code] of Object.entries(data.players || {})) {
    const nextNumber = Number(String(code).replace(/^\D+/, "")) || null;
    await db.ref(`/players/${code}`).update({ number: nextNumber });
  }

  log("已釋放玩家號碼");
}

async function clearCarryForTarget() {
  const code = String($("#targetPlayerCode").value || "").trim().toUpperCase();

  if (!code) return log("請輸入指定玩家代碼");

  await db.ref(`/players/${code}/carrying`).set(null);
  log(`已清空 ${code} 的攜帶材料`);
}

async function randomDown() {
  const data = await getData();
  const players = Object.values(data.players || {}).filter(p => p.status === "normal");

  if (!players.length) return log("沒有可沒電的正常玩家");

  const picked = players[Math.floor(Math.random() * players.length)];

  await db.ref(`/players/${picked.code}`).update({
    status: "down",
    rescueCount: 0,
    rescuedBy: {}
  });

  await db.ref("/game/message").set(`${picked.code} 沒電了，需要 5 位玩家救援`);

  log(`已讓 ${picked.code} 沒電`);
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

  await db.ref("/game/message").set("所有沒電玩家已恢復行動");

  log("已恢復所有沒電玩家");
}

async function fullReset() {
  await db.ref("/").set(defaultState());
  log("已一鍵重置全部資料");
}

async function createTestPlayers() {
  for (const letter of TEAM_LETTERS) {
    for (let i = 1; i <= 2; i++) {
      const code = `${letter}${String(i).padStart(2, "0")}`;

      await db.ref(`/players/${code}`).set({
        code,
        nickname: `${code}測試`,
        teamId: `team${TEAM_LETTERS.indexOf(letter) + 1}`,
        number: i,
        status: "normal",
        carrying: null,
        rescueCount: 0,
        rescuedBy: {},
        joinedAt: Date.now()
      });
    }
  }

  log("已建立每組 2 位測試玩家");
}

async function giveCarry() {
  const code = String($("#targetPlayerCode").value || "").trim().toUpperCase();
  const material = String($("#carryMaterial").value || "").trim();

  if (!code || !material) return log("請輸入玩家代碼與材料");

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) return log(`找不到玩家：${code}`);

  await db.ref(`/players/${code}/carrying`).set(material);
  log(`已給 ${code} 材料 ${materialLabel(material)}`);
}

async function setDown() {
  const code = String($("#targetPlayerCode").value || "").trim().toUpperCase();

  if (!code) return log("請輸入玩家代碼");

  const snap = await db.ref(`/players/${code}`).get();
  const player = snap.val();

  if (!player) return log(`找不到玩家：${code}`);

  await db.ref(`/players/${code}`).update({
    status: "down",
    rescueCount: 0,
    rescuedBy: {}
  });

  await db.ref("/game/message").set(`${code} 沒電了，需要 5 位玩家救援`);

  log(`已讓 ${code} 沒電`);
}

async function addScore() {
  const teamId = scoreTeamSelect.value;

  await db.ref(`/teams/${teamId}/score`).transaction(v => (v || 0) + 10);
  log(`${teamId} 分數 +10`);
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

function initScoreTeamOptions() {
  if (!scoreTeamSelect) return;

  scoreTeamSelect.innerHTML = "";

  TEAM_LETTERS.forEach((letter, i) => {
    const opt = document.createElement("option");

    opt.value = `team${i + 1}`;
    opt.textContent = `第 ${i + 1} 組 (${letter})`;

    scoreTeamSelect.appendChild(opt);
  });
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

function renderPlayers(players) {
  const playerList = $("#playerList");

  if (!playerList) return;

  if (!players.length) {
    playerList.innerHTML = `<div class="row"><span class="muted">目前沒有玩家</span></div>`;
    return;
  }

  playerList.innerHTML = players
    .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    .map(p => {
      const carry = p.carrying ? materialLabel(p.carrying) : "無";

      return `
        <div class="row">
          <span><strong>${p.code}</strong> ${p.nickname || ""} · ${p.teamId || "-"}</span>
          <span class="pill ${p.status === "down" ? "danger" : ""}">
            ${p.status === "down" ? "沒電" : "正常"}${p.status === "normal" ? ` · ${carry}` : ""}
          </span>
        </div>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  initScoreTeamOptions();
  initCustomBossInputs();

  bind("bootstrapBtn", () => bootstrap(Number($("#totalPlayers").value || 0) || 30));
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

  db.ref("/players").on("value", snap => {
    renderPlayers(Object.values(snap.val() || {}));
  });
});