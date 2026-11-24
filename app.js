// SPDX-License-Identifier: AGPL-3.0-or-later
/*
 * Guía de privacidad de herramientas educativas
 * Lógica de consulta, filtrado, asistente guiado, ficha detallada e interfaz multilingüe.
 * Funciona íntegramente en el navegador sobre datos/guia-intef.json,
 * datos/enlaces-herramientas.json y datos/vce-evaluadas.json sin enviar datos a ningún servidor.
 */

(function () {
  "use strict";

  const POR_PAGINA = 24;
  const IDIOMAS_SOPORTADOS = ["es", "ca", "gl", "eu", "en"];

  // Ámbitos cotidianos para el asistente «Ayúdame a elegir»
  const AMBITOS_ASISTENTE = [
    { id: "todos", palabras: [] },
    { id: "actividades", palabras: ["ACTIVIDADES INTERACTIVAS", "CUESTIONARIOS", "CUESTIONARIO", "GAMIFICACIÓN", "JUEGO", "EVALUACIÓN"] },
    { id: "ia", palabras: ["INTELIGENCIA ARTIFICIAL", "DETECTORES DE IA", "CHATBOT", "CON IA", "TUTOR"] },
    { id: "presentaciones", palabras: ["PRESENTACIONES", "PRESENTACIÓN", "INFOGRAFÍAS", "INFOGRAFÍA", "MUROS", "PIZARRAS", "LÍNEAS DEL TIEMPO", "MAPAS MENTALES", "DIAGRAMAS"] },
    { id: "multimedia", palabras: ["VÍDEO", "AUDIO", "IMAGEN", "FOTOGRAFÍA", "ANIMACIÓN", "GRABACIÓN DE PANTALLA", "CÓMICS", "AVATARES"] },
    { id: "documentos", palabras: ["DOCUMENTOS", "IDIOMAS", "OFIMÁTICA", "CURACIÓN", "GESTIÓN DE REFERENCIAS", "DICTADO", "TEXTO", "EDICIÓN EPUB", "TUTORIAL", "COLECCIÓN", "BIBLIOTECA"] },
    { id: "ciencias", palabras: ["CIENCIAS", "MATEMÁTICAS", "ASTRONOMÍA", "GEOGRAFÍA", "MAPAS", "MAPA INTERACTIVO", "ANÁLISIS ESTADÍSTICO", "ELECTRÓNICA", "SIMULADOR", "LABORATORIO", "VISUALIZACIÓN DE DATOS"] },
    { id: "programacion", palabras: ["PROGRAMACIÓN", "ROBÓTICA", "CREACIÓN, DISEÑO Y PUBLICACIÓN WEB", "EDICIÓN DE PÁGINAS WEB", "REALIDAD AUMENTADA", "DIBUJO, DISEÑO", "EDICIÓN DE GRÁFICOS"] },
    { id: "organizacion", palabras: ["ACCESIBILIDAD", "DEBATE", "ORGANIZACIÓN", "GESTIÓN DE AULA", "CIBERSEGURIDAD", "CÓDIGOS QR", "MOTORES DE BÚSQUEDA", "HERRAMIENTA DE CREACIÓN"] }
  ];

  const estado = {
    idioma: "es",
    datos: null,
    vce: null,
    enlaces: {},
    herramientas: [],
    categoriasMapa: new Map(),
    filtradas: [],
    busqueda: "",
    fuente: "TODAS",         // TODAS | INTEF | VCE
    semaforo: "TODOS",       // TODOS | VERDE | AMARILLO | ROJO
    uso: "TODOS",            // TODOS | ALUMNADO_VERDE | SOLO_DOCENTE
    categoria: "",           // categoria_id o ""
    ambito: "",              // id de AMBITOS_ASISTENTE
    extras: {
      sin_registro: false,
      software_libre: false,
      embebible: false,
      accesibilidad: false
    },
    orden: "semaforo",       // semaforo | nombre | categoria | fecha
    pagina: 1,
    fichaAbiertaId: null,
    enlaceBuscado: ""
  };

  const dom = {
    buscador: document.getElementById("buscador"),
    btnLimpiarBusq: document.getElementById("btn-limpiar-busq"),
    btnCategoria: document.getElementById("btn-categoria"),
    catActualTexto: document.getElementById("cat-actual-texto"),
    panelCategoria: document.getElementById("panel-categoria"),
    busqCategoria: document.getElementById("busq-categoria"),
    listaCategorias: document.getElementById("lista-categorias"),
    selOrden: document.getElementById("sel-orden"),
    contador: document.getElementById("contador-resultados"),
    avisoCategoria: document.getElementById("aviso-categoria"),
    notaIdiomaOficial: document.getElementById("nota-idioma-oficial"),
    lista: document.getElementById("lista-tarjetas"),
    vacio: document.getElementById("estado-vacio"),
    paginacion: document.getElementById("paginacion"),
    btnRestablecer: document.getElementById("btn-restablecer"),
    btnVacioLimpiar: document.getElementById("btn-vacio-limpiar"),
    btnCompartirVista: document.getElementById("btn-compartir-vista"),
    btnAsistente: document.getElementById("btn-asistente"),
    btnMarco: document.getElementById("btn-marco"),
    btnTema: document.getElementById("btn-tema"),
    btnIdioma: document.getElementById("btn-idioma"),
    menuIdiomas: document.getElementById("menu-idiomas"),
    idiomaActualCod: document.getElementById("idioma-actual-cod"),
    enlaceInicio: document.getElementById("enlace-inicio"),
    numSrcTodas: document.getElementById("num-src-todas"),
    numSrcIntef: document.getElementById("num-src-intef"),
    numSrcVce: document.getElementById("num-src-vce"),
    leyendaOrigen: document.getElementById("leyenda-origen"),
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

  function t(clave, params) {
    var dicc = (window.GPE_I18N && (window.GPE_I18N[estado.idioma] || window.GPE_I18N.es)) || {};
    var val = dicc[clave] !== undefined ? dicc[clave] : (window.GPE_I18N && window.GPE_I18N.es[clave]) || clave;
    if (params && typeof val === "string") {
      Object.keys(params).forEach(function (k) {
        val = val.replace(new RegExp("\\{" + k + "\\}", "g"), String(params[k]));
      });
    }
    return val;
  }

  function idiomaNavegador() {
    var langs = navigator.languages || [navigator.language || "es"];
    for (var i = 0; i < langs.length; i++) {
      var cod = String(langs[i] || "").slice(0, 2).toLowerCase();
      if (IDIOMAS_SOPORTADOS.indexOf(cod) !== -1) return cod;
    }
    return "es";
  }

  function detectarIdiomaInicial() {
    var p = new URLSearchParams(window.location.search);
    var qLang = (p.get("lang") || "").toLowerCase();
    if (IDIOMAS_SOPORTADOS.indexOf(qLang) !== -1) return qLang;
    try {
      var guardado = localStorage.getItem("gpe.idioma");
      if (guardado && IDIOMAS_SOPORTADOS.indexOf(guardado) !== -1) return guardado;
    } catch (_) {}
    return idiomaNavegador();
  }

  function aplicarIdiomaInterfaz(cod, repintar) {
    estado.idioma = IDIOMAS_SOPORTADOS.indexOf(cod) !== -1 ? cod : "es";
    var dicc = (window.GPE_I18N && (window.GPE_I18N[estado.idioma] || window.GPE_I18N.es)) || {};

    document.documentElement.lang = estado.idioma;
    document.title = t("pageTitle");

    if (dom.idiomaActualCod) dom.idiomaActualCod.textContent = t("langCode");
    if (dom.btnIdioma) {
      dom.btnIdioma.title = t("btnLangTitle");
      dom.btnIdioma.setAttribute("aria-label", t("btnLangTitle"));
    }
    if (dom.btnTema) {
      dom.btnTema.title = t("btnThemeTitle");
      dom.btnTema.setAttribute("aria-label", t("btnThemeTitle"));
    }
    if (dom.buscador) dom.buscador.placeholder = t("searchPlaceholder");
    if (dom.btnLimpiarBusq) {
      dom.btnLimpiarBusq.title = t("searchClear");
      dom.btnLimpiarBusq.setAttribute("aria-label", t("searchClear"));
    }

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.dataset.i18n;
      if (dicc[k] !== undefined) el.textContent = dicc[k];
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var k = el.dataset.i18nHtml;
      if (dicc[k] !== undefined) el.innerHTML = dicc[k];
    });
    document.querySelectorAll("[data-cerrar]").forEach(function (el) {
      if (el.classList.contains("btn-icono")) {
        el.title = t("closeLabel");
        el.setAttribute("aria-label", t("closeLabel"));
      }
    });
    document.querySelectorAll("[data-elegir-idioma]").forEach(function (b) {
      b.setAttribute("aria-current", b.dataset.elegirIdioma === estado.idioma ? "true" : "false");
    });

    // Nota discreta sobre idioma original del documento oficial en ca/gl/eu/en
    var nota = t("officialLangNote");
    if (dom.notaIdiomaOficial) {
      if (nota) {
        dom.notaIdiomaOficial.innerHTML = nota;
        dom.notaIdiomaOficial.hidden = false;
      } else {
        dom.notaIdiomaOficial.hidden = true;
      }
    }

    // Actualizar etiqueta y buscador del selector de categorías
    if (dom.busqCategoria) dom.busqCategoria.placeholder = t("catFilterPlaceholder");
    actualizarTextoCategoria();

    pintarOpcionesAsistente();
    if (repintar && estado.datos) {
      actualizarContadoresOrigen();
      pintarListaCategorias();
      pintarMarcoOficial();
      pintarResultados();
      if (estado.fichaAbiertaId && dom.modalFicha.open) {
        abrirFicha(estado.fichaAbiertaId, true);
      }
    }
  }

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

  function nombreCategoriaVisible(nombre) {
    return String(nombre || "").replace(/^VCE\s*·\s*/i, "");
  }

  function prepararHerramienta(h) {
    var escenarios = h.escenarios || [];
    var esVce = h.fuente === "vce";
    var cruceVce = h._cruceVce || null;
    var colores = [];
    escenarios.forEach(function (e) {
      if (e.semaforo && colores.indexOf(e.semaforo) === -1) colores.push(e.semaforo);
    });

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

    var esSoftwareLibre = escenarios.some(function (e) { return e.software_libre === "SI"; });
    var esEmbebible = escenarios.some(function (e) { return e.embebible === "SI"; });
    var tieneAccesibilidad = escenarios.some(function (e) {
      var txt = (e.accesibilidad_texto || "").trim();
      return (e.enlaces_accesibilidad && e.enlaces_accesibilidad.length > 0) || (txt && txt.toUpperCase() !== "X");
    });

    var alumnadoVerde = escenarios.some(function (e) {
      if (e.semaforo !== "VERDE") return false;
      var al = normalizarTexto(e.alumnado);
      return al.indexOf("no,") !== 0 && al !== "no";
    });

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

    var textoBusqueda = normalizarTexto(
      [
        h.nombre,
        h.descripcion,
        h.categoria,
        h.subcategoria || "",
        h.autor || "",
        h.niveles || "",
        h.licencia || "",
        h.idiomas || "",
        cruceVce ? cruceVce.titulo_vce : "",
        cruceVce ? cruceVce.autor : "",
        cruceVce ? cruceVce.areas : "",
        (h.evidencia || []).join(" "),
        escenarios.map(function (e) { return e.otros || ""; }).join(" ")
      ].join(" ")
    );

    var enlaceInfo = esVce ? null : (estado.enlaces[h.id] || null);
    var urlAcceso = esVce
      ? (h.url || h.url_final || null)
      : (
          enlaceInfo &&
          enlaceInfo.url &&
          (enlaceInfo.estado === "verificado" || enlaceInfo.estado === "bloqueado_bot")
            ? enlaceInfo.url
            : null
        );

    return Object.assign({}, h, {
      _fuente: esVce ? "vce" : "intef",
      _enIntef: !esVce,
      _enVce: esVce || Boolean(cruceVce),
      _esAmbas: !esVce && Boolean(cruceVce),
      _cruceVce: cruceVce,
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
    if (color === "VERDE") return t("semShortVERDE");
    if (color === "AMARILLO") return t("semShortAMARILLO");
    if (color === "ROJO") return t("semShortROJO");
    return color;
  }

  function etiquetaColor(color) {
    if (color === "VERDE") return t("semVerde").toUpperCase();
    if (color === "AMARILLO") return t("semAmarillo").toUpperCase();
    if (color === "ROJO") return t("semRojo").toUpperCase();
    return color;
  }

  function iconoExterno() {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  }

  function leerEstadoDesdeUrl() {
    var p = new URLSearchParams(window.location.search);
    estado.busqueda = p.get("q") || "";
    var src = (p.get("src") || "TODAS").toUpperCase();
    estado.fuente = ["TODAS", "INTEF", "VCE"].indexOf(src) !== -1 ? src : "TODAS";
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
    estado.enlaceBuscado = p.get("u") || "";
  }

  function construirUrlActual(incluirFichaId) {
    var p = new URLSearchParams();
    if (estado.idioma !== "es") p.set("lang", estado.idioma);
    if (estado.busqueda.trim()) p.set("q", estado.busqueda.trim());
    if (estado.fuente !== "TODAS") p.set("src", estado.fuente.toLowerCase());
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

  function categoriasVisiblesPorFuente() {
    var catsIntef = (estado.datos && estado.datos.categorias) || [];
    var catsVce = (estado.vce && estado.vce.categorias) || [];
    return {
      intef: estado.fuente === "VCE" ? [] : catsIntef,
      vce: estado.fuente === "INTEF" ? [] : catsVce
    };
  }

  function contarPorCategoria(terminos) {
    var terms = terminos || normalizarTexto(estado.busqueda).split(/\s+/).filter(Boolean);
    var cuentas = {};
    estado.herramientas.forEach(function (h) {
      if (coincideFiltros(h, terms, "categoria")) {
        cuentas[h.categoria_id] = (cuentas[h.categoria_id] || 0) + 1;
      }
    });
    return cuentas;
  }

  function actualizarTextoCategoria(cuentasCat) {
    if (!dom.catActualTexto) return;
    if (estado.categoria && estado.categoriasMapa.has(estado.categoria)) {
      var cat = estado.categoriasMapa.get(estado.categoria);
      dom.catActualTexto.textContent = cat.fuente === "vce" ? nombreCategoriaVisible(cat.nombre) : cat.nombre;
      return;
    }
    var grupos = categoriasVisiblesPorFuente();
    var cuentas = cuentasCat || contarPorCategoria();
    var hayOtrosFiltros =
      Boolean(estado.busqueda.trim()) ||
      estado.semaforo !== "TODOS" ||
      estado.uso !== "TODOS" ||
      estado.extras.sin_registro ||
      estado.extras.software_libre ||
      estado.extras.embebible ||
      estado.extras.accesibilidad;
    var todas = grupos.intef.concat(grupos.vce);
    var totalCats = hayOtrosFiltros
      ? todas.filter(function (c) { return (cuentas[c.id] || 0) > 0; }).length
      : (todas.length || 97);
    dom.catActualTexto.textContent = t("allCats") + " (" + totalCats + ")";
  }

  function pintarListaCategorias() {
    if (!dom.listaCategorias || !estado.datos) return;
    var q = normalizarTexto(dom.busqCategoria ? dom.busqCategoria.value : "");
    var cuentasCat = contarPorCategoria();
    var hayOtrosFiltros =
      Boolean(estado.busqueda.trim()) ||
      estado.semaforo !== "TODOS" ||
      estado.uso !== "TODOS" ||
      estado.extras.sin_registro ||
      estado.extras.software_libre ||
      estado.extras.embebible ||
      estado.extras.accesibilidad;

    var grupos = categoriasVisiblesPorFuente();
    var todasVis = grupos.intef.concat(grupos.vce).filter(function (c) {
      return !hayOtrosFiltros || (cuentasCat[c.id] || 0) > 0 || estado.categoria === c.id;
    });
    var partes = [];

    if (!q) {
      partes.push(
        '<button type="button" class="cat-opcion" data-elegir-cat="" aria-current="' + (estado.categoria === "" ? "true" : "false") + '">' +
          "<span>" + escaparHtml(t("allCats")) + "</span>" +
          '<span class="cat-opcion-num">(' + todasVis.length + ")</span>" +
        "</button>"
      );
    }

    var totalMostradas = 0;

    function añadirGrupo(titulo, lista, esVce) {
      var filtradas = lista.filter(function (c) {
        var n = cuentasCat[c.id] || 0;
        if (hayOtrosFiltros && n === 0 && estado.categoria !== c.id) return false;
        if (!q) return true;
        return normalizarTexto(c.nombre).indexOf(q) !== -1;
      });
      if (!filtradas.length) return;
      totalMostradas += filtradas.length;
      partes.push('<div class="cat-grupo-titulo">' + escaparHtml(titulo + " (" + filtradas.length + ")") + "</div>");
      filtradas.forEach(function (c) {
        var nombre = esVce ? nombreCategoriaVisible(c.nombre) : c.nombre;
        var activo = estado.categoria === c.id ? "true" : "false";
        partes.push(
          '<button type="button" class="cat-opcion" data-elegir-cat="' + escaparHtml(c.id) + '" aria-current="' + activo + '">' +
            "<span>" + escaparHtml(nombre) + "</span>" +
            '<span class="cat-opcion-num">(' + (cuentasCat[c.id] || 0) + ")</span>" +
          "</button>"
        );
      });
    }

    añadirGrupo(t("catGroupIntef"), grupos.intef, false);
    añadirGrupo(t("catGroupVce"), grupos.vce, true);

    if (totalMostradas === 0) {
      partes.push('<p class="cat-vacio">' + escaparHtml(t("catNoMatch")) + "</p>");
    }

    dom.listaCategorias.innerHTML = partes.join("");
  }

  function sincronizarControles() {
    dom.buscador.value = estado.busqueda;
    dom.btnLimpiarBusq.hidden = !estado.busqueda;
    actualizarTextoCategoria();
    dom.selOrden.value = estado.orden;

    document.querySelectorAll("[data-fuente]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.fuente === estado.fuente ? "true" : "false");
    });
    if (dom.leyendaOrigen) {
      dom.leyendaOrigen.dataset.fuenteActiva = estado.fuente;
    }
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
      estado.fuente !== "TODAS" ||
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

  function coincideFuente(h) {
    if (estado.fuente === "INTEF") return h._enIntef;
    if (estado.fuente === "VCE") return h._enVce;
    return true;
  }

  function coincideFiltros(h, terminos, omitir) {
    if (omitir !== "fuente" && !coincideFuente(h)) return false;
    if (omitir !== "semaforo" && estado.semaforo !== "TODOS" && h._colores.indexOf(estado.semaforo) === -1) return false;
    if (estado.uso === "ALUMNADO_VERDE" && !h._alumnadoVerde) return false;
    if (estado.uso === "SOLO_DOCENTE" && !h._soloDocente) return false;
    if (omitir !== "categoria" && estado.categoria && h.categoria_id !== estado.categoria) return false;
    if (omitir !== "categoria" && estado.ambito && !coincideAmbito(h, estado.ambito)) return false;
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
  }

  function actualizarContadoresOrigen(terminos) {
    var loc = estado.idioma === "en" ? "en-US" : "es-ES";
    var terms = terminos || normalizarTexto(estado.busqueda).split(/\s+/).filter(Boolean);
    var base = estado.herramientas.filter(function (h) { return coincideFiltros(h, terms, "fuente"); });
    var nTodas = base.length;
    var nIntef = base.filter(function (h) { return h._enIntef; }).length;
    var nVce = base.filter(function (h) { return h._enVce; }).length;
    if (dom.numSrcTodas) dom.numSrcTodas.textContent = "(" + nTodas.toLocaleString(loc) + ")";
    if (dom.numSrcIntef) dom.numSrcIntef.textContent = "(" + nIntef.toLocaleString(loc) + ")";
    if (dom.numSrcVce) dom.numSrcVce.textContent = "(" + nVce.toLocaleString(loc) + ")";
  }

  function actualizarContadoresSemaforo(terminos) {
    var terms = terminos || normalizarTexto(estado.busqueda).split(/\s+/).filter(Boolean);
    var base = estado.herramientas.filter(function (h) { return coincideFiltros(h, terms, "semaforo"); });
    var nVerde = base.filter(function (h) { return h._colores.indexOf("VERDE") !== -1; }).length;
    var nAmarillo = base.filter(function (h) { return h._colores.indexOf("AMARILLO") !== -1; }).length;
    var nRojo = base.filter(function (h) { return h._colores.indexOf("ROJO") !== -1; }).length;
    dom.numVerde.textContent = "(" + nVerde + ")";
    dom.numAmarillo.textContent = "(" + nAmarillo + ")";
    dom.numRojo.textContent = "(" + nRojo + ")";
  }

  function coincideAmbito(h, ambitoId) {
    if (!ambitoId || ambitoId === "todos") return true;
    var amb = AMBITOS_ASISTENTE.find(function (a) { return a.id === ambitoId; });
    if (!amb || !amb.palabras.length) return true;
    var catNorm = normalizarTexto(h.categoria);
    return amb.palabras.some(function (kw) {
      return catNorm.indexOf(normalizarTexto(kw)) !== -1;
    });
  }

  function aplicarFiltros() {
    var terminos = normalizarTexto(estado.busqueda).split(/\s+/).filter(Boolean);

    var res = estado.herramientas.filter(function (h) {
      return coincideFiltros(h, terminos, null);
    });

    res.sort(function (a, b) {
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

    actualizarContadoresOrigen(terminos);
    actualizarContadoresSemaforo(terminos);
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
        var ambLabel = (t("ambitos") && t("ambitos")[amb.id]) || amb.id;
        dom.avisoCategoria.innerHTML =
          "<strong>" + escaparHtml(t("wizardBanner", { label: ambLabel })) + "</strong>" +
          "<span>" + escaparHtml(t("wizardBannerSub")) + "</span>";
        dom.avisoCategoria.hidden = false;
        return;
      }
    }
    dom.avisoCategoria.hidden = true;
  }

  function pintarResultados() {
    var total = estado.filtradas.length;
    var totalGlobal = estado.herramientas.length;
    var loc = estado.idioma === "en" ? "en-US" : "es-ES";

    if (total === totalGlobal) {
      dom.contador.innerHTML = t("showingAll", { total: total.toLocaleString(loc) });
    } else {
      dom.contador.innerHTML = t("showingFiltered", {
        count: total.toLocaleString(loc),
        total: totalGlobal.toLocaleString(loc)
      });
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
        return '<span class="insignia insignia-' + c + '"><span aria-hidden="true">' + simbolo + '</span> ' + escaparHtml(etiquetaColor(c)) + "</span>";
      }).join("");

      var etiquetas = [];
      if (h.escenarios.length > 1) {
        etiquetas.push('<span class="etq etq-aviso">' + escaparHtml(t("cardModes", { n: h.escenarios.length })) + "</span>");
      }
      if (h._sinRegistro) etiquetas.push('<span class="etq">' + escaparHtml(t("extraNoReg")) + "</span>");
      if (h._softwareLibre) etiquetas.push('<span class="etq">' + escaparHtml(t("extraFreeSw")) + "</span>");
      if (h._embebible) etiquetas.push('<span class="etq">' + escaparHtml(t("extraEmbed")) + "</span>");

      var catVisible = h._fuente === "vce" ? nombreCategoriaVisible(h.categoria) : h.categoria;
      var catTexto = catVisible + (h.subcategoria ? " · " + h.subcategoria : "");
      var badgeOrigen = h._esAmbas
        ? '<span class="etq-origen etq-origen-ambas">' + escaparHtml(t("badgeBoth")) + "</span>"
        : h._fuente === "vce"
          ? '<span class="etq-origen etq-origen-vce">' + escaparHtml(t("badgeVce")) + "</span>"
          : '<span class="etq-origen etq-origen-intef">' + escaparHtml(t("badgeIntef")) + "</span>";
      var btnWeb = h._urlAcceso
        ? '<a class="btn btn-suave" href="' + escaparHtml(h._urlAcceso) + '" target="_blank" rel="noopener">' + escaparHtml(t("cardOpenWeb")) + " " + iconoExterno() + "</a>"
        : "";

      return (
        '<article class="tarjeta">' +
          '<div class="tarjeta-cab">' +
            '<h2 class="tarjeta-titulo"><button type="button" data-abrir-ficha="' + escaparHtml(h.id) + '">' + escaparHtml(h.nombre) + "</button></h2>" +
            '<div class="badges-semaforo">' + badges + "</div>" +
          "</div>" +
          '<p class="tarjeta-cat">' + badgeOrigen + "<span>" + escaparHtml(catTexto) + "</span></p>" +
          '<p class="tarjeta-desc">' + escaparHtml(h.descripcion || t("cardNoDesc")) + "</p>" +
          (etiquetas.length ? '<div class="tarjeta-etiquetas">' + etiquetas.join("") + "</div>" : "") +
          '<div class="tarjeta-pie">' +
            '<button type="button" class="btn btn-secundario" data-abrir-ficha="' + escaparHtml(h.id) + '">' + escaparHtml(t("cardViewDetails")) + "</button>" +
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
      (actual <= 1 ? " disabled" : "") + ">" + escaparHtml(t("prevPage")) + "</button>"
    );

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
      (actual >= totalPags ? " disabled" : "") + ">" + escaparHtml(t("nextPage")) + "</button>"
    );

    dom.paginacion.innerHTML = partes.join("");
  }

  function textoCampoSiX(valor, tipo) {
    if (valor === "SI") return { texto: t("valYes"), nota: "" };
    if (valor === "NO") return { texto: t("valNo"), nota: "" };
    if (valor === "X") {
      if (tipo === "sw") return { texto: t("valUnknownX"), nota: t("noteSwX") };
      if (tipo === "emb") return { texto: t("valUnknownX"), nota: t("noteEmbedX") };
    }
    return { texto: valor || t("valUnknown"), nota: "" };
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

  function abrirFicha(idHerramienta, yaAbierto) {
    var h = estado.herramientas.find(function (x) { return x.id === idHerramienta; });
    if (!h) return;

    estado.fichaAbiertaId = h.id;
    sincronizarUrl();

    var esVce = h._fuente === "vce";
    var vceRepoUrl = (estado.vce && estado.vce.fuente && estado.vce.fuente.url) || "https://vibe-coding-educativo.github.io/app_edu/";
    var catMostrar = esVce ? nombreCategoriaVisible(h.categoria) : h.categoria;

    dom.fichaTitulo.textContent = h.nombre;
    if (esVce) {
      dom.fichaSub.textContent =
        t("vceRecordMeta") +
        " · " + catMostrar +
        (h.subcategoria ? " · " + h.subcategoria : "");
    } else {
      dom.fichaSub.textContent =
        h.categoria +
        (h.subcategoria ? " · " + h.subcategoria : "") +
        " · " + t("cardRecordMeta", { num: h.numero, pag: h.pagina }) +
        (h._esAmbas ? " · " + t("bothRecordMeta") : "");
    }

    var bloques = [];

    if (esVce) {
      bloques.push(
        '<div class="aviso-vce">' +
          "<strong>" + escaparHtml(t("vceNoticeTitle")) + "</strong>" +
          "<p>" + escaparHtml(t("vceNoticeText")) + "</p>" +
          '<div class="enlaces-lista">' +
            '<a class="enlace-pildora" href="' + escaparHtml(vceRepoUrl) + '" target="_blank" rel="noopener">' + escaparHtml(t("vceRepoLink")) + " " + iconoExterno() + "</a>" +
          "</div>" +
        "</div>"
      );
    }

    bloques.push('<p style="margin:0">' + escaparHtml(h.descripcion) + "</p>");

    if (h._urlAcceso) {
      var notaWeb = "";
      if (esVce) {
        var fechaVce = (estado.vce && estado.vce.fuente && estado.vce.fuente.fecha_evaluacion) || "";
        notaWeb = t("vceDirectNote") + (fechaVce ? " · " + t("cardCheckedOn") + " " + fechaVce : "");
      } else {
        var fechaUrl = h._enlaceInfo && h._enlaceInfo.comprobado ? " · " + t("cardCheckedOn") + " " + h._enlaceInfo.comprobado : "";
        notaWeb = t("cardDirectNote") + fechaUrl;
      }
      bloques.push(
        '<div class="ficha-barra-web">' +
          "<div>" +
            "<strong>" + escaparHtml(t("cardDirectAccess")) + "</strong>" +
            '<p class="ficha-web-nota">' + escaparHtml(notaWeb) + ".</p>" +
          "</div>" +
          '<a class="btn btn-primario" href="' + escaparHtml(h._urlAcceso) + '" target="_blank" rel="noopener">' + escaparHtml(t("cardOpenTool")) + " " + iconoExterno() + "</a>" +
        "</div>"
      );
    }

    if (esVce) {
      var metaVce = [];
      if (h.autor) metaVce.push([t("vceAuthor"), h.autor]);
      if (h.licencia) metaVce.push([t("vceLicense"), h.licencia]);
      if (h.niveles) metaVce.push([t("vceLevels"), h.niveles]);
      if (h.subcategoria) metaVce.push([t("vceAreas"), h.subcategoria]);
      if (h.idiomas) metaVce.push([t("vceLanguages"), h.idiomas]);
      if (metaVce.length) {
        bloques.push(
          '<div class="datos-tabla">' +
            metaVce.map(function (par) {
              return (
                '<div class="dato-item">' +
                  '<span class="dato-clave">' + escaparHtml(par[0]) + "</span>" +
                  "<span>" + escaparHtml(par[1]) + "</span>" +
                "</div>"
              );
            }).join("") +
          "</div>"
        );
      }
    }

    if (h.escenarios.length > 1) {
      bloques.push(
        '<div class="aviso-categoria" style="margin:0">' +
          "<strong>" + escaparHtml(t("cardMultiTitle", { n: h.escenarios.length })) + "</strong>" +
          "<span>" + escaparHtml(t("cardMultiSub")) + "</span>" +
        "</div>"
      );
    }

    h.escenarios.forEach(function (esc, idx) {
      var sem = esc.semaforo || "AMARILLO";
      var sw = textoCampoSiX(esc.software_libre, "sw");
      var emb = textoCampoSiX(esc.embebible, "emb");
      var fechaNota = esFechaAntigua(esc.fecha_comprobacion)
        ? '<span class="dato-nota">' + escaparHtml(t("noteOldDate", { fecha: esc.fecha_comprobacion })) + "</span>"
        : "";

      var tituloEsc =
        (h.escenarios.length > 1 ? t("modePrefix", { n: idx + 1 }) : "") +
        textoSemaforoCorto(sem);

      var linksPriv = renderListaEnlaces(esc.enlaces_privacidad, t("linkPrivacy"));
      var linksAcc = renderListaEnlaces(esc.enlaces_accesibilidad, t("linkAccess"));
      var linksOtros = renderListaEnlaces(esc.enlaces_otros, t("linkCited"));

      var textoOtros = (esc.otros || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
      var textoAcc = (esc.accesibilidad_texto || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
      if (textoAcc.toUpperCase() === "X") textoAcc = "";

      bloques.push(
        '<section class="escenario-caja">' +
          '<div class="escenario-cab sem-' + sem + '">' +
            '<span class="escenario-titulo">' + escaparHtml(tituloEsc) + "</span>" +
            '<span class="escenario-fecha">' + escaparHtml(t("checkedLabel") + " " + (esc.fecha_comprobacion || t("noDate"))) + "</span>" +
          "</div>" +
          '<div class="escenario-cuerpo">' +
            '<div class="roles-rejilla">' +
              '<div class="rol-caja">' +
                "<h4>" + escaparHtml(t("forTeachers")) + "</h4>" +
                "<p>" + escaparHtml(esc.profesorado || t("noSpecificNotes")) + "</p>" +
              "</div>" +
              '<div class="rol-caja">' +
                "<h4>" + escaparHtml(t("forStudents")) + "</h4>" +
                "<p>" + escaparHtml(esc.alumnado || t("noSpecificNotes")) + "</p>" +
              "</div>" +
            "</div>" +

            '<div class="datos-tabla">' +
              '<div class="dato-item">' +
                '<span class="dato-clave">' + escaparHtml(t("fieldReg")) + "</span>" +
                "<span>" + escaparHtml(esc.requiere_registro || t("valUnknown")) + "</span>" +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">' + escaparHtml(t("fieldFreeSw")) + "</span>" +
                "<span>" + escaparHtml(sw.texto) + "</span>" +
                (sw.nota ? '<span class="dato-nota">' + escaparHtml(sw.nota) + "</span>" : "") +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">' + escaparHtml(t("fieldEmbed")) + "</span>" +
                "<span>" + escaparHtml(emb.texto) + "</span>" +
                (emb.nota ? '<span class="dato-nota">' + escaparHtml(emb.nota) + "</span>" : "") +
              "</div>" +
              '<div class="dato-item">' +
                '<span class="dato-clave">' + escaparHtml(t("fieldDate")) + "</span>" +
                "<span>" + escaparHtml(esc.fecha_comprobacion || t("valUnknown")) + "</span>" +
                fechaNota +
              "</div>" +
            "</div>" +

            (textoOtros || linksOtros
              ? "<div><strong>" + escaparHtml(t("fieldOthers")) + "</strong> " +
                (textoOtros ? "<span>" + escaparHtml(textoOtros) + "</span>" : "") +
                linksOtros + "</div>"
              : "") +

            (linksPriv || linksAcc || textoAcc
              ? "<div><strong>" + escaparHtml(t("fieldOfficialDocs")) + "</strong>" +
                linksPriv +
                linksAcc +
                (textoAcc ? '<p class="ficha-web-nota">' + escaparHtml(textoAcc) + "</p>" : "") +
                "</div>"
              : "") +
          "</div>" +
        "</section>"
      );
    });

    if (esVce && h.evidencia && h.evidencia.length) {
      bloques.push(
        '<div class="rol-caja">' +
          "<h4>" + escaparHtml(t("vceEvidenceTitle")) + "</h4>" +
          '<ul class="lista-evidencias">' +
            h.evidencia.map(function (ev) { return "<li>" + escaparHtml(ev) + "</li>"; }).join("") +
          "</ul>" +
        "</div>"
      );
    }

    if (h._esAmbas && h._cruceVce) {
      var cv = h._cruceVce;
      var metaCruce = [];
      if (cv.titulo_vce) metaCruce.push([t("bothVceTitle"), cv.titulo_vce]);
      if (cv.autor) metaCruce.push([t("vceAuthor"), cv.autor]);
      if (cv.licencia) metaCruce.push([t("vceLicense"), cv.licencia]);
      if (cv.niveles) metaCruce.push([t("vceLevels"), cv.niveles]);
      if (cv.areas) metaCruce.push([t("vceAreas"), cv.areas]);
      if (cv.idiomas) metaCruce.push([t("vceLanguages"), cv.idiomas]);
      bloques.push(
        '<div class="aviso-vce">' +
          "<strong>" + escaparHtml(t("bothBoxTitle")) + "</strong>" +
          "<p>" + escaparHtml(t("bothBoxNote")) + "</p>" +
          (metaCruce.length
            ? '<div class="datos-tabla">' +
                metaCruce.map(function (par) {
                  return (
                    '<div class="dato-item">' +
                      '<span class="dato-clave">' + escaparHtml(par[0]) + "</span>" +
                      "<span>" + escaparHtml(par[1]) + "</span>" +
                    "</div>"
                  );
                }).join("") +
              "</div>"
            : "") +
          '<div class="enlaces-lista">' +
            '<a class="enlace-pildora" href="' + escaparHtml(vceRepoUrl) + '" target="_blank" rel="noopener">' + escaparHtml(t("vceRepoLink")) + " " + iconoExterno() + "</a>" +
          "</div>" +
        "</div>"
      );
    }

    if (estado.datos && estado.datos.marco) {
      var m = estado.datos.marco;
      var advHtml = "<ol>" + m.advertencias.map(function (a) { return "<li>" + escaparHtml(a) + "</li>"; }).join("") + "</ol>";
      bloques.push(
        '<details class="desplegable">' +
          "<summary>" + escaparHtml(t("cardWarnSummary")) + "</summary>" +
          '<div class="desplegable-contenido">' + advHtml + "</div>" +
        "</details>"
      );
    }

    dom.fichaCuerpo.innerHTML = bloques.join("");
    if (!yaAbierto && !dom.modalFicha.open) {
      dom.modalFicha.showModal();
    }
  }

  function pintarMarcoOficial() {
    if (!estado.datos || !estado.datos.marco) return;
    var m = estado.datos.marco;
    var f = estado.datos.fuente;
    var pdfUrl = estado.idioma === "en" && f.url_pdf_en ? f.url_pdf_en : f.url_pdf;

    var partes = [
      '<div class="aviso-categoria" style="margin:0"><strong>' + escaparHtml(t("guideImportant")) + "</strong><span>" + escaparHtml(m.importante) + "</span></div>",
      '<details class="desplegable" open>' +
        "<summary>" + escaparHtml(t("guideWarn11")) + "</summary>" +
        '<div class="desplegable-contenido"><ol>' +
        m.advertencias.map(function (a) { return "<li>" + escaparHtml(a) + "</li>"; }).join("") +
        "</ol></div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>" + escaparHtml(t("guideOriGreen")) + "</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.sin_datos_personales.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>" + escaparHtml(t("guideOriAnon")) + "</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.anonimizado.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>" + escaparHtml(t("guideOriNoAnon")) + "</summary>" +
        '<div class="desplegable-contenido">' +
        m.orientaciones.no_anonimizado.map(function (p) { return "<p>" + escaparHtml(p) + "</p>"; }).join("") +
        "</div>" +
      "</details>",
      '<details class="desplegable">' +
        "<summary>" + escaparHtml(t("guideMeanX")) + "</summary>" +
        '<div class="desplegable-contenido">' +
          "<p><strong>" + escaparHtml(t("fieldFreeSw")) + ":</strong> " + escaparHtml(m.aclaracion_software_libre) + "</p>" +
          "<p><strong>" + escaparHtml(t("fieldEmbed")) + ":</strong> " + escaparHtml(m.aclaracion_embebible) + "</p>" +
        "</div>" +
      "</details>",
      '<div class="ficha-barra-web">' +
        "<div><strong>" + escaparHtml(t("guideNotListedTitle")) + '</strong><p class="ficha-web-nota">' + escaparHtml(t("guideNotListedText")) + "</p></div>" +
        '<a class="btn btn-primario" href="' + escaparHtml(pdfUrl) + '" target="_blank" rel="noopener">' + escaparHtml(t("guideOpenPdf")) + " " + iconoExterno() + "</a>" +
      "</div>"
    ];

    dom.marcoCuerpo.innerHTML = partes.join("");
  }

  function pintarOpcionesAsistente() {
    var diccAmb = t("ambitos") || {};
    var checkedPrev = dom.asistenteAmbitos.querySelector("input:checked");
    var seleccionado = checkedPrev ? checkedPrev.value : "todos";
    dom.asistenteAmbitos.innerHTML = AMBITOS_ASISTENTE.map(function (amb) {
      var label = diccAmb[amb.id] || amb.id;
      return (
        '<label class="asistente-radio">' +
          '<input type="radio" name="asist_ambito" value="' + escaparHtml(amb.id) + '"' + (amb.id === seleccionado ? " checked" : "") + ">" +
          "<span>" + escaparHtml(label) + "</span>" +
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
        mostrarToast(t("toastCopied"));
      }).catch(function () {
        mostrarToast(t("toastCopyFail"));
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
        mostrarToast(t("toastCopied"));
      } catch (_) {}
      ta.remove();
    }
  }

  function restablecerFiltros() {
    estado.busqueda = "";
    estado.fuente = "TODAS";
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

    document.querySelectorAll("[data-fuente]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        estado.fuente = btn.dataset.fuente;
        if (estado.categoria && estado.categoriasMapa.has(estado.categoria)) {
          var catSel = estado.categoriasMapa.get(estado.categoria);
          var esCatVce = catSel && catSel.fuente === "vce";
          if ((estado.fuente === "INTEF" && esCatVce) || (estado.fuente === "VCE" && !esCatVce)) {
            estado.categoria = "";
          }
        }
        estado.pagina = 1;
        aplicarFiltros();
      });
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

    if (dom.btnCategoria && dom.panelCategoria) {
      function togglePanelCat(abre) {
        dom.panelCategoria.hidden = !abre;
        dom.btnCategoria.setAttribute("aria-expanded", abre ? "true" : "false");
        if (abre) {
          if (dom.busqCategoria) dom.busqCategoria.value = "";
          pintarListaCategorias();
          if (dom.busqCategoria) dom.busqCategoria.focus();
        }
      }

      dom.btnCategoria.addEventListener("click", function (ev) {
        ev.stopPropagation();
        togglePanelCat(dom.panelCategoria.hidden);
      });

      dom.panelCategoria.addEventListener("click", function (ev) {
        var opt = ev.target.closest("[data-elegir-cat]");
        if (!opt) return;
        estado.categoria = opt.dataset.elegirCat;
        if (estado.categoria && estado.categoriasMapa.has(estado.categoria)) {
          var catSel = estado.categoriasMapa.get(estado.categoria);
          var esCatVce = catSel && catSel.fuente === "vce";
          if ((esCatVce && estado.fuente === "INTEF") || (!esCatVce && estado.fuente === "VCE")) {
            estado.fuente = "TODAS";
          }
        }
        estado.ambito = "";
        estado.pagina = 1;
        togglePanelCat(false);
        aplicarFiltros();
        dom.btnCategoria.focus();
      });

      if (dom.busqCategoria) {
        dom.busqCategoria.addEventListener("input", pintarListaCategorias);
        dom.busqCategoria.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            var primera = dom.listaCategorias.querySelector("[data-elegir-cat]");
            if (primera) primera.click();
          }
        });
      }

      document.addEventListener("click", function (ev) {
        if (!dom.panelCategoria.hidden && !dom.panelCategoria.contains(ev.target) && !dom.btnCategoria.contains(ev.target)) {
          togglePanelCat(false);
        }
      });

      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !dom.panelCategoria.hidden) {
          togglePanelCat(false);
          dom.btnCategoria.focus();
        }
      });
    }

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

    // Menú de idioma accesible
    if (dom.btnIdioma && dom.menuIdiomas) {
      function toggleMenuIdiomas(abre) {
        dom.menuIdiomas.hidden = !abre;
        dom.btnIdioma.setAttribute("aria-expanded", abre ? "true" : "false");
        if (abre) {
          var actual = dom.menuIdiomas.querySelector('[aria-current="true"]') || dom.menuIdiomas.querySelector("button");
          if (actual) actual.focus();
        }
      }
      dom.btnIdioma.addEventListener("click", function (ev) {
        ev.stopPropagation();
        toggleMenuIdiomas(dom.menuIdiomas.hidden);
      });
      document.addEventListener("click", function (ev) {
        if (!dom.menuIdiomas.hidden && !dom.menuIdiomas.contains(ev.target)) {
          toggleMenuIdiomas(false);
        }
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !dom.menuIdiomas.hidden) {
          toggleMenuIdiomas(false);
          dom.btnIdioma.focus();
        }
      });
      dom.menuIdiomas.querySelectorAll("[data-elegir-idioma]").forEach(function (b) {
        b.addEventListener("click", function () {
          var cod = b.dataset.elegirIdioma;
          try {
            if (cod === idiomaNavegador()) localStorage.removeItem("gpe.idioma");
            else localStorage.setItem("gpe.idioma", cod);
          } catch (_) {}
          aplicarIdiomaInterfaz(cod, true);
          sincronizarUrl();
          toggleMenuIdiomas(false);
          dom.btnIdioma.focus();
        });
      });
    }

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
      var p = new URLSearchParams();
      if (estado.idioma !== "es") p.set("lang", estado.idioma);
      p.set("h", estado.fichaAbiertaId);
      var url = window.location.origin + window.location.pathname + "?" + p.toString();
      compartirEnlace(url, (h ? h.nombre + " · " : "") + t("brandTitle"));
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

    dom.toast.addEventListener("click", function () {
      dom.toast.hidden = true;
    });
  }

  function registrarServiceWorker() {
    if ("serviceWorker" in navigator && window.top === window && window.isSecureContext) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  async function iniciar() {
    iniciarTema();
    estado.idioma = detectarIdiomaInicial();
    aplicarIdiomaInterfaz(estado.idioma, false);
    vincularEventos();
    leerEstadoDesdeUrl();
    registrarServiceWorker();

    try {
      var [respGuia, respEnlaces, respVce] = await Promise.all([
        fetch("datos/guia-intef.json"),
        fetch("datos/enlaces-herramientas.json").catch(function () { return null; }),
        fetch("datos/vce-evaluadas.json").catch(function () { return null; })
      ]);

      if (!respGuia.ok) throw new Error("HTTP " + respGuia.status);
      estado.datos = await respGuia.json();

      if (respEnlaces && respEnlaces.ok) {
        var datosEnlaces = await respEnlaces.json();
        estado.enlaces = datosEnlaces.enlaces || {};
      }

      if (respVce && respVce.ok) {
        estado.vce = await respVce.json();
      }

      var coincidencias = (estado.vce && estado.vce.coincidencias_intef) || {};
      var intefLista = (estado.datos.herramientas || []).map(function (h) {
        var copia = coincidencias[h.id] ? Object.assign({}, h, { _cruceVce: coincidencias[h.id] }) : h;
        return prepararHerramienta(copia);
      });
      var vceLista = (estado.vce && estado.vce.herramientas ? estado.vce.herramientas : []).map(prepararHerramienta);
      estado.herramientas = intefLista.concat(vceLista);

      var catsIntef = estado.datos.categorias || [];
      var catsVce = (estado.vce && estado.vce.categorias) || [];
      catsIntef.forEach(function (c) { estado.categoriasMapa.set(c.id, c); });
      catsVce.forEach(function (c) { estado.categoriasMapa.set(c.id, c); });

      actualizarTextoCategoria();
      pintarListaCategorias();

      actualizarContadoresOrigen();
      pintarMarcoOficial();
      aplicarFiltros();

      // ?u=<enlace>: abre la ficha de esa aplicación (el Repositorio VCE enlaza así cada recurso, ADR 0006).
      var porEnlace = estado.enlaceBuscado;
      if (!estado.fichaAbiertaId && porEnlace) {
        var norm = function (u) { return String(u || "").trim().toLowerCase().replace(/\/+$/, ""); };
        var buscada = norm(porEnlace);
        var hallada = estado.herramientas.find(function (h) {
          return norm(h.url) === buscada || norm(h.url_final) === buscada ||
            (h._cruceVce && norm(h._cruceVce.url_vce) === buscada);
        });
        if (hallada) estado.fichaAbiertaId = hallada.id;
      }

      if (estado.fichaAbiertaId) {
        abrirFicha(estado.fichaAbiertaId);
      }
    } catch (err) {
      dom.contador.textContent = t("loadError");
      console.error("Error cargando la guía:", err);
    }
  }

  iniciar();
})();
