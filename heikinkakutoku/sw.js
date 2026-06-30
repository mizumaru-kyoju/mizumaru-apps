// sw.js — AT平均獲得枚数（TY）計算・記録アプリ用 Service Worker
// スコープ：/heikinkakutoku/ 配下のみ

const CACHE_VERSION = 'heikinkakutoku-v1';
const CACHE_NAME = CACHE_VERSION;

// オフラインでも開けるようにしておくファイル（アプリの外枠部分）
const PRECACHE_URLS = [
  '/heikinkakutoku/',
  '/heikinkakutoku/index.html',
  '/heikinkakutoku/guide.html',
  '/heikinkakutoku/manifest.json',
  '/heikinkakutoku/logo.png',
  '/heikinkakutoku/icon-192.png',
  '/heikinkakutoku/icon-512.png',
  '/heikinkakutoku/icon-maskable-192.png',
  '/heikinkakutoku/icon-maskable-512.png'
];

// 広告（AdSense）関連は常にネットワーク経由とし、絶対にキャッシュしない
function isAdRequest(url) {
  return (
    url.includes('googlesyndication.com') ||
    url.includes('doubleclick.net') ||
    url.includes('googleadservices.com') ||
    url.includes('adsbygoogle') ||
    url.includes('pagead')
  );
}

// インストール時：アプリ本体・ガイドをあらかじめキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 有効化時：古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// リクエスト時の振り分け
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // GET以外（POST等）はそのまま素通り
  if (req.method !== 'GET') return;

  // 広告関連リクエストはキャッシュを一切介さず、常にネットワークから取得
  if (isAdRequest(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // 他サイト（外部CDN・フォント等）は素通り（キャッシュもしない）
  if (!url.startsWith(self.location.origin)) {
    return;
  }

  // ページ遷移（index.html / guide.html を開く動作）
  // → まずネットワークを試し、最新版を表示。
  //   オフライン等で失敗した場合のみキャッシュ済みのページを表示する。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/heikinkakutoku/index.html'))
        )
    );
    return;
  }

  // それ以外の同一オリジンの静的リソース（アイコン等）
  // → キャッシュ優先、裏側で最新版に更新（stale-while-revalidate）
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
