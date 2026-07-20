// Hit & Blow Analyzer - Service Worker
// 既存アプリ（/boheikin/, /heikinkakutoku/）と同じ設計方針に準拠

const CACHE_VERSION = 'hb-analyzer-v1';
const CACHE_NAME = CACHE_VERSION;

// キャッシュ対象ファイル（インストール時に事前キャッシュ）
const PRECACHE_URLS = [
  '/hb-analyzer/',
  '/hb-analyzer/index.html',
  '/hb-analyzer/guide.html',
  '/hb-analyzer/manifest.json',
  '/hb-analyzer/icon-192.png',
  '/hb-analyzer/icon-512.png',
  '/hb-analyzer/icon-maskable-192.png',
  '/hb-analyzer/icon-maskable-512.png',
];

// 広告リクエスト判定（現時点では広告未導入のため常にfalse。将来導入時に条件を追記する）
function isAdRequest(url) {
  // 例: return url.hostname.includes('googlesyndication') || url.hostname.includes('doubleclick');
  return false;
}

// インストール：事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('hb-analyzer-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// フェッチ：リクエスト種別ごとに戦略を切り替える
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GET以外は素通り
  if (event.request.method !== 'GET') return;

  // 外部ドメインは素通り
  if (url.origin !== self.location.origin) return;

  // 広告リクエストは常にネットワーク直行
  if (isAdRequest(url)) return;

  // ページ遷移（navigate）はネットワーク優先
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 同一オリジンの静的リソースはstale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
        return cached || networkFetch;
      })
    )
  );
});
