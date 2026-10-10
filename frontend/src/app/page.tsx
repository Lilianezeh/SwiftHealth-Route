import { getHealth } from "@/lib/api/client";

// Landing page placeholder. Day 9: problem, who it's for, pricing.
export default async function Home() {
  const health = await getHealth();
  return (
    <section className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-4xl font-bold text-forest">SwiftHealth: find open care, fast.</h1>
      <p className="mt-4 text-lg">
        Emergency, hospital and pharmacy finder. Verified listings, one-tap calling and directions, with SwiftRescue for emergencies. Now in Enugu.
      </p>
      <p className="mt-8 text-base">
        API status: <strong>{health ? "connected" : "not reachable"}</strong>
      </p>
    </section>
  );
}
