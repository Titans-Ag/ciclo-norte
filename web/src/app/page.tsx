export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-blue-700">Ciclo Norte</h1>
        <p className="mt-2 text-gray-600">Plataforma de Atendimento Inteligente</p>
        <a href="/login" className="mt-6 inline-block rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
          Entrar
        </a>
      </div>
    </div>
  );
}
