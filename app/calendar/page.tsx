"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Booking = {
  id: string;
  client_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  venue_name: string | null;
  event_type: string | null;
  total_amount: number;
  status: string;
  venue_id: string;
};

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
};

const weekDays = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export default function CalendarPage() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [venueId, setVenueId] = useState<string | null>(
    null
  );

  const [defaultStartTime, setDefaultStartTime] =
    useState("09:00:00");

  const [defaultEndTime, setDefaultEndTime] =
    useState("17:00:00");

  const [currentDate, setCurrentDate] = useState(
    new Date()
  );

  /*
   * Load the logged-in user's venue.
   */
  async function loadUserVenue() {
    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return null;
    }

    const {
      data: profile,
      error,
    } = await supabase
      .from("profiles")
      .select("venue_id")
      .eq("id", user.id)
      .single();

    if (error || !profile?.venue_id) {
      console.error(
        "PROFILE / VENUE ERROR:",
        error
      );

      setErrorMessage(
        "Unable to identify your venue."
      );

      setLoading(false);

      return null;
    }

    setVenueId(profile.venue_id);

    return profile.venue_id;
  }

  /*
   * Load venue booking hours.
   */
  async function loadVenueSettings(
    currentVenueId: string
  ) {
    const {
      data: venue,
      error,
    } = await supabase
      .from("venues")
      .select(
        "default_start_time, default_end_time"
      )
      .eq("id", currentVenueId)
      .single();

    if (error) {
      console.error(
        "VENUE SETTINGS ERROR:",
        error
      );

      /*
       * Keep the default fallback hours.
       */
      return;
    }

    if (venue?.default_start_time) {
      setDefaultStartTime(
        venue.default_start_time
      );
    }

    if (venue?.default_end_time) {
      setDefaultEndTime(
        venue.default_end_time
      );
    }
  }

  /*
   * Load bookings belonging only to
   * the logged-in user's venue.
   */
  async function loadBookings(
    currentVenueId: string,
    isRefresh = false
  ) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    const {
      data,
      error,
    } = await supabase
      .from("bookings")
      .select(
        `
          id,
          client_name,
          event_date,
          start_time,
          end_time,
          guests,
          venue_name,
          event_type,
          total_amount,
          status,
          venue_id
        `
      )
      .eq("venue_id", currentVenueId)
      .order("event_date", {
        ascending: true,
      })
      .order("start_time", {
        ascending: true,
      });

    if (error) {
      console.error(
        "SUPABASE CALENDAR ERROR:",
        error
      );

      setErrorMessage(
        `Unable to load calendar bookings: ${error.message}`
      );

      setLoading(false);
      setRefreshing(false);

      return;
    }

    setBookings(data || []);

    setLoading(false);
    setRefreshing(false);
  }

  /*
   * Authenticate user and load
   * venue-specific data.
   */
  useEffect(() => {
    async function initializeCalendar() {
      const currentVenueId =
        await loadUserVenue();

      if (currentVenueId) {
        await Promise.all([
          loadVenueSettings(
            currentVenueId
          ),
          loadBookings(
            currentVenueId
          ),
        ]);
      }
    }

    initializeCalendar();
  }, []);

  /*
   * Refresh calendar data.
   */
  async function refreshCalendar() {
    if (!venueId) {
      return;
    }

    await Promise.all([
      loadVenueSettings(venueId),
      loadBookings(venueId, true),
    ]);
  }

  /*
   * First day of the current month.
   */
  const firstDayOfMonth = useMemo(() => {
    return new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
  }, [currentDate]);

  /*
   * Last day of the current month.
   */
  const lastDayOfMonth = useMemo(() => {
    return new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );
  }, [currentDate]);

  /*
   * Number of days in the month.
   */
  const daysInMonth =
    lastDayOfMonth.getDate();

  /*
   * Day of week on which the month starts.
   */
  const startingDay =
    firstDayOfMonth.getDay();

  /*
   * Build calendar cells.
   */
  const calendarDays: (
    number | null
  )[] = [];

  for (
    let i = 0;
    i < startingDay;
    i++
  ) {
    calendarDays.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    calendarDays.push(day);
  }

  /*
   * Previous month.
   */
  function goToPreviousMonth() {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1
      )
    );
  }

  /*
   * Next month.
   */
  function goToNextMonth() {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1
      )
    );
  }

  /*
   * Today.
   */
  function goToToday() {
    setCurrentDate(new Date());
  }

  /*
   * Month and year heading.
   */
  function formatMonthYear() {
    return new Intl.DateTimeFormat(
      "en-NG",
      {
        month: "long",
        year: "numeric",
      }
    ).format(currentDate);
  }

  /*
   * Create YYYY-MM-DD.
   */
  function getDateKey(day: number) {
    const year =
      currentDate.getFullYear();

    const month = String(
      currentDate.getMonth() + 1
    ).padStart(2, "0");

    const dayNumber = String(day).padStart(
      2,
      "0"
    );

    return `${year}-${month}-${dayNumber}`;
  }

  /*
   * Get bookings for a specific date.
   */
  function getBookingsForDate(
    day: number
  ) {
    const dateKey = getDateKey(day);

    return bookings
      .filter(
        (booking) =>
          booking.event_date ===
          dateKey
      )
      .sort((a, b) =>
        a.start_time.localeCompare(
          b.start_time
        )
      );
  }

  /*
   * Check whether a day is today.
   */
  function isToday(day: number) {
    const today = new Date();

    return (
      today.getFullYear() ===
        currentDate.getFullYear() &&
      today.getMonth() ===
        currentDate.getMonth() &&
      today.getDate() === day
    );
  }

  /*
   * Convert HH:MM or HH:MM:SS
   * into minutes after midnight.
   */
  function timeToMinutes(
    time: string
  ) {
    if (!time) {
      return 0;
    }

    const parts = time.split(":");

    const hours = Number(
      parts[0] || 0
    );

    const minutes = Number(
      parts[1] || 0
    );

    return hours * 60 + minutes;
  }

  /*
   * Convert minutes after midnight
   * back into HH:MM.
   */
  function minutesToTime(
    totalMinutes: number
  ) {
    const hours = Math.floor(
      totalMinutes / 60
    );

    const minutes =
      totalMinutes % 60;

    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}`;
  }

  /*
   * Format Nigerian currency.
   */
  function formatCurrency(
    amount: number
  ) {
    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }
    ).format(Number(amount || 0));
  }

  /*
   * Format booking time.
   *
   * Database:
   * HH:MM:SS
   *
   * Display:
   * h:mm AM/PM
   */
  function formatTime(
    time: string
  ) {
    if (!time) {
      return "-";
    }

    const parts = time.split(":");

    const hours = Number(
      parts[0]
    );

    const minutes = Number(
      parts[1]
    );

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return time;
    }

    const period =
      hours >= 12 ? "PM" : "AM";

    const displayHour =
      hours % 12 === 0
        ? 12
        : hours % 12;

    const displayMinutes =
      String(minutes).padStart(
        2,
        "0"
      );

    return `${displayHour}:${displayMinutes} ${period}`;
  }

  /*
   * Format booking time range.
   */
  function formatTimeRange(
    startTime: string,
    endTime: string
  ) {
    return `${formatTime(
      startTime
    )} – ${formatTime(endTime)}`;
  }

  /*
   * Create a local YYYY-MM-DD date key for today.
   */
  function getTodayDateKey() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  /*
   * Determine whether a calendar date is in the past.
   */
  function isPastDate(dateKey: string) {
    return dateKey < getTodayDateKey();
  }

  /*
   * Determine whether an available slot can still be booked.
   * Past dates are never bookable. On today, only slots that
   * have not started yet are offered for new bookings.
   */
  function isSlotBookable(
    dateKey: string,
    startTime: string
  ) {
    const todayKey = getTodayDateKey();

    if (dateKey < todayKey) {
      return false;
    }

    if (dateKey > todayKey) {
      return true;
    }

    const now = new Date();
    const currentMinutes =
      now.getHours() * 60 + now.getMinutes();

    return timeToMinutes(startTime) > currentMinutes;
  }

  /*
   * Calculate available time periods
   * for a particular day.
   *
   * Cancelled bookings do NOT block
   * availability.
   */
  function getAvailabilityForDate(
    dayBookings: Booking[]
  ): AvailabilitySlot[] {
    const venueStart =
      timeToMinutes(
        defaultStartTime
      );

    const venueEnd =
      timeToMinutes(
        defaultEndTime
      );

    if (
      venueEnd <= venueStart
    ) {
      return [];
    }

    /*
     * Only active bookings affect
     * availability.
     */
    const activeBookings =
      dayBookings
        .filter(
          (booking) =>
            booking.status !==
            "Cancelled"
        )
        .map((booking) => {
          const start =
            timeToMinutes(
              booking.start_time
            );

          const end =
            timeToMinutes(
              booking.end_time
            );

          return {
            start: Math.max(
              start,
              venueStart
            ),
            end: Math.min(
              end,
              venueEnd
            ),
          };
        })
        .filter(
          (booking) =>
            booking.end >
            booking.start
        )
        .sort(
          (a, b) =>
            a.start - b.start
        );

    /*
     * No active bookings means the
     * entire venue period is free.
     */
    if (
      activeBookings.length ===
      0
    ) {
      return [
        {
          startTime:
            minutesToTime(
              venueStart
            ),
          endTime:
            minutesToTime(
              venueEnd
            ),
        },
      ];
    }

    /*
     * Merge overlapping bookings.
     *
     * This is defensive protection even
     * though the New Booking page already
     * prevents overlapping bookings.
     */
    const mergedBookings: {
      start: number;
      end: number;
    }[] = [];

    for (const booking of activeBookings) {
      const last =
        mergedBookings[
          mergedBookings.length - 1
        ];

      if (
        !last ||
        booking.start >
          last.end
      ) {
        mergedBookings.push({
          start: booking.start,
          end: booking.end,
        });
      } else {
        last.end = Math.max(
          last.end,
          booking.end
        );
      }
    }

    /*
     * Find gaps between bookings.
     */
    const availability: AvailabilitySlot[] =
      [];

    let currentTime =
      venueStart;

    for (const booking of mergedBookings) {
      /*
       * There is free time before
       * this booking.
       */
      if (
        booking.start >
        currentTime
      ) {
        availability.push({
          startTime:
            minutesToTime(
              currentTime
            ),
          endTime:
            minutesToTime(
              booking.start
            ),
        });
      }

      currentTime = Math.max(
        currentTime,
        booking.end
      );
    }

    /*
     * Check for free time after
     * the final booking.
     */
    if (
      currentTime <
      venueEnd
    ) {
      availability.push({
        startTime:
          minutesToTime(
            currentTime
          ),
        endTime:
          minutesToTime(
            venueEnd
          ),
      });
    }

    return availability;
  }

  /*
   * Status badge.
   */
  function getStatusClasses(
    status: string
  ) {
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

  /*
   * Booking card styling.
   */
  function getBookingCardClasses(
    status: string
  ) {
    switch (status) {
      case "Confirmed":
        return "border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100";

      case "Completed":
        return "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100";

      case "Cancelled":
        return "border-red-200 bg-red-50 opacity-70 hover:border-red-400 hover:bg-red-100";

      case "Pending":
      default:
        return "border-yellow-200 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100";
    }
  }

  /*
   * Open booking details.
   */
  function openBooking(
    bookingId: string
  ) {
    router.push(
      `/bookings/${bookingId}`
    );
  }

  /*
   * Count bookings in the currently
   * displayed month.
   */
  const currentMonthBookingCount =
    useMemo(() => {
      return bookings.filter(
        (booking) => {
          const bookingDate =
            new Date(
              `${booking.event_date}T00:00:00`
            );

          return (
            bookingDate.getFullYear() ===
              currentDate.getFullYear() &&
            bookingDate.getMonth() ===
              currentDate.getMonth()
          );
        }
      ).length;
    }, [
      bookings,
      currentDate,
    ]);

  /*
   * Count active bookings in the
   * currently displayed month.
   */
  const currentMonthActiveBookingCount =
    useMemo(() => {
      return bookings.filter(
        (booking) => {
          if (
            booking.status ===
            "Cancelled"
          ) {
            return false;
          }

          const bookingDate =
            new Date(
              `${booking.event_date}T00:00:00`
            );

          return (
            bookingDate.getFullYear() ===
              currentDate.getFullYear() &&
            bookingDate.getMonth() ===
              currentDate.getMonth()
          );
        }
      ).length;
    }, [
      bookings,
      currentDate,
    ]);

  /*
   * Number of days in the current
   * month with at least one active
   * booking.
   */
  const bookedDaysThisMonth =
    useMemo(() => {
      const dates = new Set(
        bookings
          .filter(
            (booking) =>
              booking.status !==
              "Cancelled"
          )
          .filter((booking) => {
            const date =
              new Date(
                `${booking.event_date}T00:00:00`
              );

            return (
              date.getFullYear() ===
                currentDate.getFullYear() &&
              date.getMonth() ===
                currentDate.getMonth()
            );
          })
          .map(
            (booking) =>
              booking.event_date
          )
      );

      return dates.size;
    }, [
      bookings,
      currentDate,
    ]);

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-100 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">

          {/* Page Header */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Calendar
              </h1>

              <p className="mt-2 text-gray-600">
                View bookings and check venue availability.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                onClick={
                  refreshCalendar
                }
                disabled={
                  refreshing ||
                  loading
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 transition hover:bg-gray-50"
              >
                Today
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/bookings/new"
                  )
                }
                className="rounded-lg bg-black px-5 py-2 font-semibold text-white transition hover:bg-gray-800"
              >
                + New Booking
              </button>

            </div>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="font-medium">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Calendar Summary */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Events This Month
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {
                  currentMonthBookingCount
                }
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Including cancelled bookings
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Active Bookings
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {
                  currentMonthActiveBookingCount
                }
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Pending, confirmed and completed
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Booked Days
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {
                  bookedDaysThisMonth
                }
              </p>

              <p className="mt-1 text-xs text-gray-400">
                Days with active bookings
              </p>
            </div>

          </div>

          {/* Venue Hours */}
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Venue Booking Hours
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Availability is calculated using your venue's default booking hours.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {formatTime(
                  defaultStartTime
                )}{" "}
                –{" "}
                {formatTime(
                  defaultEndTime
                )}
              </div>

            </div>

          </div>

          {/* Calendar */}
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            {/* Calendar Toolbar */}
            <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {formatMonthYear()}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {
                    currentMonthBookingCount
                  }{" "}
                  {currentMonthBookingCount ===
                  1
                    ? "booking"
                    : "bookings"}{" "}
                  scheduled
                </p>
              </div>

              <div className="flex gap-2">

                <button
                  type="button"
                  onClick={
                    goToPreviousMonth
                  }
                  aria-label="Previous month"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-lg font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  ←
                </button>

                <button
                  type="button"
                  onClick={
                    goToNextMonth
                  }
                  aria-label="Next month"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-lg font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  →
                </button>

              </div>

            </div>

            {/* Loading */}
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">
                  Loading calendar...
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">

                <div className="min-w-[900px]">

                  {/* Weekdays */}
                  <div className="grid grid-cols-7 border-b bg-gray-50">

                    {weekDays.map(
                      (day) => (
                        <div
                          key={day}
                          className="border-r border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-600 last:border-r-0"
                        >
                          {day}
                        </div>
                      )
                    )}

                  </div>

                  {/* Calendar Days */}
                  <div className="grid grid-cols-7">

                    {calendarDays.map(
                      (day, index) => {

                        /*
                         * Empty calendar cell.
                         */
                        if (
                          day === null
                        ) {
                          return (
                            <div
                              key={`empty-${index}`}
                              className="min-h-[220px] border-b border-r border-gray-200 bg-gray-50"
                            />
                          );
                        }

                        const dayBookings =
                          getBookingsForDate(
                            day
                          );

                        const activeBookings =
                          dayBookings.filter(
                            (booking) =>
                              booking.status !==
                              "Cancelled"
                          );

                        const availability =
                          getAvailabilityForDate(
                            dayBookings
                          );

                        return (
                          <div
                            key={day}
                            className="min-h-[220px] border-b border-r border-gray-200 p-2"
                          >

                            {/* Date Number */}
                            <div className="mb-2 flex items-center justify-between">

                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  isToday(day)
                                    ? "bg-black text-white"
                                    : "text-gray-700"
                                }`}
                              >
                                {day}
                              </span>

                              {dayBookings.length >
                                0 && (
                                <span className="text-xs font-medium text-gray-400">
                                  {
                                    dayBookings.length
                                  }{" "}
                                  {dayBookings.length ===
                                  1
                                    ? "event"
                                    : "events"}
                                </span>
                              )}

                            </div>

                            {/* Availability Summary */}
                            {activeBookings.length ===
                              0 && (
                              <div className="mb-2 rounded-lg border border-green-200 bg-green-50 p-2">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                                  Available
                                </p>

                                <p className="mt-1 text-xs font-semibold text-green-700">
                                  {formatTimeRange(
                                    defaultStartTime,
                                    defaultEndTime
                                  )}
                                </p>

                                {(() => {
                                  const date = getDateKey(day);
                                  const bookable = isSlotBookable(
                                    date,
                                    defaultStartTime
                                  );

                                  return bookable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push(
                                          `/bookings/new?date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(defaultStartTime)}&endTime=${encodeURIComponent(defaultEndTime)}`
                                        );
                                      }}
                                      className="mt-2 w-full rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
                                    >
                                      Book this time
                                    </button>
                                  ) : (
                                    <p className="mt-2 text-[11px] font-medium text-gray-500">
                                      {isPastDate(date)
                                        ? "Past date"
                                        : "Time has passed"}
                                    </p>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Booking Cards */}
                            <div className="space-y-2">

                              {dayBookings.map(
                                (booking) => (
                                  <button
                                    key={
                                      booking.id
                                    }
                                    type="button"
                                    onClick={() =>
                                      openBooking(
                                        booking.id
                                      )
                                    }
                                    className={`block w-full cursor-pointer rounded-lg border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-black ${getBookingCardClasses(
                                      booking.status
                                    )}`}
                                  >

                                    {/* Client + Status */}
                                    <div className="flex items-start justify-between gap-2">

                                      <p className="min-w-0 truncate text-sm font-semibold text-gray-900">
                                        {
                                          booking.client_name
                                        }
                                      </p>

                                      <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClasses(
                                          booking.status
                                        )}`}
                                      >
                                        {
                                          booking.status
                                        }
                                      </span>

                                    </div>

                                    {/* Time */}
                                    <p className="mt-1 text-xs font-bold text-gray-900">
                                      🕐{" "}
                                      {formatTimeRange(
                                        booking.start_time,
                                        booking.end_time
                                      )}
                                    </p>

                                    {/* Event Type */}
                                    <p className="mt-1 text-xs font-medium text-gray-600">
                                      {
                                        booking.event_type ||
                                        "Event"
                                      }
                                    </p>

                                    {/* Guests */}
                                    <p className="mt-1 text-xs text-gray-500">
                                      👥{" "}
                                      {
                                        booking.guests
                                      }{" "}
                                      guests
                                    </p>

                                    {/* Venue */}
                                    {booking.venue_name && (
                                      <p className="mt-1 truncate text-xs text-gray-500">
                                        📍{" "}
                                        {
                                          booking.venue_name
                                        }
                                      </p>
                                    )}

                                    {/* Total */}
                                    <p className="mt-2 text-xs font-semibold text-gray-900">
                                      {formatCurrency(
                                        booking.total_amount
                                      )}
                                    </p>

                                    {/* Action Hint */}
                                    <p className="mt-2 text-[11px] font-medium text-gray-400">
                                      Click to view details →
                                    </p>

                                  </button>
                                )
                              )}

                            </div>

                            {/* Available Time Slots */}
                            {activeBookings.length >
                              0 &&
                              availability.length >
                                0 && (
                                <div className="mt-2 space-y-2">

                                  {availability.map(
                                    (
                                      slot,
                                      slotIndex
                                    ) => (
                                      <div
                                        key={`${slot.startTime}-${slot.endTime}-${slotIndex}`}
                                        className="rounded-lg border border-green-200 bg-green-50 p-2"
                                      >
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                                          Available
                                        </p>

                                        <p className="mt-1 text-xs font-semibold text-green-700">
                                          {formatTimeRange(
                                            slot.startTime,
                                            slot.endTime
                                          )}
                                        </p>

                                        {(() => {
                                          const date = getDateKey(day);
                                          const bookable = isSlotBookable(
                                            date,
                                            slot.startTime
                                          );

                                          return bookable ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                router.push(
                                                  `/bookings/new?date=${encodeURIComponent(date)}&startTime=${encodeURIComponent(slot.startTime)}&endTime=${encodeURIComponent(slot.endTime)}`
                                                );
                                              }}
                                              className="mt-2 w-full rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
                                            >
                                              Book this time
                                            </button>
                                          ) : (
                                            <p className="mt-2 text-[11px] font-medium text-gray-500">
                                              {isPastDate(date)
                                                ? "Past date"
                                                : "Time has passed"}
                                            </p>
                                          );
                                        })()}
                                      </div>
                                    )
                                  )}

                                </div>
                              )}

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>

              </div>
            )}

          </section>

          {/* Legend */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

            <h3 className="mb-4 text-sm font-bold text-gray-900">
              Calendar Legend
            </h3>

            <div className="flex flex-wrap gap-5 text-sm text-gray-600">

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                Available
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                Pending
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-600" />
                Confirmed
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                Completed
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                Cancelled
              </div>

            </div>

            <p className="mt-4 text-xs text-gray-500">
              Cancelled bookings do not block availability.
            </p>

          </div>

        </div>
      </main>
    </CRMLayout>
  );
}