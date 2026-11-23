# 4. Interfaz en cinco idiomas, consulta sin conexión y verificación continua

Fecha: 2026-11-23 · Estado: aceptado

## Contexto

Tras publicar la versión 1.0.0 en castellano, se decide completar la aplicación conforme a los estándares de publicación abierta de la guía *Vibe coding responsable*: soporte de las lenguas cooficiales e inglés, funcionamiento sin conexión, vista previa al compartir, revisión automática de accesibilidad, evaluación VCER y comprobación automática en GitHub Actions.

## Alternativas

- **Traducir también las 1.144 fichas del INTEF a catalán, gallego y euskera**: descartado porque son ~1,8 MB de texto oficial ajeno cuya literalidad conviene preservar en su idioma original y que obligaría a re-traducir el catálogo entero en cada nueva edición del INTEF.
- **Generar cinco copias HTML por idioma**: descartado para esta aplicación interactiva porque duplica mantenimiento sin necesidad; con un diccionario compartido (`i18n.js`) todas las vistas (`index.html` y `privacidad.html`) y los componentes dinámicos cambian al instante sin recargar el catálogo JSON.

## Decisión

- **Cinco idiomas de interfaz (`i18n.js`)**: castellano (`es`), catalán (`ca`), gallego (`gl`), euskera (`eu`) e inglés (`en`). Detecta el idioma del navegador, permite cambiar desde la cabecera (guardando `localStorage['gpe.idioma']` solo si difiere del sistema y aceptando `?lang=`) y conserva los textos oficiales del INTEF en castellano con una nota aclaratoria. En inglés enlaza al PDF oficial v3.0 en inglés del INTEF.
- **Uso sin conexión (`sw.js` + `manifest.webmanifest`)**: un *service worker* con estrategia *stale-while-revalidate* precachea la aplicación y los dos JSON locales para poder consultarla sin red en el aula.
- **Vista previa al compartir (`og.png`, `favicon-32.png`, `apple-touch-icon.png`)**: generadas en local con Pillow y optimizadas (62 KB para `og.png`), sin depender de servicios externos.
- **Calidad automatizada**:
  - Auditoría WCAG 2.1 AA con `axe-core` integrada en `pruebas/probar_accesibilidad.js` (0 violaciones en portada, ficha modal y asistente en Chromium y Firefox, temas claro y oscuro).
  - Evaluación VCER documentada en `evaluacion-vcer.md` y enlazada en el pie.
  - Flujo de GitHub Actions (`.github/workflows/verificar.yml`) que valida sintaxis JS, integridad de los dos JSON y paridad de las 141 claves de traducción en los 5 idiomas.

## Consecuencias

- La aplicación se puede consultar en las cinco lenguas habituales y sin conexión a internet tras la primera visita.
- Cualquier cambio futuro que rompa el JSON o deje una clave sin traducir en alguno de los cinco idiomas fallará automáticamente en GitHub Actions.
