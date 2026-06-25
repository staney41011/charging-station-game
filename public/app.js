const MATERIALS = [
  "wire",
  "outlet",
  "wifi",
  "fast_cable",
  "power_bank",
  "reboot",
  "reminder",
  "companion",
  "support"
];

const MATERIAL_LABELS = {
  wire: "充電線",
  outlet: "插座",
  wifi: "無線網路",
  fast_cable: "快充線",
  power_bank: "行動電源",
  reboot: "重開機",
  reminder: "提醒卡",
  companion: "同行卡",
  support: "陪伴卡"
};

const MAX_TEAMS = 15;
const DEFAULT_TEAM_COUNT = 15;
const DEFAULT_TEAM_SIZE = 4;
const TEAM_LETTERS = Array.from({ length: MAX_TEAMS }, (_, i) => String.fromCharCode(65 + i));
const TEAM_NAMES = TEAM_LETTERS.reduce((map, letter, index) => {
  map[`team${index + 1}`] = letter;
  return map;
}, {});

const BOSS_DEFS = {
  boss1: {
    name: "全城小停電",
    hp: 18,
    required: { wire: 6, outlet: 6, wifi: 6 }
  },
  boss2: {
    name: "材料大缺貨",
    hp: 24,
    required: { wire: 6, outlet: 6, fast_cable: 6, power_bank: 6 }
  },
  boss3: {
    name: "關機區爆滿",
    hp: 30,
    required: { power_bank: 8, reboot: 8, wifi: 7, support: 7 }
  },
  boss4: {
    name: "週三遺忘獸",
    hp: 36,
    required: { reminder: 8, companion: 8, power_bank: 6, reboot: 6, wire: 4, wifi: 4 }
  }
};

const ORDER_DEFS = {
  order1: {
    name: "快充補給單",
    reward: 10,
    required: { wire: 2, outlet: 1, fast_cable: 1 }
  },
  order2: {
    name: "全場連線單",
    reward: 12,
    required: { wifi: 3, power_bank: 1, wire: 1 }
  },
  order3: {
    name: "重新啟動單",
    reward: 15,
    required: { reboot: 2, reminder: 2, support: 1 }
  },
  order4: {
    name: "同行支援單",
    reward: 18,
    required: { companion: 2, support: 2, power_bank: 2 }
  },
  order5: {
    name: "臨時補電單",
    reward: 14,
    required: { power_bank: 2, outlet: 2, wire: 1 }
  },
  order6: {
    name: "穩定訊號單",
    reward: 16,
    required: { wifi: 3, reboot: 1, companion: 1 }
  },
  order7: {
    name: "週三提醒單",
    reward: 14,
    required: { reminder: 3, support: 1, fast_cable: 1 }
  },
  order8: {
    name: "全員支援單",
    reward: 20,
    required: { companion: 2, support: 2, reminder: 2, wifi: 1 }
  }
};

window.APP = {
  MATERIALS,
  MATERIAL_LABELS,
  MAX_TEAMS,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TEAM_SIZE,
  TEAM_LETTERS,
  TEAM_NAMES,
  BOSS_DEFS,
  ORDER_DEFS
};

window.MATERIALS = MATERIALS;
window.MATERIAL_LABELS = MATERIAL_LABELS;
window.MAX_TEAMS = MAX_TEAMS;
window.DEFAULT_TEAM_COUNT = DEFAULT_TEAM_COUNT;
window.DEFAULT_TEAM_SIZE = DEFAULT_TEAM_SIZE;
window.TEAM_LETTERS = TEAM_LETTERS;
window.TEAM_NAMES = TEAM_NAMES;
window.BOSS_DEFS = BOSS_DEFS;
window.ORDER_DEFS = ORDER_DEFS;

window.$ = (sel, root = document) => root.querySelector(sel);
window.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}
window.normalizeCode = normalizeCode;

function normalizeTeamCount(value) {
  const n = Number(value || DEFAULT_TEAM_COUNT);
  if (!Number.isFinite(n)) return DEFAULT_TEAM_COUNT;
  return Math.max(1, Math.min(MAX_TEAMS, Math.floor(n)));
}
window.normalizeTeamCount = normalizeTeamCount;

function normalizeTeamSize(value) {
  const n = Number(value || DEFAULT_TEAM_SIZE);
  if (!Number.isFinite(n)) return DEFAULT_TEAM_SIZE;
  return Math.max(1, Math.min(99, Math.floor(n)));
}
window.normalizeTeamSize = normalizeTeamSize;

function parsePayload(text) {
  const raw = String(text || "").trim();
  const [type, value] = raw.split(":");

  return {
    type: (type || "").toUpperCase(),
    value: (value || "").trim()
  };
}
window.parsePayload = parsePayload;

function materialLabel(material) {
  return MATERIAL_LABELS[material] || material || "無";
}
window.materialLabel = materialLabel;

function teamNumber(teamId) {
  const n = Number(String(teamId || "").replace(/^team/i, ""));
  return Number.isInteger(n) && n > 0 ? n : 0;
}
window.teamNumber = teamNumber;

function teamLetter(teamId) {
  return TEAM_NAMES[teamId] || "";
}
window.teamLetter = teamLetter;

function teamDisplayName(teamId, team) {
  const n = teamNumber(teamId);
  return team?.name || (n ? `第 ${n} 組` : "未選擇組別");
}
window.teamDisplayName = teamDisplayName;

function sortedTeamEntries(teams) {
  return Object.entries(teams || {}).sort(([a], [b]) => teamNumber(a) - teamNumber(b));
}
window.sortedTeamEntries = sortedTeamEntries;

function teamCapacity(totalPlayers, index, teamCount = DEFAULT_TEAM_COUNT) {
  const count = normalizeTeamCount(teamCount);
  const total = Math.max(0, Number(totalPlayers || 0));
  const base = Math.floor(total / count);
  const extra = total % count;
  return base + (index < extra ? 1 : 0);
}
window.teamCapacity = teamCapacity;

function makeTeam(teamId, index, teamSize) {
  return {
    name: `第 ${index + 1} 組`,
    letter: TEAM_LETTERS[index],
    capacity: normalizeTeamSize(teamSize),
    score: 0,
    supportPoints: 0,
    bossContribution: 0,
    completedOrders: 0,
    inventory: {}
  };
}
window.makeTeam = makeTeam;

function makeTeams(teamCount = DEFAULT_TEAM_COUNT, teamSize = DEFAULT_TEAM_SIZE) {
  const count = normalizeTeamCount(teamCount);
  const size = normalizeTeamSize(teamSize);
  const teams = {};

  for (let i = 0; i < count; i++) {
    teams[`team${i + 1}`] = makeTeam(`team${i + 1}`, i, size);
  }

  return teams;
}
window.makeTeams = makeTeams;

function defaultState() {
  return {
    game: {
      status: "lobby",
      phase: "lobby",
      totalPlayers: 0,
      teamCount: DEFAULT_TEAM_COUNT,
      teamSize: DEFAULT_TEAM_SIZE,
      currentBoss: 1,
      startedAt: null,
      message: "等待主持人建立遊戲。"
    },
    teams: {},
    players: {},
    boss: null,
    order: null
  };
}
window.defaultState = defaultState;

function cloneRequired(required) {
  const result = {};

  Object.entries(required || {}).forEach(([material, count]) => {
    const n = Number(count || 0);
    if (n > 0) result[material] = n;
  });

  return result;
}

function orderTotalRequired(order) {
  return Object.values(order?.required || {}).reduce((sum, n) => sum + Number(n || 0), 0);
}
window.orderTotalRequired = orderTotalRequired;

function orderTeamProgress(order, team) {
  const required = order?.required || {};
  const inventory = team?.inventory || {};

  let got = 0;
  let total = 0;

  Object.entries(required).forEach(([material, need]) => {
    const requiredCount = Number(need || 0);
    const haveCount = Number(inventory[material] || 0);

    total += requiredCount;
    got += Math.min(haveCount, requiredCount);
  });

  return { got, total };
}
window.orderTeamProgress = orderTeamProgress;

function canTeamCompleteOrder(order, team) {
  if (!order || order.active !== true) return false;

  const required = order.required || {};
  const inventory = team?.inventory || {};

  return Object.entries(required).every(([material, need]) => {
    return Number(inventory[material] || 0) >= Number(need || 0);
  });
}
window.canTeamCompleteOrder = canTeamCompleteOrder;

function pickRandomOrderDef(previousDefId) {
  const ids = Object.keys(ORDER_DEFS);
  const candidates = ids.filter(id => id !== previousDefId);
  const pool = candidates.length ? candidates : ids;
  const pickedId = pool[Math.floor(Math.random() * pool.length)];

  return {
    id: pickedId,
    def: ORDER_DEFS[pickedId]
  };
}

function makeRandomOrder(previousDefId) {
  const picked = pickRandomOrderDef(previousDefId);
  const required = cloneRequired(picked.def.required);

  return {
    active: true,
    id: `${picked.id}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    defId: picked.id,
    name: picked.def.name,
    reward: Number(picked.def.reward || 10),
    required,
    createdAt: Date.now(),
    completedBy: null,
    completedAt: null
  };
}
window.makeRandomOrder = makeRandomOrder;

async function ensureRandomOrder(db, data) {
  const game = data?.game || {};
  const order = data?.order;

  if (game.status !== "running") return;
  if (order && order.active === true) return;

  await db.ref("/order").transaction(current => {
    if (current && current.active === true) return current;

    const previousDefId = current?.defId || null;
    return makeRandomOrder(previousDefId);
  });
}
window.ensureRandomOrder = ensureRandomOrder;

window.initFirebase = function initFirebase() {
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  return firebase.database();
};
