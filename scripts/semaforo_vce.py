#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
El semáforo de privacidad del Repositorio de Vibe Coding Educativo, al día (ADR 0006).

Cada noche, en el NAS:
  1. lee la hoja del repositorio (su CSV publicado);
  2. inspecciona en el navegador las aplicaciones nuevas, las que han cambiado de enlace y las
     que la última vez no se abrieron (con --todas, todas: una vez por semana);
  3. olvida las que ya no están en el repositorio;
  4. rehace datos/vce-evaluadas.json, la lista que enseña la guía;
  5. escribe en la hoja el semáforo, el motivo y la fecha de las filas que cambian, con la
     acción «semaforos» de la API del repositorio (api.gs, ADR 0002 de app_edu).

Lo que inspecciona se guarda en datos/auditoria-vce.json para no repetirlo cada noche.
Subir los cambios a GitHub lo hace nas/noche.sh.

Uso:
    python3 scripts/semaforo_vce.py [--todas] [--sin-hoja] [--credencial RUTA] [--datos CARPETA]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from auditar_vce import auditar, cargar_csv, normalizar_url
from generar_vce import generar

RAIZ = Path(__file__).resolve().parent.parent
COLS_HOJA = ("Semáforo de privacidad", "Motivo del semáforo", "Fecha del semáforo")
CRED_POR_DEFECTO = Path(os.environ.get("CATALOGO_CRED", Path.home() / ".config/credenciales/catalogo-vce.json"))


def leer_json(ruta: Path, por_defecto):
    return json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else por_defecto


def escribir_json(ruta: Path, datos) -> None:
    tmp = ruta.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(ruta)


def fallida(r: dict) -> bool:
    http = r.get("http_status", 0)
    return bool(r.get("error")) or http == 0 or http >= 500


def llamar_api(cred: Path, accion: str, **datos) -> dict:
    c = json.loads(cred.read_text())
    cuerpo = json.dumps({"clave": c["clave"], "accion": accion, **datos}).encode()
    pet = urllib.request.Request(c["url"], cuerpo, {"Content-Type": "application/json"})
    with urllib.request.urlopen(pet, timeout=120) as r:
        res = json.load(r)
    if res.get("error"):
        raise RuntimeError(f"API del repositorio: {res['error']}")
    return res


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--todas", action="store_true", help="volver a inspeccionar todas las aplicaciones")
    ap.add_argument("--sin-hoja", action="store_true", help="no escribir en la hoja del repositorio")
    ap.add_argument("--credencial", type=Path, default=CRED_POR_DEFECTO, help="clave de la API del repositorio")
    ap.add_argument("--concurrencia", type=int, default=3)
    ap.add_argument("--datos", type=Path, default=RAIZ / "datos",
                    help="carpeta datos/ donde leer y escribir (en el NAS, la del clon que se publica)")
    args = ap.parse_args()
    DATOS = args.datos
    AUDITORIA = DATOS / "auditoria-vce.json"
    SALIDA = DATOS / "vce-evaluadas.json"

    apps = cargar_csv()
    if len(apps) < 100:  # una hoja vacía o a medias no debe vaciar la guía
        print(f"La hoja solo trae {len(apps)} aplicaciones: no sigo.", file=sys.stderr)
        return 2

    previa = leer_json(AUDITORIA, {"resultados": []})
    por_url = {normalizar_url(r["url"]): r for r in previa.get("resultados", [])}

    pendientes, resultados = [], {}
    for a in apps:
        n = normalizar_url(a["url"])
        r = por_url.get(n)
        if args.todas or r is None or fallida(r):
            pendientes.append(a)
        else:
            # La ficha (título, autor, licencia…) puede haber cambiado sin cambiar la aplicación.
            r.update({k: v for k, v in a.items() if k != "hoja"})
            resultados[n] = r

    print(f"{len(apps)} aplicaciones en el repositorio; inspecciono {len(pendientes)}.")
    if pendientes:
        for r in asyncio.run(auditar(pendientes, args.concurrencia)):
            resultados[normalizar_url(r["url"])] = r
    retiradas = sorted(set(por_url) - {normalizar_url(a["url"]) for a in apps})

    aud = {
        "fecha": date.today().isoformat(),
        "total": len(apps),
        "resultados": [resultados[normalizar_url(a["url"])] for a in apps],
    }
    escribir_json(AUDITORIA, aud)

    guia = leer_json(DATOS / "guia-intef.json", None)
    enlaces = leer_json(DATOS / "enlaces-herramientas.json", None)
    anterior = leer_json(SALIDA, {"herramientas": []})
    salida, resumen = generar(aud, guia, enlaces)
    # Sin cambios reales, el archivo no cambia (la fecha de la cabecera sale de las inspecciones).
    escribir_json(SALIDA, salida)

    # Cambios de color, para el registro
    antes = {normalizar_url(h["url"]): "/".join(dict.fromkeys(e["semaforo"] for e in h["escenarios"]))
             for h in anterior.get("herramientas", [])}
    cambios = []
    for a in apps:
        n = normalizar_url(a["url"])
        nuevo = resumen[a["url"]]["semaforo"]
        if n in antes and antes[n] != nuevo:
            cambios.append(f"  {antes[n]} → {nuevo}: {a['titulo']} ({a['url']})")
    print(f"Semáforo: {dict(Counter(x['semaforo'] for x in resumen.values()))}")
    print(f"Retiradas del repositorio: {len(retiradas)}")
    if cambios:
        print("Cambios de color:\n" + "\n".join(cambios))

    if args.sin_hoja:
        return 0
    # A la hoja, solo las filas cuyo valor cambia
    filas = []
    for a in apps:
        x = resumen[a["url"]]
        actual = tuple((a["hoja"].get(c) or "").strip() for c in COLS_HOJA)
        nuevo = (x["semaforo"], x["motivo"], x["fecha"])
        if actual != nuevo:
            filas.append({"url": a["url"], "semaforo": x["semaforo"], "motivo": x["motivo"], "fecha": x["fecha"]})
    if filas:
        res = llamar_api(args.credencial, "semaforos", filas=filas)
        print(f"Hoja: {res.get('cambiadas', 0)} filas cambiadas; sin fila: {len(res.get('sin_fila', []))}.")
    else:
        print("Hoja: nada que cambiar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
