const items = [
  "player.html",
  ...MATERIALS.map(m => `MATERIAL:${m}`),
  ...TEAM_LETTERS.map((_, i) => `WAREHOUSE:team${i + 1}`),
  "BOSS:CENTRAL"
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
  errorBox.hidden = false;
  errorBox.querySelector(".print-error").textContent = message;
}

$("#qrLibraryStatus").textContent = qrLibraryLoaded() ? "已載入" : "未載入";

$("#printList").innerHTML = items.map(payload => `
  <div class="card section qr-card">
    <div id="qr-${slug(payload)}" class="qr-mount"></div>
    <div class="qr-text"><span class="muted">系統掃碼內容：</span>${payload}</div>
  </div>
`).join("");

let hadFailure = false;

for (const payload of items) {
  const mount = document.getElementById(`qr-${slug(payload)}`);
  try {
    const QrCtor = resolveQrCtor();
    if (!QrCtor) throw new Error("QR code library missing");
    new QrCtor(mount, {
      text: payload,
      width: 180,
      height: 180,
      correctLevel: QrCtor.CorrectLevel?.M ?? 0
    });
  } catch (err) {
    hadFailure = true;
    console.error("QR 產生失敗", payload, err);
    mount.innerHTML = `<div class="qr-fallback">系統掃碼內容：<strong>${payload}</strong></div>`;
  }
}

if (hadFailure) {
  setPrintError("二維碼產生失敗，請檢查 public/vendor/qrcode.min.js 是否存在");
  console.error("QR generation failed for one or more payloads");
}
