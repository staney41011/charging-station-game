# 《充電站營業中》Firebase MVP

這是一套使用 Firebase Hosting 與 Realtime Database 的現場互動遊戲。新版支援最多 15 組，主持人可以在遊戲開始前設定「本次開放幾組」與「每組幾個人」。

## 頁面

- `index.html`：入口總覽
- `player.html`：玩家入口與掃碼操作
- `team.html`：店長指揮台
- `display.html`：投影幕畫面
- `admin.html`：主持人後台
- `print.html`：二維碼測試頁
- `qr-print-a4.html`：正式列印二維碼，一頁一個 QR
- `health.html`：系統檢查頁

## 新版重點

- 預設支援 15 組。
- 主持人可在 `admin.html` 設定開放組數與每組人數。
- 玩家加入時只會看到本次開放的組別與名額。
- 店長頁只顯示本次開放的組別。
- 投影畫面只保留現場需要資訊：遊戲狀態、全場訊息、任務/魔王、沒電玩家、排行榜。
- 正式列印頁含 15 組倉庫 QR，共 26 頁。

## 活動前快速流程

1. 開啟 `admin.html`。
2. 設定開放組數與每組人數。
3. 按「建立遊戲與組別」。
4. 開啟 `display.html` 投影。
5. 開啟 `qr-print-a4.html` 列印 QR。
6. 用手機開 `player.html` 測試加入玩家。
7. 測試掃材料、交付倉庫、交付中央電塔、救援沒電玩家。
8. 確認沒問題後按「遊戲開始」。

## QR 說明

- `print.html` 是測試用二維碼頁。
- `qr-print-a4.html` 是正式列印頁，一頁一個 QR。
- 正式列印新版包含：
  - 玩家入口 1 張
  - 材料站 9 張
  - 第 1 組到第 15 組倉庫 15 張
  - 中央電塔 1 張
- 若 QR 圖沒有出現，請檢查 `public/vendor/qrcode.min.js` 是否存在。
- 掃描器使用 `public/vendor/html5-qrcode.min.js`，現場不依賴外部 CDN。

## 相機提醒

- 玩家請使用 Chrome 或 Safari 開啟玩家頁。
- 不建議使用 LINE、Facebook、Instagram 內建瀏覽器。
- 第一次掃描時要允許相機權限。
- 如果相機沒有跳出，先按「測試相機」確認瀏覽器是否能開相機。
- 若仍失敗，才使用手動輸入 QR 代碼作為備援。

## 分支切換

- `live-version`：目前保留的現場穩定版。
- `new-version`：開發與新版測試分支。

切到新版：

```powershell
git checkout new-version
firebase deploy
```

切回現場穩定版：

```powershell
git checkout live-version
firebase deploy
```
