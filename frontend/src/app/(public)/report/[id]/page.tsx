export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Report a problem with listing {id}</h1>
      <p className="mt-2">Coming soon.</p>
    </section>
  );
}
