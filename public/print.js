const items = [
  PLAYER_ENTRY_URL,
  ...WORK_TYPES.map(workType => `WORK:${workType}`),
  ...TEAM_LETTERS.map((_, i) => `DELIVERY:team${i + 1}`),
  "FINAL:MAIN",
  "KOUQIU:MAIN"
];

function slug(payload) {
  return payload.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function resolveQrCtor() {
  if (typeof window.QRCode === "function") return window.QRCode;
  if (typeof QRCode === "function") return QRCode;
  return null;
}

function qrLibraryLoaded() {
  return !!resolveQrCtor();
}

function setPrintError(message) {
  const errorBox = $("#printError");
  if (!errorBox) return;
  errorBox.hidden = false;
  errorBox.querySelector(".print-error").textContent = message;
}

function displayName(payload) {
  if (payload === PLAYER_ENTRY_URL) return "玩家入口";
  if (payload.startsWith("WORK:")) return workLabel(payload.split(":")[1]);
  if (payload.startsWith("DELIVERY:")) return `第 ${teamNumber(payload.split(":")[1])} 組任務交付處`;
  if (payload === "FINAL:MAIN") return "大型任務交付處";
  if (payload === "KOUQIU:MAIN") return "叩求點";
  return payload;
}

$("#qrLibraryStatus").textContent = qrLibraryLoaded() ? "已載入" : "未載入";

$("#printList").innerHTML = items.map(payload => `
  <div class="card section qr-card">
    <h2>${displayName(payload)}</h2>
    <div id="qr-${slug(payload)}" class="qr-mount"></div>
    <div class="qr-text"><span class="muted">系統掃碼內容：</span>${payload}</div>
  </div>
`).join("");

let hadFailure = false;

for (const payload of items) {
  const mount = document.getElementById(`qr-${slug(payload)}`);
  try {
    const QrCtor = resolveQrCtor();
    if (!QrCtor) throw new Error("QRCode library missing");
    new QrCtor(mount, {
      text: payload,
      width: 180,
      height: 180,
      correctLevel: QrCtor.CorrectLevel?.M ?? 0
    });
  } catch (err) {
    hadFailure = true;
    console.error("QR 產生失敗", payload, err);
    mount.innerHTML = `<div class="qr-fallback">二維碼產生失敗<br><strong>${payload}</strong></div>`;
  }
}

if (hadFailure) {
  setPrintError("二維碼產生失敗，請檢查 public/vendor/qrcode.min.js 是否存在。");
  console.error("QR generation failed for one or more payloads");
}
