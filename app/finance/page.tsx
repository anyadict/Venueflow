"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Booking = {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string | null;
  venue_name: string | null;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
};

type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
  payment_date: string;
  notes: string | null;
};

type DateFilter = "all" | "this_month" | "last_month" | "custom";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(date: string) {
  if (!date) {
    return "-";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getMonthStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function getMonthEnd(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

export default function FinancePage() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>(
    []
  );

  const [payments, setPayments] = useState<Payment[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
   * FILTERS
   */

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("all");

  const [customStartDate, setCustomStartDate] =
    useState("");

  const [customEndDate, setCustomEndDate] =
    useState("");

  const [bookingStatusFilter, setBookingStatusFilter] =
    useState("All");

  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState("All");

  /*
   * LOAD DATA
   */

  useEffect(() => {
    loadFinancialData();
  }, []);

  async function loadFinancialData() {
    try {
      setLoading(true);
      setError("");

      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from("bookings")
        .select(
          `
            id,
            client_name,
            event_date,
            event_type,
            venue_name,
            total_amount,
            amount_paid,
            payment_status,
            status
          `
        )
        .order("event_date", {
          ascending: true,
        });

      if (bookingError) {
        throw bookingError;
      }

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select(
          `
            id,
            booking_id,
            amount,
            payment_method,
            payment_reference,
            payment_date,
            notes
          `
        )
        .order("payment_date", {
          ascending: false,
        });

      if (paymentError) {
        throw paymentError;
      }

      setBookings(bookingData || []);
      setPayments(paymentData || []);
    } catch (err: any) {
      console.error(
        "FINANCE LOAD ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load financial data."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * DATE RANGE
   */

  const dateRange = useMemo(() => {
    const today = new Date();

    if (dateFilter === "this_month") {
      return {
        start: toDateInputValue(
          getMonthStart(today)
        ),
        end: toDateInputValue(
          getMonthEnd(today)
        ),
      };
    }

    if (dateFilter === "last_month") {
      const lastMonth = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );

      return {
        start: toDateInputValue(
          getMonthStart(lastMonth)
        ),
        end: toDateInputValue(
          getMonthEnd(lastMonth)
        ),
      };
    }

    if (dateFilter === "custom") {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }

    return {
      start: "",
      end: "",
    };
  }, [
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  /*
   * FILTER BOOKINGS
   *
   * Financial booking values are filtered by
   * event date.
   */

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus =
        bookingStatusFilter === "All" ||
        booking.status === bookingStatusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!dateRange.start && !dateRange.end) {
        return true;
      }

      if (
        dateRange.start &&
        booking.event_date < dateRange.start
      ) {
        return false;
      }

      if (
        dateRange.end &&
        booking.event_date > dateRange.end
      ) {
        return false;
      }

      return true;
    });
  }, [
    bookings,
    bookingStatusFilter,
    dateRange,
  ]);

  /*
   * FILTER PAYMENTS
   *
   * Payments are filtered by payment date.
   */

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesMethod =
        paymentMethodFilter === "All" ||
        payment.payment_method ===
          paymentMethodFilter;

      if (!matchesMethod) {
        return false;
      }

      if (!dateRange.start && !dateRange.end) {
        return true;
      }

      if (
        dateRange.start &&
        payment.payment_date <
          dateRange.start
      ) {
        return false;
      }

      if (
        dateRange.end &&
        payment.payment_date >
          dateRange.end
      ) {
        return false;
      }

      return true;
    });
  }, [
    payments,
    paymentMethodFilter,
    dateRange,
  ]);

  /*
   * FINANCIAL CALCULATIONS
   */

  const totalBookingValue = useMemo(() => {
    return filteredBookings.reduce(
      (total, booking) =>
        total +
        Number(
          booking.total_amount || 0
        ),
      0
    );
  }, [filteredBookings]);

  const totalPaymentsReceived = useMemo(() => {
    return filteredPayments.reduce(
      (total, payment) =>
        total +
        Number(payment.amount || 0),
      0
    );
  }, [filteredPayments]);

  /*
   * Outstanding balance is calculated from
   * the selected booking population.
   *
   * We use the booking's authoritative
   * amount_paid value.
   */

  const totalOutstanding = useMemo(() => {
    return Math.max(
      filteredBookings.reduce(
        (total, booking) =>
          total +
          Math.max(
            Number(
              booking.total_amount || 0
            ) -
              Number(
                booking.amount_paid || 0
              ),
            0
          ),
        0
      ),
      0
    );
  }, [filteredBookings]);

  const paidBookings = useMemo(() => {
    return filteredBookings.filter(
      (booking) =>
        Number(
          booking.amount_paid || 0
        ) >=
        Number(
          booking.total_amount || 0
        )
    );
  }, [filteredBookings]);

  const partiallyPaidBookings =
    useMemo(() => {
      return filteredBookings.filter(
        (booking) => {
          const paid = Number(
            booking.amount_paid || 0
          );

          const total = Number(
            booking.total_amount || 0
          );

          return (
            paid > 0 &&
            paid < total
          );
        }
      );
    }, [filteredBookings]);

  const unpaidBookings = useMemo(() => {
    return filteredBookings.filter(
      (booking) =>
        Number(
          booking.amount_paid || 0
        ) <= 0
    );
  }, [filteredBookings]);

  /*
   * PAYMENT METHODS
   */

  const paymentMethodTotals =
    useMemo(() => {
      const totals: Record<
        string,
        number
      > = {};

      filteredPayments.forEach(
        (payment) => {
          const method =
            payment.payment_method ||
            "Other";

          totals[method] =
            (totals[method] || 0) +
            Number(payment.amount || 0);
        }
      );

      return Object.entries(
        totals
      ).sort(
        (a, b) => b[1] - a[1]
      );
    }, [filteredPayments]);

  /*
   * PAYMENT METHOD OPTIONS
   */

  const paymentMethods =
    useMemo(() => {
      const methods = Array.from(
        new Set(
          payments
            .map(
              (payment) =>
                payment.payment_method
            )
            .filter(Boolean)
        )
      );

      return methods.sort();
    }, [payments]);

  /*
   * OUTSTANDING BOOKINGS
   */

  const outstandingBookings =
    useMemo(() => {
      return filteredBookings
        .filter(
          (booking) =>
            Number(
              booking.total_amount || 0
            ) >
            Number(
              booking.amount_paid || 0
            )
        )
        .sort(
          (a, b) =>
            new Date(
              a.event_date
            ).getTime() -
            new Date(
              b.event_date
            ).getTime()
        );
    }, [filteredBookings]);

  /*
   * RECENT / FILTERED PAYMENTS
   */

  const recentPayments =
    useMemo(() => {
      return filteredPayments.slice(
        0,
        10
      );
    }, [filteredPayments]);

  /*
   * PAYMENT TRANSACTIONS
   */

  const paymentTransactions =
    useMemo(() => {
      return [...filteredPayments].sort(
        (a, b) =>
          new Date(
            b.payment_date
          ).getTime() -
          new Date(
            a.payment_date
          ).getTime()
      );
    }, [filteredPayments]);

  /*
   * MONTHLY SUMMARY
   *
   * Groups payments by month.
   */

  const monthlySummary =
    useMemo(() => {
      const summary: Record<
        string,
        {
          month: string;
          amount: number;
          count: number;
        }
      > = {};

      filteredPayments.forEach(
        (payment) => {
          const date = new Date(
            `${payment.payment_date}T00:00:00`
          );

          const key = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;

          const month =
            date.toLocaleDateString(
              "en-GB",
              {
                month: "long",
                year: "numeric",
              }
            );

          if (!summary[key]) {
            summary[key] = {
              month,
              amount: 0,
              count: 0,
            };
          }

          summary[key].amount += Number(
            payment.amount || 0
          );

          summary[key].count += 1;
        }
      );

      return Object.entries(summary)
        .sort(([a], [b]) =>
          b.localeCompare(a)
        )
        .map(([, value]) => value);
    }, [filteredPayments]);

  /*
   * CLIENT LOOKUP
   */

  function getClientName(
    bookingId: string
  ) {
    const booking = bookings.find(
      (item) =>
        item.id === bookingId
    );

    return (
      booking?.client_name ||
      "Unknown Client"
    );
  }

  function getBooking(
    bookingId: string
  ) {
    return bookings.find(
      (item) =>
        item.id === bookingId
    );
  }

  /*
   * PAYMENT PERCENTAGE
   */

  function getPaymentPercentage(
    booking: Booking
  ) {
    const total = Number(
      booking.total_amount || 0
    );

    const paid = Number(
      booking.amount_paid || 0
    );

    if (total <= 0) {
      return 0;
    }

    return Math.min(
      (paid / total) * 100,
      100
    );
  }

  /*
   * RESET FILTERS
   */

  function resetFilters() {
    setDateFilter("all");
    setCustomStartDate("");
    setCustomEndDate("");
    setBookingStatusFilter("All");
    setPaymentMethodFilter("All");
  }

  /*
   * CSV EXPORT
   */

  function exportPaymentsToCSV() {
    if (
      paymentTransactions.length === 0
    ) {
      alert(
        "There are no payment transactions to export."
      );

      return;
    }

    const rows =
      paymentTransactions.map(
        (payment) => {
          const booking =
            getBooking(
              payment.booking_id
            );

          return [
            payment.payment_date,
            booking?.client_name ||
              "Unknown Client",
            booking?.event_date || "",
            booking?.event_type ||
              "",
            payment.amount,
            payment.payment_method,
            payment.payment_reference ||
              "",
            payment.notes || "",
          ];
        }
      );

    const headers = [
      "Payment Date",
      "Client",
      "Event Date",
      "Event Type",
      "Amount",
      "Payment Method",
      "Reference",
      "Notes",
    ];

    const csvRows = [
      headers,
      ...rows,
    ];

    const csvContent =
      csvRows
        .map((row) =>
          row
            .map((value) => {
              const stringValue =
                String(
                  value ?? ""
                );

              return `"${stringValue.replace(
                /"/g,
                '""'
              )}"`;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `venueflow-payments-${getToday()}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /*
   * LOADING
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-gray-200 bg-white p-8">
            <p className="text-gray-500">
              Loading financial dashboard...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ERROR
   */

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-red-200 bg-red-50 p-8">
            <h1 className="text-xl font-bold text-red-700">
              Unable to load financial dashboard
            </h1>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={
                loadFinancialData
              }
              className="mt-5 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
   * MAIN UI
   */

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Financial Dashboard
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Monitor revenue, payments and outstanding balances.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={
                loadFinancialData
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              View Bookings
            </button>
          </div>
        </div>

        {/* FILTERS */}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Financial Filters
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Filter bookings and payments before reviewing the financial figures.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            {/* DATE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Date Range
              </label>

              <select
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(
                    event.target
                      .value as DateFilter
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="all">
                  All Dates
                </option>

                <option value="this_month">
                  This Month
                </option>

                <option value="last_month">
                  Last Month
                </option>

                <option value="custom">
                  Custom Range
                </option>
              </select>
            </div>

            {/* BOOKING STATUS */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Booking Status
              </label>

              <select
                value={
                  bookingStatusFilter
                }
                onChange={(event) =>
                  setBookingStatusFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="All">
                  All Statuses
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="Confirmed">
                  Confirmed
                </option>

                <option value="Completed">
                  Completed
                </option>

                <option value="Cancelled">
                  Cancelled
                </option>
              </select>
            </div>

            {/* PAYMENT METHOD */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Payment Method
              </label>

              <select
                value={
                  paymentMethodFilter
                }
                onChange={(event) =>
                  setPaymentMethodFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
              >
                <option value="All">
                  All Methods
                </option>

                {paymentMethods.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* RESET */}

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  resetFilters
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* CUSTOM DATES */}

          {dateFilter ===
            "custom" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Start Date
                </label>

                <input
                  type="date"
                  value={
                    customStartDate
                  }
                  onChange={(event) =>
                    setCustomStartDate(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  End Date
                </label>

                <input
                  type="date"
                  value={
                    customEndDate
                  }
                  onChange={(event) =>
                    setCustomEndDate(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          )}

          {(dateRange.start ||
            dateRange.end) && (
            <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Showing financial data from{" "}
              <strong>
                {dateRange.start
                  ? formatDate(
                      dateRange.start
                    )
                  : "beginning"}
              </strong>{" "}
              to{" "}
              <strong>
                {dateRange.end
                  ? formatDate(
                      dateRange.end
                    )
                  : "present"}
              </strong>
              .
            </div>
          )}
        </section>

        {/* FINANCIAL SUMMARY */}

        <section className="mb-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Total Booking Value
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {formatCurrency(
                  totalBookingValue
                )}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {filteredBookings.length}{" "}
                {filteredBookings.length ===
                1
                  ? "booking"
                  : "bookings"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Payments Received
              </p>

              <p className="mt-2 text-2xl font-bold text-green-600">
                {formatCurrency(
                  totalPaymentsReceived
                )}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {filteredPayments.length}{" "}
                payment transaction
                {filteredPayments.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Outstanding Balance
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                {formatCurrency(
                  totalOutstanding
                )}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                Amount still owed
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                Fully Paid Bookings
              </p>

              <p className="mt-2 text-2xl font-bold text-blue-600">
                {paidBookings.length}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                {partiallyPaidBookings.length}{" "}
                partially paid ·{" "}
                {unpaidBookings.length}{" "}
                unpaid
              </p>
            </div>
          </div>
        </section>

        {/* PAYMENT BREAKDOWN */}

        <section className="mb-8 grid gap-6 lg:grid-cols-2">

          {/* METHODS */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Payments by Method
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Breakdown of money received by payment method.
              </p>
            </div>

            {paymentMethodTotals.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="text-sm text-gray-500">
                  No payments recorded for the selected filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethodTotals.map(
                  ([method, amount]) => {
                    const percentage =
                      totalPaymentsReceived >
                      0
                        ? (amount /
                            totalPaymentsReceived) *
                          100
                        : 0;

                    return (
                      <div
                        key={method}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">
                            {method}
                          </span>

                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(
                              amount
                            )}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-black"
                            style={{
                              width: `${Math.min(
                                percentage,
                                100
                              )}%`,
                            }}
                          />
                        </div>

                        <p className="mt-1 text-xs text-gray-400">
                          {percentage.toFixed(
                            1
                          )}
                          %
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* PAYMENT STATUS */}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Payment Status
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Overview of booking payment statuses.
              </p>
            </div>

            <div className="space-y-5">

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Fully Paid
                  </span>

                  <span className="text-sm font-bold text-green-600">
                    {paidBookings.length}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{
                      width:
                        filteredBookings.length >
                        0
                          ? `${
                              (paidBookings.length /
                                filteredBookings.length) *
                              100
                            }%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Partially Paid
                  </span>

                  <span className="text-sm font-bold text-yellow-600">
                    {
                      partiallyPaidBookings.length
                    }
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-yellow-500"
                    style={{
                      width:
                        filteredBookings.length >
                        0
                          ? `${
                              (partiallyPaidBookings.length /
                                filteredBookings.length) *
                              100
                            }%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Unpaid
                  </span>

                  <span className="text-sm font-bold text-red-600">
                    {unpaidBookings.length}
                  </span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width:
                        filteredBookings.length >
                        0
                          ? `${
                              (unpaidBookings.length /
                                filteredBookings.length) *
                              100
                            }%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MONTHLY SUMMARY */}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Monthly Collections
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Payments received grouped by month.
            </p>
          </div>

          {monthlySummary.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">
                No payment data available for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Month
                    </th>

                    <th className="px-4 py-3">
                      Transactions
                    </th>

                    <th className="px-4 py-3">
                      Amount Collected
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {monthlySummary.map(
                    (item) => (
                      <tr
                        key={item.month}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-4 py-4 font-semibold text-gray-900">
                          {item.month}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {item.count}
                        </td>

                        <td className="px-4 py-4 text-sm font-bold text-green-600">
                          {formatCurrency(
                            item.amount
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* OUTSTANDING BALANCES */}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Outstanding Balances
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Bookings with money still owed.
              </p>
            </div>

            <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
              {
                outstandingBookings.length
              }{" "}
              Outstanding
            </span>
          </div>

          {outstandingBookings.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="font-semibold text-green-600">
                No outstanding balances 🎉
              </p>

              <p className="mt-1 text-sm text-gray-500">
                All filtered bookings have been fully paid.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Client
                    </th>

                    <th className="px-4 py-3">
                      Event Date
                    </th>

                    <th className="px-4 py-3">
                      Total
                    </th>

                    <th className="px-4 py-3">
                      Paid
                    </th>

                    <th className="px-4 py-3">
                      Outstanding
                    </th>

                    <th className="px-4 py-3">
                      Progress
                    </th>

                    <th className="px-4 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {outstandingBookings.map(
                    (booking) => {
                      const total =
                        Number(
                          booking.total_amount
                        );

                      const paid =
                        Number(
                          booking.amount_paid
                        );

                      const outstanding =
                        Math.max(
                          total -
                            paid,
                          0
                        );

                      const percentage =
                        getPaymentPercentage(
                          booking
                        );

                      return (
                        <tr
                          key={
                            booking.id
                          }
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">
                              {
                                booking.client_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              {booking.event_type ||
                                "Event"}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(
                              booking.event_date
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                            {formatCurrency(
                              total
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-green-600">
                            {formatCurrency(
                              paid
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm font-bold text-red-600">
                            {formatCurrency(
                              outstanding
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <div className="w-28">
                              <div className="mb-1 flex justify-between text-xs text-gray-500">
                                <span>
                                  {percentage.toFixed(
                                    0
                                  )}
                                  %
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-green-500"
                                  style={{
                                    width: `${percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/bookings/${booking.id}`
                                )
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* PAYMENT TRANSACTIONS */}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Payment Transactions
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                All payment transactions matching the selected filters.
              </p>
            </div>

            <button
              type="button"
              onClick={
                exportPaymentsToCSV
              }
              disabled={
                paymentTransactions.length ===
                0
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>

          {paymentTransactions.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">
                No payment transactions found for the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Date
                    </th>

                    <th className="px-4 py-3">
                      Client
                    </th>

                    <th className="px-4 py-3">
                      Event
                    </th>

                    <th className="px-4 py-3">
                      Amount
                    </th>

                    <th className="px-4 py-3">
                      Method
                    </th>

                    <th className="px-4 py-3">
                      Reference
                    </th>

                    <th className="px-4 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paymentTransactions.map(
                    (payment) => {
                      const booking =
                        getBooking(
                          payment.booking_id
                        );

                      return (
                        <tr
                          key={
                            payment.id
                          }
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(
                              payment.payment_date
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <p className="font-semibold text-gray-900">
                              {getClientName(
                                payment.booking_id
                              )}
                            </p>
                          </td>

                          <td className="px-4 py-4">
                            <p className="text-sm text-gray-700">
                              {booking?.event_type ||
                                "Event"}
                            </p>

                            <p className="mt-1 text-xs text-gray-400">
                              {booking?.event_date
                                ? formatDate(
                                    booking.event_date
                                  )
                                : "-"}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-sm font-bold text-green-600">
                            {formatCurrency(
                              Number(
                                payment.amount
                              )
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {
                              payment.payment_method
                            }
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-500">
                            {payment.payment_reference ||
                              "-"}
                          </td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/bookings/${payment.booking_id}`
                                )
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                            >
                              View Booking
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RECENT PAYMENTS */}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              Recent Payments
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              The latest payments matching the current filters.
            </p>
          </div>

          {recentPayments.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-500">
                No payments recorded yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Client
                    </th>

                    <th className="px-4 py-3">
                      Date
                    </th>

                    <th className="px-4 py-3">
                      Amount
                    </th>

                    <th className="px-4 py-3">
                      Method
                    </th>

                    <th className="px-4 py-3">
                      Reference
                    </th>

                    <th className="px-4 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentPayments.map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">
                            {getClientName(
                              payment.booking_id
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(
                            payment.payment_date
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm font-bold text-green-600">
                          {formatCurrency(
                            Number(
                              payment.amount
                            )
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {
                            payment.payment_method
                          }
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-500">
                          {payment.payment_reference ||
                            "-"}
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/bookings/${payment.booking_id}`
                              )
                            }
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                          >
                            View Booking
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}