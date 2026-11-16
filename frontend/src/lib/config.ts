// URL de la API Laravel. Solo se usa en el servidor de Next.js (Server Components y Route Handlers):
// dentro de Docker es http://api:8000/api (red interna); el navegador nunca la llama directo.
export const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000/api";

// Cookie httpOnly con el token de sesión: JavaScript del navegador no puede leerla (protege ante XSS)
export const SESSION_COOKIE = "chat_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días, igual que el token en la API
