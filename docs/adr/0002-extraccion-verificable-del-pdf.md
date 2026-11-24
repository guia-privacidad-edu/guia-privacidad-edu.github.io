# 2. Extracción reproducible del PDF oficial y validación 1 a 1

Fecha: 2026-11-23 · Estado: aceptado

## Contexto

El PDF oficial del INTEF (v3.0, junio 2026) tiene 237 páginas: marco y orientaciones (págs. 4–17), tabla de 13 columnas con 1.144 herramientas (págs. 19–199), Anexo I (págs. 200–210) e índice numerado en dos columnas (págs. 211–237).

Al inspeccionar el PDF con `pdftohtml` y `pdfplumber`, aparecieron cuatro particularidades que rompen un análisis de texto ingenuo:
1. **Herramientas con varios escenarios de uso**: unas 48 herramientas combinan verticalmente las celdas de nombre y descripción mientras dividen en dos filas el registro, el semáforo y las indicaciones (por ejemplo, Educaplay en pág. 20–21 o LearningApps y Live Worksheets en pág. 22). Word centra verticalmente el nombre en la celda combinada, de modo que puede caer visualmente debajo de la línea divisoria interna.
2. **Filas partidas entre páginas**: algunas herramientas continúan en la página siguiente sin repetir el nombre.
3. **Celda sin etiqueta textual**: en `wBrain Slice` (pág. 148), el documento pinta el fondo de la celda de semáforo en verde `#00B050` (`RGB 0, 0.69, 0.314`) pero omite el texto `VERDE`.
4. **URLs partidas en múltiples líneas**: el texto visible de la celda parte las URLs, mientras que las anotaciones PDF (`URI`) conservan cada dirección íntegra.
5. **Letras intercaladas entre líneas** (detectado el 24-11-2026 por un aviso de un usuario sobre Canva, pág. 88): si `extract_words()` se aplica a la página entera, el texto de otras columnas a alturas intermedias encadena dos líneas de una misma celda en una sola, y sus letras se mezclan («S ig u i e n d o…» intercalado con «es t a b le c id o…»). Afectaba a 257 textos de 70 herramientas.
6. **Títulos de categoría con erratas o paréntesis**: la banda de la tabla escribe «ELECTRÓNICA Y ELECTRIDAD» o «TARJETAS DIDÁCTICAS» donde el índice dice «ELECTRICIDAD» y «DINÁMICAS», y «VÍDEO (alojamiento, creación…)» lleva un paréntesis en minúsculas.

## Alternativas

- **Extracción por tablas automáticas de `pdfplumber` o `pymupdf`**: probada en páginas 19–21; ambas confunden el sombreado de párrafos con subtablas o pierden espacios entre palabras.
- **Extracción geométrica por bordes negros de Word + palabras + anotaciones URI**: comprobada sobre las 181 páginas de tabla. Elegida.

## Decisión

- Usar `scripts/extraer_guia.py` con `pdfplumber`:
  - Detectar los bordes horizontales negros reales (`height < 2.2 pt`, color negro) para separar bloques completos de herramienta (`minx <= 60 pt`) y subescenarios internos (`minx > 60 pt`).
  - Leer las 13 columnas por sus coordenadas X fijas (constantes en todo el documento), repartiendo los caracteres de la página por columna y llamando a `extract_words()` en cada una por separado, para que no se intercalen líneas (particularidad 5), y asociar las anotaciones `URI` por posición. La lectura de la página entera se reserva para reconocer las bandas de categoría y las cabeceras, que cruzan columnas.
  - Emparejar la descripción de cada categoría con su título del índice tolerando erratas (`difflib`, umbral 0,85, con aviso en la salida) y sin contar el paréntesis aclaratorio al comprobar que el título va en mayúsculas (particularidad 6).
  - Cuando la celda de semáforo carece de texto (`wBrain Slice`, pág. 148), inferir el valor a partir del color de relleno de la celda en el PDF.
  - Extraer independientemente el índice oficial (págs. 211–237) distinguiendo categorías (`#007691` negrita), subcategorías (`#aa004d` negrita) y herramientas numeradas (`#467885`), y exigir **coincidencia exacta 1 a 1** (1.144 / 1.144, 0 discrepancias, 0 escenarios sin semáforo) antes de emitir el JSON final.

## Consecuencias

- La extracción es repetible y auditable en ~45 segundos.
- Cualquier futura edición del PDF (v4.0) que cambie columnas o introduzca anomalías fallará la validación de forma visible en lugar de generar datos corruptos en silencio.
- Validación del cambio de 24-11-2026: con el mismo PDF, 1.144/1.144 y 1.192 escenarios; frente a los datos anteriores solo cambian espacios en 257 textos (ningún carácter distinto), y marco y categorías quedan idénticos. Una búsqueda de secuencias de letras sueltas pasa de 245 textos a 1, que es texto normal («de IA y ML en la»).
