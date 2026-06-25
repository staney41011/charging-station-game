function yesNo(ok, yes = "已載入", no = "未載入") {
  return ok ? yes : no;
}

function row(label, value, ok = true) {
  return `
    <div class="row">
      <span>${label}</span>
      <span class="pill ${ok ? "" : "danger"}">${value}</span>
    </div>
  `;
}

function renderHealth() {
  const firebaseConfigLoaded = typeof window.firebaseConfig !== "undefined";
  const qrLoaded = typeof QRCode !== "undefined" || typeof window.QRCode !== "undefined";
  const scannerLoaded = typeof Html5Qrcode !== "undefined" || typeof window.Html5Qrcode !== "undefined";
  const databaseAvailable = typeof firebase !== "undefined" && !!firebase.database;
  const html = [
    row("Firebase config", yesNo(firebaseConfigLoaded), firebaseConfigLoaded),
    row("QRCode 產生器", yesNo(qrLoaded), qrLoaded),
    row("Html5Qrcode 掃描器", yesNo(scannerLoaded), scannerLoaded),
    row("firebase.database", yesNo(databaseAvailable, "可用", "不可用"), databaseAvailable),
    row("vendor/qrcode.min.js 路徑", "vendor/qrcode.min.js", true),
    row("vendor/html5-qrcode.min.js 路徑", "vendor/html5-qrcode.min.js", true)
  ].join("");
  document.getElementById("healthList").innerHTML = html;
}

document.addEventListener("DOMContentLoaded", renderHealth);
