/**
 * Service Worker do Agenda-docas.
 *
 * Objetivos:
 * 1. Qualificar o app como PWA instalável "rica" — Android/Chrome só cria um
 *    WebAPK dedicado (janela própria, sem barra do navegador) quando o site
 *    registra um service worker com fetch handler.
 * 2. App shell offline: em caso de falha de rede, serve o index.html em cache
 *    para que o app abra (os dados carregam via API quando a conexão voltar).
 *
 * Estratégia de cache conservadora: NADA de dados dinâmicos em cache —
 * apenas o shell (index.html + assets estáticos imutáveis do Vite).
 */

const CACHE_NAME = 'agenda-docas-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Nunca intercepta chamadas de API (dados sempre frescos; offline mostra erro normal).
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Assets do Vite são imutáveis (hash no nome): cache-first.
  if (url.origin === self.location.origin && /^\/assets\//.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navegações: rede primeiro; offline cai para o shell em cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
  }
});
