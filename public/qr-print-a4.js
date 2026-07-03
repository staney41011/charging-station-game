const workPages = WORK_TYPES.map(workType => ({
  name: workLabel(workType),
  payload: `WORK:${workType}`,
  note: `掃描後取得「${workLabel(workType)}」工作記錄，一次只能攜帶一筆。`
}));

const deliveryPages = Array.from({ length: MAX_TEAMS }, (_, index) => ({
  name: `第 ${index + 1} 組任務交付處`,
  payload: `DELIVERY:team${index + 1}`,
  note: "玩家帶著工作記錄掃描後，會交付到這一組目前的活動任務。"
}));

const qrPages = [
  {
    name: "玩家加入遊戲",
    payload: PLAYER_ENTRY_URL,
    note: "所有玩家一開始掃這張進入遊戲，選組別、玩家代碼與暱稱。"
  },
  ...workPages,
  ...deliveryPages,
  {
    name: "大型任務交付處",
    payload: "FINAL:MAIN",
    note: "最終大型活動開始後，玩家帶著工作記錄掃描這張交付到大型任務。"
  },
  {
    name: "叩求點",
    payload: "KOUQIU:MAIN",
    note: "無明來襲時，全場到固定地點掃描這張，累積叩求次數。"
  }
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pageHtml(item, index) {
  return `
    <section class="qr-print-page" data-page="${index + 1}">
      <article class="qr-print-card">
        <div class="qr-print-index">第 ${index + 1} / ${qrPages.length} 頁</div>
        <h2 class="qr-print-name">${escapeHtml(item.name)}</h2>
        <div class="qr-print-mount" data-index="${index}">
          <div class="qr-fallback">二維碼產生中</div>
        </div>
        <p class="qr-print-note">${escapeHtml(item.note)}</p>
        <p class="qr-print-payload">系統掃碼內容：${escapeHtml(item.payload)}</p>
        <div class="qr-print-footer">活動籌備挑戰</div>
      </article>
    </section>
  `;
}

function resolveQrCtor() {
  if (typeof window.QRCode !== "undefined") return window.QRCode;
  if (typeof QRCode !== "undefined") return QRCode;
  return null;
}

function setError(message) {
  const error = document.getElementById("qrPrintError");
  if (!error) return;
  error.hidden = false;
  error.textContent = message;
}

function setStatus(loaded) {
  const status = document.getElementById("qrLibraryStatus");
  if (status) status.textContent = loaded ? "已載入" : "未載入";

  const pageCount = document.getElementById("qrPageCount");
  if (pageCount) pageCount.textContent = String(qrPages.length);
}

function renderPages() {
  const mount = document.getElementById("qrPrintPages");
  if (!mount) {
    setError("找不到列印容器 qrPrintPages");
    return;
  }

  mount.innerHTML = qrPages.map(pageHtml).join("");

  const QrCtor = resolveQrCtor();
  setStatus(!!QrCtor);

  if (!QrCtor) {
    setError("二維碼產生失敗，請檢查 vendor/qrcode.min.js 是否載入。");
    console.error("QRCode 未載入，請檢查 vendor/qrcode.min.js 是否存在與 script 載入順序");
  }

  qrPages.forEach((item, index) => {
    const container = document.querySelector(`.qr-print-mount[data-index="${index}"]`);
    if (!container) return;

    try {
      if (!QrCtor) throw new Error("QRCode 未載入");
      container.innerHTML = "";
      new QrCtor(container, {
        text: item.payload,
        width: 520,
        height: 520,
        correctLevel: QrCtor.CorrectLevel?.M ?? 0
      });
    } catch (err) {
      console.error("正式列印 QR 產生失敗", item.payload, err);
      container.innerHTML = `<div class="qr-fallback">二維碼產生失敗<br><strong>${escapeHtml(item.payload)}</strong></div>`;
      setError("部分二維碼產生失敗，請檢查 qrcode.min.js。");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const printButton = document.getElementById("printPageBtn");
  if (printButton) printButton.addEventListener("click", () => window.print());
  Promise.resolve().then(renderPages);
});
