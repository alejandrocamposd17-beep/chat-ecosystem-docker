export default function ApiError({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  const notFound = message.includes("404");
  return (
    <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <p className="font-medium">{notFound ? "No encontramos esta conversación." : "No se pudo conectar con la API."}</p>
      <p className="mt-1 opacity-80">{message}</p>
    </div>
  );
}
