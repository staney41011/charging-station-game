# 活動籌備挑戰｜國高中班 Firebase MVP

這是一套使用 Firebase Hosting 與 Realtime Database 的現場互動遊戲。玩家扮演活動籌備成員，透過掃描工作 QR 累積任務進度，完成三輪活動任務後，全場共同完成最終大型活動。

## 頁面

- `index.html`：入口總覽
- `player.html`：玩家入口與掃碼操作
- `team.html`：組別戰情輔助頁
- `display.html`：投影幕畫面
- `admin.html`：主持人後台
- `rules.html`：遊戲規則與玩家入口 QR
- `print.html`：二維碼測試頁
- `qr-print-a4.html`：正式列印二維碼，一頁一個 QR
- `health.html`：系統檢查頁

## 國高中班玩法重點

- 主持人可在 `admin.html` 設定開放組數與每組人數，預設 8 組、每組 16 人，最多支援 15 組。
- 遊戲分為三輪活動任務，每輪約 10 分鐘。
- 每組每輪會隨機取得一個活動任務，任務需求明細不公開，只顯示完成百分比。
- 玩家一次只能攜帶一筆工作記錄。
- 玩家先掃工作小組 QR，例如 `WORK:activity`，再掃任務交付處 QR，例如 `DELIVERY:team1`。
- 本組任務完成 100% 後，才可以支援其他組。
- 三輪後開啟最終大型活動：`白陽祖師傳道120週年紀念大會`，交付到 `FINAL:MAIN`。
- 玩家有個人熟練度，每次交付某類工作後，該類熟練度會提升，下次同類工作貢獻更高。
- 九種工作熟練度均衡提升時，會有額外加成。
- 玩家可能進入負面狀態：補眠、體力透支、不想工作、跟夥伴吵架。
- 負面狀態需要不同玩家掃 `RESCUE:{玩家代號}` 協助，所需人數依狀態隨機。
- 主持人可觸發「無明來襲」，全場掃 `KOUQIU:MAIN` 累積 100 到 1000 次叩求後通過。

## 活動前快速流程

1. 開啟 `admin.html`。
2. 設定開放組數與每組人數。
3. 按「建立遊戲與組別」。
4. 開啟 `display.html` 投影。
5. 開啟 `qr-print-a4.html` 列印 QR。
6. 用手機開 `player.html` 測試加入玩家。
7. 按「遊戲開始」。
8. 按「開始第 1 輪」，測試掃 `WORK:*` 與 `DELIVERY:team*`。
9. 測試隨機負面狀態與救援 QR。
10. 測試「無明來襲」與 `KOUQIU:MAIN`。
11. 測試最終大型活動與 `FINAL:MAIN`。

## QR 說明

- `print.html` 是測試用二維碼頁。
- `qr-print-a4.html` 是正式列印頁，一頁一個 QR。
- 正式列印新版包含：
  - 玩家入口 1 張
  - 工作小組 9 張
  - 第 1 組到第 15 組任務交付處 15 張
  - 大型任務交付處 1 張
  - 叩求點 1 張
- 共 27 頁。
- 若 QR 圖沒有出現，請檢查 `public/vendor/qrcode.min.js` 是否存在。
- 掃描器使用 `public/vendor/html5-qrcode.min.js`，現場不依賴外部 CDN。

## 相機提醒

- 玩家請使用 Chrome 或 Safari 開啟玩家頁。
- 不建議使用 LINE、Facebook、Instagram 內建瀏覽器。
- 第一次掃描時要允許相機權限。
- 如果相機沒有跳出，先按「測試相機」確認瀏覽器是否能開相機。
- 若仍失敗，才使用手動輸入 QR 代碼作為備援。

## 分支切換

- `live-version`：上一版現場穩定版。
- `codex/國高中班`：國高中班大改版開發分支。

切到國高中班版本：

```powershell
git checkout codex/國高中班
firebase deploy
```

切回現場穩定版：

```powershell
git checkout live-version
firebase deploy
```
