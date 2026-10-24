export default function Home() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-2 bg-neutral-50 p-8 text-center dark:bg-neutral-950">
      <p className="text-4xl" aria-hidden>💬</p>
      <h2 className="text-xl font-semibold">Selecciona una conversación</h2>
      <p className="max-w-sm text-sm text-neutral-500">
        Elige un chat en la barra lateral para ver los mensajes y responder.
      </p>
    </section>
  );
}
