# 1. Arquitectura estática y separación de datos en dos JSON

Fecha: 2026-11-23 · Estado: aceptado

## Contexto

La guía oficial del INTEF *Orientaciones sobre el uso de herramientas digitales en el ámbito educativo desde la perspectiva de la protección de datos* (versión 3.0, junio 2026, NIPO 164-26-013-9, licencia CC BY-SA 4.0) analiza 1.144 herramientas digitales en un PDF de 237 páginas (181 páginas de tabla de 13 columnas). No existe un buscador web oficial del INTEF, lo que dificulta su consulta rápida por docentes sin formación específica en protección de datos.

Juanjo pide convertir el documento en una aplicación web de consulta por criterios sencillos, pensada especialmente para quienes saben poco de RGPD, alojada en una organización propia de GitHub Pages (`guia-privacidad-edu.github.io`).

## Alternativas

- **Incluir el evaluador del Anexo I como formulario interactivo**: descartado por decisión de Juanjo («el evaluador es manual, no? no me convence»), ya que exige al profesorado leer políticas de privacidad y responder cuestiones jurídico-técnicas que la mayoría no hará. Se conserva únicamente la referencia y el enlace al documento oficial del INTEF.
- **Un único JSON mezclando datos del INTEF y enlaces añadidos**: descartado porque al actualizar a una futura versión del PDF (v4.0) se sobrescribiría el trabajo de búsqueda y verificación de las URLs de acceso a cada herramienta, y dificultaría distinguir con transparencia qué procede del documento oficial.
- **Ceñirse solo a las URLs de política de privacidad y accesibilidad del PDF**: descartado por decisión de Juanjo («hay que buscar las url para acceder a cada aplicacion también»), para que quien consulta pueda abrir directamente la herramienta que le interesa.
- **Aplicación con servidor o base de datos**: descartada por coste, mantenimiento y coherencia con la privacidad y soberanía digital.

## Decisión

- **Organización y repositorio**: `guia-privacidad-edu/guia-privacidad-edu.github.io`, web estática publicada en GitHub Pages, sin servidor, sin cuentas y sin recogida de datos personales.
- **Separación de datos en dos archivos JSON**:
  - `datos/guia-intef.json`: extraído de forma reproducible desde el PDF oficial mediante `scripts/extraer_guia.py` y validado al 100 % contra el índice oficial de 1.144 herramientas (páginas 211-237). Conserva íntegros los escenarios múltiples de las herramientas que tienen más de una valoración de semáforo (por ejemplo, con registro y sin registro) y los textos de *Advertencias* y *Orientaciones*.
  - `datos/enlaces-herramientas.json`: mapa de URLs de acceso directo a cada herramienta, buscadas y verificadas aparte con fecha de comprobación.
- **Licencias**: código bajo `AGPL-3.0-or-later`; contenidos y datos derivados de la guía del INTEF bajo `CC BY-SA 4.0`, reconociendo expresamente la autoría del INTEF y enlazando a la publicación oficial.

## Consecuencias

- La web descarga el JSON completo una sola vez (~200-300 KB comprimido por GitHub Pages) y todas las búsquedas y filtros se ejecutan al instante en el navegador.
- Si el INTEF publica una versión posterior del PDF, `guia-intef.json` se regenera sin perder las URLs ya verificadas en `enlaces-herramientas.json`.
- El mantenimiento de las ~1.144 URLs de acceso externas requiere verificación periódica automática porque algunos servicios cambian de dominio o cierran; la fecha de comprobación queda registrada en cada entrada.
