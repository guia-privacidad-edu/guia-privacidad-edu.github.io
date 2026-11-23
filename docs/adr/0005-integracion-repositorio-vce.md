# 5. Integración separada del Repositorio de Vibe Coding Educativo (VCE)

Fecha: 2026-11-23 · Estado: aceptado

## Contexto

El [Repositorio de aplicaciones educativas de Vibe Coding Educativo](https://vibe-coding-educativo.github.io/app_edu/) reúne 385 aplicaciones web creadas por docentes. Resulta útil consultarlas en la misma interfaz junto a las 1.144 herramientas oficiales del INTEF, pero manteniendo una separación estricta entre la evaluación oficial del Ministerio y la evaluación técnica comunitaria para no inducir a confusión.

## Alternativas

- **Mezclar las aplicaciones VCE dentro de `datos/guia-intef.json`**: descartado porque contaminaría el catálogo extraído del PDF oficial del INTEF, rompería la validación 1:1 contra el índice oficial y dificultaría futuras actualizaciones cuando el INTEF publique la versión 4.0.
- **Publicar una web separada solo para VCE**: descartado porque obligaría al profesorado a buscar en dos sitios distintos cuando busca una herramienta para un tema concreto (por ejemplo, matemáticas o simuladores).
- **Duplicar las aplicaciones que ya figuran en la lista oficial del INTEF**: descartado porque mostraría tarjetas duplicadas con criterios distintos; en su lugar, las 3 coincidencias (`BoardLive`, `Muro interactivo` / `Conexión en Directo` y `Multiprompt`) conservan la ficha oficial del INTEF como fuente primaria y se enlazan a ambas listas con insignia `INTEF + VCE`.

## Decisión

- **Archivo independiente `datos/vce-evaluadas.json`**: generado de forma reproducible con `scripts/generar_vce.py` tras inspeccionar en navegador real (Playwright) las 385 entradas activas aplicando los criterios del Anexo I del INTEF (v3.0): tráfico de red, cookies, formularios, registro, alojamiento y cabeceras.
  - **360** aplicaciones web nuevas evaluadas (278 en verde, 86 en amarillo —incluidos 6 escenarios duales en aplicaciones de ChatGPT— y 2 en rojo por incorporar Google Analytics / Amplitude).
  - **3** coincidencias con el INTEF anotadas en `coincidencias_intef`, presentes en ambos filtros (`Guía INTEF` y `Repositorio VCE`) sin duplicar tarjetas en `Todas` (total 1.504 herramientas únicas).
  - **22** entradas excluidas por no ser aplicaciones web evaluables (16 repositorios de GitHub sin despliegue web, 3 páginas 404, 1 descarga directa y 2 entradas no web).
- **Separación visible en la interfaz**:
  - Filtro **Origen** en la portada (`Todas`, `Guía INTEF`, `Repositorio VCE`) sincronizado en la URL (`?src=intef|vce`), acompañado de dos tarjetas explicativas que aclaran qué es el INTEF y qué es el Repositorio VCE para docentes sin contexto previo.
  - Recuentos facetados en tiempo real en **Origen**, **Semáforo** y **Categoría** (ocultando las categorías sin coincidencias al filtrar) para evitar contradicciones entre los contadores y la lista mostrada.
  - Desplegable propio buscable de **Categoría** (sustituyendo al `<select>` nativo de 97 opciones, problemático en Linux de escritorio) agrupado por fuente (87 del INTEF y 10 del Repositorio VCE).
  - Insignias de origen (`INTEF`, `VCE`, `INTEF + VCE`) en cada tarjeta y pie de página reestructurado en dos bloques y barra inferior con contraste WCAG AA/AAA en tema claro y oscuro.
  - Aviso destacado en toda ficha VCE: *«Evaluación técnica orientativa aplicando el Anexo I del INTEF (no oficial del Ministerio)»*, con autoría, licencia, niveles, áreas, idiomas, evidencias técnicas observadas y enlace al repositorio VCE.
- **Calidad y consulta sin conexión**: `sw.js` (`gpe-v1.2.0`) precachea `datos/vce-evaluadas.json`, GitHub Actions valida su estructura e IDs de coincidencia y `pruebas/probar_accesibilidad.js` audita con `axe-core` tanto el filtro VCE como las fichas VCE e `INTEF + VCE`.

## Consecuencias

- El profesorado puede consultar 1.504 herramientas en un único buscador sabiendo en todo momento si una valoración procede del INTEF o de la inspección técnica orientativa del Repositorio VCE.
- Cuando se publique una nueva edición del PDF oficial del INTEF, `datos/guia-intef.json` se regenera sin tocar `datos/vce-evaluadas.json`, y viceversa.
