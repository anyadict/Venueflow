"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../../components/CRMLayout";

type Quote = {
  id: string;
  client_name: string;
  guests: number;
  total: number;
  venue_id: string;
};

type ConflictingBooking = {
  id: string;
  client_name: string;
  event_type: string | null;
  status: string;
  start_time: string;
  end_time: string;
};

type Package = {
  id: string;
  name: string;
  category: string;
  price: number;
  pricing_type: string;
  description: string | null;
};

export default function NewBookingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const quoteId = searchParams.get("quoteId");

  // Optional calendar slot parameters.
  // These are supplied when New Booking is opened from an Available calendar slot.
  const calendarDate = searchParams.get("date");
  const calendarStartTime = searchParams.get("startTime");
  const calendarEndTime = searchParams.get("endTime");

  const [quote, setQuote] = useState<Quote | null>(null);

  const [venueId, setVenueId] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  const [clientName, setClientName] = useState("");
  const [guests, setGuests] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  const [eventDate, setEventDate] = useState(
    calendarDate || ""
  );

  const [startTime, setStartTime] = useState(
    calendarStartTime || ""
  );

  const [endTime, setEndTime] = useState(
    calendarEndTime || ""
  );

  const [eventType, setEventType] = useState("Wedding");
  const [venueName, setVenueName] = useState("");

  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<
    Record<string, number>
  >({});

  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);

  const [checkingAvailability, setCheckingAvailability] =
    useState(false);

  const [conflictingBooking, setConflictingBooking] =
    useState<ConflictingBooking | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  // --------------------------------------------------
  // DATE/TIME VALIDATION HELPERS
  // --------------------------------------------------

  function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function getCurrentTime() {
    const now = new Date();

    const hours = String(
      now.getHours()
    ).padStart(2, "0");

    const minutes = String(
      now.getMinutes()
    ).padStart(2, "0");

    return `${hours}:${minutes}`;
  }

  /**
   * Returns true when the selected booking
   * start date/time has already passed.
   *
   * Examples:
   *
   * Yesterday at 10:00 → true
   * Today at 10:00 when it is 13:00 → true
   * Today at 15:00 when it is 13:00 → false
   * Tomorrow at 10:00 → false
   */
  function isBookingStartTimeInThePast(
    selectedDate: string,
    selectedStartTime: string
  ) {
    if (
      !selectedDate ||
      !selectedStartTime
    ) {
      return false;
    }

    const today = getTodayDate();

    // Any date before today is in the past.
    if (selectedDate < today) {
      return true;
    }

    // Any future date is valid regardless of time.
    if (selectedDate > today) {
      return false;
    }

    // Same day: compare selected time
    // against the current local time.
    const currentTime = getCurrentTime();

    return selectedStartTime <= currentTime;
  }

  // --------------------------------------------------
  // DERIVED BOOKING TIME STATUS
  // --------------------------------------------------

  const bookingTimeHasPassed =
    isBookingStartTimeInThePast(
      eventDate,
      startTime
    );

  // --------------------------------------------------
  // LOAD USER'S VENUE
  // --------------------------------------------------

  useEffect(() => {
    async function loadUserVenue() {
      setLoadingVenue(true);
      setErrorMessage("");

      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("venue_id")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(
          "PROFILE LOAD ERROR:",
          profileError
        );

        setErrorMessage(
          `Unable to load your venue profile: ${profileError.message}`
        );

        setLoadingVenue(false);
        return;
      }

      if (!profile?.venue_id) {
        setErrorMessage(
          "Your account is not connected to a venue."
        );

        setLoadingVenue(false);
        return;
      }

      // --------------------------------------------------
      // LOAD VENUE BOOKING SETTINGS
      // --------------------------------------------------

      const {
        data: venue,
        error: venueError,
      } = await supabase
        .from("venues")
        .select(
          "default_start_time, default_end_time"
        )
        .eq("id", profile.venue_id)
        .single();

      if (venueError || !venue) {
        console.error(
          "VENUE SETTINGS LOAD ERROR:",
          venueError
        );

        setErrorMessage(
          "Unable to load your venue booking settings."
        );

        setLoadingVenue(false);
        return;
      }

      setVenueId(profile.venue_id);

      // Use venue defaults only when
      // the calendar did not provide a value.

      if (!calendarStartTime) {
        setStartTime(
          venue.default_start_time
            ? venue.default_start_time.slice(0, 5)
            : "09:00"
        );
      }

      if (!calendarEndTime) {
        setEndTime(
          venue.default_end_time
            ? venue.default_end_time.slice(0, 5)
            : "17:00"
        );
      }

      if (calendarDate) {
        setEventDate(calendarDate);
      }

      setLoadingVenue(false);
    }

    loadUserVenue();
  }, [
    router,
    calendarDate,
    calendarStartTime,
    calendarEndTime,
  ]);

  // --------------------------------------------------
  // LOAD VENUE PACKAGES
  // --------------------------------------------------

  useEffect(() => {
    async function loadPackages() {
      if (!venueId) {
        return;
      }

      setLoadingPackages(true);
      setErrorMessage("");

      const {
        data,
        error,
      } = await supabase
        .from("packages")
        .select(
          "id, name, category, price, pricing_type, description"
        )
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("category", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "PACKAGES LOAD ERROR:",
          error
        );

        setErrorMessage(
          `Unable to load packages: ${error.message}`
        );

        setLoadingPackages(false);
        return;
      }

      setPackages(
        (data || []).map((item) => ({
          ...item,
          price: Number(item.price),
        }))
      );

      setLoadingPackages(false);
    }

    loadPackages();
  }, [venueId]);

  // --------------------------------------------------
  // LOAD QUOTE
  // --------------------------------------------------

  useEffect(() => {
    async function loadQuote() {
      if (!quoteId || !venueId) {
        return;
      }

      setLoadingQuote(true);
      setErrorMessage("");

      const {
        data,
        error,
      } = await supabase
        .from("quotes")
        .select(
          "id, client_name, guests, total, venue_id"
        )
        .eq("id", quoteId)
        .eq("venue_id", venueId)
        .single();

      if (error) {
        console.error(
          "SUPABASE QUOTE ERROR:",
          error
        );

        setErrorMessage(
          `Unable to load quote: ${error.message}`
        );

        setLoadingQuote(false);
        return;
      }

      setQuote(data);

      setClientName(
        data.client_name ?? ""
      );

      setGuests(
        String(data.guests ?? "")
      );

      setTotalAmount(
        String(data.total ?? "")
      );

      setLoadingQuote(false);
    }

    loadQuote();
  }, [quoteId, venueId]);

  // --------------------------------------------------
  // CALCULATE PACKAGE SUBTOTAL
  // --------------------------------------------------

  const packageSubtotal = packages.reduce(
    (total, packageItem) => {
      const quantity =
        selectedPackages[
          packageItem.id
        ] || 0;

      return (
        total +
        packageItem.price * quantity
      );
    },
    0
  );

  // --------------------------------------------------
  // UPDATE BOOKING TOTAL FROM PACKAGES
  // --------------------------------------------------

  useEffect(() => {
    if (packageSubtotal > 0) {
      setTotalAmount(
        String(packageSubtotal)
      );
    }
  }, [packageSubtotal]);

  // --------------------------------------------------
  // CHECK BOOKING AVAILABILITY
  // --------------------------------------------------

  useEffect(() => {
    async function checkAvailability() {
      if (
        !venueId ||
        !eventDate ||
        !startTime ||
        !endTime ||
        endTime <= startTime
      ) {
        setConflictingBooking(null);
        setCheckingAvailability(false);
        return;
      }

      // Do not perform an availability lookup
      // for a booking that has already passed.
      if (bookingTimeHasPassed) {
        setConflictingBooking(null);
        setCheckingAvailability(false);
        return;
      }

      setCheckingAvailability(true);
      setConflictingBooking(null);
      setErrorMessage("");

      const {
        data,
        error,
      } = await supabase
        .from("bookings")
        .select(
          "id, client_name, event_type, status, start_time, end_time"
        )
        .eq("venue_id", venueId)
        .eq("event_date", eventDate)
        .neq("status", "Cancelled")
        .lt("start_time", endTime)
        .gt("end_time", startTime)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error(
          "BOOKING AVAILABILITY ERROR:",
          error
        );

        setErrorMessage(
          `Unable to check booking availability: ${error.message}`
        );

        setCheckingAvailability(false);
        return;
      }

      if (data) {
        setConflictingBooking(data);
      } else {
        setConflictingBooking(null);
      }

      setCheckingAvailability(false);
    }

    checkAvailability();
  }, [
    venueId,
    eventDate,
    startTime,
    endTime,
    bookingTimeHasPassed,
  ]);

  // --------------------------------------------------
  // FORMAT CURRENCY
  // --------------------------------------------------

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(Number(amount));
  }

  function formatDisplayDate(
    dateString: string
  ) {
    return new Intl.DateTimeFormat(
      "en-NG",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    ).format(
      new Date(
        `${dateString}T00:00:00`
      )
    );
  }

  function formatTime(
    timeString: string
  ) {
    const [hours, minutes] =
      timeString
        .split(":")
        .map(Number);

    const period =
      hours >= 12 ? "PM" : "AM";

    const displayHour =
      hours % 12 || 12;

    return `${displayHour}:${String(
      minutes
    ).padStart(2, "0")} ${period}`;
  }

  // --------------------------------------------------
  // CREATE BOOKING
  // --------------------------------------------------

  async function handleCreateBooking(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setMessage("");

    if (!venueId) {
      setErrorMessage(
        "Unable to determine your venue. Please log in again."
      );
      return;
    }

    if (!clientName.trim()) {
      setErrorMessage(
        "Please enter the client's name."
      );
      return;
    }

    if (
      !guests ||
      Number(guests) <= 0
    ) {
      setErrorMessage(
        "Please enter a valid number of guests."
      );
      return;
    }

    // --------------------------------------------------
    // PACKAGE VALIDATION
    // --------------------------------------------------

    if (packageSubtotal <= 0) {
      setErrorMessage(
        "Please select at least one package or service."
      );
      return;
    }

    if (
      !totalAmount ||
      Number(totalAmount) < 0
    ) {
      setErrorMessage(
        "Please enter a valid booking amount."
      );
      return;
    }

    if (!eventDate) {
      setErrorMessage(
        "Please select the event date."
      );
      return;
    }

    // --------------------------------------------------
    // TIME VALIDATION
    // --------------------------------------------------

    if (!startTime || !endTime) {
      setErrorMessage(
        "Please select a start time and end time."
      );
      return;
    }

    if (endTime <= startTime) {
      setErrorMessage(
        "End time must be later than start time."
      );
      return;
    }

    // --------------------------------------------------
    // PAST DATE/TIME PROTECTION
    // --------------------------------------------------

    const todayDate = getTodayDate();

    if (eventDate < todayDate) {
      setErrorMessage(
        "You cannot create a booking for a past date. Please select today or a future date."
      );
      return;
    }

    if (
      isBookingStartTimeInThePast(
        eventDate,
        startTime
      )
    ) {
      setErrorMessage(
        "The selected start time has already passed. Please choose a future time."
      );
      return;
    }

    // --------------------------------------------------
    // VENUE NAME VALIDATION
    // --------------------------------------------------

    if (!venueName.trim()) {
      setErrorMessage(
        "Please enter the venue name."
      );
      return;
    }

    // --------------------------------------------------
    // FINAL AVAILABILITY CHECK
    // --------------------------------------------------

    setSaving(true);

    // Re-check the time immediately before
    // creating the booking. This protects against
    // the user leaving the form open until the
    // selected time passes.

    if (
      isBookingStartTimeInThePast(
        eventDate,
        startTime
      )
    ) {
      setSaving(false);

      setErrorMessage(
        "The selected start time has already passed. Please choose a future time."
      );

      return;
    }

    const {
      data: existingBooking,
      error: availabilityError,
    } = await supabase
      .from("bookings")
      .select(
        "id, client_name, event_type, status, start_time, end_time"
      )
      .eq("venue_id", venueId)
      .eq("event_date", eventDate)
      .neq("status", "Cancelled")
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .limit(1)
      .maybeSingle();

    if (availabilityError) {
      console.error(
        "FINAL AVAILABILITY CHECK ERROR:",
        availabilityError
      );

      setSaving(false);

      setErrorMessage(
        `Unable to verify booking availability: ${availabilityError.message}`
      );

      return;
    }

    if (existingBooking) {
      setSaving(false);

      setConflictingBooking(
        existingBooking
      );

      setErrorMessage(
        `This venue is already booked on ${formatDisplayDate(
          eventDate
        )} from ${formatTime(
          existingBooking.start_time
        )} – ${formatTime(
          existingBooking.end_time
        )} for ${existingBooking.client_name}. Please choose a different time or date.`
      );

      return;
    }

    // --------------------------------------------------
    // CREATE BOOKING
    // --------------------------------------------------

    const {
      data: createdBooking,
      error,
    } = await supabase
      .from("bookings")
      .insert({
        venue_id: venueId,
        enquiry_id: null,
        quote_id: quote?.id ?? null,
        client_name:
          clientName.trim(),
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        guests: Number(guests),
        venue_name:
          venueName.trim(),
        event_type: eventType,
        total_amount:
          Number(totalAmount),
        status: "Pending",
      })
      .select("id")
      .single();

    if (
      error ||
      !createdBooking
    ) {
      console.error(
        "SUPABASE BOOKING ERROR:",
        error
      );

      setSaving(false);

      setErrorMessage(
        `Unable to create booking: ${
          error?.message ||
          "Booking was not created."
        }`
      );

      return;
    }

    // --------------------------------------------------
    // CREATE BOOKING ITEMS
    // --------------------------------------------------

    const bookingItems = packages
      .filter(
        (packageItem) =>
          (
            selectedPackages[
              packageItem.id
            ] || 0
          ) > 0
      )
      .map((packageItem) => {
        const quantity =
          selectedPackages[
            packageItem.id
          ] || 1;

        return {
          booking_id:
            createdBooking.id,
          package_id:
            packageItem.id,
          package_name:
            packageItem.name,
          quantity,
          unit_price:
            packageItem.price,
          total_price:
            packageItem.price *
            quantity,
        };
      });

    const {
      error: bookingItemsError,
    } = await supabase
      .from("booking_items")
      .insert(
        bookingItems
      );

    if (bookingItemsError) {
      console.error(
        "BOOKING ITEMS ERROR:",
        bookingItemsError
      );

      setSaving(false);

      setErrorMessage(
        `Booking was created, but its services could not be saved: ${bookingItemsError.message}`
      );

      return;
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    setSaving(false);

    setMessage(
      "Booking created successfully!"
    );

    setTimeout(() => {
      router.push(
        "/bookings"
      );
    }, 1000);
  }

  // --------------------------------------------------
  // LOADING UI
  // --------------------------------------------------

  if (loadingVenue) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-100 p-8">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500">
                Loading your venue...
              </p>
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  // --------------------------------------------------
  // PAGE UI
  // --------------------------------------------------

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-3xl">

          {/* Header */}

          <div className="mb-8">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="mb-4 text-sm font-medium text-gray-600 hover:text-black"
            >
              ← Back to Bookings
            </button>

            <h1 className="text-3xl font-bold text-gray-900">
              Create Booking
            </h1>

            <p className="mt-2 text-gray-600">
              Create a new event booking or
              convert an accepted quote into a
              booking.
            </p>
          </div>

          {/* Loading Quote */}

          {loadingQuote && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-700">
              <p className="font-medium">
                Loading quote information...
              </p>
            </div>
          )}

          {/* Success */}

          {message && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
              <p className="font-medium">
                {message}
              </p>

              <p className="mt-1 text-sm">
                Redirecting to bookings...
              </p>
            </div>
          )}

          {/* Error */}

          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Booking Conflict */}

          {conflictingBooking && (
            <div className="mb-6 rounded-xl border border-yellow-300 bg-yellow-50 p-6 text-yellow-900">
              <div className="flex items-start gap-3">

                <div className="text-2xl">
                  ⚠️
                </div>

                <div className="flex-1">

                  <h2 className="font-bold">
                    Booking Conflict
                  </h2>

                  <p className="mt-1 text-sm">
                    This venue already has a booking on{" "}
                    <strong>
                      {formatDisplayDate(
                        eventDate
                      )}
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
                      {
                        conflictingBooking.event_type ||
                        "Event"
                      }
                    </p>

                    <p className="mt-1">
                      <span className="font-medium">
                        Status:
                      </span>{" "}
                      {
                        conflictingBooking.status
                      }
                    </p>

                  </div>

                  <p className="mt-4 text-sm font-medium">
                    Please select another event time or date.
                  </p>

                </div>
              </div>
            </div>
          )}

          {/* Quote Information */}

          {quote && (
            <section className="mb-6 rounded-xl border bg-white p-8 shadow-sm">

              <div className="mb-6 flex items-center justify-between">

                <h2 className="text-xl font-bold text-gray-900">
                  Quote Information
                </h2>

                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                  Accepted Quote
                </span>

              </div>

              <div className="grid gap-6 sm:grid-cols-3">

                <div>
                  <p className="text-sm text-gray-500">
                    Client
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {
                      quote.client_name
                    }
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">
                    Guests
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {quote.guests}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">
                    Quoted Amount
                  </p>

                  <p className="mt-1 text-lg font-bold text-gray-900">
                    {formatCurrency(
                      quote.total
                    )}
                  </p>
                </div>

              </div>
            </section>
          )}

          {/* Booking Form */}

          <section className="rounded-xl border bg-white p-8 shadow-sm">

            <h2 className="mb-6 text-xl font-bold text-gray-900">
              Booking Information
            </h2>

            <form
              onSubmit={
                handleCreateBooking
              }
              className="space-y-6"
            >

              {/* Client Name */}

              <div>
                <label
                  htmlFor="clientName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Client Name
                </label>

                <input
                  id="clientName"
                  type="text"
                  value={clientName}
                  onChange={(event) =>
                    setClientName(
                      event.target.value
                    )
                  }
                  placeholder="e.g. John & Sarah"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Guests */}

              <div>
                <label
                  htmlFor="guests"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Number of Guests
                </label>

                <input
                  id="guests"
                  type="number"
                  min="1"
                  value={guests}
                  onChange={(event) =>
                    setGuests(
                      event.target.value
                    )
                  }
                  placeholder="e.g. 200"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Packages & Services */}

              <div>
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Packages & Services
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Select the packages and services included
                    in this booking.
                  </p>
                </div>

                {loadingPackages ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">
                      Loading packages...
                    </p>
                  </div>
                ) : packages.length === 0 ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-800">
                      No active packages or services have been
                      added yet.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/packages"
                        )
                      }
                      className="mt-2 text-sm font-semibold text-yellow-900 underline"
                    >
                      Manage Packages & Services
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">

                    {packages.map(
                      (
                        packageItem
                      ) => {
                        const quantity =
                          selectedPackages[
                            packageItem.id
                          ] || 0;

                        const selected =
                          quantity >
                          0;

                        return (
                          <div
                            key={
                              packageItem.id
                            }
                            className={`rounded-lg border p-4 transition ${
                              selected
                                ? "border-black bg-gray-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >

                            <div className="flex items-start justify-between gap-4">

                              <div className="flex-1">

                                <div className="flex items-center gap-2">

                                  <input
                                    type="checkbox"
                                    checked={
                                      selected
                                    }
                                    onChange={(
                                      event
                                    ) => {
                                      setSelectedPackages(
                                        (
                                          current
                                        ) => ({
                                          ...current,
                                          [
                                            packageItem.id
                                          ]:
                                            event
                                              .target
                                              .checked
                                              ? 1
                                              : 0,
                                        })
                                      );
                                    }}
                                    className="h-4 w-4"
                                  />

                                  <p className="font-semibold text-gray-900">
                                    {
                                      packageItem.name
                                    }
                                  </p>

                                </div>

                                <p className="ml-6 mt-1 text-xs text-gray-500">
                                  {
                                    packageItem.category
                                  }
                                </p>

                                {packageItem.description && (
                                  <p className="ml-6 mt-2 text-sm text-gray-600">
                                    {
                                      packageItem.description
                                    }
                                  </p>
                                )}

                              </div>

                              <div className="text-right">

                                <p className="font-semibold text-gray-900">
                                  {formatCurrency(
                                    packageItem.price
                                  )}
                                </p>

                                <p className="text-xs text-gray-500">
                                  {packageItem.pricing_type ===
                                  "per_guest"
                                    ? "per guest"
                                    : "fixed"}
                                </p>

                              </div>

                            </div>

                            {selected && (
                              <div className="mt-4 ml-6 flex items-center gap-3">

                                <label
                                  htmlFor={`quantity-${packageItem.id}`}
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Quantity
                                </label>

                                <input
                                  id={`quantity-${packageItem.id}`}
                                  type="number"
                                  min="1"
                                  value={
                                    quantity
                                  }
                                  onChange={(
                                    event
                                  ) => {
                                    const nextQuantity =
                                      Math.max(
                                        1,
                                        Number(
                                          event
                                            .target
                                            .value
                                        ) ||
                                          1
                                      );

                                    setSelectedPackages(
                                      (
                                        current
                                      ) => ({
                                        ...current,
                                        [
                                          packageItem.id
                                        ]:
                                          nextQuantity,
                                      })
                                    );
                                  }}
                                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-black"
                                />

                                <p className="text-sm font-medium text-gray-700">
                                  ={" "}
                                  {formatCurrency(
                                    packageItem.price *
                                      quantity
                                  )}
                                </p>

                              </div>
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

                {/* Package Subtotal */}

                {packageSubtotal >
                  0 && (
                  <div className="mt-5 rounded-lg border bg-gray-50 p-5">

                    <div className="flex items-center justify-between">

                      <span className="text-sm text-gray-600">
                        Services Subtotal
                      </span>

                      <span className="text-lg font-bold text-gray-900">
                        {formatCurrency(
                          packageSubtotal
                        )}
                      </span>

                    </div>

                  </div>
                )}

              </div>

              {/* Booking Amount */}

              <div>
                <label
                  htmlFor="totalAmount"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Booking Amount (₦)
                </label>

                <input
                  id="totalAmount"
                  type="number"
                  min="0"
                  value={totalAmount}
                  readOnly
                  placeholder="Select packages or services"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 outline-none"
                />

                {totalAmount && (
                  <p className="mt-2 text-sm text-gray-500">
                    {formatCurrency(
                      Number(
                        totalAmount
                      )
                    )}
                  </p>
                )}

                <p className="mt-1 text-xs text-gray-500">
                  This amount is calculated automatically
                  from the selected packages and services.
                </p>
              </div>

              {/* Event Type */}

              <div>
                <label
                  htmlFor="eventType"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Event Type
                </label>

                <select
                  id="eventType"
                  value={eventType}
                  onChange={(event) =>
                    setEventType(
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                >
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

                  <option value="Anniversary">
                    Anniversary
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {/* Event Date & Time */}

              <div className="grid gap-6 sm:grid-cols-3">

                <div>
                  <label
                    htmlFor="eventDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Event Date
                  </label>

                  <input
                    id="eventDate"
                    type="date"
                    min={getTodayDate()}
                    value={eventDate}
                    onChange={(
                      event
                    ) => {
                      setEventDate(
                        event.target
                          .value
                      );

                      setErrorMessage(
                        ""
                      );

                      setConflictingBooking(
                        null
                      );
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="startTime"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Start Time
                  </label>

                  <input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(
                      event
                    ) => {
                      setStartTime(
                        event.target
                          .value
                      );

                      setErrorMessage(
                        ""
                      );

                      setConflictingBooking(
                        null
                      );
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="endTime"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    End Time
                  </label>

                  <input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(
                      event
                    ) => {
                      setEndTime(
                        event.target
                          .value
                      );

                      setErrorMessage(
                        ""
                      );

                      setConflictingBooking(
                        null
                      );
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                  />
                </div>

              </div>

              {/* Booking Settings Help Text */}

              <p className="text-xs text-gray-500">
                Start and end times are pre-filled from
                your venue's booking settings. You can
                change them for this event.
              </p>

              {/* Availability Status */}

              {checkingAvailability && (
                <p className="mt-2 text-sm text-gray-500">
                  Checking availability...
                </p>
              )}

              {bookingTimeHasPassed && (
                <p className="text-sm font-medium text-red-600">
                  ⚠️ The selected start time has already passed.
                  Please choose a future time.
                </p>
              )}

              {!checkingAvailability &&
                !bookingTimeHasPassed &&
                eventDate &&
                startTime &&
                endTime &&
                endTime >
                  startTime &&
                !conflictingBooking && (
                  <p className="text-sm font-medium text-green-600">
                    ✓ This date and time are available.
                  </p>
                )}

              {eventDate &&
                startTime &&
                endTime &&
                endTime <=
                  startTime && (
                  <p className="text-sm font-medium text-red-600">
                    End time must be later than start time.
                  </p>
                )}

              {/* Venue Name */}

              <div>
                <label
                  htmlFor="venueName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Venue Name
                </label>

                <input
                  id="venueName"
                  type="text"
                  value={venueName}
                  onChange={(
                    event
                  ) =>
                    setVenueName(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Grand Ballroom"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              {/* Buttons */}

              <div className="flex flex-col gap-4 pt-4 sm:flex-row">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/bookings"
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    checkingAvailability ||
                    !!conflictingBooking ||
                    bookingTimeHasPassed ||
                    !venueId
                  }
                  className="rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Creating Booking..."
                    : checkingAvailability
                    ? "Checking Availability..."
                    : conflictingBooking
                    ? "Time Unavailable"
                    : bookingTimeHasPassed
                    ? "Time Has Passed"
                    : "Create Booking"}
                </button>

              </div>

            </form>
          </section>

        </div>
      </main>
    </CRMLayout>
  );
}