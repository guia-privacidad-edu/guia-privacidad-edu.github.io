// SPDX-License-Identifier: AGPL-3.0-or-later
// Auditoría automática de accesibilidad con axe-core + teclado + 5 idiomas para probar-web

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
  // 1. Esperar carga completa del catálogo
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && /1[.,]?144/.test(el.textContent);
  }, { timeout: 10000 });

  // 2. Auditar pantalla inicial con axe-core
  await auditarAxe(page, "portada");

  // 3. Probar cambio de idioma a los 5 idiomas (ca, gl, eu, en, es)
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

  // 4. Probar búsqueda sin distinguir tildes ni mayúsculas
  await page.fill("#buscador", "MATEMÁTICAS");
  await page.waitForFunction(() => /31/.test(document.getElementById("contador-resultados").textContent), { timeout: 5000 });
  await page.fill("#buscador", "matematicas");
  await page.waitForFunction(() => /31/.test(document.getElementById("contador-resultados").textContent), { timeout: 5000 });

  // 5. Abrir ficha con 2 escenarios (Educaplay) y auditar con axe-core
  await page.fill("#buscador", "Educaplay");
  await page.waitForFunction(() => {
    const c = document.querySelector("#lista-tarjetas .tarjeta");
    return c && c.textContent.includes("Educaplay");
  }, { timeout: 5000 });
  await page.locator('#lista-tarjetas button[data-abrir-ficha="educaplay"]').first().click();
  await page.waitForSelector("#modal-ficha[open]");
  await auditarAxe(page, "ficha-educaplay");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-ficha").open);

  // 6. Abrir asistente, auditar con axe-core y cerrar con Escape
  await page.click("#btn-asistente");
  await page.waitForSelector("#modal-asistente[open]");
  await auditarAxe(page, "asistente");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-asistente").open);

  // 7. Limpiar filtros y comprobar navegación por teclado con Tab
  await page.click("#btn-restablecer");
  await page.waitForFunction(() => /1[.,]?144/.test(document.getElementById("contador-resultados").textContent));
  await page.keyboard.press("Tab");
};
