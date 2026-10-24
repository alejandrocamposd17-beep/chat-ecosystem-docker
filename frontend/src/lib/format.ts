// Zona horaria fija: servidor y navegador formatean igual (sin errores de hidratacion)
const TIME_ZONE = "America/El_Salvador";

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", {
    day: "2-digit",
    month: "short",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}
