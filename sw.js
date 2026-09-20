// ScoreMate 最小限のService Worker（PWA要件を満たすためのもの）
// キャッシュ戦略は持たず、常にネットワークから取得する
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', () => {
  // 何もしない（素通し）。PWA判定に必要な最低限の登録のみ。
});
