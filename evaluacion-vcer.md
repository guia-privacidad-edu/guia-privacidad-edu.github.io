# Evaluación VCER · Guía de privacidad de herramientas educativas

- **Recurso evaluado:** Guía de privacidad de herramientas educativas (`https://guia-privacidad-edu.github.io/`)
- **Versión evaluada:** `v1.2.0`
- **Fecha de la evaluación:** 2026-11-23
- **Resultado:** **Recomendable (100 % · 20 / 20 puntos)**

---

## Inventario previo

### Datos personales y almacenamiento
- La aplicación **no pide ningún dato personal** ni requiere cuenta o registro.
- Todas las búsquedas y filtros se ejecutan íntegramente en el navegador sobre los tres archivos JSON locales (`datos/guia-intef.json`, `datos/enlaces-herramientas.json` y `datos/vce-evaluadas.json`).
- En el dispositivo se guarda únicamente:
  - `localStorage['gpe.tema']`: tema claro/oscuro solo si difiere de la preferencia del sistema.
  - `localStorage['gpe.idioma']`: idioma elegido solo si difiere del idioma del navegador.
  - Caché del *service worker* (`sw.js`, `gpe-v1.2.0`): archivos propios de la aplicación y los tres JSON para consulta sin conexión.
- No incluye cookies, analítica ni peticiones a servidores de seguimiento.

### Dependencias y recursos externos
- **Cero recursos cargados de terceros al abrir la página**: sin tipografías externas (usa tipografía del sistema), sin CDN de scripts ni hojas de estilo externas.
- Los iconos son SVG inline procedentes de **Lucide** (licencia ISC, acreditada en el pie y en `README.md`).
- Los archivos gráficos propios (`favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `og.png`) están alojados en el propio repositorio.
- Los enlaces hacia herramientas educativas, el Repositorio VCE, políticas de privacidad, accesibilidad y documentos oficiales del INTEF se abren en una pestaña nueva solo cuando la persona los pulsa.

### Material ajeno
- **Datos y textos oficiales de la guía**: procedentes de *Orientaciones sobre el uso de herramientas digitales en el ámbito educativo desde la perspectiva de la protección de datos* (INTEF, v3.0, junio 2026, NIPO 164-26-013-9), licencia **CC BY-SA 4.0**, acreditado con autoría, organismo, fecha, enlace oficial y licencia en el pie, en `README.md` y dentro de `datos/guia-intef.json`.
- **Metadatos del Repositorio VCE**: procedentes de `https://vibe-coding-educativo.github.io/app_edu/`, acreditando autoría, licencia individual y enlace al repositorio en cada ficha VCE, en el pie, en `README.md` y en `datos/vce-evaluadas.json`, con aviso expreso de que la evaluación técnica es orientativa y no oficial del Ministerio.
- **Iconos**: Lucide (`https://lucide.dev`), licencia ISC, acreditada en el pie y en `README.md`.

---

## Puntuación según la rúbrica VCER

| # | Punto | Puntuación | Justificación |
|---|-------|------------|---------------|
| 1 | **Contenido** *(eliminatorio)* | **2 / 2** | Las 1.144 herramientas oficiales del INTEF (1.192 escenarios, 87 categorías, 11 advertencias y 3 orientaciones) están validadas 1 a 1 contra el índice oficial (0 discrepancias) y se suman 360 aplicaciones web del Repositorio VCE inspeccionadas técnicamente en navegador bajo el Anexo I del INTEF (3 coincidencias unificadas sin duplicar), separadas de forma transparente; conviene revisión humana periódica de cambios en las webs externas. |
| 2 | **Datos personales** *(eliminatorio)* | **2 / 2** | No solicita datos personales, no usa cookies ni analítica y no envía ninguna búsqueda fuera del navegador; la política de privacidad se explica en página propia (`privacidad.html`). |
| 3 | **Entender qué hace** | **2 / 2** | `README.md`, `privacidad.html`, el pie y el aviso en cada ficha VCE describen con exactitud qué hace, qué origen tiene cada evaluación y qué guarda en el dispositivo; todo coincide con el código. |
| 4 | **Dependencias** | **2 / 2** | Cero cargas externas de terceros; datos, estilos, iconos e imágenes están dentro del repositorio y funcionan también sin conexión mediante `sw.js`. |
| 5 | **Accesibilidad** | **2 / 2** | Comprobada con `axe-core` (WCAG 2.0/2.1 niveles A y AA) con 0 violaciones en portada, filtro VCE, fichas INTEF, VCE e `INTEF + VCE` y asistente en Chromium y Firefox, escritorio y móvil, tema claro y oscuro; navegación con teclado (`Tab` y `Escape` en menús y diálogos `<dialog>`), contraste verificado y señales de semáforo con icono y texto además del color. |
| 6 | **Material ajeno** | **2 / 2** | Tanto el documento del INTEF (CC BY-SA 4.0) como el Repositorio VCE (con autoría y licencia por aplicación) y los iconos Lucide (ISC) indican procedencia y licencia compatible en el pie, en `README.md` y en los metadatos JSON. |
| 7 | **Rastro** | **2 / 2** | El proyecto mantiene un registro de decisiones en `docs/adr/` (5 ADR con contexto, alternativas descartadas y consecuencias) y un historial git con notas de herramienta. |
| 8 | **Uso de IA** | **2 / 2** | El pie declara expresamente la cocreación con IA enlazando al MIAE nivel 4, fecha (noviembre de 2026) y lo revisado por la persona (dirección, criterios y revisión funcional). |
| 9 | **Licencia** | **2 / 2** | Autoría y licencias libres visibles con enlace en el pie y en archivos dedicados en la raíz: código `AGPL-3.0-or-later` (`LICENSE` y cabeceras SPDX) y contenidos `CC BY-SA 4.0` (`LICENSE-CONTENIDOS`). |
| 10 | **Reutilización** | **2 / 2** | Código abierto sin comprimir, comentado en español, con `README.md`, `AGENTS.md`, guiones reproducibles de extracción y comprobación automática en GitHub Actions. |

**Total:** **20 / 20 (100 %) → Recomendable.**

## Posibles mejoras futuras

1. Incorporar la extracción opcional del PDF oficial v3.0 en inglés del INTEF (`Guidelines_Digital_Tools_Data_Protection_v3_EN.pdf`) para mostrar también las fichas traducidas oficialmente cuando se elige el idioma inglés.
2. Programar una verificación mensual automática en GitHub Actions para detectar cambios o caídas en las URLs de `datos/enlaces-herramientas.json`.
3. Añadir una prueba automática de modo sin conexión verificando la respuesta del *service worker* en un entorno de red desconectada.
