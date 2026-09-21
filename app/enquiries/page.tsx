"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Enquiry = {
  id: string;
  venue_id: string;
  client_name: string;
  email: string;
  phone: string;
  event_date: string;
  guests: number;
  status: string;
  created_at: string;
};

export default function Enquiries() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guests, setGuests] = useState("");

  // Enquiries state
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);

  // Authentication / venue state
  const [venueId, setVenueId] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);

  // Messages
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // --------------------------------------------------
  // LOAD USER AND VENUE
  // --------------------------------------------------

  async function loadUserVenue() {
    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("venue_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("PROFILE LOAD ERROR:", profileError);

      setErrorMessage(
        `Unable to load your venue profile: ${profileError.message}`
      );

      setLoadingEnquiries(false);
      return null;
    }

    if (!profile?.venue_id) {
      setErrorMessage(
        "Your account is not connected to a venue."
      );

      setLoadingEnquiries(false);
      return null;
    }

    setVenueId(profile.venue_id);

    return profile.venue_id;
  }

  // --------------------------------------------------
  // LOAD ENQUIRIES FROM SUPABASE
  // --------------------------------------------------

  async function loadEnquiries() {
    setLoadingEnquiries(true);
    setErrorMessage("");

    const currentVenueId =
      venueId || (await loadUserVenue());

    if (!currentVenueId) {
      return;
    }

    const { data, error } = await supabase
      .from("enquiries")
      .select("*")
      .eq("venue_id", currentVenueId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SUPABASE LOAD ERROR:", error);

      setErrorMessage(
        `Unable to load enquiries: ${error.message}`
      );

      setLoadingEnquiries(false);
      return;
    }

    setEnquiries(data || []);
    setLoadingEnquiries(false);
  }

  // --------------------------------------------------
  // LOAD ENQUIRIES WHEN PAGE OPENS
  // --------------------------------------------------

  useEffect(() => {
    loadEnquiries();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------
  // CREATE NEW ENQUIRY
  // --------------------------------------------------

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const currentVenueId =
      venueId || (await loadUserVenue());

    if (!currentVenueId) {
      setLoading(false);

      setErrorMessage(
        "Unable to determine your venue. Please log in again."
      );

      return;
    }

    const { error } = await supabase
      .from("enquiries")
      .insert({
        venue_id: currentVenueId,
        client_name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        event_date: eventDate,
        guests: Number(guests),
        status: "Inquiry",
      });

    setLoading(false);

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);

      setErrorMessage(
        `Unable to save enquiry: ${error.message}`
      );

      return;
    }

    setMessage("Enquiry saved successfully!");

    // Clear form
    setName("");
    setEmail("");
    setPhone("");
    setEventDate("");
    setGuests("");

    // Reload enquiries
    loadEnquiries();
  }

  // --------------------------------------------------
  // UPDATE ENQUIRY STATUS
  // --------------------------------------------------

  async function updateStatus(
    id: string,
    status: string
  ) {
    setErrorMessage("");
    setMessage("");

    if (!venueId) {
      setErrorMessage(
        "Unable to determine your venue."
      );

      return;
    }

    const { error } = await supabase
      .from("enquiries")
      .update({ status })
      .eq("id", id)
      .eq("venue_id", venueId);

    if (error) {
      console.error(
        "SUPABASE STATUS UPDATE ERROR:",
        error
      );

      setErrorMessage(
        `Unable to update status: ${error.message}`
      );

      return;
    }

    setEnquiries((currentEnquiries) =>
      currentEnquiries.map((enquiry) =>
        enquiry.id === id
          ? {
              ...enquiry,
              status,
            }
          : enquiry
      )
    );

    setMessage(
      "Enquiry status updated successfully."
    );
  }

  // --------------------------------------------------
  // PAGE UI
  // --------------------------------------------------

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-6xl">

          {/* PAGE HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Enquiries
            </h1>

            <p className="mt-2 text-gray-600">
              Manage wedding and event enquiries.
            </p>
          </div>

          {/* GLOBAL ERROR MESSAGE */}
          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {/* GLOBAL SUCCESS MESSAGE */}
          {message && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
              <p className="font-medium">
                {message}
              </p>
            </div>
          )}

          {/* NEW ENQUIRY FORM */}
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              New Enquiry
            </h2>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 rounded-xl border bg-white p-8 shadow-sm"
            >

              {/* CLIENT NAME */}
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block font-medium text-gray-900"
                >
                  Client Name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="e.g. Sarah Johnson"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block font-medium text-gray-900"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="sarah@example.com"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* PHONE */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block font-medium text-gray-900"
                >
                  Phone Number
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="+2348012345678"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* EVENT DATE */}
              <div>
                <label
                  htmlFor="eventDate"
                  className="mb-2 block font-medium text-gray-900"
                >
                  Event Date
                </label>

                <input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(event) =>
                    setEventDate(event.target.value)
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* NUMBER OF GUESTS */}
              <div>
                <label
                  htmlFor="guests"
                  className="mb-2 block font-medium text-gray-900"
                >
                  Number of Guests
                </label>

                <input
                  id="guests"
                  type="number"
                  value={guests}
                  onChange={(event) =>
                    setGuests(event.target.value)
                  }
                  placeholder="e.g. 150"
                  min="1"
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : "Create Enquiry"}
              </button>

            </form>
          </section>

          {/* ALL ENQUIRIES */}
          <section>

            {/* SECTION HEADER */}
            <div className="mb-4 flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  All Enquiries
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  View and manage all incoming enquiries.
                </p>
              </div>

              <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
                {enquiries.length}{" "}
                {enquiries.length === 1
                  ? "enquiry"
                  : "enquiries"}
              </span>

            </div>

            {/* TABLE CONTAINER */}
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

              {/* LOADING */}
              {loadingEnquiries ? (
                <div className="p-8 text-center text-gray-500">
                  Loading enquiries...
                </div>

              ) : enquiries.length === 0 ? (

                /* EMPTY STATE */
                <div className="p-8 text-center text-gray-500">
                  No enquiries found.
                </div>

              ) : (

                /* TABLE */
                <div className="overflow-x-auto">

                  <table className="w-full text-left">

                    {/* TABLE HEADER */}
                    <thead className="border-b bg-gray-50">

                      <tr>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Client
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Contact
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Event Date
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Guests
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Status
                        </th>

                      </tr>

                    </thead>

                    {/* TABLE BODY */}
                    <tbody className="divide-y">

                      {enquiries.map((enquiry) => (

                        <tr
                          key={enquiry.id}
                          className="hover:bg-gray-50"
                        >

                          {/* CLIENT */}
                          <td className="px-6 py-4">

                            <p className="font-semibold text-gray-900">
                              {enquiry.client_name}
                            </p>

                            <p className="text-sm text-gray-500">
                              {enquiry.email}
                            </p>

                          </td>

                          {/* CONTACT */}
                          <td className="px-6 py-4">

                            <p className="text-sm text-gray-600">
                              {enquiry.phone}
                            </p>

                          </td>

                          {/* EVENT DATE */}
                          <td className="px-6 py-4">

                            <p className="text-sm text-gray-600">
                              {enquiry.event_date}
                            </p>

                          </td>

                          {/* GUESTS */}
                          <td className="px-6 py-4">

                            <p className="text-sm text-gray-600">
                              {enquiry.guests}
                            </p>

                          </td>

                          {/* STATUS */}
                          <td className="px-6 py-4">

                            <select
                              value={enquiry.status}
                              onChange={(event) =>
                                updateStatus(
                                  enquiry.id,
                                  event.target.value
                                )
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-black"
                            >

                              <option value="Inquiry">
                                Inquiry
                              </option>

                              <option value="Tour Scheduled">
                                Tour Scheduled
                              </option>

                              <option value="Quote Sent">
                                Quote Sent
                              </option>

                              <option value="Negotiation">
                                Negotiation
                              </option>

                              <option value="Booked">
                                Booked
                              </option>

                              <option value="Lost">
                                Lost
                              </option>

                            </select>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>
              )}

            </div>

          </section>

        </div>
      </main>
    </CRMLayout>
  );
}