"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../../components/CRMLayout";

type Quote = {
id: string;
client_name: string;
guests: number;
catering_package: string;
catering_total: number;
bar_package: string;
bar_total: number;
decoration: boolean;
decoration_total: number;
dj: boolean;
dj_total: number;
photography: boolean;
photography_total: number;
total: number;
status: string;
created_at: string;
venue_id: string;
};

export default function QuoteHistory() {
const router = useRouter();

const [quotes, setQuotes] = useState<Quote[]>([]);
const [loading, setLoading] = useState(true);
const [errorMessage, setErrorMessage] = useState("");
const [message, setMessage] = useState("");

const [venueId, setVenueId] = useState<string | null>(null);

const formatCurrency = (amount: number) => {
return new Intl.NumberFormat("en-NG", {
style: "currency",
currency: "NGN",
maximumFractionDigits: 0,
}).format(amount);
};

// --------------------------------------------------
// LOAD USER'S VENUE
// --------------------------------------------------

async function loadUserVenue() {
const user = await getCurrentUser();


if (!user) {
  router.push("/login");
  return null;
}

const { data: profile, error: profileError } =
  await supabase
    .from("profiles")
    .select("venue_id")
    .eq("id", user.id)
    .single();

if (profileError) {
  console.error("PROFILE LOAD ERROR:", profileError);

  setErrorMessage(
    `Unable to load your venue profile: ${profileError.message}`
  );

  setLoading(false);
  return null;
}

if (!profile?.venue_id) {
  setErrorMessage(
    "Your account is not connected to a venue."
  );

  setLoading(false);
  return null;
}

setVenueId(profile.venue_id);

return profile.venue_id;


}

// --------------------------------------------------
// LOAD QUOTES
// --------------------------------------------------

async function loadQuotes(currentVenueId: string) {
setLoading(true);
setErrorMessage("");


const { data, error } = await supabase
  .from("quotes")
  .select("*")
  .eq("venue_id", currentVenueId)
  .order("created_at", { ascending: false });

if (error) {
  console.error("SUPABASE QUOTES ERROR:", error);

  setErrorMessage(
    `Unable to load quotes: ${error.message}`
  );

  setLoading(false);
  return;
}

setQuotes(data || []);
setLoading(false);


}

// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------

useEffect(() => {
async function initializePage() {
setLoading(true);


  const currentVenueId = await loadUserVenue();

  if (!currentVenueId) {
    return;
  }

  await loadQuotes(currentVenueId);
}

initializePage();


}, [router]);

// --------------------------------------------------
// UPDATE QUOTE STATUS
// --------------------------------------------------

async function updateStatus(
id: string,
status: string
) {
setErrorMessage("");
setMessage("");


if (!venueId) {
  setErrorMessage(
    "Unable to determine your venue. Please log in again."
  );

  return;
}

const { error } = await supabase
  .from("quotes")
  .update({ status })
  .eq("id", id)
  .eq("venue_id", venueId);

if (error) {
  console.error(
    "SUPABASE QUOTE STATUS ERROR:",
    error
  );

  setErrorMessage(
    `Unable to update status: ${error.message}`
  );

  return;
}

setQuotes((currentQuotes) =>
  currentQuotes.map((quote) =>
    quote.id === id
      ? { ...quote, status }
      : quote
  )
);

setMessage("Quote status updated successfully.");


}

// --------------------------------------------------
// PAGE UI
// --------------------------------------------------

return ( <CRMLayout> <main className="min-h-screen bg-gray-100 p-8"> <div className="mx-auto max-w-7xl">

```
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Quote History
          </h1>

          <p className="mt-2 text-gray-600">
            View and manage all saved client quotes.
          </p>
        </div>

        <Link
          href="/quotes"
          className="inline-flex items-center justify-center rounded-lg bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
        >
          + New Quote
        </Link>
      </div>

      {/* Success Message */}
      {message && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          <p className="font-medium">
            {message}
          </p>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Quote Count */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Saved Quotes
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Click a client name to view the full quote.
          </p>
        </div>

        <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
          {quotes.length}{" "}
          {quotes.length === 1 ? "quote" : "quotes"}
        </span>
      </div>

      {/* Quotes Table */}
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

        {/* Loading */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading quotes...
          </div>
        ) : quotes.length === 0 ? (

          /* Empty State */
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold text-gray-900">
              No quotes found
            </h3>

            <p className="mt-2 text-gray-500">
              Create your first quote to see it here.
            </p>

            <Link
              href="/quotes"
              className="mt-5 inline-block rounded-lg bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Create Quote
            </Link>
          </div>

        ) : (

          /* Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left">

              {/* Table Header */}
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Client
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Guests
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Catering
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Bar
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Total
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Status
                  </th>

                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                    Created
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y">
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="transition hover:bg-gray-50"
                  >

                    {/* Client */}
                    <td className="px-6 py-4">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-semibold text-gray-900 hover:underline"
                      >
                        {quote.client_name}
                      </Link>

                      <p className="mt-1 text-xs text-gray-500">
                        ID: {quote.id.slice(0, 8)}
                      </p>
                    </td>

                    {/* Guests */}
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {quote.guests}
                      </span>
                    </td>

                    {/* Catering */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium capitalize text-gray-900">
                        {quote.catering_package}
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatCurrency(
                          quote.catering_total
                        )}
                      </p>
                    </td>

                    {/* Bar */}
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium capitalize text-gray-900">
                        {quote.bar_package}
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatCurrency(
                          quote.bar_total
                        )}
                      </p>
                    </td>

                    {/* Total */}
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">
                        {formatCurrency(quote.total)}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <select
                        value={quote.status}
                        onChange={(event) =>
                          updateStatus(
                            quote.id,
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-black"
                      >
                        <option value="Draft">
                          Draft
                        </option>

                        <option value="Sent">
                          Sent
                        </option>

                        <option value="Accepted">
                          Accepted
                        </option>

                        <option value="Rejected">
                          Rejected
                        </option>
                      </select>
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {new Date(
                          quote.created_at
                        ).toLocaleDateString("en-NG")}
                      </p>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}
      </div>
    </div>
  </main>
</CRMLayout>


);
}