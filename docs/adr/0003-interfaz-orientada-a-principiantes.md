# 3. Interfaz orientada a docentes sin conocimientos previos de RGPD

Fecha: 2026-11-23 · Estado: aceptado

## Contexto

La tabla del PDF del INTEF tiene 13 columnas densas y remite constantemente a las páginas 7–15 (*Advertencias*, *Orientaciones* y aclaración del significado de la `X` en *Software libre* y *Embebible*). Juanjo pide facilitar al máximo la consulta para que incluso quienes saben poco de protección de datos puedan aprovechar la guía.

## Alternativas

- **Reproducir la tabla de 13 columnas con filtros por columna**: fiel al PDF pero ilegible en móvil e intimidante para perfiles no técnicos.
- **Buscador por preguntas cotidianas + tarjetas paginadas + ficha detallada con advertencias integradas + asistente de 3 pasos**: elegido.

## Decisión

- **Controles en lenguaje llano**: buscador libre (nombre, descripción, categoría y observaciones), botones de semáforo con leyenda permanente, filtro «¿Quién la usa?» (con alumnado en verde vs solo profesorado/visualización), selector de las 87 categorías con descripción contextual y cuatro filtros prácticos (sin registro, software libre, embebible, con accesibilidad).
- **Asistente «Ayúdame a elegir»**: tres preguntas breves agrupando las 87 categorías en 8 ámbitos cotidianos de aula, que traducen las respuestas en filtros visibles y modificables.
- **Fichas con todos los modos de uso juntos**: si una herramienta tiene dos valoraciones (por ejemplo, verde sin registro y rojo con registro), ambas se muestran en la misma ficha en bloques separados con los apartados *Para el profesorado* y *Para el alumnado* destacados.
- **Sin ir y venir por el PDF**: cada ficha incluye un desplegable con las 11 advertencias oficiales y notas explicativas junto a cada `X` de *Software libre* o *Embebible*.
- **Paginación (24 resultados por página)**, **enlace directo compartible** tanto para cualquier búsqueda/filtro como para cada ficha (`?h=<id>`), **diálogos nativos `<dialog>`** accesibles por teclado, **tema claro/oscuro** que sigue al sistema y hoja de impresión en blanco.

## Consecuencias

- Un docente sin conocimientos de RGPD puede llegar en dos clics a herramientas verdes sin registro para su aula y leer qué puede hacer con el alumnado sin descargar un PDF de 237 páginas.
- Al mantener los filtros del asistente sincronizados con los controles normales y la URL, se evita una caja negra y cualquier selección se puede ajustar o compartir.
