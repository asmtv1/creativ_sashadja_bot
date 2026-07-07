export function ErrorState({ message }: { message: string }) {
  return (
    <main className="app-shell">
      <section className="panel error">{message}</section>
    </main>
  );
}
