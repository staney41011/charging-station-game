const WORK_TYPES = [
  "audio",
  "activity",
  "food",
  "service",
  "photo",
  "video",
  "design",
  "venue",
  "promo"
];

const WORK_LABELS = {
  audio: "音控組",
  activity: "活動組",
  food: "膳食組",
  service: "服務組",
  photo: "攝影組",
  video: "錄影組",
  design: "美宣組",
  venue: "場佈組",
  promo: "宣傳組"
};

const TASK_DEFS = {
  characterCamp: {
    name: "崇正品格夏令營",
    required: { audio: 14, activity: 54, food: 24, service: 30, photo: 16, video: 14, design: 16, venue: 20, promo: 12 }
  },
  parentsDay: {
    name: "雙親節",
    required: { audio: 12, activity: 26, food: 16, service: 22, photo: 16, video: 12, design: 24, venue: 44, promo: 28 }
  },
  ruralCamp: {
    name: "森耕偏鄉夏令營",
    required: { audio: 10, activity: 54, food: 24, service: 38, photo: 20, video: 14, design: 14, venue: 16, promo: 10 }
  },
  jurassicCamp: {
    name: "侏羅紀重生大作戰夏令營",
    required: { audio: 16, activity: 58, food: 20, service: 28, photo: 16, video: 20, design: 20, venue: 16, promo: 6 }
  },
  miaoJiMemorial: {
    name: "妙極大帝紀念晚會",
    required: { audio: 26, activity: 48, food: 10, service: 16, photo: 20, video: 26, design: 24, venue: 20, promo: 10 }
  },
  guangYuMemorial: {
    name: "光裕大帝紀念晚會",
    required: { audio: 26, activity: 48, food: 10, service: 16, photo: 20, video: 26, design: 24, venue: 20, promo: 10 }
  },
  walkerOverseas: {
    name: "越行者海外志工",
    required: { audio: 10, activity: 54, food: 24, service: 42, photo: 24, video: 16, design: 10, venue: 10, promo: 10 }
  },
  southIndiaOverseas: {
    name: "歡印光臨南印度海外志工",
    required: { audio: 10, activity: 54, food: 24, service: 42, photo: 24, video: 16, design: 10, venue: 10, promo: 10 }
  },
  springTea: {
    name: "各組線春節茶敘",
    required: { audio: 12, activity: 50, food: 34, service: 28, photo: 12, video: 10, design: 16, venue: 26, promo: 12 }
  },
  volunteerYearEnd: {
    name: "崇正志工尾牙",
    required: { audio: 24, activity: 54, food: 38, service: 24, photo: 12, video: 16, design: 16, venue: 12, promo: 4 }
  },
  lifeFuService: {
    name: "HOLD住生命的FU-機構服務",
    required: { audio: 6, activity: 30, food: 16, service: 68, photo: 20, video: 14, design: 14, venue: 10, promo: 22 }
  }
};

const FINAL_TASK_DEF = {
  id: "final120",
  name: "白陽祖師傳道120週年紀念大會",
  perTeamDemand: 200,
  distribution: {
    audio: 0.13,
    activity: 0.22,
    food: 0.10,
    service: 0.15,
    photo: 0.08,
    video: 0.10,
    design: 0.08,
    venue: 0.09,
    promo: 0.05
  }
};

const NEGATIVE_STATUS_DEFS = {
  sleep: { label: "補眠", min: 5, max: 8 },
  exhausted: { label: "體力透支", min: 8, max: 12 },
  unwilling: { label: "不想工作", min: 10, max: 15 },
  conflict: { label: "跟夥伴吵架", min: 12, max: 20 }
};

const MAX_TEAMS = 15;
const DEFAULT_TEAM_COUNT = 8;
const DEFAULT_TEAM_SIZE = 16;
const ROUND_DURATION_MS = 10 * 60 * 1000;
const FINAL_DURATION_MS = 10 * 60 * 1000;
const MAX_PROFICIENCY = 3;
const PROFICIENCY_STEP = 0.1;
const PLAYER_ENTRY_URL = "https://charging-station-game.web.app/player.html";
const TEAM_LETTERS = Array.from({ length: MAX_TEAMS }, (_, i) => String.fromCharCode(65 + i));
const TEAM_NAMES = TEAM_LETTERS.reduce((map, letter, index) => {
  map[`team${index + 1}`] = letter;
  return map;
}, {});

// Backward-compatible aliases for pages that still load shared helpers.
const MATERIALS = WORK_TYPES;
const MATERIAL_LABELS = WORK_LABELS;
const BOSS_DEFS = {};
const ORDER_DEFS = TASK_DEFS;

window.APP = {
  WORK_TYPES,
  WORK_LABELS,
  TASK_DEFS,
  FINAL_TASK_DEF,
  NEGATIVE_STATUS_DEFS,
  MAX_TEAMS,
  DEFAULT_TEAM_COUNT,
  DEFAULT_TEAM_SIZE,
  ROUND_DURATION_MS,
  FINAL_DURATION_MS,
  MAX_PROFICIENCY,
  PROFICIENCY_STEP,
  PLAYER_ENTRY_URL,
  TEAM_LETTERS,
  TEAM_NAMES
};

window.WORK_TYPES = WORK_TYPES;
window.WORK_LABELS = WORK_LABELS;
window.TASK_DEFS = TASK_DEFS;
window.FINAL_TASK_DEF = FINAL_TASK_DEF;
window.NEGATIVE_STATUS_DEFS = NEGATIVE_STATUS_DEFS;
window.MAX_TEAMS = MAX_TEAMS;
window.DEFAULT_TEAM_COUNT = DEFAULT_TEAM_COUNT;
window.DEFAULT_TEAM_SIZE = DEFAULT_TEAM_SIZE;
window.ROUND_DURATION_MS = ROUND_DURATION_MS;
window.FINAL_DURATION_MS = FINAL_DURATION_MS;
window.MAX_PROFICIENCY = MAX_PROFICIENCY;
window.PROFICIENCY_STEP = PROFICIENCY_STEP;
window.PLAYER_ENTRY_URL = PLAYER_ENTRY_URL;
window.TEAM_LETTERS = TEAM_LETTERS;
window.TEAM_NAMES = TEAM_NAMES;
window.MATERIALS = MATERIALS;
window.MATERIAL_LABELS = MATERIAL_LABELS;
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
  const raw = String(text || "").trim().replace(/：/g, ":");
  const [type, ...rest] = raw.split(":");
  return {
    raw,
    type: String(type || "").toUpperCase(),
    value: rest.join(":").trim()
  };
}
window.parsePayload = parsePayload;

function workLabel(workType) {
  return WORK_LABELS[workType] || workType || "無";
}
window.workLabel = workLabel;
window.materialLabel = workLabel;

function negativeStatusLabel(statusId) {
  return NEGATIVE_STATUS_DEFS[statusId]?.label || statusId || "需要協助";
}
window.negativeStatusLabel = negativeStatusLabel;

function playerStatusLabel(player) {
  if (!player) return "尚未加入";
  if (player.status === "normal") return "正常";
  return negativeStatusLabel(player.negativeStatus?.id || player.status);
}
window.playerStatusLabel = playerStatusLabel;

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

function makeInitialProficiency() {
  return WORK_TYPES.reduce((profile, workType) => {
    profile[workType] = 1;
    return profile;
  }, {});
}
window.makeInitialProficiency = makeInitialProficiency;

function normalizedProficiency(profile) {
  const source = profile || {};
  return WORK_TYPES.reduce((next, workType) => {
    const n = Number(source[workType] || 1);
    next[workType] = Math.max(1, Math.min(MAX_PROFICIENCY, n));
    return next;
  }, {});
}
window.normalizedProficiency = normalizedProficiency;

function personalBalanceMultiplier(profile) {
  const values = Object.values(normalizedProficiency(profile));
  const min = Math.min(...values);
  if (min >= 2.5) return 1.2;
  if (min >= 2) return 1.15;
  if (min >= 1.5) return 1.1;
  if (min >= 1.2) return 1.05;
  return 1;
}
window.personalBalanceMultiplier = personalBalanceMultiplier;

function personalBalanceLabel(profile) {
  const multiplier = personalBalanceMultiplier(profile);
  if (multiplier >= 1.2) return "均衡發展 +20%";
  if (multiplier >= 1.15) return "均衡發展 +15%";
  if (multiplier >= 1.1) return "均衡發展 +10%";
  if (multiplier >= 1.05) return "均衡發展 +5%";
  return "均衡發展尚未啟動";
}
window.personalBalanceLabel = personalBalanceLabel;

function makeTeam(teamId, index, teamSize) {
  return {
    name: `第 ${index + 1} 組`,
    letter: TEAM_LETTERS[index],
    capacity: normalizeTeamSize(teamSize),
    score: 0,
    completedTasks: 0,
    supportDeliveries: 0,
    finalContribution: 0,
    canSupport: false,
    currentTaskId: null,
    currentTaskName: null
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

function cloneRequired(required) {
  return WORK_TYPES.reduce((next, workType) => {
    const n = Number(required?.[workType] || 0);
    if (n > 0) next[workType] = n;
    return next;
  }, {});
}
window.cloneRequired = cloneRequired;

function emptyProgress(required) {
  return Object.keys(required || {}).reduce((next, workType) => {
    next[workType] = 0;
    return next;
  }, {});
}
window.emptyProgress = emptyProgress;

function pickTaskDefId() {
  const ids = Object.keys(TASK_DEFS);
  return ids[Math.floor(Math.random() * ids.length)];
}
window.pickTaskDefId = pickTaskDefId;

function makeTeamTask(teamId, round, defId = pickTaskDefId()) {
  const def = TASK_DEFS[defId] || TASK_DEFS[Object.keys(TASK_DEFS)[0]];
  const required = cloneRequired(def.required);

  return {
    id: `${round}_${teamId}_${defId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    defId,
    teamId,
    round,
    name: def.name,
    required,
    progress: emptyProgress(required),
    active: true,
    completed: false,
    completedAt: null,
    startedAt: Date.now()
  };
}
window.makeTeamTask = makeTeamTask;

function makeRoundTasks(teamCount, round) {
  const count = normalizeTeamCount(teamCount);
  const tasks = {};

  for (let i = 1; i <= count; i++) {
    const teamId = `team${i}`;
    tasks[teamId] = makeTeamTask(teamId, round);
  }

  return tasks;
}
window.makeRoundTasks = makeRoundTasks;

function makeFinalTask(teamCount = DEFAULT_TEAM_COUNT) {
  const total = normalizeTeamCount(teamCount) * FINAL_TASK_DEF.perTeamDemand;
  const required = {};
  let assigned = 0;

  WORK_TYPES.forEach(workType => {
    const count = Math.round(total * Number(FINAL_TASK_DEF.distribution[workType] || 0));
    required[workType] = count;
    assigned += count;
  });

  required.activity += total - assigned;

  return {
    id: `${FINAL_TASK_DEF.id}_${Date.now()}`,
    name: FINAL_TASK_DEF.name,
    required,
    progress: emptyProgress(required),
    active: true,
    completed: false,
    completedAt: null,
    startedAt: Date.now()
  };
}
window.makeFinalTask = makeFinalTask;

function taskRequiredTotal(task) {
  return Object.values(task?.required || {}).reduce((sum, n) => sum + Number(n || 0), 0);
}
window.taskRequiredTotal = taskRequiredTotal;

function taskProgressTotal(task) {
  const required = task?.required || {};
  const progress = task?.progress || {};
  return Object.entries(required).reduce((sum, [workType, need]) => {
    return sum + Math.min(Number(progress[workType] || 0), Number(need || 0));
  }, 0);
}
window.taskProgressTotal = taskProgressTotal;

function taskPercent(task) {
  const total = taskRequiredTotal(task);
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((taskProgressTotal(task) / total) * 100)));
}
window.taskPercent = taskPercent;

function isTaskComplete(task) {
  return taskPercent(task) >= 100;
}
window.isTaskComplete = isTaskComplete;

function defaultState() {
  return {
    game: {
      status: "lobby",
      phase: "lobby",
      round: 0,
      maxRounds: 3,
      totalPlayers: 0,
      teamCount: DEFAULT_TEAM_COUNT,
      teamSize: DEFAULT_TEAM_SIZE,
      startedAt: null,
      roundStartedAt: null,
      roundEndsAt: null,
      message: "等待主持人建立遊戲。"
    },
    teams: {},
    players: {},
    tasksByTeam: {},
    finalTask: null,
    global: {
      ignorance: null
    }
  };
}
window.defaultState = defaultState;

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
window.randomInteger = randomInteger;

function randomNegativeStatus() {
  const ids = Object.keys(NEGATIVE_STATUS_DEFS);
  const id = ids[Math.floor(Math.random() * ids.length)];
  const def = NEGATIVE_STATUS_DEFS[id];

  return {
    id,
    label: def.label,
    needed: randomInteger(def.min, def.max),
    count: 0,
    rescuedBy: {},
    startedAt: Date.now()
  };
}
window.randomNegativeStatus = randomNegativeStatus;

function randomIgnoranceTarget() {
  return randomInteger(1, 10) * 100;
}
window.randomIgnoranceTarget = randomIgnoranceTarget;

window.initFirebase = function initFirebase() {
  if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
  return firebase.database();
};
