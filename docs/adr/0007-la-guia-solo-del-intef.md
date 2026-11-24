# 7. La guía, solo del INTEF

Fecha: 2026-11-24 · Estado: aceptado

## Contexto

La versión 1.2.0 (ADR 0005) añadió a la guía las aplicaciones del Repositorio de Vibe
Coding Educativo (VCE), evaluadas con el Anexo I del INTEF, y la 1.3.0 (ADR 0006) puso
al día su semáforo cada noche desde el NAS. El 24-11-2026 el semáforo de esas
aplicaciones empezó a mostrarse en el propio repositorio de VCE. Con ello, la guía
dejaba de ser el lugar donde se consultaba, y mezclar en ella dos orígenes (la
evaluación oficial del INTEF y una inspección técnica no oficial) obligaba a mantener
filtros, insignias y avisos solo para distinguirlos.

Juanjo decidió que «lo del intef solo del intef»: la guía debe ser únicamente la del
INTEF.

## Decisión

- **La guía vuelve a contener solo las 1.144 herramientas del INTEF** (v3.0, junio
  2026). Se retira todo lo de VCE: los datos (`datos/vce-evaluadas.json` y
  `datos/auditoria-vce.json`), el filtro de origen (`?src=`) y sus recuentos, las
  insignias INTEF / VCE / INTEF + VCE, el cruce de coincidencias, las fichas y el aviso
  de VCE, las categorías de VCE del desplegable y el parámetro `?u=<enlace>`, que se
  añadió solo para que el repositorio de VCE abriera fichas aquí.
- **Se retiran también la pasada nocturna y el contenedor del NAS** (`nas/`) y los
  programas de evaluación (`scripts/auditar_vce.py`, `generar_vce.py` y
  `semaforo_vce.py`). El evaluador y la pasada nocturna pasaron al bot de VCE
  (`jjdeharo/bot-chatgpt-ia-edu`, ADR 0053), que escribe el semáforo en la hoja del
  repositorio de VCE.
- **Se conserva lo de las versiones 1.2.0 y 1.3.0 que no era de VCE**: los recuentos
  facetados en vivo (semáforo y categoría, sin contradicciones con la lista), el
  desplegable propio y buscable de categorías (sin `<select>` nativo), el buscador
  insensible a tildes y mayúsculas, el asistente, el modo sin conexión, los cinco
  idiomas y el pie de página. El desplegable de categorías ya no agrupa por fuente.
- **La evaluación VCER del pie se mantiene**: no es del repositorio de VCE, sino la
  evaluación de calidad de esta web con la rúbrica VCER.
- El workflow ya no valida `vce-evaluadas.json` ni las coincidencias; sigue validando
  `guia-intef.json` y `enlaces-herramientas.json`. Versión 1.4.0 y caché `gpe-v1.4.0`.

## Consecuencias

- Los ADR 0005 y 0006 quedan como historial, marcados como sustituidos por este.
- Los enlaces antiguos con `?src=` o `?u=` siguen abriendo la guía, pero ignoran esos
  parámetros.
- Ya no hay datos que cambien solos: no hace falta `git pull` previo por subidas del
  NAS, y los datos solo cambian al salir una versión nueva del PDF del INTEF.
- Quien necesite el semáforo de las aplicaciones de VCE lo encuentra en el repositorio
  de VCE; esta guía no lo calcula ni lo muestra.
