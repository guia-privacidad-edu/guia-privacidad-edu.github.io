# Guía de privacidad de herramientas educativas

Aplicación web estática y sin seguimiento para consultar de forma sencilla las **1.144 herramientas digitales** analizadas por el INTEF en *Orientaciones sobre el uso de herramientas digitales en el ámbito educativo desde la perspectiva de la protección de datos* (Versión 3.0, junio 2026, NIPO 164-26-013-9).

> **Aviso importante:** esta aplicación es un proyecto independiente sin vinculación oficial con el Ministerio de Educación, Formación Profesional y Deportes. El documento original tiene carácter orientativo, no prescriptivo. La interpretación y el uso de cada herramienta es responsabilidad única del docente.

## Qué ofrece

- **Búsqueda instantánea** por nombre, descripción, autoría, categoría u observaciones, ejecutada íntegramente en el navegador sin enviar datos a ningún servidor.
- **Filtros pensados para uso cotidiano**: semáforo (verde, amarillo, rojo) con recuentos en vivo que nunca contradicen la lista, uso con alumnado o solo docente, 87 categorías en un desplegable buscable, sin registro, software libre, embebible y con información de accesibilidad.
- **Asistente «Ayúdame a elegir»** en tres preguntas para quienes no conocen la guía ni el RGPD.
- **Fichas claras y completas**: muestran juntos todos los modos de uso cuando una herramienta tiene varias valoraciones (por ejemplo, con registro y sin registro), separan las indicaciones para profesorado y alumnado, aclaran el significado de la `X` del INTEF, e incluyen las 11 advertencias oficiales desplegables sin salir de la ficha.
- **Enlaces directos**: acceso verificado a la web de cada herramienta (separado de los datos oficiales del INTEF) y enlaces compartibles para cualquier ficha o combinación de filtros.

## Organización del proyecto

```text
.
├── index.html                  # Aplicación principal (buscador, filtros, asistente y fichas)
├── privacidad.html             # Política de privacidad (cero seguimiento y cero cookies)
├── estilos.css                 # Hoja de estilos (tema claro/oscuro e impresión en blanco)
├── i18n.js                     # Traducciones de interfaz en 5 idiomas (es, ca, gl, eu, en)
├── app.js                      # Lógica de consulta y renderizado en el navegador
├── sw.js                       # Service worker para consulta sin conexión
├── manifest.webmanifest        # Manifiesto de aplicación web instalable
├── favicon.svg                 # Icono vectorial (+ favicon-32.png, apple-touch-icon.png, og.png)
├── evaluacion-vcer.md          # Informe de evaluación VCER
├── datos/
│   ├── guia-intef.json         # Datos extraídos del PDF oficial del INTEF (CC BY-SA 4.0)
│   └── enlaces-herramientas.json # URLs de acceso directo verificadas aparte
├── scripts/
│   ├── extraer_guia.py         # Extractor reproducible desde el PDF oficial con validación 1:1
│   ├── buscar_urls.py          # Resolución y verificación HTTP de enlaces de acceso
│   └── completar_urls.py       # Segunda pasada dirigida para dominios compartidos
├── pruebas/
│   ├── probar_app.js           # Pruebas funcionales con probar-web
│   └── probar_accesibilidad.js # Auditoría WCAG 2.1 AA con axe-core + 5 idiomas + recuentos
├── .github/workflows/          # Comprobación automática en GitHub Actions
├── docs/adr/                   # Registro de decisiones de arquitectura (ADR)
├── LICENSE                     # Licencia del código (AGPL v3)
└── LICENSE-CONTENIDOS          # Licencia de los contenidos y datos (CC BY-SA 4.0)
```

## Cómo actualizar datos con una nueva versión del PDF

```bash
uv run --with pdfplumber python3 scripts/extraer_guia.py \
  /ruta/al/Orientaciones_sobre_el_uso_de_herramientas_digital.pdf \
  datos/guia-intef.json
```

El guion valida automáticamente el 100 % de las herramientas extraídas frente al índice oficial del documento y conserva intacto `datos/enlaces-herramientas.json`.

## Pruebas en local

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080` en el navegador o probar en escritorio, móvil y tableta con `probar-web`.

## Fuentes y licencias

- **Datos y textos oficiales**: [Instituto Nacional de Tecnologías Educativas y de Formación del Profesorado (INTEF)](https://intef.es/Noticias/actualizacion-de-las-orientaciones-sobre-el-uso-de-herramientas-digitales-en-el-ambito-educativo-desde-la-perspectiva-de-la-proteccion-de-datos/), *Orientaciones sobre el uso de herramientas digitales en el ámbito educativo desde la perspectiva de la protección de datos*, v3.0, junio 2026 ([PDF oficial](https://intef.es/wp-content/uploads/2026/07/Orientaciones_sobre_el_uso_de_herramientas_digital.pdf)), licencia [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.es).
- **Código fuente**: licencia [GNU AGPL v3.0 o posterior](LICENSE).
- **Iconos**: [Lucide](https://lucide.dev) (licencia ISC), integrados en SVG inline sin peticiones externas.
- **Dirección y revisión**: [Juan José de Haro](https://bilateria.org) · Cocreación con IA ([MIAE nivel 4](https://jjdeharo.github.io/miae/?nivel=4)).
