// ScoreMate Service Worker
// オフライン対応：アプリ本体（index.html/manifest.json/アイコン）と、
// PDF化・画像補正・並び替え・ZIP出力に必須のCDNライブラリをキャッシュし、
// ネットに繋がっていなくても起動・利用できるようにする。
//
// クラウド同期（Google Drive/Dropbox）、AI読み取り（Gemini）、YouTube動画再生、
// Googleサインインは、その機能を使う場面でのみ通信が必要な「オンライン専用機能」
// のため、意図的にキャッシュ対象外にしている（オフライン時はその操作だけ失敗する）。

const CACHE_VERSION = 'scoremate-v1';

// 同一オリジン：アプリ本体一式
const APP_SHELL_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 別オリジン：アプリの基本機能に必須のCDNライブラリ（すべてバージョン固定URLなので、
// 一度キャッシュした内容がそのURLのまま変わることはない）
const VENDOR_URLS = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.9.0-release.1/dist/opencv.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // アプリ本体は1つでも取得に失敗したらinstall自体を失敗させる
      return cache.addAll(APP_SHELL_URLS).then(() =>
        // CDNライブラリは個別に取得し、1つ失敗しても他のキャッシュは諦めない
        Promise.all(
          VENDOR_URLS.map((url) =>
            fetch(url, { mode: 'no-cors' })
              .then((res) => cache.put(url, res))
              .catch(() => {})
          )
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isSameOrigin = new URL(req.url).origin === self.location.origin;
  const isVendor = VENDOR_URLS.includes(req.url);

  if (isSameOrigin) {
    // アプリ本体：オンライン時は常に最新を取得してキャッシュを更新し、
    // 取得できない時（オフライン）はキャッシュを使う。
    // ネットには繋がったが正常なページでない場合（ホスティング側の障害・利用停止時の
    // エラーページ等）は、その内容でキャッシュを上書きせず、既存の正常なキャッシュが
    // あればそちらを優先する。
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
            return res;
          }
          return caches.match(req).then((cached) => cached || res);
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
  } else if (isVendor) {
    // バージョン固定のCDNライブラリ：キャッシュ優先（内容が変わらない前提）
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        });
      })
    );
  }
  // それ以外（Google/Dropbox API、YouTube、Geminiなど）は素通し。何もしない。
});
