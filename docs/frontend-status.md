# TURBOX 前台還原狀態

參考來源：<https://turbox.club>，2026-09-18。這份文件記錄實際覆蓋範圍，不能作為像素級 1:1 驗收通過的聲明。

## 已實作

- 共用頁頭、頁腳、手機底部導覽、客服入口與歡迎禮物彈窗。
- 首頁精選盲盒輪播、四張活動橫幅、熱門盲盒、排行榜、免費福利。
- 36 款盲盒的原站名稱、價格與本地圖片；搜尋、分類、標籤、價格範圍、排序、清除篩選及空結果。
- 36 個可直接存取與重新整理的詳情路由。
- 免費模式的 18 款金幣盲盒、本地圖片、金幣價格、模式切換及獨立詳情路由。
- Cozy Christmas 的 18 件公開物品、圖片、概率與說明。
- Everyday Sync、One Piece Voyage、Next-Gen Discovery 的公開物品、圖片與概率。
- 詳情數量選擇、音效與极速開箱開關、分享、物品資訊、相關盲盒。
- 8 個 VIP 福利卡片與未登入提示。
- 公開排行榜與本期／上期切換、活動資訊彈窗。
- 郵箱註冊、密碼登入、登出、會話保持、忘記密碼與一次性密碼重置，已接入本專案 API。
- 受保護的基本帳戶頁；完整原站個人中心仍待還原。
- 手機自適應與原生 dialog 的焦點限制、Escape 關閉。

## 尚待還原與驗收

- 其餘 33 款消費盲盒及 17 款金幣盲盒的完整物品清單與說明，頁面已明示缺少資料。
- 排行榜背景、月桂與台階圖、原站 Barlow 字體。原站資源端點下載返回 403，部分瀏覽器素材打包亦因 MIME 類型而失敗；目前使用 CSS 與系統字體回退。
- 完整法律／政策文章、語言選單與活動彈窗詳細內容。
- 社群連結已接上原站公開地址；客服仍為預覽入口，沒有發送外部訊息。
- 仍需逐頁進行桌面與手機的像素對照，不能稱為完整 1:1 複刻。

公開頁面之後已開始 Authentication 階段，帳戶資料會送至本專案 API，資料庫保存郵箱與密碼雜湊。郵箱驗證、Google OAuth、空投、背包、完整個人中心、開箱、付款、配送、提現與即時排行榜尚未完成；沒有真實抽獎與交易。詳見 [認證說明](authentication.md)。

## 開發

```sh
pnpm --filter @box/web dev
pnpm check
```

本機若 Playwright 的 Chromium 無法啟動，可在 PowerShell 使用已安裝的 Chrome：

```powershell
$env:PLAYWRIGHT_CHANNEL='chrome'
pnpm check
```

`apps/web/src/data/reference.json` 與 `details.json` 僅保留為歷史來源快照；目錄运行時從 PostgreSQL 經 API 讀取，金額採整數 minor units，展示概率不作為開獎配置。`apps/web/public/reference` 是公開頁面素材快照。API 和 Prisma 已擴展認證與 Catalog 查詢服務；Worker 仍只有基礎設施任務。
