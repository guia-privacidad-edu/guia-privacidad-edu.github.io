// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Guía de privacidad de herramientas educativas
 * Lógica de consulta, filtrado, asistente guiado y ficha detallada.
 * Funciona íntegramente en el navegador sobre datos/guia-intef.json
 * y datos/enlaces-herramientas.json sin enviar datos a ningún servidor.
 */

(function () {
  "use strict";

  const POR_PAGINA = 24;

  // Ámbitos cotidianos para el asistente «Ayúdame a elegir» (agrupan varias categorías por palabra clave)
  const AMBITOS_ASISTENTE = [
    { id: "todos", etiqueta: "Cualquier tipo de herramienta", palabras: [] },
    { id: "actividades", etiqueta: "Actividades interactivas, juegos y cuestionarios", palabras: ["ACTIVIDADES INTERACTIVAS", "CUESTIONARIOS", "GAMIFICACIÓN", "EVALUACIÓN"] },
    { id: "ia", etiqueta: "Inteligencia artificial (IA)", palabras: ["INTELIGENCIA ARTIFICIAL", "DETECTORES DE IA", "CHATBOT"] },
    { id: "presentaciones", etiqueta: "Presentaciones, infografías y murales", palabras: ["PRESENTACIONES", "INFOGRAFÍAS", "MUROS", "PIZARRAS", "LÍNEAS DEL TIEMPO", "MAPAS MENTALES", "DIAGRAMAS"] },
    { id: "multimedia", etiqueta: "Vídeo, audio, pódcast e imagen", palabras: ["VÍDEO", "AUDIO", "IMAGEN", "FOTOGRAFÍA", "ANIMACIÓN", "GRABACIÓN DE PANTALLA", "CÓMICS", "AVATARES"] },
    { id: "documentos", etiqueta: "Documentos, lectura, idiomas y escritura", palabras: ["DOCUMENTOS", "IDIOMAS", "OFIMÁTICA", "CURACIÓN", "GESTIÓN DE REFERENCIAS", "DICTADO", "TEXTO", "EDICIÓN EPUB"] },
    { id: "ciencias", etiqueta: "Ciencias, matemáticas, geografía y mapas", palabras: ["CIENCIAS", "MATEMÁTICAS", "ASTRONOMÍA", "GEOGRAFÍA", "MAPAS", "ANÁLISIS ESTADÍSTICO", "ELECTRÓNICA"] },
    { id: "programacion", etiqueta: "Programación, web, robótica y 3D", palabras: ["PROGRAMACIÓN", "ROBÓTICA", "CREACIÓN, DISEÑO Y PUBLICACIÓN WEB", "EDICIÓN DE PÁGINAS WEB", "REALIDAD AUMENTADA", "DIBUJO, DISEÑO", "EDICIÓN DE GRÁFICOS"] },
    { id: "organizacion", etiqueta: "Organización, aula, debate y accesibilidad", palabras: ["ACCESIBILIDAD", "DEBATE", "ORGANIZACIÓN", "GESTIÓN DE AULA", "CIBERSEGURIDAD", "CÓDIGOS QR", "MOTORES DE BÚSQUEDA"] }
  ];

  const estado = {
    datos: null,
    enlaces: {},
    herramientas: [],
    categoriasMapa: new Map(),
    filtradas: [],
    busqueda: "",
    semaforo: "TODOS",       // TODOS | VERDE | AMARILLO | ROJO
    uso: "TODOS",            // TODOS | ALUMNADO_VERDE | SOLO_DOCENTE
    categoria: "",           // categoria_id o ""
    ambito: "",              // id de AMBITOS_ASISTENTE (opcional, desde el asistente)
    extras: {
      sin_registro: false,
      software_libre: false,
      embebible: false,
      accesibilidad: false
    },
    orden: "semaforo",       // semaforo | nombre | categoria | fecha
    pagina: 1,
    fichaAbiertaId: null
  };

  // Referencias al DOM
  const dom = {
    buscador: document.getElementById("buscador"),
    btnLimpiarBusq: document.getElementById("btn-limpiar-busq"),
    selCategoria: document.getElementById("sel-categoria"),
    selOrden: document.getElementById("sel-orden"),
    contador: document.getElementById("contador-resultados"),
    avisoCategoria: document.getElementById("aviso-categoria"),
    lista: document.getElementById("lista-tarjetas"),
    vacio: document.getElementById("estado-vacio"),
    paginacion: document.getElementById("paginacion"),
    btnRestablecer: document.getElementById("btn-restablecer"),
    btnVacioLimpiar: document.getElementById("btn-vacio-limpiar"),
    btnCompartirVista: document.getElementById("btn-compartir-vista"),
    btnAsistente: document.getElementById("btn-asistente"),
    btnMarco: document.getElementById("btn-marco"),
    btnTema: document.getElementById("btn-tema"),
    enlaceInicio: document.getElementById("enlace-inicio"),
    numVerde: document.getElementById("num-verde"),
    numAmarillo: document.getElementById("num-amarillo"),
    numRojo: document.getElementById("num-rojo"),
    modalFicha: document.getElementById("modal-ficha"),
    fichaTitulo: document.getElementById("ficha-titulo"),
    fichaSub: document.getElementById("ficha-sub"),
    fichaCuerpo: document.getElementById("ficha-cuerpo"),
    btnCompartirFicha: document.getElementById("btn-compartir-ficha"),
    modalAsistente: document.getElementById("modal-asistente"),
    formAsistente: document.getElementById("form-asistente"),
    asistenteAmbitos: document.getElementById("asistente-ambitos"),
    modalMarco: document.getElementById("modal-marco"),
    marcoCuerpo: document.getElementById("marco-cuerpo"),
    toast: document.getElementById("toast")
  };

  let temporizadorToast = null;

  function normalizarTexto(txt) {
    return (txt || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function escaparHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mostrarToast(mensaje) {
    if (!dom.toast) return;
    dom.toast.textContent = mensaje;
    dom.toast.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () {
      dom.toast.hidden = true;
    }, 3200);
  }

  // Tema claro/oscuro siguiendo el sistema y recordando solo si se cambia a mano
  function iniciarTema() {
    var raiz = document.documentElement;
    var sistema = window.matchMedia("(prefers-color-scheme: dark)");
    function esOscuro() {
      return raiz.dataset.theme ? raiz.dataset.theme === "dark" : sistema.matches;
    }
    function aplicar() {
      raiz.dataset.theme = esOscuro() ? "dark" : "light";
    }
    aplicar();
    sistema.addEventListener("change", function () {
      try {
        if (!localStorage.getItem("gpe.tema")) {
          delete raiz.dataset.theme;
          aplicar();
        }
      } catch (_) {
        aplicar();
      }
    });
    if (dom.btnTema) {
      dom.btnTema.addEventListener("click", function () {
        var nuevo = esOscuro() ? "light" : "dark";
        raiz.dataset.theme = nuevo;
        try {
          if ((nuevo === "dark") === sistema.matches) localStorage.removeItem("gpe.tema");
          else localStorage.setItem("gpe.tema", nuevo);
        } catch (_) {}
      });
    }
  }

  // Metadatos derivados para filtrado rápido y comprensible
  function prepararHerramienta(h) {
    var escenarios = h.escenarios || [];
    var colores = [];
    escenarios.forEach(function (e) {
      if (e.semaforo && colores.indexOf(e.semaforo) === -1) colores.push(e.semaforo);
    });

    // Prioridad para ordenar: VERDE (0) < AMARILLO (1) < ROJO (2)
    var mejorColor = colores.indexOf("VERDE") !== -1 ? 0 : colores.indexOf("AMARILLO") !== -1 ? 1 : 2;

    var permiteSinRegistro = escenarios.some(function (e) {
      var r = normalizarTexto(e.requiere_registro);
      return (
        r === "no" ||
        r.indexOf("sin registro") !== -1 ||
        r.indexOf("no necesitan registrarse") !== -1 ||
        r.indexOf("no se requiere") !== -1 ||
        r.indexOf("invitados") !== -1
      );
    });

    var esSoftwareLibre = escenarios.some(function (e) {
      return e.software_libre === "SI";
    });

    var esEmbebible = escenarios.some(function (e) {
      return e.embebible === "SI";
    });

    var tieneAccesibilidad = escenarios.some(function (e) {
      var txt = (e.accesibilidad_texto || "").trim();
      return (e.enlaces_accesibilidad && e.enlaces_accesibilidad.length > 0) || (txt && txt.toUpperCase() !== "X");
    });

    // ¿Tiene algún escenario en verde utilizable con alumnado (sin prohibición "NO")?
    var alumnadoVerde = escenarios.some(function (e) {
      if (e.semaforo !== "VERDE") return false;
      var al = normalizarTexto(e.alumnado);
      return al.indexOf("no,") !== 0 && al !== "no";
    });

    // ¿Permite uso por el docente o que el alumnado solo visualice producciones creadas por el docente?
    var soloDocente = escenarios.some(function (e) {
      var al = normalizarTexto(e.alumnado);
      var pr = normalizarTexto(e.profesorado);
      return (
        e.semaforo === "VERDE" ||
        al.indexOf("visualizar") !== -1 ||
        al.indexOf("creadas por el docente") !== -1 ||
        pr.indexOf("titulo individual") !== -1
      );
    });

    // Fecha más reciente (YYYYMMDD para ordenación)
    var mejorFechaNum = 0;
    var mejorFechaStr = "";
    escenarios.forEach(function (e) {
      var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(e.fecha_comprobacion || "");
      if (m) {
        var n = parseInt(m[3] + m[2] + m[1], 10);
        if (n > mejorFechaNum) {
          mejorFechaNum = n;
          mejorFechaStr = e.fecha_comprobacion;
        }
      }
    });

    // Índice de búsqueda libre (nombre, descripción, categoría, subcategoría, observaciones)
    var textoBusqueda = normalizarTexto(
      [
        h.nombre,
        h.descripcion,
        h.categoria,
        h.subcategoria || "",
        escenarios.map(function (e) { return e.otros || ""; }).join(" ")
      ].join(" ")
    );

    var enlaceInfo = estado.enlaces[h.id] || null;
    var urlAcceso = enlaceInfo && enlaceInfo.url && enlaceInfo.estado !== "revisar" ? enlaceInfo.url : null;

    return Object.assign({}, h, {
      _colores: colores,
      _mejorColor: mejorColor,
      _sinRegistro: permiteSinRegistro,
      _softwareLibre: esSoftwareLibre,
      _embebible: esEmbebible,
      _accesibilidad: tieneAccesibilidad,
      _alumnadoVerde: alumnadoVerde,
      _soloDocente: soloDocente,
      _fechaNum: mejorFechaNum,
      _fechaStr: mejorFechaStr,
      _busqueda: textoBusqueda,
      _nombreNorm: normalizarTexto(h.nombre),
      _urlAcceso: urlAcceso,
      _enlaceInfo: enlaceInfo
    });
  }

  function textoSemaforoCorto(color) {
    if (color === "VERDE") return "Verde · Sin datos personales";
    if (color === "AMARILLO") return "Amarillo · Requiere autorización";
    if (color === "ROJO") return "Rojo · No cumple RGPD";
    return color;
  }

  function iconoExterno() {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  }

  function leerEstadoDesdeUrl() {
    var p = new URLSearchParams(window.location.search);
    estado.busqueda = p.get("q") || "";
    var sem = (p.get("sem") || "TODOS").toUpperCase();
    estado.semaforo = ["TODOS", "VERDE", "AMARILLO", "ROJO"].indexOf(sem) !== -1 ? sem : "TODOS";
    var uso = (p.get("uso") || "TODOS").toUpperCase();
    estado.uso = ["TODOS", "ALUMNADO_VERDE", "SOLO_DOCENTE"].indexOf(uso) !== -1 ? uso : "TODOS";
    estado.categoria = p.get("cat") || "";
    estado.ambito = p.get("amb") || "";
    estado.extras.sin_registro = p.get("sr") === "1";
    estado.extras.software_libre = p.get("sl") === "1";
    estado.extras.embebible = p.get("emb") === "1";
    estado.extras.accesibilidad = p.get("acc") === "1";
    var ord = p.get("ord") || "semaforo";
    estado.orden = ["semaforo", "nombre", "categoria", "fecha"].indexOf(ord) !== -1 ? ord : "semaforo";
    estado.pagina = Math.max(1, parseInt(p.get("p") || "1", 10) || 1);
    estado.fichaAbiertaId = p.get("h") || null;
  }

  function construirUrlActual(incluirFichaId) {
    var p = new URLSearchParams();
    if (estado.busqueda.trim()) p.set("q", estado.busqueda.trim());
    if (estado.semaforo !== "TODOS") p.set("sem", estado.semaforo.toLowerCase());
    if (estado.uso !== "TODOS") p.set("uso", estado.uso.toLowerCase());
    if (estado.categoria) p.set("cat", estado.categoria);
    if (estado.ambito) p.set("amb", estado.ambito);
    if (estado.extras.sin_registro) p.set("sr", "1");
    if (estado.extras.software_libre) p.set("sl", "1");
    if (estado.extras.embebible) p.set("emb", "1");
    if (estado.extras.accesibilidad) p.set("acc", "1");
    if (estado.orden !== "semaforo") p.set("ord", estado.orden);
    if (estado.pagina > 1) p.set("p", String(estado.pagina));
    if (incluirFichaId) p.set("h", incluirFichaId);
    var qs = p.toString();
    return window.location.origin + window.location.pathname + (qs ? "?" + qs : "");
  }

  function sincronizarUrl() {
    var nueva = construirUrlActual(estado.fichaAbiertaId);
    if (nueva !== window.location.href) {
      window.history.replaceState(null, "", nueva);
    }
  }

  function sincronizarControles() {
    dom.buscador.value = estado.busqueda;
    dom.btnLimpiarBusq.hidden = !estado.busqueda;
    dom.selCategoria.value = estado.categoria;
    dom.selOrden.value = estado.orden;

    document.querySelectorAll("[data-semaforo]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.semaforo === estado.semaforo ? "true" : "false");
    });
    document.querySelectorAll("[data-uso]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.uso === estado.uso ? "true" : "false");
    });
    document.querySelectorAll("[data-extra]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", estado.extras[btn.dataset.extra] ? "true" : "false");
    });

    var hayFiltros =
      Boolean(estado.busqueda.trim()) ||
      estado.semaforo !== "TODOS" ||
      estado.uso !== "TODOS" ||
      Boolean(estado.categoria) ||
      Boolean(estado.ambito) ||
      estado.extras.sin_registro ||
      estado.extras.software_libre ||
      estado.extras.embebible ||
      estado.extras.accesibilidad;

    dom.btnRestablecer.hidden = !hayFiltros;
  }

  function coincideAmbito(h, ambitoId) {
    if (!ambitoId || ambitoId === "todos") return true;
    var amb = AMBITOS_ASISTENTE.find(function (a) { return a.id === ambitoId; });
    if (!amb || !amb.palabras.length) return true;
    var catUp = (h.categoria || "").toUpperCase();
    return amb.palabras.some(function (kw) {
      return catUp.indexOf(kw) !== -1;
    });
  }

  function aplicarFiltros() {
    var terminos = normalizarTexto(estado.busqueda).split(/\s+/).filter(Boolean);

    var res = estado.herramientas.filter(function (h) {
      if (estado.semaforo !== "TODOS" && h._colores.indexOf(estado.semaforo) === -1) return false;
      if (estado.uso === "ALUMNADO_VERDE" && !h._alumnadoVerde) return false;
      if (estado.uso === "SOLO_DOCENTE" && !h._soloDocente) return false;
      if (estado.categoria && h.categoria_id !== estado.categoria) return false;
      if (estado.ambito && !coincideAmbito(h, estado.ambito)) return false;
      if (estado.extras.sin_registro && !h._sinRegistro) return false;
      if (estado.extras.software_libre && !h._softwareLibre) return false;
      if (estado.extras.embebible && !h._embebible) return false;
      if (estado.extras.accesibilidad && !h._accesibilidad) return false;
      if (terminos.length) {
        for (var i = 0; i < terminos.length; i++) {
          if (h._busqueda.indexOf(terminos[i]) === -1) return false;
        }
      }
      return true;
    });

    // Ordenación
    res.sort(function (a, b) {
      // Si hay búsqueda exacta en el nombre, priorizarla
      if (terminos.length) {
        var qNorm = terminos.join(" ");
        var aIni = a._nombreNorm.indexOf(qNorm) === 0 ? 0 : a._nombreNorm.indexOf(qNorm) !== -1 ? 1 : 2;
        var bIni = b._nombreNorm.indexOf(qNorm) === 0 ? 0 : b._nombreNorm.indexOf(qNorm) !== -1 ? 1 : 2;
        if (aIni !== bIni) return aIni - bIni;
      }
      if (estado.orden === "semaforo") {
        if (a._mejorColor !== b._mejorColor) return a._mejorColor - b._mejorColor;
        return a._nombreNorm.localeCompare(b._nombreNorm, "es");
      }
      if (estado.orden === "nombre") {
        return a._nombreNorm.localeCompare(b._nombreNorm, "es");
      }
      if (estado.orden === "categoria") {
        var c = a.categoria.localeCompare(b.categoria, "es");
        return c !== 0 ? c : a._nombreNorm.localeCompare(b._nombreNorm, "es");
      }
      if (estado.orden === "fecha") {
        if (a._fechaNum !== b._fechaNum) return b._fechaNum - a._fechaNum;
        return a._nombreNorm.localeCompare(b._nombreNorm, "es");
      }
      return 0;
    });

    estado.filtradas = res;
    var totalPags = Math.max(1, Math.ceil(res.length / POR_PAGINA));
    if (estado.pagina > totalPags) estado.pagina = totalPags;

    sincronizarControles();
    sincronizarUrl();
    pintarResultados();
  }

  function pintarAvisoCategoria() {
    if (estado.categoria && estado.categoriasMapa.has(estado.categoria)) {
      var cat = estado.categoriasMapa.get(estado.categoria);
      dom.avisoCategoria.innerHTML =
        "<strong>" + escaparHtml(cat.nombre) + "</strong>" +
        (cat.descripcion ? "<span>" + escaparHtml(cat.descripcion) + "</span>" : "");
      dom.avisoCategoria.hidden = false;
      return;
    }
    if (estado.ambito) {
      var amb = AMBITOS_ASISTENTE.find(function (a) { return a.id === estado.ambito; });
      if (amb) {
        dom.avisoCategoria.innerHTML =
          "<strong>Selección del asistente: " + escaparHtml(amb.etiqueta) + "</strong>" +
          "<span>Puedes ajustar cualquier filtro o pulsar «Limpiar filtros» para volver al listado completo.</span>";
        dom.avisoCategoria.hidden = false;
        return;
      }
    }
    dom.avisoCategoria.hidden = true;
  }

  function pintarResultados() {
    var total = estado.filtradas.length;
    var totalGlobal = estado.herramientas.length;

    if (total === totalGlobal) {
      dom.contador.innerHTML = "Mostrando <strong>" + total.toLocaleString("es-ES") + "</strong> herramientas analizadas";
    } else {
      dom.contador.innerHTML =
        "<strong>" + total.toLocaleString("es-ES") + "</strong> de " +
        totalGlobal.toLocaleString("es-ES") + " herramientas cumplen estos criterios";
    }

    pintarAvisoCategoria();

    if (total === 0) {
      dom.lista.innerHTML = "";
      dom.vacio.hidden = false;
      dom.paginacion.innerHTML = "";
      return;
    }

    dom.vacio.hidden = true;
    var inicio = (estado.pagina - 1) * POR_PAGINA;
    var porcion = estado.filtradas.slice(inicio, inicio + POR_PAGINA);

    var htmlTarjetas = porcion.map(function (h) {
      var badges = h._colores.map(function (c) {
        var simbolo = c === "VERDE" ? "✓" : c === "AMARILLO" ? "!" : "✕";
        return '<span class="insignia insignia-' + c + '"><span aria-hidden="true">' + simbolo + '</span> ' + c + "</span>";
      }).join("");

      var etiquetas = [];
      if (h.escenarios.length > 1) {
        etiquetas.push('<span class="etq etq-aviso">' + h.escenarios.length + " modos de uso</span>");
      }
      if (h._sinRegistro) etiquetas.push('<span class="etq">Sin registro</span>');
      if (h._softwareLibre) etiquetas.push('<span class="etq">Software libre</span>');
      if (h._embebible) etiquetas.push('<span class="etq">Embebible</span>');

      var catTexto = h.categoria + (h.subcategoria ? " · " + h.subcategoria : "");
      var btnWeb = h._urlAcceso
        ? '<a class="btn btn-suave" href="' + escaparHtml(h._urlAcceso) + '" target="_blank" rel="noopener">Abrir web ' + iconoExterno() + "</a>"
        : "";

      return (
        '<article class="tarjeta">' +
          '<div class="tarjeta-cab">' +
            '<h2 class="tarjeta-titulo"><button type="button" data-abrir-ficha="' + escaparHtml(h.id) + '">' + escaparHtml(h.nombre) + "</button></h2>" +
            '<div class="badges-semaforo">' + badges + "</div>" +
          "</div>" +
          '<p class="tarjeta-cat">' + escaparHtml(catTexto) + "</p>" +
          '<p class="tarjeta-desc">' + escaparHtml(h.descripcion || "Sin descripción en el documento.") + "</p>" +
          (etiquetas.length ? '<div class="tarjeta-etiquetas">' + etiquetas.join("") + "</div>" : "") +
          '<div class="tarjeta-pie">' +
            '<button type="button" class="btn btn-secundario" data-abrir-ficha="' + escaparHtml(h.id) + '">Ver indicaciones</button>' +
            btnWeb +
          "</div>" +
        "</article>"
      );
    }).join("");

    dom.lista.innerHTML = htmlTarjetas;
    pintarPaginacion(total);
  }

  function pintarPaginacion(total) {
    var totalPags = Math.ceil(total / POR_PAGINA);
    if (totalPags <= 1) {
      dom.paginacion.innerHTML = "";
      return;
    }

    var actual = estado.pagina;
    var partes = [];

    partes.push(
      '<button type="button" class="btn" data-pag="' + (actual - 1) + '"' +
      (actual <= 1 ? " disabled" : "") + ">← Anterior</button>"
    );

    // Mostrar primera, última y entorno de la actual
    var paginas = new Set([1, totalPags, actual - 1, actual, actual + 1]);
    var ordenadas = Array.from(paginas).filter(function (p) {
      return p >= 1 && p <= totalPags;
    }).sort(function (a, b) { return a - b; });

    var anterior = 0;
    ordenadas.forEach(function (p) {
      if (anterior && p - anterior > 1) {
        partes.push('<span class="paginacion-info" aria-hidden="true">…</span>');
      }
      partes.push(
        '<button type="button" class="btn" data-pag="' + p + '"' +
        (p === actual ? ' aria-current="page"' : "") + ">" + p + "</button>"
      );
      anterior = p;
    });

    partes.push(
      '<button type="button" class="btn" data-pag="' + (actual + 1) + '"' +
      (actual >= totalPags ? " disabled" : "") + ">Siguiente →</button>"
    );

    dom.paginacion.innerHTML = partes.join("");
  }

  function textoCampoSiX(valor, tipo) {
    if (valor === "SI") return { texto: "Sí", nota: "" };
    if (valor === "NO") return { texto: "No", nota: "" };
    if (valor === "X") {
      if (tipo === "sw") {
        return { texto: "No consta (X)", nota: "Según el INTEF, «X» puede indicar que no es libre o que no pudo confirmarse." };
      }
      if (tipo === "emb") {
        return { texto: "No consta (X)", nota: "Según el INTEF, «X» puede indicar que no es embebible, no en versión gratuita o requiere código avanzado." };
      }
    }
    return { texto: valor || "No consta", nota: "" };
  }

  function esFechaAntigua(fechaStr) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fechaStr || "");
    if (!m) return false;
    return parseInt(m[3], 10) < 2025;
  }

  function renderListaEnlaces(urls, etiquetaBase) {
    var validas = (urls || []).filter(function (u) {
      return /^https?:\/\//i.test(u || "");
    });
    if (!validas.length) return "";
    return (
      '<div class="enlaces-lista">' +
      validas.map(function (u, i) {
        var texto = validas.length > 1 ? etiquetaBase + " (" + (i + 1) + ")" : etiquetaBase;
        return '<a class="enlace-pildora" href="' + escaparHtml(u) + '" target="_blank" rel="noopener">' + escaparHtml(texto) + " " + iconoExterno() + "</a>";
      }).join("") +
      "</div>"
    );
  }

  function abrirFicha(idHerramienta) {
    var h = estado.herramientas.find(function (x) { return x.id === idHerramienta; });
    if (!h) return;

    estado.fichaAbiertaId = h.id;
    sincronizarUrl();

    dom.fichaTitulo.textContent = h.nombre;
    dom.fichaSub.textContent =
      h.categoria +
      (h.subcategoria ? " · " + h.subcategoria : "") +
      " · Ficha n.º " + h.numero + " (pág. " + h.pagina + " del PDF del INTEF)";

    var bloques = [];

    // Descripción + acceso directo a la herramienta si hay URL verificada
    bloques.push("<p style=\"margin:0\">" + escaparHtml(h.descripcion) + "</p>");

    if (h._urlAcceso) {
      var fechaUrl = h._enlaceInfo && h._enlaceInfo.comprobado ? " · comprobado " + h._enlaceInfo.comprobado : "";
      bloques.push(
        '<div class="ficha-barra-web">' +
          '<div>' +
            '<strong>Acceso directo a la herramienta</strong>' +
            '<p class="ficha-web-nota">Enlace añadido y verificado aparte del PDF del INTEF' + escaparHtml(fechaUrl) + ".</p>" +
          "</div>" +
          '<a class="btn btn-primario" href="' + escaparHtml(h._urlAcceso) + '" target="_blank" rel="noopener">Abrir herramienta ' + iconoExterno() + "</a>" +
        "</div>"
      );
    }

    if (h.escenarios.length > 1) {
      bloques.push(
        '<div class="aviso-categoria" style="margin:0">' +
          "<strong>Esta herramienta tiene " + h.escenarios.length + " modos de uso analizados</strong>" +
          "<span>El semáforo cambia según cómo se utilice (por ejemplo, con registro o sin registro). Revisa cada bloque.</span>" +
        "</div>"
      );
    }

    h.escenarios.forEach(function (esc, idx) {
      var sem = esc.semaforo || "AMARILLO";
      var sw = textoCampoSiX(esc.software_libre, "sw");
      var emb = textoCampoSiX(esc.embebible, "emb");
      var fechaNota = esFechaAntigua(esc.fecha_comprobacion)
        ? '<span class="dato-nota">Revisión de ' + escaparHtml(esc.fecha_comprobacion) + ": conviene comprobar si la política ha cambiado.</span>"
        : "";

      var tituloEsc =
        (h.escenarios.length > 1 ? "Modo " + (idx + 1) + " · " : "") +
        textoSemaforoCorto(sem);

      var linksPriv = renderListaEnlaces(esc.enlaces_privacidad, "Política de privacidad");
      var linksAcc = renderListaEnlaces(esc.enlaces_accesibilidad, "Información de accesibilidad");
      var linksOtros = renderListaEnlaces(esc.enlaces_otros, "Enlace citado en la guía");

      var textoOtros = (esc.otros || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
      var textoAcc = (esc.accesibilidad_texto || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
      if (textoAcc.toUpperCase() === "X") textoAcc = "";

      bloques.push(
        '<section class="escenario-caja">' +
          '<div class="escenario-cab sem-' + sem + '">' +
            '<span class="escenario-titulo">' + escaparHtml(tituloEsc) + "</span>" +
            '<span class="escenario-fecha">Comprobado: ' + escaparHtml(esc.fecha_comprobacion || "sin fecha") + "</span>" +
          "</div>" +
          '<div class="escenario-cuerpo">' +
            '<div class="roles-rejilla">' +
              '<div class="rol-caja">' +
                "<h4>Para el profesorado</h4>" +
                "<p>" + escaparHtml(esc.profesorado || "Sin indicaciones específicas.") + "</p>" +
              "</div>" +
              '<div class="rol-caja">' +
                "<h4>Para el alumnado</h4>" +
                "<p>" + escaparHtml(esc.alumnado || "Sin indicaciones específicas.") + "</p>" +
              "</div>" +
            "</div>" +

            '<div class="datos-tabla">' +
              '<div class="dato-item">' +
                '<span class="dato-clave">¿Requiere registro?</span>' +
                "<span>" + escaparHtml(esc.requiere_registro || "No consta") + "</span>" +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">Software libre / código abierto</span>' +
                "<span>" + escaparHtml(sw.texto) + "</span>" +
                (sw.nota ? '<span class="dato-nota">' + escaparHtml(sw.nota) + "</span>" : "") +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">Embebible</span>' +
                "<span>" + escaparHtml(emb.texto) + "</span>" +
                (emb.nota ? '<span class="dato-nota">' + escaparHtml(emb.nota) + "</span>" : "") +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">Fecha de comprobación</span>' +
                "<span>" + escaparHtml(esc.fecha_comprobacion || "No consta") + "</span>" +
                fechaNota +
              "</div>" +
            "</div>" +

            (textoOtros || linksOtros
              ? '<div><strong>Observaciones de la guía:</strong> ' +
                (textoOtros ? "<span>" + escaparHtml(textoOtros) + "</span>" : "") +
                linksOtros + "</div>"
              : "") +

            (linksPriv || linksAcc || textoAcc
              ? '<div><strong>Documentación oficial revisada por el INTEF:</strong>' +
                linksPriv +
                linksAcc +
                (textoAcc ? '<p class="ficha-web-nota">' + escaparHtml(textoAcc) + "</p>" : "") +
                "</div>"
              : "") +
          "</div>" +
        "</section>"
      );
    });

    // Desplegable contextual con las Advertencias y Orientaciones sin salir de la ficha
    if (estado.datos && estado.datos.marco) {
      var m = estado.datos.marco;
      var advHtml = "<ol>" + m.advertencias.map(function (a) { return "<li>" + escaparHtml(a) + "</li>"; }).join("") + "</ol>";
      bloques.push(
        '<details class="desplegable">' +
          "<summary>Consultar las 11 advertencias oficiales del INTEF (referenciadas en esta ficha)</summary>" +
          '<div class="desplegable-contenido">' + advHtml + "</div>" +
        "</details>"
      );
    }

    dom.fichaCuerpo.innerHTML = bloques.join("");
    dom.modalFicha.showModal();
  }

  function pintarMarcoOficial() {
    if (!estado.datos || !estado.datos.marco) return;
    var m = estado.datos.marco;
    var f = estado.datos.fuente;

    var partes = [
      '<div class="aviso-categoria" style="margin:0"><strong>Aviso importante del INTEF</strong><span>' + escaparHtml(m.importante) + "</span></div>",
      '<details class="desplegable" open>' +
        "<summary>11 advertencias generales antes de usar cualquier herramienta</summary>" +
        '<div class="desplegable-contenido"><ol>' +
        m.advertencias.map(function (a) { return "<li>" + escaparHtml(a) + "</li>"; }).join("") +
        "</ol></div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>Orientaciones: herramientas sin datos personales (verde)</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.sin_datos_personales.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>Orientaciones: tratamiento anonimizado o seudonimizado</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.anonimizado.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>Orientaciones: tratamiento no anonimizado (amarillo / rojo)</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.no_anonimizado.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>Qué significa la «X» en Software libre y Embebible</summary>" +
        '<div class="desplegable-contenido">' +
          "<p><strong>Software libre y/o código abierto:</strong> " + escaparHtml(m.aclaracion_software_libre) + "</p>" +
          "<p><strong>Embebible:</strong> " + escaparHtml(m.aclaracion_embebible) + "</p>" +
        "</div>" +
      "</details>",
      '<div class="ficha-barra-web">' +
        '<div><strong>¿Tu herramienta no está en la guía?</strong><p class="ficha-web-nota">El Anexo I del PDF oficial del INTEF (págs. 200–209) ofrece un modelo de evaluación para consultar a la Delegación de Protección de Datos de tu centro o administración.</p></div>' +
        '<a class="btn btn-primario" href="' + escaparHtml(f.url_pdf) + '" target="_blank" rel="noopener">Abrir PDF oficial ' + iconoExterno() + "</a>" +
      "</div>"
    ];

    dom.marcoCuerpo.innerHTML = partes.join("");
  }

  function pintarOpcionesAsistente() {
    dom.asistenteAmbitos.innerHTML = AMBITOS_ASISTENTE.map(function (amb, idx) {
      return (
        '<label class="asistente-radio">' +
          '<input type="radio" name="asist_ambito" value="' + escaparHtml(amb.id) + '"' + (idx === 0 ? " checked" : "") + ">" +
          "<span>" + escaparHtml(amb.etiqueta) + "</span>" +
        "</label>"
      );
    }).join("");
  }

  function compartirEnlace(url, titulo) {
    if (navigator.share) {
      navigator.share({ title: titulo, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () {
        mostrarToast("Enlace copiado al portapapeles");
      }).catch(function () {
        mostrarToast("No se pudo copiar el enlace");
      });
    } else {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        mostrarToast("Enlace copiado al portapapeles");
      } catch (_) {}
      ta.remove();
    }
  }

  function restablecerFiltros() {
    estado.busqueda = "";
    estado.semaforo = "TODOS";
    estado.uso = "TODOS";
    estado.categoria = "";
    estado.ambito = "";
    estado.extras.sin_registro = false;
    estado.extras.software_libre = false;
    estado.extras.embebible = false;
    estado.extras.accesibilidad = false;
    estado.orden = "semaforo";
    estado.pagina = 1;
    aplicarFiltros();
  }

  function vincularEventos() {
    var timerBusq = null;
    dom.buscador.addEventListener("input", function () {
      estado.busqueda = dom.buscador.value;
      dom.btnLimpiarBusq.hidden = !estado.busqueda;
      estado.pagina = 1;
      clearTimeout(timerBusq);
      timerBusq = setTimeout(aplicarFiltros, 120);
    });

    dom.btnLimpiarBusq.addEventListener("click", function () {
      estado.busqueda = "";
      dom.buscador.value = "";
      dom.buscador.focus();
      estado.pagina = 1;
      aplicarFiltros();
    });

    document.querySelectorAll("[data-semaforo]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.semaforo = btn.dataset.semaforo;
        estado.pagina = 1;
        aplicarFiltros();
      });
    });

    document.querySelectorAll("[data-uso]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.uso = btn.dataset.uso;
        estado.pagina = 1;
        aplicarFiltros();
      });
    });

    document.querySelectorAll("[data-extra]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var clave = btn.dataset.extra;
        estado.extras[clave] = !estado.extras[clave];
        estado.pagina = 1;
        aplicarFiltros();
      });
    });

    dom.selCategoria.addEventListener("change", function () {
      estado.categoria = dom.selCategoria.value;
      estado.ambito = "";
      estado.pagina = 1;
      aplicarFiltros();
    });

    dom.selOrden.addEventListener("change", function () {
      estado.orden = dom.selOrden.value;
      estado.pagina = 1;
      aplicarFiltros();
    });

    dom.btnRestablecer.addEventListener("click", restablecerFiltros);
    dom.btnVacioLimpiar.addEventListener("click", restablecerFiltros);

    dom.enlaceInicio.addEventListener("click", function (ev) {
      ev.preventDefault();
      restablecerFiltros();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    dom.lista.addEventListener("click", function (ev) {
      if (ev.target.closest("a")) return;
      var btn = ev.target.closest("[data-abrir-ficha]");
      if (btn) {
        abrirFicha(btn.dataset.abrirFicha);
        return;
      }
      var tarjeta = ev.target.closest(".tarjeta");
      if (tarjeta) {
        var b = tarjeta.querySelector("[data-abrir-ficha]");
        if (b) abrirFicha(b.dataset.abrirFicha);
      }
    });

    dom.paginacion.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-pag]");
      if (!btn || btn.disabled) return;
      estado.pagina = parseInt(btn.dataset.pag, 10) || 1;
      sincronizarUrl();
      pintarResultados();
      document.getElementById("resultados").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    dom.btnCompartirVista.addEventListener("click", function () {
      compartirEnlace(construirUrlActual(null), document.title);
    });

    dom.btnCompartirFicha.addEventListener("click", function () {
      if (!estado.fichaAbiertaId) return;
      var h = estado.herramientas.find(function (x) { return x.id === estado.fichaAbiertaId; });
      var url = window.location.origin + window.location.pathname + "?h=" + encodeURIComponent(estado.fichaAbiertaId);
      compartirEnlace(url, (h ? h.nombre + " · " : "") + "Guía de privacidad de herramientas educativas");
    });

    dom.btnAsistente.addEventListener("click", function () {
      dom.modalAsistente.showModal();
    });

    dom.btnMarco.addEventListener("click", function () {
      dom.modalMarco.showModal();
    });

    dom.formAsistente.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(dom.formAsistente);
      var amb = fd.get("asist_ambito") || "todos";
      var quien = fd.get("asist_quien") || "ALUMNADO_VERDE";

      estado.busqueda = "";
      estado.categoria = "";
      estado.ambito = amb === "todos" ? "" : amb;
      estado.uso = quien;
      estado.semaforo = quien === "ALUMNADO_VERDE" ? "VERDE" : "TODOS";
      estado.extras.sin_registro = fd.get("asist_sin_reg") !== null;
      estado.extras.software_libre = fd.get("asist_libre") !== null;
      estado.extras.embebible = fd.get("asist_embebible") !== null;
      estado.extras.accesibilidad = false;
      estado.orden = "semaforo";
      estado.pagina = 1;

      dom.modalAsistente.close();
      aplicarFiltros();
      document.getElementById("resultados").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // Cerrar diálogos con botones o clic en el fondo
    document.querySelectorAll("[data-cerrar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dlg = document.getElementById(btn.dataset.cerrar);
        if (dlg && dlg.open) dlg.close();
      });
    });

    [dom.modalFicha, dom.modalAsistente, dom.modalMarco].forEach(function (dlg) {
      dlg.addEventListener("click", function (ev) {
        if (ev.target === dlg) dlg.close();
      });
    });

    dom.modalFicha.addEventListener("close", function () {
      estado.fichaAbiertaId = null;
      sincronizarUrl();
    });

    // Cerrar el toast al tocarlo
    dom.toast.addEventListener("click", function () {
      dom.toast.hidden = true;
    });
  }

  async function iniciar() {
    iniciarTema();
    pintarOpcionesAsistente();
    vincularEventos();
    leerEstadoDesdeUrl();

    try {
      var [respGuia, respEnlaces] = await Promise.all([
        fetch("datos/guia-intef.json"),
        fetch("datos/enlaces-herramientas.json").catch(function () { return null; })
      ]);

      if (!respGuia.ok) throw new Error("HTTP " + respGuia.status);
      estado.datos = await respGuia.json();

      if (respEnlaces && respEnlaces.ok) {
        var datosEnlaces = await respEnlaces.json();
        estado.enlaces = datosEnlaces.enlaces || {};
      }

      // Poblar mapa y selector de categorías con recuento real
      var cuentasCat = {};
      (estado.datos.herramientas || []).forEach(function (h) {
        cuentasCat[h.categoria_id] = (cuentasCat[h.categoria_id] || 0) + 1;
      });

      var frag = document.createDocumentFragment();
      (estado.datos.categorias || []).forEach(function (c) {
        estado.categoriasMapa.set(c.id, c);
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre + " (" + (cuentasCat[c.id] || 0) + ")";
        frag.appendChild(opt);
      });
      dom.selCategoria.appendChild(frag);

      estado.herramientas = (estado.datos.herramientas || []).map(prepararHerramienta);

      // Contadores de semáforo (cuántas herramientas tienen al menos un modo en cada color)
      var nVerde = estado.herramientas.filter(function (h) { return h._colores.indexOf("VERDE") !== -1; }).length;
      var nAmarillo = estado.herramientas.filter(function (h) { return h._colores.indexOf("AMARILLO") !== -1; }).length;
      var nRojo = estado.herramientas.filter(function (h) { return h._colores.indexOf("ROJO") !== -1; }).length;
      dom.numVerde.textContent = "(" + nVerde + ")";
      dom.numAmarillo.textContent = "(" + nAmarillo + ")";
      dom.numRojo.textContent = "(" + nRojo + ")";

      pintarMarcoOficial();
      aplicarFiltros();

      if (estado.fichaAbiertaId) {
        abrirFicha(estado.fichaAbiertaId);
      }
    } catch (err) {
      dom.contador.textContent = "No se pudieron cargar los datos de la guía.";
      console.error("Error cargando la guía:", err);
    }
  }

  iniciar();
})();
