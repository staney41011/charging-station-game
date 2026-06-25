# 《充電站營業中》Firebase MVP

這是一套適合現場活動的 Firebase Realtime Database 小遊戲。
主持人可用後台初始化、開始遊戲、自訂魔王、投影排行與列印二維碼。

## 主要頁面

- `index.html`：入口頁
- `player.html`：玩家入口
- `team.html`：店長頁
- `display.html`：投影幕畫面
- `admin.html`：主持人後台
- `print.html`：二維碼測試頁
- `qr-print-a4.html`：正式列印用二維碼頁

## 開始使用

1. 填入 `public/firebase-config.js`
2. 部署 Firebase Hosting 與 Realtime Database
3. 打開 `admin.html` 初始化遊戲
4. 打開 `display.html` 投影
5. 打開 `qr-print-a4.html` 列印正式 QR

## 重要提醒

- `print.html` 是測試用二維碼頁
- `qr-print-a4.html` 是正式列印頁，一頁一個 QR，共 17 頁
- QR 產生器已本地化，使用 `public/vendor/qrcode.min.js`
- QR 掃描器已本地化，使用 `public/vendor/html5-qrcode.min.js`
- 若相機沒有觸發，請先用 `player.html` 的「直接測試相機權限」判斷是瀏覽器問題還是掃描器問題
- 若權限曾被拒絕，請重新整理頁面或清除網站權限

## 現場前 10 分鐘測試流程

1. 開 `admin.html`
2. 輸入總人數並建立 6 組
3. 開 `display.html` 投影
4. 開 `qr-print-a4.html` 確認 QR 正常後列印
5. 兩支手機加入不同玩家
6. 測試掃材料
7. 測試交付自己組倉庫
8. 測試交付別組倉庫
9. 測試打魔王
10. 測試中央電塔交付
11. 測試隨機沒電
12. 測試 5 人救援
13. 測試回到遊戲

## 主持人 60 分鐘現場操作流程

請參考 [HOST_CHEATSHEET.md](./HOST_CHEATSHEET.md)
