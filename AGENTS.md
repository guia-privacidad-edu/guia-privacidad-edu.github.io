# Guía de trabajo para agentes (`guia-privacidad-edu.github.io`)

## Principios del repositorio

- **Web estática pura en GitHub Pages**: sin servidor, sin cookies, sin analítica ni cargas de recursos de terceros (fuentes, CDN o scripts externos).
- **Separación estricta de datos**:
  - `datos/guia-intef.json` procede exclusivamente del PDF oficial del INTEF mediante `scripts/extraer_guia.py`. Nunca se edita a mano: cualquier ajuste va en el script de extracción y debe pasar la validación 1 a 1 contra el índice oficial (1.144 herramientas en la v3.0).
  - `datos/enlaces-herramientas.json` contiene las URLs de acceso directo a cada herramienta buscadas y verificadas aparte, con código HTTP y fecha de comprobación.
- **Solo INTEF**: la guía recoge únicamente las herramientas del INTEF (ADR 0007). El semáforo de las aplicaciones del Repositorio de Vibe Coding Educativo no se calcula ni se muestra aquí.
- **Licencias**: código `AGPL-3.0-or-later` (cabecera `SPDX-License-Identifier` en cada archivo de código); datos y contenidos derivados `CC BY-SA 4.0` acreditando al INTEF.
- **Decisiones en ADR**: cada cambio relevante de arquitectura, datos o diseño se documenta en `docs/adr/`.

## Comprobaciones antes de dar un cambio por bueno

1. Validar la integridad de `datos/guia-intef.json` (1.144 herramientas, 0 escenarios sin semáforo válido).
2. Servir en local y comprobar con `probar-web` en Chromium y Firefox, escritorio y móvil, tema claro y oscuro, verificando que no haya errores de consola ni desbordamiento horizontal.
3. Revisar accesibilidad (contraste, navegación con teclado, etiquetas ARIA y diálogos nativos `<dialog>`).
