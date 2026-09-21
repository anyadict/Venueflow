"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ExistingBooking = {
  id: string;
  client_name: string;
  event_type: string | null;
  status: string;
  start_time: string;
  end_time: string;
};

function formatDisplayDate(dateString: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function formatTime(timeString: string) {
  const [hours, minutes] = timeString.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

export default function EditBookingPage() {
  const params = useParams();
  const router = useRouter();

  const bookingId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [clientName, setClientName] = useState("");
  const [guests, setGuests] = useState("");
  const [bookingAmount, setBookingAmount] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [venueName, setVenueName] = useState("");
  const [venueId, setVenueId] = useState("");

  const [conflictingBooking, setConflictingBooking] =
    useState<ExistingBooking | null>(null);

  useEffect(() => {
    async function loadBooking() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (error) {
        console.error("LOAD BOOKING ERROR:", error);

        setError(error.message);
        setLoading(false);
        return;
      }

      setClientName(data.client_name || "");
      setGuests(String(data.guests || ""));
      setBookingAmount(String(data.total_amount || ""));
      setEventType(data.event_type || "");
      setEventDate(data.event_date || "");
      setStartTime(
        data.start_time
          ? String(data.start_time).slice(0, 5)
          : "09:00"
      );
      setEndTime(
        data.end_time
          ? String(data.end_time).slice(0, 5)
          : "17:00"
      );
      setVenueName(data.venue_name || "");
      setVenueId(data.venue_id || "");

      setLoading(false);
    }

    if (bookingId) {
      loadBooking();
    }
  }, [bookingId]);

  useEffect(() => {
    async function checkAvailability() {
      setConflictingBooking(null);

      if (
        !venueId ||
        !eventDate ||
        !startTime ||
        !endTime
      ) {
        return;
      }

      if (endTime <= startTime) {
        return;
      }

      const {
        data,
        error: conflictError,
      } = await supabase
        .from("bookings")
        .select(
          "id, client_name, event_type, status, start_time, end_time"
        )
        .eq("venue_id", venueId)
        .eq("event_date", eventDate)
        .neq("id", bookingId)
        .neq("status", "Cancelled")
        .lt("start_time", endTime)
        .gt("end_time", startTime)
        .limit(1)
        .maybeSingle();

      if (conflictError) {
        console.error(
          "AVAILABILITY CHECK ERROR:",
          conflictError
        );
        return;
      }

      if (data) {
        setConflictingBooking({
          ...data,
          start_time: String(data.start_time).slice(0, 5),
          end_time: String(data.end_time).slice(0, 5),
        });
      }
    }

    checkAvailability();
  }, [
    venueId,
    eventDate,
    startTime,
    endTime,
    bookingId,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setConflictingBooking(null);

    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }

    if (!guests || Number(guests) <= 0) {
      setError("Please enter a valid number of guests.");
      return;
    }

    if (!bookingAmount || Number(bookingAmount) < 0) {
      setError("Please enter a valid booking amount.");
      return;
    }

    if (!eventDate) {
      setError("Event date is required.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Start time and end time are required.");
      return;
    }

    if (endTime <= startTime) {
      setError("End time must be later than start time.");
      return;
    }

    if (!venueId) {
      setError(
        "Venue information is unavailable. Please try again."
      );
      return;
    }

    setSaving(true);

    /*
     * Final conflict check.
     *
     * We repeat the check here instead of relying only on
     * the availability message shown on the form.
     *
     * This protects the save operation if another booking
     * was created after the page loaded.
     */
    const {
      data: existingBooking,
      error: conflictError,
    } = await supabase
      .from("bookings")
      .select(
        "id, client_name, event_type, status, start_time, end_time"
      )
      .eq("venue_id", venueId)
      .eq("event_date", eventDate)
      .neq("id", bookingId)
      .neq("status", "Cancelled")
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .limit(1)
      .maybeSingle();

    if (conflictError) {
      console.error(
        "FINAL BOOKING CONFLICT CHECK ERROR:",
        conflictError
      );

      setError(
        `Unable to check booking availability: ${conflictError.message}`
      );

      setSaving(false);
      return;
    }

    if (existingBooking) {
      const formattedBooking = {
        ...existingBooking,
        start_time: String(
          existingBooking.start_time
        ).slice(0, 5),
        end_time: String(
          existingBooking.end_time
        ).slice(0, 5),
      };

      setConflictingBooking(formattedBooking);

      setError(
        `This venue is already booked on ${formatDisplayDate(
          eventDate
        )} from ${formatTime(
          formattedBooking.start_time
        )} – ${formatTime(
          formattedBooking.end_time
        )} for ${
          formattedBooking.client_name
        }. Please choose a different time or date.`
      );

      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        client_name: clientName.trim(),
        guests: Number(guests),
        total_amount: Number(bookingAmount),
        event_type: eventType,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        venue_name: venueName.trim(),
      })
      .eq("id", bookingId)
      .eq("venue_id", venueId);

    if (updateError) {
      console.error(
        "UPDATE BOOKING ERROR:",
        updateError
      );

      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push(`/bookings/${bookingId}`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-gray-500">
            Loading booking...
          </p>
        </div>
      </main>
    );
  }

  if (error && !clientName) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-xl font-bold text-red-700">
              Unable to load booking
            </h1>

            <p className="mt-2 text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() => router.back()}
              className="mt-5 rounded-lg bg-black px-5 py-2 text-white"
            >
              Go Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-4 text-sm font-medium text-gray-600 hover:text-black"
          >
            ← Back
          </button>

          <h1 className="text-3xl font-bold text-gray-900">
            Edit Booking
          </h1>

          <p className="mt-2 text-gray-500">
            Update the booking information below.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
        >
          <div className="grid gap-6 md:grid-cols-2">

            {/* Client Name */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Client Name
              </label>

              <input
                type="text"
                value={clientName}
                onChange={(e) =>
                  setClientName(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="Enter client name"
              />
            </div>

            {/* Guests */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Number of Guests
              </label>

              <input
                type="number"
                min="1"
                value={guests}
                onChange={(e) =>
                  setGuests(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="e.g. 200"
              />
            </div>

            {/* Booking Amount */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Booking Amount (₦)
              </label>

              <input
                type="number"
                min="0"
                value={bookingAmount}
                onChange={(e) =>
                  setBookingAmount(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="e.g. 2850000"
              />
            </div>

            {/* Event Type */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Event Type
              </label>

              <select
                value={eventType}
                onChange={(e) =>
                  setEventType(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                <option value="">
                  Select event type
                </option>

                <option value="Wedding">
                  Wedding
                </option>

                <option value="Birthday">
                  Birthday
                </option>

                <option value="Corporate Event">
                  Corporate Event
                </option>

                <option value="Conference">
                  Conference
                </option>

                <option value="Burial">
                  Burial
                </option>

                <option value="Party">
                  Party
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            {/* Event Date */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Event Date
              </label>

              <input
                type="date"
                value={eventDate}
                onChange={(e) =>
                  setEventDate(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Start Time
              </label>

              <input
                type="time"
                value={startTime}
                onChange={(e) =>
                  setStartTime(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                End Time
              </label>

              <input
                type="time"
                value={endTime}
                onChange={(e) =>
                  setEndTime(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            {/* Venue */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Venue Name
              </label>

              <input
                type="text"
                value={venueName}
                onChange={(e) =>
                  setVenueName(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                placeholder="Enter venue name"
              />
            </div>
          </div>

          {/* Live Conflict Warning */}
          {conflictingBooking && (
            <div className="mt-6 rounded-xl border border-yellow-300 bg-yellow-50 p-6 text-yellow-900">
              <div className="flex items-start gap-3">

                <div className="text-2xl">
                  ⚠️
                </div>

                <div className="flex-1">
                  <h2 className="font-bold">
                    Booking Conflict
                  </h2>

                  <p className="mt-1 text-sm">
                    This venue already has a booking
                    on{" "}
                    <strong>
                      {formatDisplayDate(eventDate)}
                    </strong>{" "}
                    from{" "}
                    <strong>
                      {formatTime(
                        conflictingBooking.start_time
                      )}{" "}
                      –{" "}
                      {formatTime(
                        conflictingBooking.end_time
                      )}
                    </strong>
                    .
                  </p>

                  <div className="mt-4 rounded-lg border border-yellow-200 bg-white p-4 text-sm">
                    <p>
                      <span className="font-medium">
                        Client:
                      </span>{" "}
                      {
                        conflictingBooking.client_name
                      }
                    </p>

                    <p className="mt-1">
                      <span className="font-medium">
                        Event:
                      </span>{" "}
                      {conflictingBooking.event_type ||
                        "Event"}
                    </p>

                    <p className="mt-1">
                      <span className="font-medium">
                        Status:
                      </span>{" "}
                      {conflictingBooking.status}
                    </p>
                  </div>

                  <p className="mt-4 text-sm font-medium">
                    Please select another event time
                    or date.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving || !!conflictingBooking
              }
              className="rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}