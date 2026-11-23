// SPDX-License-Identifier: AGPL-3.0-or-later
// Script de pruebas funcionales para probar-web (-s pruebas/probar_app.js)

module.exports = async (page, info) => {
  // 1. Esperar a que carguen las 1144 herramientas (en es-ES, 4 dígitos puede ir con o sin punto)
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && /1\.?144/.test(el.textContent);
  }, { timeout: 10000 });

  const tarjetasIniciales = await page.locator("#lista-tarjetas .tarjeta").count();
  if (tarjetasIniciales !== 24) {
    throw new Error(`Esperaba 24 tarjetas en página 1, hay ${tarjetasIniciales}`);
  }

  // 2. Comprobar insensibilidad a tildes y mayúsculas en el buscador
  await page.fill("#buscador", "MATEMÁTICAS");
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && el.textContent.includes("31 de");
  }, { timeout: 5000 });

  await page.fill("#buscador", "matematicas");
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && el.textContent.includes("31 de");
  }, { timeout: 5000 });

  // 3. Buscar una herramienta con dos escenarios (Educaplay) y abrir su ficha
  await page.fill("#buscador", "Educaplay");
  await page.waitForFunction(() => {
    const cards = document.querySelectorAll("#lista-tarjetas .tarjeta");
    return cards.length >= 1 && cards[0].textContent.includes("Educaplay");
  }, { timeout: 5000 });

  await page.locator('#lista-tarjetas .tarjeta button[data-abrir-ficha="educaplay"]').first().click();
  await page.waitForSelector("#modal-ficha[open]");

  const escenarios = await page.locator("#modal-ficha .escenario-caja").count();
  if (escenarios !== 2) {
    throw new Error(`Educaplay debería mostrar 2 escenarios en su ficha, muestra ${escenarios}`);
  }

  // Cerrar la ficha con Escape
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("modal-ficha").open);

  // 3. Probar el asistente «Ayúdame a elegir»
  await page.click("#btn-asistente");
  await page.waitForSelector("#modal-asistente[open]");
  await page.click('#form-asistente button[type="submit"]');
  await page.waitForFunction(() => !document.getElementById("modal-asistente").open);

  const textoTrasAsistente = await page.locator("#contador-resultados").textContent();
  if (!textoTrasAsistente || textoTrasAsistente.includes("0 de")) {
    throw new Error(`El asistente no devolvió resultados válidos: ${textoTrasAsistente}`);
  }

  // 4. Volver a limpiar filtros para dejar la captura limpia
  await page.click("#btn-restablecer");
  await page.waitForFunction(() => {
    const el = document.getElementById("contador-resultados");
    return el && /1\.?144/.test(el.textContent);
  });
};
