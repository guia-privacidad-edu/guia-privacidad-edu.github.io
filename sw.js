// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Service worker para consulta sin conexión de la Guía de privacidad de herramientas educativas.
 * Precarga la aplicación y los dos archivos JSON locales; actualiza en segundo plano cuando hay red.
 */

const CACHE_NOMBRE = "gpe-v1.1.0";
const ARCHIVOS_BASE = [
  "./",
  "./index.html",
  "./privacidad.html",
  "./estilos.css",
  "./i18n.js",
  "./app.js",
  "./favicon.svg",
  "./manifest.webmanifest",
  "./datos/guia-intef.json",
  "./datos/enlaces-herramientas.json"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NOMBRE).then((cache) => cache.addAll(ARCHIVOS_BASE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(
        claves.filter((c) => c !== CACHE_NOMBRE).map((c) => caches.delete(c))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  if (ev.request.method !== "GET") return;
  const url = new URL(ev.request.url);
  if (url.origin !== self.location.origin) return;

  // Estrategia stale-while-revalidate para los recursos locales
  ev.respondWith(
    caches.open(CACHE_NOMBRE).then(async (cache) => {
      const enCache = await cache.match(ev.request, { ignoreSearch: url.pathname === "/" || url.pathname.endsWith("/index.html") });
      const deRed = fetch(ev.request)
        .then((resp) => {
          if (resp && resp.ok) {
            cache.put(ev.request, resp.clone());
          }
          return resp;
        })
        .catch(() => null);
      return enCache || (await deRed) || Response.error();
    })
  );
});
