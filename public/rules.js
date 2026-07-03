function getQrConstructor() {
  if (typeof window.QRCode === "function") return window.QRCode;
  if (typeof QRCode === "function") return QRCode;
  return null;
}

function initRulesEntryQr() {
  const qrEl = document.getElementById("rulesEntryQr");
  const textEl = document.getElementById("rulesEntryQrText");
  const errorEl = document.getElementById("rulesEntryQrError");
  const entryUrl = "https://charging-station-game.web.app/player.html?openExternalBrowser=1";

  if (textEl) textEl.textContent = entryUrl;
  if (!qrEl) return;

  const QrCtor = getQrConstructor();

  if (!QrCtor) {
    if (errorEl) errorEl.hidden = false;
    console.error("QRCode 未載入，請檢查 vendor/qrcode.min.js 是否存在與載入順序。");
    return;
  }

  try {
    qrEl.innerHTML = "";
    new QrCtor(qrEl, {
      text: entryUrl,
      width: 220,
      height: 220,
      correctLevel: QrCtor.CorrectLevel ? QrCtor.CorrectLevel.H : undefined
    });
  } catch (err) {
    if (errorEl) errorEl.hidden = false;
    console.error("玩家入口二維碼產生失敗", err);
  }
}

document.addEventListener("DOMContentLoaded", initRulesEntryQr);
