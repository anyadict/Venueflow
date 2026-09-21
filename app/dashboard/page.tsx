"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Enquiry = {
  id: string;
  client_name: string;
  email: string;
  phone: string | null;
  event_date: string;
  guests: number;
  status: string;
  created_at: string;
  venue_id: string;
};

const statusOptions = [
  "Inquiry",
  "Tour Scheduled",
  "Quote Sent",
  "Negotiation",
  "Booked",
  "Lost",
];

export default function DashboardPage() {
  const router = useRouter();

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError("");

      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("venue_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.venue_id) {
        console.error("PROFILE ERROR:", profileError);

        setError(
          "Unable to determine your venue. Please make sure your profile is connected to a venue."
        );

        setLoading(false);
        return;
      }

      const { data, error: enquiryError } = await supabase
        .from("enquiries")
        .select("*")
        .eq("venue_id", profile.venue_id)
        .order("created_at", { ascending: false });

      if (enquiryError) {
        console.error("ENQUIRY ERROR:", enquiryError);

        setError("Unable to load dashboard data.");
        setLoading(false);
        return;
      }

      setEnquiries(data || []);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function updateStatus(id: string, newStatus: string) {
    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("venue_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.venue_id) {
      setError("Unable to determine your venue.");
      return;
    }

    const { error: updateError } = await supabase
      .from("enquiries")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("venue_id", profile.venue_id);

    if (updateError) {
      console.error("UPDATE ERROR:", updateError);

      setError("Unable to update enquiry status.");
      return;
    }

    setEnquiries((current) =>
      current.map((enquiry) =>
        enquiry.id === id
          ? {
              ...enquiry,
              status: newStatus,
            }
          : enquiry
      )
    );
  }

  const totalEnquiries = enquiries.length;

  const inquiryCount = enquiries.filter(
    (enquiry) => enquiry.status === "Inquiry"
  ).length;

  const tourCount = enquiries.filter(
    (enquiry) => enquiry.status === "Tour Scheduled"
  ).length;

  const quoteCount = enquiries.filter(
    (enquiry) => enquiry.status === "Quote Sent"
  ).length;

  const negotiationCount = enquiries.filter(
    (enquiry) => enquiry.status === "Negotiation"
  ).length;

  const bookedCount = enquiries.filter(
    (enquiry) => enquiry.status === "Booked"
  ).length;

  const lostCount = enquiries.filter(
    (enquiry) => enquiry.status === "Lost"
  ).length;

  const pipelineStatuses = [
    {
      name: "Inquiry",
      count: inquiryCount,
    },
    {
      name: "Tour Scheduled",
      count: tourCount,
    },
    {
      name: "Quote Sent",
      count: quoteCount,
    },
    {
      name: "Negotiation",
      count: negotiationCount,
    },
    {
      name: "Booked",
      count: bookedCount,
    },
  ];

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "Inquiry":
        return "bg-blue-100 text-blue-700";

      case "Tour Scheduled":
        return "bg-purple-100 text-purple-700";

      case "Quote Sent":
        return "bg-yellow-100 text-yellow-700";

      case "Negotiation":
        return "bg-orange-100 text-orange-700";

      case "Booked":
        return "bg-green-100 text-green-700";

      case "Lost":
        return "bg-red-100 text-red-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  if (loading) {
    return (
      <CRMLayout>
        <main className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black"></div>

            <p className="text-gray-600">
              Loading VenueFlow...
            </p>
          </div>
        </main>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-50">

        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between px-6 py-5">

            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Dashboard
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage your venue enquiries and event pipeline.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/enquiries")}
              className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              + New Enquiry
            </button>

          </div>
        </header>

        <div className="p-6">

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Total Enquiries
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalEnquiries}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                New Inquiries
              </p>

              <p className="mt-2 text-3xl font-bold text-blue-600">
                {inquiryCount}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Quotes Sent
              </p>

              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {quoteCount}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Booked
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {bookedCount}
              </p>
            </div>

          </div>

          {/* Pipeline */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Enquiry Pipeline
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Track clients from initial inquiry to booking.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

              {pipelineStatuses.map((stage) => (
                <div
                  key={stage.name}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-500">
                    {stage.name}
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {stage.count}
                  </p>
                </div>
              ))}

            </div>
          </div>

          {/* Recent Enquiries */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-gray-200 p-6">

              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Enquiries
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Your latest venue enquiries.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/enquiries")}
                className="text-sm font-semibold text-gray-900 hover:underline"
              >
                View All
              </button>

            </div>

            {enquiries.length === 0 ? (
              <div className="p-10 text-center">

                <p className="text-gray-500">
                  No enquiries yet.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/enquiries")}
                  className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  Create Your First Enquiry
                </button>

              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[800px]">

                  <thead className="bg-gray-50">
                    <tr>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Client
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Guests
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Event Date
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Email
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">

                    {enquiries.slice(0, 10).map((enquiry) => (
                      <tr
                        key={enquiry.id}
                        className="transition hover:bg-gray-50"
                      >

                        <td className="px-6 py-4">

                          <p className="font-medium text-gray-900">
                            {enquiry.client_name}
                          </p>

                          {enquiry.phone && (
                            <p className="mt-1 text-xs text-gray-500">
                              {enquiry.phone}
                            </p>
                          )}

                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {enquiry.guests}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(enquiry.event_date)}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-700">
                          {enquiry.email}
                        </td>

                        <td className="px-6 py-4">

                          <select
                            value={enquiry.status}
                            onChange={(event) =>
                              updateStatus(
                                enquiry.id,
                                event.target.value
                              )
                            }
                            className={`rounded-full border-0 px-3 py-1.5 text-xs font-semibold outline-none ${getStatusClass(
                              enquiry.status
                            )}`}
                          >

                            {statusOptions.map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ))}

                          </select>

                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>
            )}

          </div>

          {/* Additional Status Summary */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

              <h3 className="text-lg font-semibold text-gray-900">
                Negotiations
              </h3>

              <p className="mt-2 text-3xl font-bold text-orange-600">
                {negotiationCount}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Clients currently in negotiation.
              </p>

            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

              <h3 className="text-lg font-semibold text-gray-900">
                Lost Enquiries
              </h3>

              <p className="mt-2 text-3xl font-bold text-red-600">
                {lostCount}
              </p>

              <p className="mt-2 text-sm text-gray-500">
                Enquiries that did not convert into bookings.
              </p>

            </div>

          </div>

        </div>

      </main>
    </CRMLayout>
  );
}