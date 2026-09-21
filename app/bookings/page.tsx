"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Booking = {
  id: string;
  enquiry_id: string | null;
  quote_id: string | null;
  venue_id: string;
  client_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  venue_name: string | null;
  event_type: string | null;
  total_amount: number;
  status: string;
  created_at: string;
};

const statusOptions = [
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
];

export default function BookingsPage() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setErrorMessage("");

    try {
      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("venue_id")
          .eq("id", user.id)
          .single();

      if (profileError || !profile?.venue_id) {
        console.error(
          "PROFILE ERROR:",
          profileError
        );

        setErrorMessage(
          "Unable to determine your venue. Please make sure your profile is connected to a venue."
        );

        return;
      }

      setVenueId(profile.venue_id);

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("venue_id", profile.venue_id)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.error(
          "SUPABASE BOOKINGS ERROR:",
          error
        );

        setErrorMessage(
          `Unable to load bookings: ${error.message}`
        );

        return;
      }

      setBookings(data || []);
    } catch (error) {
      console.error(
        "LOAD BOOKINGS ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load bookings."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function updateBookingStatus(
    bookingId: string,
    newStatus: string
  ) {
    if (!venueId) {
      setErrorMessage(
        "Venue information is unavailable."
      );
      return;
    }

    setErrorMessage("");

    /*
     * When moving a booking to Pending or Confirmed,
     * make sure another active booking does not overlap
     * with it on the same date and time.
     */
    if (
      newStatus === "Pending" ||
      newStatus === "Confirmed"
    ) {
      const {
        data: currentBooking,
        error: currentBookingError,
      } = await supabase
        .from("bookings")
        .select(
          "id, event_date, start_time, end_time, client_name"
        )
        .eq("id", bookingId)
        .eq("venue_id", venueId)
        .single();

      if (
        currentBookingError ||
        !currentBooking
      ) {
        console.error(
          "CURRENT BOOKING LOOKUP ERROR:",
          currentBookingError
        );

        setErrorMessage(
          "Unable to check the booking before updating its status."
        );

        return;
      }

      const {
        data: conflictingBooking,
        error: conflictError,
      } = await supabase
        .from("bookings")
        .select(
          "id, client_name, event_type, status, start_time, end_time"
        )
        .eq("venue_id", venueId)
        .eq(
          "event_date",
          currentBooking.event_date
        )
        .neq("id", bookingId)
        .neq("status", "Cancelled")
        .lt(
          "start_time",
          currentBooking.end_time
        )
        .gt(
          "end_time",
          currentBooking.start_time
        )
        .limit(1)
        .maybeSingle();

      if (conflictError) {
        console.error(
          "BOOKING CONFLICT CHECK ERROR:",
          conflictError
        );

        setErrorMessage(
          `Unable to check booking availability: ${conflictError.message}`
        );

        return;
      }

      if (conflictingBooking) {
        setErrorMessage(
          `Cannot change this booking to ${newStatus}. The venue is already booked on ${formatDate(
            currentBooking.event_date
          )} from ${formatTime(
            String(conflictingBooking.start_time).slice(
              0,
              5
            )
          )} – ${formatTime(
            String(conflictingBooking.end_time).slice(
              0,
              5
            )
          )} for ${
            conflictingBooking.client_name
          }.`
        );

        return;
      }
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        status: newStatus,
      })
      .eq("id", bookingId)
      .eq("venue_id", venueId);

    if (error) {
      console.error(
        "SUPABASE BOOKING STATUS ERROR:",
        error
      );

      setErrorMessage(
        `Unable to update booking status: ${error.message}`
      );

      return;
    }

    setBookings((currentBookings) =>
      currentBookings.map((booking) =>
        booking.id === bookingId
          ? {
              ...booking,
              status: newStatus,
            }
          : booking
      )
    );
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(
      new Date(`${dateString}T00:00:00`)
    );
  }

  function formatTime(timeString: string) {
    const [hours, minutes] = timeString
      .slice(0, 5)
      .split(":")
      .map(Number);

    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(
      minutes
    ).padStart(2, "0")} ${period}`;
  }

  function getStatusClasses(status: string) {
    switch (status) {
      case "Confirmed":
        return "bg-green-100 text-green-700";

      case "Completed":
        return "bg-blue-100 text-blue-700";

      case "Cancelled":
        return "bg-red-100 text-red-700";

      case "Pending":
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  }

  const totalBookings = bookings.length;

  const confirmedBookings = bookings.filter(
    (booking) =>
      booking.status === "Confirmed"
  ).length;

  const pendingBookings = bookings.filter(
    (booking) =>
      booking.status === "Pending"
  ).length;

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-7xl">

          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bookings
              </h1>

              <p className="mt-2 text-gray-600">
                Manage confirmed events and upcoming bookings.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push("/bookings/new")
              }
              className="rounded-lg bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              + New Booking
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="mb-8 grid gap-6 md:grid-cols-3">

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Total Bookings
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {totalBookings}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Confirmed
              </p>

              <p className="mt-2 text-3xl font-bold text-green-600">
                {confirmedBookings}
              </p>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">
                Pending
              </p>

              <p className="mt-2 text-3xl font-bold text-yellow-600">
                {pendingBookings}
              </p>
            </div>

          </div>

          {/* Loading */}
          {loading && (
            <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
              <p className="text-gray-500">
                Loading bookings...
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading &&
            bookings.length === 0 && (
              <div className="rounded-xl border bg-white p-12 text-center shadow-sm">

                <h2 className="text-xl font-bold text-gray-900">
                  No bookings yet
                </h2>

                <p className="mt-2 text-gray-600">
                  Create your first booking to start managing your events.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/bookings/new"
                    )
                  }
                  className="mt-6 rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
                >
                  Create First Booking
                </button>

              </div>
            )}

          {/* Bookings Table */}
          {!loading &&
            bookings.length > 0 && (
              <div className="overflow-hidden rounded-xl border bg-white shadow-sm">

                <div className="overflow-x-auto">

                  <table className="w-full text-left">

                    <thead className="border-b bg-gray-50">
                      <tr>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Client
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Event
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Date & Time
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Guests
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Amount
                        </th>

                        <th className="px-6 py-4 text-sm font-semibold text-gray-700">
                          Status
                        </th>

                      </tr>
                    </thead>

                    <tbody className="divide-y">

                      {bookings.map(
                        (booking) => (
                          <tr
                            key={booking.id}
                            className="transition hover:bg-gray-50"
                          >

                            {/* Client */}
                            <td className="px-6 py-5">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/bookings/${booking.id}`
                                  )
                                }
                                className="text-left"
                              >
                                <p className="font-semibold text-gray-900 hover:underline">
                                  {
                                    booking.client_name
                                  }
                                </p>
                              </button>

                              {booking.venue_name && (
                                <p className="mt-1 text-sm text-gray-500">
                                  {
                                    booking.venue_name
                                  }
                                </p>
                              )}
                            </td>

                            {/* Event */}
                            <td className="px-6 py-5">
                              <p className="font-medium text-gray-900">
                                {
                                  booking.event_type ||
                                  "Event"
                                }
                              </p>
                            </td>

                            {/* Date & Time */}
                            <td className="px-6 py-5">
                              <p className="font-medium text-gray-900">
                                {formatDate(
                                  booking.event_date
                                )}
                              </p>

                              <p className="mt-1 text-sm text-gray-500">
                                {formatTime(
                                  booking.start_time
                                )}{" "}
                                –{" "}
                                {formatTime(
                                  booking.end_time
                                )}
                              </p>
                            </td>

                            {/* Guests */}
                            <td className="px-6 py-5 text-gray-700">
                              {
                                booking.guests
                              }
                            </td>

                            {/* Amount */}
                            <td className="px-6 py-5 font-semibold text-gray-900">
                              {formatCurrency(
                                booking.total_amount
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-6 py-5">
                              <select
                                value={
                                  booking.status
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateBookingStatus(
                                    booking.id,
                                    event.target
                                      .value
                                  )
                                }
                                className={`rounded-full border-0 px-3 py-2 text-sm font-semibold outline-none ${getStatusClasses(
                                  booking.status
                                )}`}
                              >
                                {statusOptions.map(
                                  (status) => (
                                    <option
                                      key={
                                        status
                                      }
                                      value={
                                        status
                                      }
                                    >
                                      {status}
                                    </option>
                                  )
                                )}
                              </select>
                            </td>

                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

        </div>
      </main>
    </CRMLayout>
  );
}