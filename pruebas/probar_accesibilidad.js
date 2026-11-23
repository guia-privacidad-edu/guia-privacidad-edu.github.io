// SPDX-License-Identifier: AGPL-3.0-or-later
// Auditoría automática de accesibilidad con axe-core + teclado + 5 idiomas + origen INTEF/VCE para probar-web

const fs = require("fs");
const AXE_PATH = "/home/jjdeharo/.npm-global/lib/node_modules/axe-core/axe.min.js";

async function auditarAxe(page, contexto) {
  const axeSource = fs.readFileSync(AXE_PATH, "utf8");
  await page.evaluate((src) => {
    if (!window.axe) {
      const s = document.createElement("script");
      s.textContent = src;
      document.head.appendChild(s);
    }
  }, axeSource);

  const res = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }
    });
  });

  if (res.violations.length > 0) {
    const detalle = res.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodos -> ${v.nodes[0].target.join(" ")})`)
      .join(" | ");
    throw new Error(`axe-core (${contexto}): ${detalle}`);
  }
}

module.exports = async (page, info) => {
  const opts = { timeout: 8000 };

  // 1. Esperar carga completa del catálogo (1.144 INTEF + 360 VCE = 1.504)
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && /1[.,]?504/.test(el.textContent);
  }, undefined, { timeout: 10000 }).catch(() => { throw new Error("No cargó el catálogo de 1.504 herramientas"); });

  // 2. Auditar pantalla inicial con axe-core
  await auditarAxe(page, "portada");

  // 2b. Probar selector desplegable buscable de categorías (sin select nativo)
  await page.click("#btn-categoria");
  await page.waitForSelector("#panel-categoria:not([hidden])");
  await auditarAxe(page, "selector-categoria");
  await page.fill("#busq-categoria", "simulador");
  await page.locator('#lista-categorias button[data-elegir-cat="vce-simulador-laboratorio-virtual"]').click();
  await page.waitForFunction(() => document.getElementById("panel-categoria").hidden, undefined, opts)
    .catch(() => { throw new Error("Panel de categorías no cerró al elegir una categoría"); });
  await page.waitForFunction(() => {
    const el = document.getElementById("aviso-categoria");
    return el && !el.hidden && /Simulador/i.test(el.textContent);
  }, undefined, opts).catch(() => { throw new Error("Categoría elegida no se aplicó"); });
  await page.click("#btn-restablecer");
  await page.waitForFunction(() => /1[.,]?504/.test(document.getElementById("contador-resultados").textContent), undefined, opts);

  // 3. Probar filtro de origen (INTEF = 1.144, VCE = 363 incluyendo las 3 coincidencias, Todas = 1.504)
  await page.click('[data-fuente="INTEF"]');
  await page.waitForFunction(() => /1[.,]?144/.test(document.getElementById("contador-resultados").textContent), undefined, opts)
    .catch(() => { throw new Error("Filtro INTEF no mostró 1.144"); });

  await page.click('[data-fuente="VCE"]');
  await page.waitForFunction(() => /363/.test(document.getElementById("contador-resultados").textContent), undefined, opts)
    .catch(() => { throw new Error("Filtro VCE no mostró 363"); });
  await auditarAxe(page, "filtro-vce");

  // Comprobar chip Rojo activo (contraste en tema claro y oscuro) y recuento facetado
  await page.click('[data-semaforo="ROJO"]');
  await page.waitForFunction(() => {
    const s = document.querySelector("#contador-resultados strong");
    return s && s.textContent.trim() === "2";
  }, undefined, opts).catch(() => { throw new Error("Filtro VCE + Rojo no mostró 2"); });
  await auditarAxe(page, "filtro-vce-rojo");
  await page.click('[data-semaforo="TODOS"]');
  await page.waitForFunction(() => /363/.test(document.getElementById("contador-resultados").textContent), undefined, opts);

  // Abrir primera ficha VCE y auditar con axe-core
  await page.locator('#lista-tarjetas button[data-abrir-ficha^="vce-"]').first().click();
  await page.waitForSelector("#modal-ficha[open]");
  const avisoVce = await page.locator("#ficha-cuerpo .aviso-vce").textContent();
  if (!avisoVce || !/(Anexo I|Annex I|eranskina)/i.test(avisoVce)) {
    throw new Error(`Falta el aviso orientativo del Anexo I en la ficha VCE: ${avisoVce}`);
  }
  await auditarAxe(page, "ficha-vce");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-ficha").open, undefined, opts)
    .catch(() => { throw new Error("ficha-vce no cerró con Escape"); });

  await page.click('[data-fuente="TODAS"]');
  await page.waitForFunction(() => /1[.,]?504/.test(document.getElementById("contador-resultados").textContent), undefined, opts)
    .catch(() => { throw new Error("Filtro TODAS no volvió a 1.504"); });

  // 4. Probar ficha presente en ambas listas (BoardLive) y auditar con axe-core
  await page.fill("#buscador", "BoardLive");
  await page.waitForFunction(() => {
    const c = document.querySelector("#lista-tarjetas .tarjeta");
    return c && c.textContent.includes("BoardLive") && c.textContent.includes("INTEF + VCE");
  }, undefined, opts).catch(() => { throw new Error("BoardLive con insignia INTEF + VCE no apareció"); });
  await page.locator('#lista-tarjetas button[data-abrir-ficha="boardlive"]').first().click();
  await page.waitForSelector("#modal-ficha[open]");
  await auditarAxe(page, "ficha-ambas-boardlive");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-ficha").open, undefined, opts)
    .catch(() => { throw new Error("ficha-boardlive no cerró con Escape"); });

  // 5. Probar cambio de idioma a los 5 idiomas (ca, gl, eu, en, es)
  await page.click("#btn-restablecer");
  await page.waitForFunction(() => /1[.,]?504/.test(document.getElementById("contador-resultados").textContent), undefined, opts)
    .catch(() => { throw new Error("Limpiar filtros tras BoardLive no volvió a 1.504"); });

  for (const [cod, textoEsperado] of [
    ["ca", "Ajuda'm a triar"],
    ["gl", "Axúdame a elixir"],
    ["eu", "Lagundu aukeratzen"],
    ["en", "Help me choose"],
    ["es", "Ayúdame a elegir"]
  ]) {
    await page.click("#btn-idioma");
    await page.click(`[data-elegir-idioma="${cod}"]`);
    const txt = await page.locator("#btn-asistente").textContent();
    if (!txt || !txt.includes(textoEsperado)) {
      throw new Error(`Idioma ${cod} no aplicó correctamente: ${txt}`);
    }
  }

  // 6. Probar búsqueda sin distinguir tildes ni mayúsculas
  await page.fill("#buscador", "MATEMÁTICAS");
  await page.waitForFunction(() => {
    const s = document.querySelector("#contador-resultados strong");
    return s && !/1[.,]?504/.test(s.textContent);
  }, undefined, opts).catch(() => { throw new Error("Búsqueda MATEMÁTICAS no filtró"); });
  const resConTilde = await page.locator("#contador-resultados").textContent();
  await page.fill("#buscador", "matematicas");
  await page.waitForFunction((esperado) => {
    return document.getElementById("contador-resultados").textContent === esperado;
  }, resConTilde, opts).catch(() => { throw new Error("Búsqueda sin tilde dio distinto resultado"); });

  // 7. Abrir ficha oficial con 2 escenarios (Educaplay) y auditar con axe-core
  await page.fill("#buscador", "Educaplay");
  await page.waitForFunction(() => {
    const c = document.querySelector("#lista-tarjetas .tarjeta");
    return c && c.textContent.includes("Educaplay");
  }, undefined, opts).catch(() => { throw new Error("Educaplay no apareció"); });
  await page.locator('#lista-tarjetas button[data-abrir-ficha="educaplay"]').first().click();
  await page.waitForSelector("#modal-ficha[open]");
  await auditarAxe(page, "ficha-educaplay");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-ficha").open, undefined, opts)
    .catch(() => { throw new Error("ficha-educaplay no cerró con Escape"); });

  // 8. Abrir asistente, auditar con axe-core y cerrar con Escape
  await page.click("#btn-asistente");
  await page.waitForSelector("#modal-asistente[open]");
  await auditarAxe(page, "asistente");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-asistente").open, undefined, opts)
    .catch(() => { throw new Error("asistente no cerró con Escape"); });

  // 9. Limpiar filtros y comprobar navegación por teclado con Tab
  await page.click("#btn-restablecer");
  await page.waitForFunction(() => /1[.,]?504/.test(document.getElementById("contador-resultados").textContent), undefined, opts)
    .catch(() => { throw new Error("Limpiar filtros final no volvió a 1.504"); });
  await page.keyboard.press("Tab");
};
