export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <section className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Listing: {slug}</h1>
      <p className="mt-2">Coming soon.</p>
    </section>
  );
}
