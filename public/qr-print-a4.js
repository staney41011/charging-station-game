const materialsForPrint = [
  { name: "充電線", payload: "MATERIAL:wire", note: "拿取充電線材料。" },
  { name: "插座", payload: "MATERIAL:outlet", note: "拿取插座材料。" },
  { name: "無線網路", payload: "MATERIAL:wifi", note: "拿取無線網路材料。" },
  { name: "快充線", payload: "MATERIAL:fast_cable", note: "拿取快充線材料。" },
  { name: "行動電源", payload: "MATERIAL:power_bank", note: "拿取行動電源材料。" },
  { name: "重開機", payload: "MATERIAL:reboot", note: "拿取重開機材料。" },
  { name: "提醒卡", payload: "MATERIAL:reminder", note: "拿取提醒卡材料。" },
  { name: "同行卡", payload: "MATERIAL:companion", note: "拿取同行卡材料。" },
  { name: "陪伴卡", payload: "MATERIAL:support", note: "拿取陪伴卡材料。" }
];

const warehousePages = Array.from({ length: 15 }, (_, index) => ({
  name: `第 ${index + 1} 組倉庫`,
  payload: `WAREHOUSE:team${index + 1}`,
  note: "玩家帶著材料掃這張 QR，材料就送到這一組倉庫。"
}));

const qrPages = [
  {
    name: "玩家加入遊戲",
    payload: "player.html",
    note: "所有玩家一開始掃這張進入遊戲，選組別、玩家代碼與暱稱。",
    kind: "url"
  },
  ...materialsForPrint,
  ...warehousePages,
  {
    name: "中央電塔",
    payload: "BOSS:CENTRAL",
    note: "打魔王時，把需要的材料送到中央電塔。"
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

function actualPayload(item) {
  if (item.kind === "url") {
    return new URL(item.payload, window.location.href).href;
  }
  return item.payload;
}

function pageHtml(item, index) {
  const payload = actualPayload(item);
  return `
    <section class="qr-print-page" data-page="${index + 1}">
      <article class="qr-print-card">
        <div class="qr-print-index">第 ${index + 1} / ${qrPages.length} 頁</div>
        <h2 class="qr-print-name">${escapeHtml(item.name)}</h2>
        <div class="qr-print-mount" data-payload="${escapeHtml(payload)}">
          <div class="qr-fallback">二維碼產生中</div>
        </div>
        <p class="qr-print-note">${escapeHtml(item.note)}</p>
        <p class="qr-print-payload">系統掃碼內容：${escapeHtml(payload)}</p>
        <div class="qr-print-footer">《充電站營業中》</div>
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

  qrPages.forEach(item => {
    const payload = actualPayload(item);
    const container = Array.from(document.querySelectorAll(".qr-print-mount"))
      .find(el => el.dataset.payload === payload);
    if (!container) return;

    try {
      if (!QrCtor) throw new Error("QRCode 未載入");
      container.innerHTML = "";
      new QrCtor(container, {
        text: payload,
        width: 340,
        height: 340,
        correctLevel: QrCtor.CorrectLevel?.M ?? 0
      });
    } catch (err) {
      console.error("正式列印 QR 產生失敗", payload, err);
      container.innerHTML = `<div class="qr-fallback">二維碼產生失敗<br><strong>${escapeHtml(payload)}</strong></div>`;
      setError("部分二維碼產生失敗，請檢查 qrcode.min.js。");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const printButton = document.getElementById("printPageBtn");
  if (printButton) printButton.addEventListener("click", () => window.print());
  Promise.resolve().then(renderPages);
});
