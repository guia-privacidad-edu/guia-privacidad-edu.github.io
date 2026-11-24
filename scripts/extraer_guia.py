#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Extrae los datos estructurados del PDF oficial del INTEF:
«Orientaciones sobre el uso de herramientas digitales en el ámbito educativo
desde la perspectiva de la protección de datos» (Versión 3.0, Junio 2026)
y genera datos/guia-intef.json con validación cruzada 1 a 1 contra el índice oficial.

Uso:
    uv run --with pdfplumber python3 scripts/extraer_guia.py \
        /ruta/al/Orientaciones_sobre_el_uso_de_herramientas_digital.pdf
"""

from __future__ import annotations

import difflib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pdfplumber
from pdfplumber.utils import extract_words

# Límites X de las 13 columnas del listado (páginas 19-199, apaisado 1190.5 x 841.9 pt)
COLUMNAS_X = [
    ("tipo", 28.0, 56.7),
    ("nombre", 56.7, 142.0),
    ("descripcion", 142.0, 262.3),
    ("software_libre", 262.3, 318.8),
    ("requiere_registro", 318.8, 411.1),
    ("otros", 411.1, 552.8),
    ("politica_privacidad", 552.8, 645.0),
    ("fecha_comprobacion", 645.0, 729.6),
    ("semaforo", 729.6, 793.1),
    ("profesorado", 793.1, 907.3),
    ("alumnado", 907.3, 1027.7),
    ("embebible", 1027.7, 1085.5),
    ("accesibilidad", 1085.5, 1170.5),
]

COLOR_NEGRO = {0.0, (0.0,), (0.0, 0.0, 0.0), (0, 0, 0)}


def unir_lineas_texto(texto: str) -> str:
    """Une saltos de línea artificiales dentro de una celda en texto fluido."""
    if not texto:
        return ""
    lineas = [re.sub(r"[ \t]+", " ", l).strip() for l in texto.split("\n") if l.strip()]
    resultado: list[str] = []
    for linea in lineas:
        if not resultado:
            resultado.append(linea)
            continue
        anterior = resultado[-1]
        if linea.startswith(("http://", "https://")):
            resultado.append(linea)
        elif re.search(r"https?://\S+$", anterior):
            # Continuación de URL partida por ajuste de columna
            if " " not in linea and (
                anterior.endswith(("/", "-", "_", ".", "?", "=", "&", "%"))
                or linea.startswith(("/", "-", "_", ".", "?", "=", "&"))
                or re.match(r"^[a-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$", linea, re.I)
            ):
                resultado[-1] = anterior + linea
            else:
                resultado.append(linea)
        else:
            resultado[-1] = anterior + " " + linea
    return "\n".join(resultado).strip()


def normalizar_clave(texto: str) -> str:
    """Clave normalizada para emparejar nombres entre tabla e índice."""
    s = unicodedata.normalize("NFKD", texto or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalizar_clave_estricta(texto: str) -> str:
    """Clave sin signos ni espacios extra para tolerar saltos de punto ('plastica. net')."""
    return re.sub(r"[^a-z0-9]+", "", normalizar_clave(texto))


def slugify(texto: str) -> str:
    """Genera un identificador seguro para URLs."""
    s = normalizar_clave(texto)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "herramienta"


def es_negro(color: Any) -> bool:
    if color is None:
        return False
    if color in COLOR_NEGRO:
        return True
    if isinstance(color, (tuple, list)) and all(c < 0.05 for c in color):
        return True
    return False


def obtener_enlaces_pagina(page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    """Extrae los hipervínculos reales (anotaciones URI) de la página con sus coordenadas."""
    enlaces = []
    for annot in page.annots or []:
        uri = annot.get("uri")
        if not uri:
            continue
        x0 = float(annot.get("x0", 0))
        x1 = float(annot.get("x1", 0))
        top = float(annot.get("top", 0))
        bottom = float(annot.get("bottom", 0))
        enlaces.append(
            {
                "uri": uri.strip(),
                "x0": x0,
                "x1": x1,
                "xc": (x0 + x1) / 2.0,
                "top": top,
                "bottom": bottom,
                "yc": (top + bottom) / 2.0,
            }
        )
    return enlaces


def extraer_texto_de_palabras(
    palabras_pagina: list[dict[str, Any]],
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    enlaces_pagina: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    """Extrae el texto limpio y las URLs únicas dentro de una caja usando las palabras ya extraídas."""
    sel = [
        w
        for w in palabras_pagina
        if x0 <= w["xc"] < x1 and y0 <= w["yc"] < y1
    ]
    if not sel:
        texto = ""
    else:
        sel.sort(key=lambda w: (w["top"], w["x0"]))
        lineas: list[list[dict[str, Any]]] = []
        for w in sel:
            if lineas and abs(w["top"] - lineas[-1][0]["top"]) <= 4.0:
                lineas[-1].append(w)
            else:
                lineas.append([w])
        partes = []
        for lin in lineas:
            lin.sort(key=lambda w: w["x0"])
            partes.append(" ".join(w["text"] for w in lin))
        texto = "\n".join(partes).strip()

    urls: list[str] = []
    vistas: set[str] = set()
    for enl in sorted(enlaces_pagina, key=lambda e: (round(e["top"], 1), e["x0"])):
        if x0 - 1.5 <= enl["xc"] <= x1 + 1.5 and y0 <= enl["yc"] < y1:
            if enl["uri"] not in vistas:
                vistas.add(enl["uri"])
                urls.append(enl["uri"])
    return texto, urls


def extraer_palabras_por_columna(page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    """Extrae las palabras de cada columna del listado por separado."""
    grupos: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for c in page.chars:
        xc = (c["x0"] + c["x1"]) / 2.0
        for i, (_, cx0, cx1) in enumerate(COLUMNAS_X):
            if cx0 <= xc < cx1:
                grupos[i].append(c)
                break
    palabras: list[dict[str, Any]] = []
    for i in sorted(grupos):
        palabras.extend(
            extract_words(grupos[i], x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
        )
    return palabras


def detectar_bordes_horizontales(page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    """
    Detecta los bordes horizontales negros de la tabla en la página.
    Devuelve una lista ordenada por Y con: y, minx, maxx, span.
    """
    segmentos_por_y: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for r in page.rects:
        alto = r["bottom"] - r["top"]
        ancho = r["x1"] - r["x0"]
        if alto < 2.2 and ancho > 10 and es_negro(r.get("non_stroking_color")):
            y_key = int(round(r["top"]))
            segmentos_por_y[y_key].append((r["x0"], r["x1"]))

    claves = sorted(segmentos_por_y.keys())
    grupos: list[list[int]] = []
    for y in claves:
        if grupos and y - grupos[-1][-1] <= 2:
            grupos[-1].append(y)
        else:
            grupos.append([y])

    bordes = []
    for g in grupos:
        segs = [s for y in g for s in segmentos_por_y[y]]
        segs.sort()
        unidos: list[list[float]] = []
        for x0, x1 in segs:
            if unidos and x0 <= unidos[-1][1] + 2.0:
                unidos[-1][1] = max(unidos[-1][1], x1)
            else:
                unidos.append([x0, x1])
        span = sum(b - a for a, b in unidos)
        minx = unidos[0][0]
        maxx = unidos[-1][1]
        # Ignorar el borde interno entre "¿QUIÉN?" y "PROFESORADO/ALUMNADO" (span ~ 233)
        if span > 350:
            bordes.append(
                {
                    "y": sum(g) / len(g),
                    "minx": minx,
                    "maxx": maxx,
                    "span": span,
                }
            )
    return bordes


def extraer_indice(pdf: pdfplumber.PDF) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Extrae el índice oficial de las páginas 211-237 (1.144 herramientas, 87 categorías)."""
    entradas: list[dict[str, Any]] = []
    cat_actual = ""
    subcat_actual: str | None = None

    for pno in range(211, len(pdf.pages) + 1):
        page = pdf.pages[pno - 1]
        mitad_x = page.width / 2.0
        chars = page.chars
        for col_idx in (0, 1):
            x_min = 0.0 if col_idx == 0 else mitad_x - 5
            x_max = mitad_x - 5 if col_idx == 0 else page.width
            # En la página 211 el título "CONTENIDO DEL LISTADO DE HERRAMIENTAS" ocupa top ~ 80-100 en todo el ancho
            y_min = 108.0 if pno == 211 else 70.0
            col_chars = [
                c
                for c in chars
                if x_min <= c["x0"] < x_max and y_min < c["top"] < page.height - 95
            ]
            if not col_chars:
                continue
            col_chars.sort(key=lambda c: (round(c["top"] / 3.0), c["x0"]))
            lineas_chars: list[list[dict[str, Any]]] = []
            for ch in col_chars:
                if lineas_chars and abs(ch["top"] - lineas_chars[-1][0]["top"]) <= 4.0:
                    lineas_chars[-1].append(ch)
                else:
                    lineas_chars.append([ch])

            for lchars in lineas_chars:
                lchars.sort(key=lambda c: c["x0"])
                texto = re.sub(r"\s+", " ", "".join(c["text"] for c in lchars)).strip()
                if not texto or texto == "CONTENIDO DEL LISTADO DE HERRAMIENTAS":
                    continue
                if texto.startswith("Nota:") or "OPEN AI, 2026" in texto or "portada de este documento" in texto:
                    # Nota final sobre la portada en la última página (p. 237)
                    break
                no_esp = [c for c in lchars if c["text"].strip()]
                if not no_esp:
                    continue
                colores = Counter(
                    tuple(round(v, 2) for v in c["non_stroking_color"])
                    if isinstance(c.get("non_stroking_color"), (tuple, list))
                    else c.get("non_stroking_color")
                    for c in no_esp
                )
                color_dom = colores.most_common(1)[0][0]
                fuente_dom = Counter(c.get("fontname", "") for c in no_esp).most_common(1)[0][0]
                es_negrita = "Bold" in fuente_dom

                m_num = re.match(r"^(\d+)\.\s*(.*)$", texto)
                if m_num:
                    entradas.append(
                        {
                            "numero": int(m_num.group(1)),
                            "nombre": m_num.group(2).strip(),
                            "categoria": cat_actual,
                            "subcategoria": subcat_actual,
                        }
                    )
                    continue

                # Categoría principal (#007691 Bold)
                if (
                    isinstance(color_dom, tuple)
                    and len(color_dom) == 3
                    and color_dom[0] < 0.1
                    and color_dom[1] > 0.35
                    and color_dom[2] > 0.45
                    and es_negrita
                ):
                    if (
                        cat_actual
                        and (not entradas or entradas[-1]["categoria"] != cat_actual)
                        and subcat_actual is None
                    ):
                        cat_actual = (cat_actual + " " + texto).strip()
                    else:
                        cat_actual = texto
                        subcat_actual = None
                    continue

                # Subcategoría (#aa004d Bold)
                if (
                    isinstance(color_dom, tuple)
                    and len(color_dom) == 3
                    and color_dom[0] > 0.5
                    and color_dom[1] < 0.15
                    and color_dom[2] > 0.2
                    and es_negrita
                ):
                    if (
                        subcat_actual
                        and (not entradas or entradas[-1]["subcategoria"] != subcat_actual)
                    ):
                        subcat_actual = (subcat_actual + " " + texto).strip()
                    else:
                        subcat_actual = texto
                    continue

                # Continuación del nombre de la última entrada (solo si mantiene el color de nombre #467885, no notas en negro)
                es_color_nombre = (
                    isinstance(color_dom, tuple)
                    and len(color_dom) == 3
                    and 0.15 < color_dom[0] < 0.40
                    and 0.35 < color_dom[1] < 0.60
                    and 0.40 < color_dom[2] < 0.65
                )
                if entradas and es_color_nombre:
                    entradas[-1]["nombre"] = (entradas[-1]["nombre"] + " " + texto).strip()

    cats_limpias: list[dict[str, Any]] = []
    vistos_cat: dict[str, dict[str, Any]] = {}
    for e in entradas:
        c = e["categoria"]
        s = e["subcategoria"]
        if c not in vistos_cat:
            obj = {"nombre": c, "subcategorias": []}
            vistos_cat[c] = obj
            cats_limpias.append(obj)
        if s and s not in vistos_cat[c]["subcategorias"]:
            vistos_cat[c]["subcategorias"].append(s)

    return entradas, cats_limpias


def normalizar_semaforo(valor: str) -> str:
    v = (valor or "").strip().upper()
    for color in ("VERDE", "AMARILLO", "ROJO"):
        if color in v:
            return color
    return ""


def normalizar_si_x(valor: str) -> str:
    v = re.sub(r"\s+", " ", valor or "").strip().upper()
    if v in ("SÍ", "SI"):
        return "SI"
    if v == "X":
        return "X"
    if v == "NO":
        return "NO"
    return valor.strip()


def es_cabecera_columnas(txt_nombre: str, txt_semaforo: str, txt_prof: str) -> bool:
    un = (txt_nombre or "").upper()
    us = (txt_semaforo or "").upper()
    up = (txt_prof or "").upper()
    return ("NOMBRE DE LA" in un and "HERRAMIENTA" in un) or ("¿DEBE" in us and "USARSE?" in us) or (up.strip() == "PROFESORADO")


def detectar_semaforo_por_fondo(page: pdfplumber.page.Page, y0: float, y1: float) -> str:
    """Respaldo por color de fondo de la celda ¿DEBE USARSE? si el PDF omitió el texto."""
    for r in page.rects:
        if 725 <= r["x0"] <= 740 and 785 <= r["x1"] <= 800 and r["top"] >= y0 - 2 and r["bottom"] <= y1 + 2:
            if (r["bottom"] - r["top"]) < 10:
                continue
            col = r.get("non_stroking_color")
            if isinstance(col, (tuple, list)) and len(col) == 3:
                rc, gc, bc = col
                # Verde típico de Word/INTEF: G domina claramente
                if gc > 0.5 and gc > rc + 0.1 and gc > bc + 0.1:
                    return "VERDE"
                # Amarillo típico: R y G altos, B bajo
                if rc > 0.7 and gc > 0.6 and bc < 0.5:
                    return "AMARILLO"
                # Rojo/rosa típico: R alto, G y B bajos
                if rc > 0.6 and gc < 0.4 and bc < 0.4:
                    return "ROJO"
    return ""


def extraer_banda_categoria(texto_completo: str) -> tuple[str, str] | None:
    """Detecta una banda de título+descripción de categoría encima de la tabla."""
    lineas = [l.strip() for l in texto_completo.splitlines() if l.strip()]
    if not lineas:
        return None
    txt = "\n".join(lineas)
    m = re.match(r"^([^:\n]{3,160}(?:\n[^:\n]{1,120})?):\s*(.*)$", txt, re.S)
    if m:
        titulo = re.sub(r"\s+", " ", m.group(1)).strip()
        desc = re.sub(r"\s+", " ", m.group(2)).strip()
        # Comprobar que la parte antes de ':' es mayoritariamente mayúsculas o empieza por mayúsculas
        # Sin el paréntesis aclaratorio en minúsculas («VÍDEO (alojamiento, creación…)»)
        letras = [c for c in re.sub(r"\([^)]*\)", "", titulo) if c.isalpha()]
        if letras and sum(1 for c in letras if c.isupper()) / len(letras) >= 0.45:
            return titulo, desc
    return None


def buscar_descripcion_categoria(nombre: str, desc_cats: dict[str, str]) -> str:
    """Descripción de una categoría del índice, tolerando erratas del título en la tabla
    (p. ej. «ELECTRIDAD» o «DIDÁCTICAS» frente a «ELECTRICIDAD» y «DINÁMICAS» del índice)."""
    clave = normalizar_clave(nombre)
    if clave in desc_cats:
        return desc_cats[clave]
    estricta = normalizar_clave_estricta(nombre)
    for k, v in desc_cats.items():
        if re.sub(r"[^a-z0-9]+", "", k) == estricta:
            return v
    parecidas = difflib.get_close_matches(clave, list(desc_cats), n=1, cutoff=0.85)
    if parecidas:
        print(f"Descripción de categoría por parecido: {nombre!r} ← {parecidas[0]!r}")
        return desc_cats[parecidas[0]]
    print(f"AVISO: categoría sin descripción: {nombre!r}")
    return ""


def extraer_bloques_tablas(pdf: pdfplumber.PDF) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """
    Extrae bloques de herramienta (delimitados por bordes negros con minx <= 60)
    y sus subescenarios internos (delimitados por bordes parciales con minx > 60).
    """
    bloques: list[dict[str, Any]] = []
    descripciones_cat: dict[str, str] = {}

    for pno in range(19, 200):
        page = pdf.pages[pno - 1]
        bordes = detectar_bordes_horizontales(page)
        if len(bordes) < 2:
            continue
        enlaces = obtener_enlaces_pagina(page)
        # Palabras de la página entera: solo para las bandas de categoría, que cruzan columnas.
        palabras_pagina = page.extract_words(x_tolerance=2, y_tolerance=3, keep_blank_chars=False)
        # Palabras de cada columna por separado: si se agrupan las líneas de toda la
        # página, el texto de otras columnas encadena dos líneas de una misma celda y
        # sus letras se intercalan («S ig u i e n d o…», Canva, p. 88).
        palabras = extraer_palabras_por_columna(page)
        for w in palabras_pagina + palabras:
            w["xc"] = (w["x0"] + w["x1"]) / 2.0
            w["yc"] = (w["top"] + w["bottom"]) / 2.0

        # Índices de bordes que cruzan la columna NOMBRE (minx <= 60)
        idx_completos = [i for i, b in enumerate(bordes) if b["minx"] <= 60.0]
        if len(idx_completos) < 2:
            continue

        for k in range(len(idx_completos) - 1):
            i_ini = idx_completos[k]
            i_fin = idx_completos[k + 1]
            y_ini = bordes[i_ini]["y"]
            y_fin = bordes[i_fin]["y"]
            if y_fin - y_ini < 8.0:
                continue

            # Texto global del bloque para detectar cabeceras de categoría, cabeceras de columnas y subcategorías
            txt_todo, _ = extraer_texto_de_palabras(palabras_pagina, 28.0, y_ini, 1170.5, y_fin, [])
            if not txt_todo.strip():
                continue

            # Columnas clave del bloque completo, con la lectura de página entera para
            # reconocer bandas y cabeceras tal como se validó (las bandas cruzan columnas)
            txt_nombre, _ = extraer_texto_de_palabras(palabras_pagina, 56.7, y_ini, 142.0, y_fin, [])
            txt_desc, _ = extraer_texto_de_palabras(palabras_pagina, 142.0, y_ini, 262.3, y_fin, [])
            txt_sw_global, _ = extraer_texto_de_palabras(palabras_pagina, 262.3, y_ini, 318.8, y_fin, [])
            txt_priv_global, _ = extraer_texto_de_palabras(palabras_pagina, 552.8, y_ini, 645.0, y_fin, [])
            txt_fecha_global, _ = extraer_texto_de_palabras(palabras_pagina, 645.0, y_ini, 729.6, y_fin, [])
            txt_sem_global, _ = extraer_texto_de_palabras(palabras_pagina, 729.6, y_ini, 793.1, y_fin, [])
            txt_prof_global, _ = extraer_texto_de_palabras(palabras_pagina, 793.1, y_ini, 907.3, y_fin, [])
            txt_alum_global, _ = extraer_texto_de_palabras(palabras_pagina, 907.3, y_ini, 1027.7, y_fin, [])

            if es_cabecera_columnas(txt_nombre, txt_sem_global, txt_prof_global):
                continue

            txt_emb_global, _ = extraer_texto_de_palabras(palabras_pagina, 1027.7, y_ini, 1085.5, y_fin, [])
            sem_detectado = normalizar_semaforo(txt_sem_global) or detectar_semaforo_por_fondo(page, y_ini, y_fin)
            tiene_fecha = bool(re.search(r"\d{2}/\d{2}/\d{4}", txt_fecha_global))
            tiene_sw = normalizar_si_x(txt_sw_global) in ("SI", "X", "NO")
            tiene_emb = normalizar_si_x(txt_emb_global) in ("SI", "X", "NO")

            # Banda de título + descripción de categoría o franja de subcategoría:
            # no tiene semáforo, ni fecha, ni indicador SÍ/X en Software libre / Embebible
            if not sem_detectado and not tiene_fecha and not tiene_sw and not tiene_emb:
                cat_info = extraer_banda_categoria(txt_todo)
                if cat_info:
                    titulo_cat, desc_cat = cat_info
                    if desc_cat:
                        descripciones_cat[normalizar_clave(titulo_cat)] = desc_cat
                # Si además tiene nombre (no es una continuación sin nombre de la página anterior), es categoría/subcategoría
                if txt_nombre.strip() or cat_info:
                    continue

            # Extraer cada subbanda (escenario) dentro de [i_ini .. i_fin]
            subbandas: list[dict[str, Any]] = []
            for s_idx in range(i_ini, i_fin):
                sy0 = bordes[s_idx]["y"]
                sy1 = bordes[s_idx + 1]["y"]
                if sy1 - sy0 < 6.0:
                    continue
                celdas_txt: dict[str, str] = {}
                celdas_urls: dict[str, list[str]] = {}
                for col_nombre, x0, x1 in COLUMNAS_X:
                    if col_nombre in ("tipo", "nombre"):
                        continue
                    txt, urls = extraer_texto_de_palabras(palabras, x0, sy0, x1, sy1, enlaces)
                    celdas_txt[col_nombre] = txt
                    if urls:
                        celdas_urls[col_nombre] = urls
                # Si la celda semáforo no tiene texto (ej. wBrain Slice p.148), inferir por color de fondo
                if not normalizar_semaforo(celdas_txt.get("semaforo", "")):
                    color_fondo = detectar_semaforo_por_fondo(page, sy0, sy1)
                    if color_fondo:
                        celdas_txt["semaforo"] = color_fondo
                subbandas.append(
                    {
                        "pagina": pno,
                        "sy0": round(sy0, 1),
                        "sy1": round(sy1, 1),
                        "celdas": celdas_txt,
                        "urls": celdas_urls,
                    }
                )

            # Contenido de nombre y descripción, con la lectura por columnas
            txt_nombre, _ = extraer_texto_de_palabras(palabras, 56.7, y_ini, 142.0, y_fin, [])
            txt_desc, _ = extraer_texto_de_palabras(palabras, 142.0, y_ini, 262.3, y_fin, [])

            bloques.append(
                {
                    "pagina": pno,
                    "y_ini": round(y_ini, 1),
                    "y_fin": round(y_fin, 1),
                    "nombre": unir_lineas_texto(txt_nombre),
                    "descripcion": unir_lineas_texto(txt_desc),
                    "subbandas": subbandas,
                }
            )

    return bloques, descripciones_cat


def subbanda_a_escenario(sb: dict[str, Any]) -> dict[str, Any]:
    c = sb["celdas"]
    u = sb["urls"]
    fechas = re.findall(r"\d{2}/\d{2}/\d{4}", c.get("fecha_comprobacion", ""))
    return {
        "pagina": sb["pagina"],
        "semaforo": normalizar_semaforo(c.get("semaforo", "")),
        "software_libre": normalizar_si_x(c.get("software_libre", "")),
        "requiere_registro": unir_lineas_texto(c.get("requiere_registro", "")),
        "otros": unir_lineas_texto(c.get("otros", "")),
        "enlaces_otros": list(u.get("otros", [])),
        "politica_privacidad_texto": unir_lineas_texto(c.get("politica_privacidad", "")),
        "enlaces_privacidad": list(u.get("politica_privacidad", [])),
        "fecha_comprobacion": fechas[-1] if fechas else c.get("fecha_comprobacion", "").strip(),
        "fechas_comprobacion": fechas,
        "profesorado": unir_lineas_texto(c.get("profesorado", "")),
        "alumnado": unir_lineas_texto(c.get("alumnado", "")),
        "embebible": normalizar_si_x(c.get("embebible", "")),
        "accesibilidad_texto": unir_lineas_texto(c.get("accesibilidad", "")),
        "enlaces_accesibilidad": list(u.get("accesibilidad", [])),
    }


def fusionar_subbanda(dest: dict[str, Any], sb: dict[str, Any]) -> None:
    c = sb["celdas"]
    u = sb["urls"]
    for campo_dest, campo_src in [
        ("requiere_registro", "requiere_registro"),
        ("otros", "otros"),
        ("politica_privacidad_texto", "politica_privacidad"),
        ("profesorado", "profesorado"),
        ("alumnado", "alumnado"),
        ("accesibilidad_texto", "accesibilidad"),
    ]:
        extra = unir_lineas_texto(c.get(campo_src, ""))
        if extra:
            dest[campo_dest] = (dest[campo_dest] + "\n" + extra).strip() if dest[campo_dest] else extra
    for campo_dest, campo_src in [
        ("enlaces_otros", "otros"),
        ("enlaces_privacidad", "politica_privacidad"),
        ("enlaces_accesibilidad", "accesibilidad"),
    ]:
        for url in u.get(campo_src, []):
            if url not in dest[campo_dest]:
                dest[campo_dest].append(url)
    sem = normalizar_semaforo(c.get("semaforo", ""))
    if not dest["semaforo"] and sem:
        dest["semaforo"] = sem
    sw = normalizar_si_x(c.get("software_libre", ""))
    if not dest["software_libre"] and sw:
        dest["software_libre"] = sw
    emb = normalizar_si_x(c.get("embebible", ""))
    if not dest["embebible"] and emb:
        dest["embebible"] = emb
    fechas = re.findall(r"\d{2}/\d{2}/\d{4}", c.get("fecha_comprobacion", ""))
    for fc in fechas:
        if fc not in dest["fechas_comprobacion"]:
            dest["fechas_comprobacion"].append(fc)
    if fechas and not dest["fecha_comprobacion"]:
        dest["fecha_comprobacion"] = fechas[-1]


def ensamblar_herramientas(bloques: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Convierte los bloques por página en la lista final de herramientas,
    resolviendo continuaciones de fila y escenarios partidos entre páginas.
    """
    herramientas: list[dict[str, Any]] = []

    for b in bloques:
        nombre = b["nombre"]
        desc = b["descripcion"]
        subbandas = b["subbandas"]
        tiene_sem = any(normalizar_semaforo(sb["celdas"].get("semaforo", "")) for sb in subbandas)

        # Caso A: Bloque sin nombre (continuación de la herramienta anterior tras salto de página)
        if not nombre and herramientas:
            prev = herramientas[-1]
            if desc:
                prev["descripcion"] = (prev["descripcion"] + " " + desc).strip()
            for sb in subbandas:
                sem = normalizar_semaforo(sb["celdas"].get("semaforo", ""))
                if sem:
                    # Si el último escenario de prev aún no tenía semáforo (fila partida), fusionar; si ya tenía, es un nuevo escenario (ej. Educaplay p.20->p.21)
                    if prev["escenarios"] and not prev["escenarios"][-1]["semaforo"]:
                        fusionar_subbanda(prev["escenarios"][-1], sb)
                    else:
                        prev["escenarios"].append(subbanda_a_escenario(sb))
                else:
                    if prev["escenarios"]:
                        fusionar_subbanda(prev["escenarios"][-1], sb)
            continue

        # Caso B: Herramienta nueva (tiene nombre)
        escenarios: list[dict[str, Any]] = []
        for sb in subbandas:
            sem = normalizar_semaforo(sb["celdas"].get("semaforo", ""))
            if not escenarios:
                escenarios.append(subbanda_a_escenario(sb))
            elif sem:
                escenarios.append(subbanda_a_escenario(sb))
            else:
                fusionar_subbanda(escenarios[-1], sb)

        herramientas.append(
            {
                "nombre": nombre,
                "descripcion": desc,
                "pagina_inicio": b["pagina"],
                "escenarios": escenarios,
            }
        )

    return herramientas


def extraer_textos_marco(pdf: pdfplumber.PDF) -> dict[str, Any]:
    """Extrae los textos oficiales de introducción, advertencias, orientaciones y aclaraciones (págs. 4-17)."""
    texto_paginas: dict[int, str] = {}
    for pno in range(4, 18):
        page = pdf.pages[pno - 1]
        cuerpo = page.crop((0, 75, page.width, page.height - 75))
        texto_paginas[pno] = (cuerpo.extract_text(x_tolerance=2, y_tolerance=3) or "").strip()

    todo = "\n".join(texto_paginas[p] for p in range(4, 18))

    def sacar_bloque(inicio: str, fin: str | None) -> str:
        i = todo.find(inicio)
        if i == -1:
            return ""
        i += len(inicio)
        if fin:
            j = todo.find(fin, i)
            bloque = todo[i:j] if j != -1 else todo[i:]
        else:
            bloque = todo[i:]
        return bloque.strip()

    def parsear_lista_numerada(bloque: str) -> list[str]:
        items: list[str] = []
        actual: list[str] = []
        for linea in bloque.splitlines():
            l = linea.strip()
            if not l:
                continue
            m = re.match(r"^(\d+)\.\s+(.*)$", l)
            if m:
                if actual:
                    items.append(" ".join(actual))
                actual = [m.group(2).strip()]
            else:
                if actual:
                    actual.append(l)
        if actual:
            items.append(" ".join(actual))
        return items

    adv_bloque = sacar_bloque("ADVERTENCIAS", "ORIENTACIONES")
    advertencias = parsear_lista_numerada(adv_bloque)

    ori_sin = sacar_bloque(
        "Herramientas, aplicaciones o plataformas que no realizan un\ntratamiento de datos de carácter personal",
        "Herramientas, aplicaciones o plataformas que realizan un\ntratamiento de datos de carácter personal de forma anonimizada",
    )
    ori_anon = sacar_bloque(
        "Herramientas, aplicaciones o plataformas que realizan un\ntratamiento de datos de carácter personal de forma anonimizada\no seudonimizada",
        "Herramientas, aplicaciones o plataformas que realizan un\ntratamiento de datos de carácter personal de forma no\nanonimizada o seudonimizada",
    )
    ori_no_anon = sacar_bloque(
        "Herramientas, aplicaciones o plataformas que realizan un\ntratamiento de datos de carácter personal de forma no\nanonimizada o seudonimizada",
        "SOFTWARE LIBRE Y/O DE CÓDIGO ABIERTO",
    )
    sw_libre = sacar_bloque("SOFTWARE LIBRE Y/O DE CÓDIGO ABIERTO", "EMBEBIBLE")
    embebible = sacar_bloque("EMBEBIBLE", "ANÁLISIS")
    analisis = sacar_bloque("ANÁLISIS", "REFERENCIAS")
    importante = sacar_bloque("IMPORTANTE", "ESTRUCTURA DEL LISTADO")

    def limpiar_parrafos(b: str) -> list[str]:
        b = re.split(r"\nANEXOS\b", b)[0].strip()
        return [
            re.sub(r"\s+", " ", p).strip()
            for p in re.split(r"\n(?=\d+\.|•|IMPORTANTE:)", b)
            if p.strip()
        ]

    return {
        "importante": re.sub(r"\s+", " ", importante).strip(),
        "semaforo_leyenda": {
            "VERDE": "La herramienta no trata datos de carácter personal, por lo que en principio podría ser empleada (leyendo siempre Advertencias, Orientaciones y las indicaciones de la ficha).",
            "AMARILLO": "La herramienta trata datos de carácter personal cumpliendo con la legislación vigente en materia de protección de datos, por lo que en principio no podría ser empleada, aunque pueden darse excepciones siempre y cuando se cumplan ciertos requisitos.",
            "ROJO": "La herramienta no cumple con la legislación vigente en materia de protección de datos, por lo que no debería ser empleada.",
        },
        "advertencias": advertencias,
        "orientaciones": {
            "sin_datos_personales": limpiar_parrafos(ori_sin),
            "anonimizado": limpiar_parrafos(ori_anon),
            "no_anonimizado": limpiar_parrafos(ori_no_anon),
        },
        "aclaracion_software_libre": re.sub(r"\s+", " ", sw_libre).strip(),
        "aclaracion_embebible": re.sub(r"\s+", " ", embebible).strip(),
        "criterios_analisis": re.sub(r"\s+", " ", analisis).strip(),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: extraer_guia.py <ruta_pdf> [ruta_salida_json]", file=sys.stderr)
        return 1

    pdf_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("datos/guia-intef.json")

    with pdfplumber.open(pdf_path) as pdf:
        print(f"PDF abierto: {pdf_path.name} ({len(pdf.pages)} páginas)")
        indice, categorias = extraer_indice(pdf)
        print(f"Índice extraído: {len(indice)} herramientas en {len(categorias)} categorías")

        bloques, desc_cats = extraer_bloques_tablas(pdf)
        print(f"Bloques de tabla extraídos: {len(bloques)}, descripciones de categoría: {len(desc_cats)}")

        herramientas_raw = ensamblar_herramientas(bloques)
        total_esc = sum(len(h["escenarios"]) for h in herramientas_raw)
        print(f"Herramientas ensambladas: {len(herramientas_raw)} | Total escenarios: {total_esc}")

        marco = extraer_textos_marco(pdf)

    # Validación 1 a 1 contra el índice oficial
    print("\n--- Validación contra el índice oficial ---")
    i_idx = 0
    t_idx = 0
    diffs = 0
    emparejadas = 0
    while i_idx < len(indice) and t_idx < len(herramientas_raw):
        ni = normalizar_clave_estricta(indice[i_idx]["nombre"])
        nt = normalizar_clave_estricta(herramientas_raw[t_idx]["nombre"])
        if ni == nt:
            emparejadas += 1
            i_idx += 1
            t_idx += 1
        else:
            diffs += 1
            if diffs <= 30:
                print(
                    f"  DIFF #{diffs} (idx #{indice[i_idx]['numero']} vs tab[{t_idx}] p.{herramientas_raw[t_idx]['pagina_inicio']}):"
                )
                print(f"    ÍNDICE: {indice[i_idx]['nombre']!r} [{indice[i_idx]['categoria']}]")
                print(f"    TABLA : {herramientas_raw[t_idx]['nombre']!r}")
            sincronizado = False
            for di in range(1, 6):
                if i_idx + di < len(indice) and normalizar_clave_estricta(indice[i_idx + di]["nombre"]) == nt:
                    i_idx += di
                    sincronizado = True
                    break
            if not sincronizado:
                for dt in range(1, 6):
                    if t_idx + dt < len(herramientas_raw) and normalizar_clave_estricta(herramientas_raw[t_idx + dt]["nombre"]) == ni:
                        t_idx += dt
                        sincronizado = True
                        break
            if not sincronizado:
                i_idx += 1
                t_idx += 1

    print(f"Emparejadas exactas: {emparejadas}/{len(indice)} | Discrepancias totales: {diffs}")

    # Comprobar escenarios sin semáforo
    sin_sem = [
        (h["nombre"], h["pagina_inicio"])
        for h in herramientas_raw
        for e in h["escenarios"]
        if e["semaforo"] not in ("VERDE", "AMARILLO", "ROJO")
    ]
    print(f"Escenarios sin semáforo válido: {len(sin_sem)} {sin_sem[:10]}")

    sem_counts = Counter(e["semaforo"] for h in herramientas_raw for e in h["escenarios"])
    print(f"Distribución semáforo: {dict(sem_counts)}")

    # Si coincide exactamente 1 a 1 (1144 == 1144 y 0 diffs), enriquecer con número, categoría y subcategoría del índice
    herramientas_final = []
    slugs_vistos: Counter[str] = Counter()
    if len(indice) == len(herramientas_raw) and diffs == 0:
        for idx_item, tab_item in zip(indice, herramientas_raw):
            base_slug = slugify(idx_item["nombre"])
            slugs_vistos[base_slug] += 1
            slug = base_slug if slugs_vistos[base_slug] == 1 else f"{base_slug}-{slugs_vistos[base_slug]}"
            herramientas_final.append(
                {
                    "id": slug,
                    "numero": idx_item["numero"],
                    "nombre": idx_item["nombre"],
                    "categoria": idx_item["categoria"],
                    "categoria_id": slugify(idx_item["categoria"]),
                    "subcategoria": idx_item["subcategoria"],
                    "descripcion": tab_item["descripcion"],
                    "pagina": tab_item["pagina_inicio"],
                    "escenarios": tab_item["escenarios"],
                }
            )
        print("¡COINCIDENCIA EXACTA 100 % (1.144 / 1.144)!")
    else:
        herramientas_final = herramientas_raw

    out_path.parent.mkdir(parents=True, exist_ok=True)
    salida = {
        "fuente": {
            "titulo": "Orientaciones sobre el uso de herramientas digitales en el ámbito educativo desde la perspectiva de la protección de datos",
            "autor": "Instituto Nacional de Tecnologías Educativas y de Formación del Profesorado (INTEF)",
            "organismo": "Ministerio de Educación, Formación Profesional y Deportes",
            "version": "3.0",
            "fecha": "Junio 2026",
            "nipo": "164-26-013-9",
            "licencia": "CC BY-SA 4.0",
            "licencia_url": "https://creativecommons.org/licenses/by-sa/4.0/deed.es",
            "url_pagina": "https://intef.es/Noticias/actualizacion-de-las-orientaciones-sobre-el-uso-de-herramientas-digitales-en-el-ambito-educativo-desde-la-perspectiva-de-la-proteccion-de-datos/",
            "url_pdf": "https://intef.es/wp-content/uploads/2026/07/Orientaciones_sobre_el_uso_de_herramientas_digital.pdf",
            "url_pdf_en": "https://intef.es/wp-content/uploads/2026/10/Guidelines_Digital_Tools_Data_Protection_v3_EN.pdf",
        },
        "marco": marco,
        "categorias": [
            {
                "id": slugify(c["nombre"]),
                "nombre": c["nombre"],
                "descripcion": buscar_descripcion_categoria(c["nombre"], desc_cats),
                "subcategorias": c["subcategorias"],
            }
            for c in categorias
        ],
        "total_herramientas": len(herramientas_final),
        "total_escenarios": sum(len(h["escenarios"]) for h in herramientas_final),
        "herramientas": herramientas_final,
    }
    out_path.write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado en {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
