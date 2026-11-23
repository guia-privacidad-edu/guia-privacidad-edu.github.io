#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Segunda pasada de resolución y verificación HTTP de las URLs pendientes o con error
en datos/enlaces-herramientas.json.

Todo enlace candidato pasa por verificación HTTP real antes de marcarse como verificado.
"""

from __future__ import annotations

import concurrent.futures
import json
import sys
from datetime import date
from pathlib import Path

from buscar_urls import obtener_pagina

# Mapa explícito para las herramientas cuyo dominio de privacidad es compartido
# (Google, Microsoft, Adobe, INTEF, KDE, La Digitale, etc.) o cuyo enlace del PDF cambió.
URLS_CONOCIDAS: dict[str, str] = {
    # Accesibilidad (estaban en OTROS y fueron descartadas por la palabra 'accessibility')
    "chatgpt-eu-accessibility-reference": "https://chatgpt.com/g/g-67c9c89a916c8191819d85e63d8fba9f-eu-accessibility-reference",
    "yeschat-ai-accessibility-advisor": "https://www.yeschat.ai/es/gpts-ZxWzgJLG-Accessibility-Advisor",
    "yeschat-ai-accessibility-coach": "https://www.yeschat.ai/gpts-2OToJOWssg-Accessibility-Coach",
    "yeschat-ai-accessibility-helper": "https://www.yeschat.ai/gpts-9t55QePhK2l-Accessibility-Helper",
    "yeschat-ai-evaluador-de-accesibilidad-web": "https://www.yeschat.ai/es/gpts-2OToA01nmQ-Web-Accessibility-Checker",
    # INTEF / educación España
    "exelearning-4-0": "https://exelearning.net/",
    "proyecto-edia": "https://cedec.intef.es/proyecto-edia/",
    "situaciones-de-aprendizaje-intef": "https://intef.es/recursos-educativos/situaciones-de-aprendizaje/",
    "la-aventura-de-aprender": "https://laaventuradeaprender.intef.es/",
    # Astronomía y ciencias
    "eqalign": "https://eqalign.sourceforge.net/index-es.html",
    "esa-kids": "https://www.esa.int/kids/es/",
    "microsoft-to-do": "https://www.microsoft.com/es-es/microsoft-365/microsoft-to-do-list-app",
    "tuxguitar": "https://sourceforge.net/projects/tuxguitar/",
    "art-of-illusion": "https://sourceforge.net/projects/aoi/",
    "digipdf": "https://ladigitale.dev/",
    "digibuzzer": "https://ladigitale.dev/",
    "digiword": "https://ladigitale.dev/",
    "editpad-humanizador-de-texto": "https://www.editpad.org/",
    "plagiarism-detector-comprobador-de-puntuacion": "https://plagiarismdetector.net/es",
    "plagiarism-detector-corrector-gramatical": "https://plagiarismdetector.net/es",
    "plagiarism-detector-ai-paper-writer": "https://plagiarismdetector.net/es",
    "plagiarism-detector-redactor-de-ensayos": "https://plagiarismdetector.net/es",
    "plagiarism-detector-articulo-reescritor": "https://plagiarismdetector.net/es",
    "scribbr-parafrasear-textos": "https://www.scribbr.es/parafrasear/",
    "smodin-detector-de-ia": "https://smodin.io/es",
    "smodin-corrector-de-gramatica": "https://smodin.io/es",
    "smodin-traductor": "https://smodin.io/es",
    "smodin-reescritor": "https://smodin.io/es",
    "pilas-engine": "https://app.pilas-engine.com.ar/",
    "rasmol": "https://sourceforge.net/projects/openrasmol/",
    "gvsig": "https://www.gvsig.com/",
    "google-maps-en-el-espacio": "https://www.google.com/maps/space/",
    "previsat": "https://previsat.sourceforge.net/",
    "virtual-moon-atlas": "https://www.ap-i.net/avl/en/start",
    "skychart": "https://www.ap-i.net/skychart/",
    "rasmol": "https://www.openrasmol.org/",
    "gnu-fisicalab": "https://www.gnu.org/software/fisicalab/",
    "gnu-octave": "https://octave.org/",
    # Adobe
    "adobe-podcast": "https://podcast.adobe.com/",
    "adobe-express": "https://www.adobe.com/es/express/",
    "illustrator-adobe": "https://www.adobe.com/es/products/illustrator.html",
    "indesign-adobe": "https://www.adobe.com/es/products/indesign.html",
    "photoshop-adobe": "https://www.adobe.com/es/products/photoshop.html",
    "firefly-adobe": "https://www.adobe.com/es/products/firefly.html",
    "mixamo-adobe": "https://www.mixamo.com/",
    # Google / YouTube
    "google-academico": "https://scholar.google.es/",
    "pinpoint-google": "https://journaliststudio.google.com/pinpoint/about/",
    "google-translate": "https://translate.google.com/",
    "little-language-lessons-google-labs": "https://labs.google/lll/es",
    "autodraw-google": "https://www.autodraw.com/",
    "whisk-google": "https://labs.google/fx/tools/whisk",
    "lyria-google": "https://deepmind.google/technologies/lyria/",
    "gemini-google": "https://gemini.google.com/",
    "appsheet-google": "https://about.appsheet.com/home/",
    "colab-google-labs": "https://colab.research.google.com/",
    "firebase-studio-google-labs": "https://firebase.studio/",
    "notebooklm-google-labs": "https://notebooklm.google.com/",
    "teachable-machine": "https://teachablemachine.withgoogle.com/",
    "flow-veo-google": "https://labs.google/flow/about",
    "chrome-music-lab": "https://musiclab.chromeexperiments.com/",
    "gemini-storybook": "https://gemini.google.com/",
    "blockly": "https://developers.google.com/blockly",
    "google-earth-studio": "https://www.google.com/earth/studio/",
    "youtube-vr": "https://vr.youtube.com/",
    "biblioteca-de-audio-de-youtube": "https://www.youtube.com/audiolibrary",
    "mi-aula-youtube": "https://www.youtube.com/channel/UCtFRv9O2AHqOZjjynzrv-xg",
    "youtube": "https://www.youtube.com/",
    # Microsoft
    "bing-generador-de-imagenes": "https://www.bing.com/images/create",
    "microsoft-designer": "https://designer.microsoft.com/",
    "copilot-microsoft": "https://copilot.microsoft.com/",
    "microsoft-to-do": "https://to-do.office.com/",
    "makecode-mindstorms": "https://makecode.mindstorms.com/",
    # OpenAI / Meta
    "dall-e3-openai": "https://openai.com/index/dall-e-3/",
    "sora-openai": "https://sora.com/",
    "chatgpt-openai": "https://chatgpt.com/",
    "llama-meta": "https://www.llama.com/",
    "meta-ai": "https://www.meta.ai/",
    # Tinkercad
    "tinkercad-circuits": "https://www.tinkercad.com/circuits",
    "tinkercad-bloques-de-codigo": "https://www.tinkercad.com/codeblocks",
    "tinkercad-diseno-3d": "https://www.tinkercad.com/3d-design",
    # KDE / Eclipse / Software libre
    "ghostwriter": "https://ghostwriter.kde.org/",
    "kdenlive": "https://kdenlive.org/es/",
    "7-zip": "https://www.7-zip.org/",
    "eclipse-ide-for-php-developers": "https://www.eclipse.org/downloads/packages/",
    "eclipse-ide-for-c-c-developers": "https://www.eclipse.org/downloads/packages/",
    "eclipse-ide-for-java-developers": "https://www.eclipse.org/downloads/packages/",
    "tuxguitar": "https://www.tuxguitar.com.ar/",
    "tux-paint": "https://tuxpaint.org/",
    "leocad": "https://www.leocad.org/",
    "a-frame": "https://aframe.io/",
    "art-of-illusion": "https://www.artofillusion.org/",
    "colmap": "https://colmap.github.io/",
    "openboard": "https://openboard.ch/",
    "open-roberta-lab": "https://lab.open-roberta.org/",
    "app-inventor": "https://appinventor.mit.edu/",
    "pilas-bloques": "https://pilasbloques.program.ar/",
    "pilas-engine": "https://pilas-engine.com.ar/",
    "s4a": "http://s4a.cat/",
    "mind": "https://mindplus.cc/en.html",
    # La Digitale (subdominios/apps reales)
    "digipage": "https://digipage.app/",
    "digipdf": "https://ladigitale.dev/digipdf/",
    "digibuzzer": "https://ladigitale.dev/digibuzzer/",
    "digistorm": "https://digistorm.app/",
    "digiword": "https://digiword.app/",
    "digiboard": "https://digiboard.app/",
    # Suites de IA / detectores / escritura (múltiples entradas sobre un mismo proveedor)
    "decopy-ai-ia-detector": "https://decopy.ai/ai-detector/",
    "decopy-ai-ia-escritor": "https://decopy.ai/ai-writer/",
    "decopy-ai-ia-humanizador": "https://decopy.ai/ai-humanizer/",
    "detector-de-ia": "https://www.detectordeia.org/",
    "detector-de-ia-chatgpt": "https://www.detectordeia.org/",
    "detector-de-ia-turnitin": "https://www.detectordeia.org/",
    "detector-de-ia-humanizador": "https://www.detectordeia.org/",
    "editpad-detector-de-ia": "https://www.editpad.org/tool/ai-content-detector",
    "editpad-humanizador-de-texto": "https://www.editpad.org/tool/ai-humanizer",
    "editpad-parafrasear": "https://www.editpad.org/tool/paraphrasing-tool",
    "plagiarism-detector": "https://plagiarismdetector.net/es",
    "plagiarism-detector-detector-de-ia": "https://plagiarismdetector.net/es/ai-content-detector",
    "plagiarism-detector-comprobador-de-puntuacion": "https://plagiarismdetector.net/es/punctuation-checker",
    "plagiarism-detector-corrector-gramatical": "https://plagiarismdetector.net/es/grammar-checker",
    "plagiarism-detector-ai-paper-writer": "https://plagiarismdetector.net/es/ai-essay-writer",
    "plagiarism-detector-redactor-de-ensayos": "https://plagiarismdetector.net/es/ai-essay-writer",
    "plagiarism-detector-humanizador": "https://plagiarismdetector.net/es/ai-humanizer",
    "plagiarism-detector-articulo-reescritor": "https://plagiarismdetector.net/es/article-rewriter",
    "plagiarism-detector-herramienta-de-parafrasis": "https://plagiarismdetector.net/es/paraphrasing-tool",
    "plagiarism-detector-resumidor-de-textos": "https://plagiarismdetector.net/es/text-summarizer",
    "quillbot-detector-de-ia": "https://quillbot.com/ai-content-detector",
    "quillbot-generador-de-citas": "https://quillbot.com/citation-generator",
    "quillbot-corrector-gramatical": "https://quillbot.com/grammar-check",
    "quillbot-traductor": "https://quillbot.com/translate",
    "scribbr-detector-de-ia": "https://www.scribbr.es/detector-de-ia/",
    "scribbr-generador-apa": "https://www.scribbr.es/citar/generador/apa/",
    "scribbr-corrector-ortografico": "https://www.scribbr.es/corrector-ortografico/",
    "scribbr-parafrasear-textos": "https://www.scribbr.es/herramienta-de-parafraseo/",
    "smodin-detector-de-ia": "https://smodin.io/es/detector-de-contenido-ai",
    "smodin-corrector-de-gramatica": "https://smodin.io/es/corrector-gramatical-gratis",
    "smodin-traductor": "https://smodin.io/es/traducir-un-texto-a-varios-idiomas",
    "smodin-reescritor": "https://smodin.io/es/reescribir-textos-online-gratis",
    "textsynth-text-to-spech": "https://textsynth.com/",
    "textsynth-translation": "https://textsynth.com/",
    "textsynth-text-to-image": "https://textsynth.com/",
    "textsynth-chat": "https://textsynth.com/",
    "textsynth-text-completion": "https://textsynth.com/",
    "tinywow-archivos": "https://tinywow.com/tools/file",
    "tinywow-pdf": "https://tinywow.com/tools/pdf",
    "tinywow-ai-write": "https://tinywow.com/tools/write",
    # Otras herramientas conocidas de la lista de pendientes / revisar
    "gravatar": "https://gravatar.com/",
    "miiavatar": "https://www.miiavatar.es/",
    "storyboarder-wonder-unit": "https://wonderunit.com/storyboarder/",
    "planner-5d": "https://planner5d.com/es",
    "julius-ai": "https://julius.ai/",
    "canva": "https://www.canva.com/es_es/",
    "getimg-ai": "https://getimg.ai/",
    "auto-classmate-ai-tools": "https://autoclassmate.io/",
    "teachershare": "https://www.teachershare.io/",
    "teaching-lab-ai": "https://www.teachinglab.org/",
    "vidful": "https://vidful.ai/",
    "timeline-js-knight-lab": "https://timeline.knightlab.com/",
    "chordbook-com": "https://www.chordbook.com/",
    "cocomaterial": "https://cocomaterial.com/",
    "freerange": "https://freerangestock.com/",
    "incompetech": "https://incompetech.com/music/",
    "josh-woodward": "https://www.joshwoodward.com/",
    "kongano": "https://kongano.com/",
    "mymap-ai": "https://www.mymap.ai/",
    "pocoyizador": "https://www.pocoyo.com/",
    "muzify-book-to-playlist": "https://muzify.com/",
    "gvsig": "https://www.gvsig.com/es",
    "lovo": "https://lovo.ai/",
    "play-ht": "https://play.ht/",
    "mpc-be": "https://sourceforge.net/projects/mpcbe/",
    "potplayer": "https://potplayer.tv/",
    "free-comic-maker-com": "https://www.freecomicmaker.com/",
    "vish": "https://vishub.org/",
}


def main() -> int:
    guia_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("datos/guia-intef.json")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("datos/enlaces-herramientas.json")

    guia = json.loads(guia_path.read_text(encoding="utf-8"))
    datos = json.loads(out_path.read_text(encoding="utf-8"))
    por_id = {h["id"]: h for h in guia["herramientas"]}
    enlaces = datos.get("enlaces", {})
    hoy = date.today().isoformat()

    por_comprobar = {}
    for hid, url in URLS_CONOCIDAS.items():
        if hid not in por_id:
            continue
        actual = enlaces.get(hid)
        if actual and actual.get("estado") == "verificado":
            continue
        por_comprobar[hid] = (url, por_id[hid]["nombre"])

    print(f"Comprobando {len(por_comprobar)} URLs adicionales...")

    def verificar(item):
        hid, (url, nombre) = item
        code, final_url, titulo = obtener_pagina(url, timeout=12)
        estado = "verificado" if 200 <= code < 400 else ("bloqueado_bot" if code in (403, 429) else "revisar")
        return hid, {
            "nombre": nombre,
            "url": final_url if 200 <= code < 400 else url,
            "url_inicial": url,
            "origen": "resolucion-directa",
            "http": code,
            "titulo": titulo,
            "estado": estado,
            "comprobado": hoy,
        }

    ok = bot = rev = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
        for hid, info in pool.map(verificar, por_comprobar.items()):
            enlaces[hid] = info
            if info["estado"] == "verificado":
                ok += 1
            elif info["estado"] == "bloqueado_bot":
                bot += 1
            else:
                rev += 1

    # Recalcular pendientes reales (herramientas que aún no tienen ninguna entrada)
    pendientes = [
        {"id": h["id"], "numero": h["numero"], "nombre": h["nombre"], "categoria": h["categoria"]}
        for h in guia["herramientas"]
        if h["id"] not in enlaces
    ]

    datos["actualizado"] = hoy
    datos["enlaces"] = enlaces
    datos["pendientes"] = pendientes
    datos["pendientes_count"] = len(pendientes)
    datos["verificados"] = sum(1 for v in enlaces.values() if v.get("estado") == "verificado")
    datos["bloqueados_bot"] = sum(1 for v in enlaces.values() if v.get("estado") == "bloqueado_bot")
    datos["por_revisar"] = sum(1 for v in enlaces.values() if v.get("estado") == "revisar")

    out_path.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Pasada 2 -> ok={ok}, 403/429={bot}, revisar={rev}")
    print(
        f"TOTAL ACUMULADO: verificados={datos['verificados']}, 403/429={datos['bloqueados_bot']}, "
        f"revisar={datos['por_revisar']}, pendientes={datos['pendientes_count']} (de {len(guia['herramientas'])})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
