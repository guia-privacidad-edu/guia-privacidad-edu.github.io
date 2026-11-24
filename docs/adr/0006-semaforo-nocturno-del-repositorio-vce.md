# 6. El semáforo del Repositorio VCE, al día cada noche

Fecha: 2026-11-24 · Estado: aceptado

## Contexto

La versión 1.2.0 (ADR 0005) evaluó una vez las aplicaciones del Repositorio de Vibe
Coding Educativo. El programa que las abrió en el navegador se quedó fuera del
repositorio, en la carpeta de trabajo del agente que lo hizo, y la lista no se ponía
al día: las aplicaciones nuevas no salían y las retiradas seguían.

Juanjo preguntó si se podía aplicar la evaluación a las aplicaciones que se fueran
añadiendo. Después pidió que el semáforo saliera también en el propio repositorio,
con una base de datos común a los dos programas.

## Decisión

- **El programa de inspección vive aquí** (`scripts/auditar_vce.py`). Solo anota lo
  que ve. Las reglas del semáforo están en `scripts/generar_vce.py`, y
  `scripts/semaforo_vce.py` junta las dos piezas. Lo que se vio de cada aplicación se
  guarda en `datos/auditoria-vce.json`, para no repetirlo cada noche.
- **Cada noche, en el NAS, a partir de las 3:30** (`nas/reloj.sh`), se inspeccionan
  las aplicaciones nuevas, las que han cambiado de enlace, las que la última vez no se
  abrieron y las que están en rojo, para que el arreglo de un autor se vea al día siguiente. El domingo se inspeccionan todas, porque una aplicación puede añadir
  analítica sin que cambie nada en la hoja. Se olvidan las retiradas del repositorio,
  se rehace `datos/vce-evaluadas.json` y se suben los datos. La pasada usa la imagen del
  boletín semanal, que ya trae Chromium, y escribe en un clon aparte (`sitio`) para no
  tocar el clon del código, que vigila el vigía del NAS. Sube con la clave de
  despliegue del repositorio (ADR 0012 de vigilancia-nas). Tras tres fallos en un día,
  avisa a Juanjo.
- **La base común es la hoja del repositorio.** La pasada escribe en tres columnas
  (semáforo, motivo y fecha), con la acción `semaforos` de su API (ADR 0002 de
  app_edu), y solo en las filas que cambian. Si la hoja trae menos de 100 aplicaciones,
  no sigue: una hoja vacía no puede vaciar la guía.
- **`?u=<enlace>` abre la ficha de esa aplicación**, también la de una que está en la
  lista del INTEF. Es el enlace que pone el repositorio en cada tarjeta.

## Reglas nuevas del semáforo

- **Un envío a un servidor ajeno es tratamiento de datos (AMARILLO).** Se cuenta lo que
  la página manda, por POST o con una baliza, no solo lo que descarga. Así salen los
  contadores de visitas alojados por el autor, como el Umami de las aplicaciones de
  ortogra.fi y de pentagrama.page. Mandan la página, el idioma, la pantalla y, con la
  petición, la IP. Antes salían en verde. Ahora salen como las que usan el contador de
  Cloudflare, que ya eran amarillas. Lo aprobó Juanjo el 24-11-2026.
- **La analítica sin fines comerciales** (contadores gratuitos, Plausible, Matomo) es
  AMARILLA. **La comercial**, que se reconoce por el dominio y sus subdominios (Google
  Analytics, Amplitude, Facebook, Hotjar, Clarity, Mixpanel…), es ROJA.

La primera pasada con estas reglas (24-11-2026, las 385 aplicaciones) cambió seis
aplicaciones de verde a amarillo:

- Trama, Relleu Obert, Fil i compte, Plec y Pentagrama, por el contador de visitas.
- La calculadora de campo eléctrico, porque manda a rocket.new, el servicio con que se
  hizo, un aviso «Public Preview Viewed» con la dirección de cada visita.

Se comprobó abriendo cada caso. Siguen en verde, también comprobado: grupos sanguíneos
(fotos de ejemplo de randomuser.me), EduArticles Radar (consultas a OpenAlex, una base
pública) y equipos cooperativos CEVP (una imagen). Ninguno de los tres manda nada.

## Validación

- Con los datos del 23-11 y sin las reglas nuevas, el generador da exactamente el mismo
  `vce-evaluadas.json` publicado en la 1.2.0.
- La pasada completa tarda unos 5 minutos en el portátil, con seis pestañas a la vez.
- La hoja recibió las 385 filas. La web del repositorio leyó el CSV publicado en
  Chromium y Firefox, en escritorio y en móvil, con el tema claro y el oscuro.
- `?u=` abre la ficha de Trama (VCE) y la de Multiprompt (INTEF + VCE). Pasan
  `pruebas/probar_app.js` y `pruebas/probar_accesibilidad.js`.

## Consecuencias

- Los datos de `datos/` los sube el NAS cada noche: hay que hacer `git pull` antes de
  trabajar en el portátil.
- Si cambian las reglas, hay que pasar `semaforo_vce.py --todas --sin-hoja` y revisar
  los cambios de color antes de subir.
