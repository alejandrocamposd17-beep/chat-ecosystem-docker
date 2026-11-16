import { expect, test, type Browser, type Page } from "@playwright/test";

// PNG de 1x1 píxel para probar los adjuntos
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Cada usuario en su propio contexto: cookies separadas, como dos navegadores distintos. */
async function loginAs(browser: Browser, who: "Alejandro" | "Andrea"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: `Entrar como ${who}` }).click();
  await expect(page.getByText("Conectado en tiempo real")).toBeVisible();
  return page;
}

/** Burbuja de un mensaje en la conversación abierta (la lista de chats también muestra el texto). */
function bubble(page: Page, text: string) {
  return page.locator('[id^="msg-"]', { hasText: text });
}

async function openChat(page: Page, name: RegExp) {
  await page.getByRole("link", { name }).first().click();
  await expect(page.getByRole("textbox", { name: "Mensaje" })).toBeVisible();
}

test("dos usuarios conversan en tiempo real: escribiendo, mensaje, Visto, reacción y adjunto", async ({ browser }) => {
  const alejandro = await loginAs(browser, "Alejandro");
  const andrea = await loginAs(browser, "Andrea");

  await openChat(alejandro, /Andrea Martínez/);
  await openChat(andrea, /Alejandro Campos/);

  // "escribiendo..." aparece en el otro navegador
  const text = `Hola desde Playwright ${Date.now()}`;
  await alejandro.getByRole("textbox", { name: "Mensaje" }).fill(text);
  await expect(andrea.getByText("escribiendo...").first()).toBeVisible();

  // El mensaje llega sin recargar la página
  await alejandro.getByRole("button", { name: "Enviar" }).click();
  await expect(bubble(andrea, text)).toBeVisible();

  // Andrea lo leyó: Alejandro ve "Visto"
  await expect(alejandro.getByText(/· Visto/)).toBeVisible();

  // Andrea reacciona y Alejandro ve la reacción
  await bubble(andrea, text).getByText(text).hover();
  await bubble(andrea, text).getByRole("button", { name: "Reaccionar", exact: true }).click();
  await andrea.getByRole("button", { name: "Reaccionar con 👍" }).click();
  await expect(alejandro.getByRole("button", { name: /👍 1/ })).toBeVisible();

  // Andrea envía una imagen y Alejandro la ve en la conversación
  await andrea.getByLabel("Adjuntar archivo").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PIXEL_PNG });
  await andrea.getByRole("button", { name: "Enviar" }).click();
  await expect(alejandro.getByRole("img", { name: "pixel.png" })).toBeVisible();
});

test("los mensajes de un grupo llegan a todos con el nombre de quien escribe", async ({ browser }) => {
  const alejandro = await loginAs(browser, "Alejandro");
  const andrea = await loginAs(browser, "Andrea");

  await openChat(alejandro, /Equipo Docker/);
  await openChat(andrea, /Equipo Docker/);

  const text = `Mensaje al grupo ${Date.now()}`;
  await andrea.getByRole("textbox", { name: "Mensaje" }).fill(text);
  await andrea.getByRole("button", { name: "Enviar" }).click();

  await expect(bubble(alejandro, text)).toBeVisible();
  await expect(bubble(alejandro, text).getByText("Andrea Martínez")).toBeVisible();
});
