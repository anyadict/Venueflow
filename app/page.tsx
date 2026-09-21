export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            VenueFlow
          </h1>

          <div className="flex gap-4">
            <button className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">
              Log in
            </button>

            <button className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-3xl">
          <p className="mb-4 font-semibold text-gray-600">
            WEDDING & EVENT VENUE CRM
          </p>

          <h2 className="text-5xl font-bold tracking-tight text-gray-900">
            Turn venue enquiries into bookings.
          </h2>

          <p className="mt-6 text-xl leading-8 text-gray-600">
            Manage enquiries, availability, quotations and bookings
            from one simple platform.
          </p>

          <div className="mt-8 flex gap-4">
            <button className="rounded-lg bg-black px-6 py-3 font-semibold text-white hover:bg-gray-800">
              Start Free
            </button>

            <button className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50">
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-20 md:grid-cols-3">
        <Feature
          title="Availability Calendar"
          description="Let couples check available dates before contacting your venue."
        />

        <Feature
          title="Instant Quotes"
          description="Create professional quotations based on guest count and packages."
        />

        <Feature
          title="Lead CRM"
          description="Track every enquiry from first contact to confirmed booking."
        />
      </section>
    </main>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="text-xl font-semibold text-gray-900">
        {title}
      </h3>

      <p className="mt-3 leading-7 text-gray-600">
        {description}
      </p>
    </div>
  );
}