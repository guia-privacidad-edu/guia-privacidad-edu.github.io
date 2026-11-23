#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Resuelve y verifica las URLs de acceso directo de las herramientas extraídas en
datos/guia-intef.json y guarda el resultado en datos/enlaces-herramientas.json.

Estrategia por capas (siempre con verificación HTTP real):
  1. Enlace directo en la columna «Otros» del PDF (GPTs, extensiones, URLs concretas).
  2. Catálogo oficial de proveedores con muchas herramientas (ej. ladigitale.dev).
  3. Raíz del dominio de la política de privacidad cuando el dominio es propio de la herramienta.
  4. Informe exacto de pendientes / fallos para resolución dirigida.

Uso:
    python3 scripts/buscar_urls.py datos/guia-intef.json datos/enlaces-herramientas.json
"""

from __future__ import annotations

import concurrent.futures
import html
import json
import re
import ssl
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any

# Dominios compartidos por múltiples productos cuya raíz NO identifica una herramienta concreta
DOMINIOS_COMPARTIDOS = {
    "policies.google.com",
    "support.google.com",
    "accounts.google.com",
    "safety.google",
    "privacy.google.com",
    "ladigitale.dev",
    "www.microsoft.com",
    "privacy.microsoft.com",
    "microsoft.com",
    "www.adobe.com",
    "adobe.com",
    "openai.com",
    "www.openai.com",
    "musely.ai",
    "www.musely.ai",
    "www.yeschat.ai",
    "yeschat.ai",
    "decopy.ai",
    "www.decopy.ai",
    "plagiarismdetector.net",
    "www.plagiarismdetector.net",
    "www.apple.com",
    "apple.com",
    "github.com",
    "docs.github.com",
    "sourceforge.net",
    "slashdotmedia.com",
    "www.mozilla.org",
    "mozilla.org",
    "wikimedia.org",
    "foundation.wikimedia.org",
    "www.wikimedia.org",
    "automattic.com",
    "www.autodesk.com",
    "autodesk.com",
    "www.tinkercad.com",
    "www.dropbox.com",
    "www.meta.com",
    "facebook.com",
    "www.facebook.com",
    "www.amazon.com",
    "aws.amazon.com",
    "www.ibm.com",
    "www.oracle.com",
    "www.sony.com",
    "www.bbc.co.uk",
    "www.nasa.gov",
    "nasa.gov",
    "www.esa.int",
    "www.gnu.org",
    "www.fsf.org",
    "kde.org",
    "gnome.org",
    "wiki.gnome.org",
    "www.apache.org",
    "www.eclipse.org",
    "www.jetbrains.com",
    "www.canva.com",
    "www.cloudflare.com",
    "www.iubenda.com",
    "termly.io",
    "www.freeprivacypolicy.com",
    "www.privacypolicies.com",
    "www.termsfeed.com",
    "sites.google.com",
    "docs.google.com",
    "drive.google.com",
    "play.google.com",
    "apps.apple.com",
    "creativecommons.org",
    "intef.es",
    "www.educacionyfp.gob.es",
    "www.educacionfpydeportes.gob.es",
    "www.aepd.es",
    "eur-lex.europa.eu",
}

PATRONES_URL_NO_APP = re.compile(
    r"(privacy|privacidad|confidentialite|legal|terms|terminos|cookie|gdpr|rgpd|"
    r"centro-de-ayuda|help\.|support\.|/help/|/docs/|/blog/|/video/|youtube\.com|youtu\.be|"
    r"wikipedia\.org|licen[cs]|dpa|security|accessibility|accesibilidad|vpat)",
    re.I,
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def obtener_pagina(url: str, timeout: int = 10) -> tuple[int, str, str]:
    """Devuelve (codigo_http, url_final, titulo_html)."""
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            status = getattr(resp, "status", 200) or 200
            final_url = resp.geturl()
            raw = resp.read(65536)
            charset = resp.headers.get_content_charset() or "utf-8"
            try:
                text = raw.decode(charset, errors="ignore")
            except LookupError:
                text = raw.decode("utf-8", errors="ignore")
            m = re.search(r"<title[^>]*>(.*?)</title>", text, re.I | re.S)
            titulo = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else ""
            return status, final_url, titulo[:160]
    except urllib.error.HTTPError as e:
        return e.code, getattr(e, "url", url) or url, ""
    except Exception:
        return 0, url, ""


def cargar_catalogo_ladigitale() -> dict[str, str]:
    """Obtiene el índice de herramientas de ladigitale.dev directamente de su portada."""
    mapa: dict[str, str] = {}
    ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request("https://ladigitale.dev/", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            html_txt = resp.read().decode("utf-8", errors="ignore")
        # Buscar enlaces internos de herramientas: href="https://ladigitale.dev/digipad/" o href="/digipad/"
        for m in re.finditer(r'href=["\'](https?://ladigitale\.dev/([a-z0-9_-]+)/?)["\']', html_txt, re.I):
            full_url, slug = m.group(1), m.group(2).lower()
            if slug not in ("confidentialite", "contact", "mentions", "soutenir", "assets", "blog"):
                mapa[norm(slug)] = full_url if full_url.endswith("/") else full_url + "/"
        for m in re.finditer(r'href=["\'](https?://([a-z0-9-]+)\.ladigitale\.dev/?)["\']', html_txt, re.I):
            mapa[norm(m.group(2))] = m.group(1)
    except Exception as exc:
        print(f"Aviso al leer ladigitale.dev: {exc}", file=sys.stderr)
    return mapa


def elegir_candidato(
    h: dict[str, Any],
    dominios_freq: Counter[str],
    mapa_ladigitale: dict[str, str],
) -> tuple[str | None, str]:
    """Devuelve (url_candidata, origen) o (None, 'pendiente')."""
    nombre = h["nombre"]
    nombre_norm = norm(nombre)
    nombre_base = norm(re.sub(r"\s*\([^)]*\)", "", nombre))

    # Recoger todos los enlaces de todos los escenarios
    enlaces_otros: list[str] = []
    enlaces_priv: list[str] = []
    for esc in h.get("escenarios", []):
        enlaces_otros.extend(esc.get("enlaces_otros", []))
        enlaces_priv.extend(esc.get("enlaces_privacidad", []))

    # 1. Enlace directo en la columna OTROS (descartando ayuda, políticas, licencias, wikipedia)
    for u in enlaces_otros:
        if not u.startswith(("http://", "https://")):
            continue
        if PATRONES_URL_NO_APP.search(u):
            continue
        return u, "pdf-otros"

    # 2. Catálogo de La Digitale si su privacidad apunta a ladigitale.dev
    if any("ladigitale.dev" in u for u in enlaces_priv):
        for clave in (nombre_norm, nombre_base):
            if clave in mapa_ladigitale:
                return mapa_ladigitale[clave], "catalogo-ladigitale"
        # Muchos slugs de ladigitale coinciden exactamente con el nombre en minúsculas (digixxx, logixxx)
        slug_simple = re.sub(r"[^a-z0-9]+", "", nombre_base)
        if slug_simple.startswith(("digi", "logi")):
            return f"https://ladigitale.dev/{slug_simple}/", "catalogo-ladigitale-patron"

    # 3. Raíz del dominio de la política de privacidad si el dominio NO es compartido
    for u in enlaces_priv:
        if not u.startswith(("http://", "https://")):
            continue
        parsed = urllib.parse.urlparse(u)
        host = parsed.netloc.lower()
        if not host:
            continue
        if host in DOMINIOS_COMPARTIDOS:
            continue
        # Si el dominio aparece en > 3 herramientas diferentes, tratarlo como compartido para revisar
        if dominios_freq[host] > 3:
            continue
        # Si es subdominio tipo privacy.foo.com o legal.foo.com, subir al dominio principal
        host_limpio = re.sub(r"^(privacy|legal|policies|policy|docs|help|support|trust|security)\.", "", host)
        return f"https://{host_limpio}/", "pdf-dominio-privacidad"

    return None, "pendiente"


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: buscar_urls.py <datos/guia-intef.json> <datos/enlaces-herramientas.json>")
        return 1

    guia_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    guia = json.loads(guia_path.read_text(encoding="utf-8"))
    herramientas = guia["herramientas"]

    # Cargar existentes si ya había trabajo previo
    existentes: dict[str, Any] = {}
    if out_path.exists():
        prev = json.loads(out_path.read_text(encoding="utf-8"))
        existentes = prev.get("enlaces", {})

    # Frecuencia de dominios de privacidad
    dominios_freq: Counter[str] = Counter()
    for h in herramientas:
        hosts_h = set()
        for esc in h.get("escenarios", []):
            for u in esc.get("enlaces_privacidad", []):
                host = urllib.parse.urlparse(u).netloc.lower()
                if host:
                    hosts_h.add(host)
        for host in hosts_h:
            dominios_freq[host] += 1

    mapa_ladigitale = cargar_catalogo_ladigitale()
    print(f"Herramientas encontradas en ladigitale.dev: {len(mapa_ladigitale)}")

    candidatos: dict[str, tuple[str, str, str]] = {}
    pendientes: list[dict[str, Any]] = []

    for h in herramientas:
        hid = h["id"]
        if hid in existentes and existentes[hid].get("estado") == "verificado":
            continue
        url, origen = elegir_candidato(h, dominios_freq, mapa_ladigitale)
        if url:
            candidatos[hid] = (url, origen, h["nombre"])
        else:
            pendientes.append({"id": hid, "numero": h["numero"], "nombre": h["nombre"], "categoria": h["categoria"]})

    print(f"Candidatos automáticos a verificar: {len(candidatos)} | Pendientes directos: {len(pendientes)}")

    hoy = date.today().isoformat()
    resultados = dict(existentes)

    def tarea(item: tuple[str, tuple[str, str, str]]) -> tuple[str, dict[str, Any]]:
        hid, (url, origen, nombre) = item
        code, final_url, titulo = obtener_pagina(url)
        # Reintento con www si falló conexión en dominio sin www
        if code == 0 and not urllib.parse.urlparse(url).netloc.startswith("www."):
            p = urllib.parse.urlparse(url)
            alt = urllib.parse.urlunparse((p.scheme, "www." + p.netloc, p.path, p.params, p.query, p.fragment))
            c2, f2, t2 = obtener_pagina(alt)
            if c2 in (200, 301, 302, 403):
                code, final_url, titulo = c2, f2, t2
        estado = "verificado" if 200 <= code < 400 else ("bloqueado_bot" if code in (403, 429) else "revisar")
        return hid, {
            "nombre": nombre,
            "url": final_url if 200 <= code < 400 else url,
            "url_inicial": url,
            "origen": origen,
            "http": code,
            "titulo": titulo,
            "estado": estado,
            "comprobado": hoy,
        }

    ok = 0
    bot = 0
    rev = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        for i, (hid, info) in enumerate(pool.map(tarea, candidatos.items()), 1):
            resultados[hid] = info
            if info["estado"] == "verificado":
                ok += 1
            elif info["estado"] == "bloqueado_bot":
                bot += 1
            else:
                rev += 1
            if i % 100 == 0 or i == len(candidatos):
                print(f"  Verificadas {i}/{len(candidatos)} -> ok={ok}, 403/429={bot}, revisar={rev}")

    salida = {
        "actualizado": hoy,
        "total_herramientas": len(herramientas),
        "verificados": sum(1 for v in resultados.values() if v.get("estado") == "verificado"),
        "bloqueados_bot": sum(1 for v in resultados.values() if v.get("estado") == "bloqueado_bot"),
        "por_revisar": sum(1 for v in resultados.values() if v.get("estado") == "revisar"),
        "pendientes_count": len(pendientes),
        "enlaces": resultados,
        "pendientes": pendientes,
    }
    out_path.write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGuardado {out_path}")
    print(
        f"Resumen: verificados={salida['verificados']}, 403/429={salida['bloqueados_bot']}, "
        f"revisar={salida['por_revisar']}, pendientes={salida['pendientes_count']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
