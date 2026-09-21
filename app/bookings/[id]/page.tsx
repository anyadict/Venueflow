"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../../components/CRMLayout";

type Booking = {
  id: string;
  enquiry_id: string | null;
  quote_id: string | null;
  client_name: string;
  event_date: string;
  guests: number;
  venue_name: string | null;
  event_type: string | null;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  created_at: string;
  venue_id: string;
};

type Payment = {
  id: string;
  booking_id: string;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
  payment_date: string;
  notes: string | null;
  status: "active" | "reversed";
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string;
};

type BookingItem = {
  id: string;
  booking_id: string;
  package_id: string;
  package_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
};

const bookingStatuses = [
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
];

const paymentMethods = [
  "Bank Transfer",
  "Cash",
  "POS",
  "Card",
  "Online Payment",
  "Other",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
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

function calculatePaymentStatus(
  amountPaid: number,
  totalAmount: number
) {
  if (amountPaid <= 0) {
    return "Unpaid";
  }

  if (amountPaid >= totalAmount) {
    return "Paid";
  }

  return "Partially Paid";
}

export default function BookingDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const bookingId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [booking, setBooking] =
    useState<Booking | null>(null);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [bookingItems, setBookingItems] =
    useState<BookingItem[]>([]);

  const [venueId, setVenueId] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  // =========================
  // ADD PAYMENT STATES
  // =========================

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState("Bank Transfer");

  const [paymentReference, setPaymentReference] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState("");

  const [paymentNotes, setPaymentNotes] =
    useState("");

  const [savingPayment, setSavingPayment] =
    useState(false);

  // =========================
  // EDIT PAYMENT STATES
  // =========================

  const [editingPaymentId, setEditingPaymentId] =
    useState<string | null>(null);

  const [editPaymentAmount, setEditPaymentAmount] =
    useState("");

  const [editPaymentMethod, setEditPaymentMethod] =
    useState("Bank Transfer");

  const [editPaymentDate, setEditPaymentDate] =
    useState("");

  const [editPaymentReference, setEditPaymentReference] =
    useState("");

  const [editPaymentNotes, setEditPaymentNotes] =
    useState("");

  const [updatingPayment, setUpdatingPayment] =
    useState(false);

  const [reversingPayment, setReversingPayment] =
    useState(false);

  // =========================
  // DEFAULT PAYMENT DATE
  // =========================

  useEffect(() => {
    setPaymentDate(
      new Date()
        .toISOString()
        .split("T")[0]
    );
  }, []);

  // =========================
  // LOAD BOOKING
  // =========================

  useEffect(() => {
    if (!bookingId) {
      return;
    }

    loadBooking();
  }, [bookingId]);

  async function loadBooking() {
    try {
      setLoading(true);
      setError("");

      // =========================
      // GET CURRENT USER
      // =========================

      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // =========================
      // GET USER PROFILE
      // =========================

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("venue_id")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (!profile?.venue_id) {
        throw new Error(
          "No venue is connected to your profile."
        );
      }

      setVenueId(profile.venue_id);

      // =========================
      // LOAD BOOKING
      // =========================

      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("venue_id", profile.venue_id)
        .single();

      if (bookingError) {
        throw bookingError;
      }

      // =========================
      // LOAD PAYMENTS
      // =========================

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("payment_date", {
          ascending: true,
        });

      if (paymentError) {
        throw paymentError;
      }

      // =========================
      // LOAD BOOKING ITEMS
      // =========================

      const {
        data: bookingItemData,
        error: bookingItemError,
      } = await supabase
        .from("booking_items")
        .select(
          `
          id,
          booking_id,
          package_id,
          package_name,
          quantity,
          unit_price,
          total_price,
          created_at
          `
        )
        .eq("booking_id", bookingId)
        .order("created_at", {
          ascending: true,
        });

      if (bookingItemError) {
        throw bookingItemError;
      }

      setBooking(bookingData);
      setPayments(paymentData || []);
      setBookingItems(
        bookingItemData || []
      );
    } catch (err: any) {
      console.error(
        "BOOKING DETAILS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load booking."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // UPDATE BOOKING STATUS
  // =========================

  async function updateBookingStatus(
    newStatus: string
  ) {
    if (!booking || !venueId) {
      return;
    }

    try {
      setUpdatingStatus(true);

      const {
        error: updateError,
      } = await supabase
        .from("bookings")
        .update({
          status: newStatus,
        })
        .eq("id", booking.id)
        .eq("venue_id", venueId);

      if (updateError) {
        throw updateError;
      }

      setBooking({
        ...booking,
        status: newStatus,
      });
    } catch (err: any) {
      console.error(err);

      alert(
        err?.message ||
          "Unable to update booking status."
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  // =========================
  // ADD PAYMENT
  // =========================

  async function addPayment() {
    if (!booking || !venueId) {
      return;
    }

    const amount =
      Number(paymentAmount);

    if (
      !paymentAmount ||
      amount <= 0
    ) {
      alert(
        "Please enter a valid payment amount."
      );
      return;
    }

    if (!paymentDate) {
      alert(
        "Please select the payment date."
      );
      return;
    }

    const currentTotalPaid =
      payments.reduce(
        (total, payment) =>
          total +
          Number(payment.amount),
        0
      );

    const bookingTotal =
      Number(booking.total_amount);

    if (
      currentTotalPaid + amount >
      bookingTotal
    ) {
      alert(
        `This payment would exceed the booking total of ${formatCurrency(
          bookingTotal
        )}.`
      );
      return;
    }

    try {
      setSavingPayment(true);

      // =========================
      // RECORD PAYMENT ATOMICALLY
      // =========================
      // PostgreSQL handles the entire
      // payment operation in one transaction:
      //
      // 1. Create payment
      // 2. Update booking payment summary
      // 3. Calculate commission
      // 4. Create financial transaction
      //
      // If any step fails, PostgreSQL rolls
      // the entire operation back.

      const {
        data: paymentId,
        error: paymentError,
      } = await supabase.rpc(
        "record_booking_payment",
        {
          p_booking_id: booking.id,
          p_amount: amount,
          p_payment_method:
            paymentMethod,
          p_payment_reference:
            paymentReference.trim() ||
            null,
          p_payment_date: paymentDate,
          p_notes:
            paymentNotes.trim() ||
            null,
        }
      );

      if (paymentError) {
        throw paymentError;
      }

      console.log(
        "PAYMENT RECORDED ATOMICALLY:",
        paymentId
      );

      // Reload the booking, payments and
      // financial state from the database.
      await loadBooking();

      // =========================
      // RESET FORM
      // =========================

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");

      setPaymentDate(
        new Date()
          .toISOString()
          .split("T")[0]
      );

      setPaymentMethod(
        "Bank Transfer"
      );

      alert(
        "Payment added successfully."
      );
    } catch (err: any) {
      console.error(
        "ADD PAYMENT ERROR:",
        err
      );

      alert(
        err?.message ||
          "Unable to add payment."
      );

      // Reload so the interface reflects
      // the actual database state.
      await loadBooking();
    } finally {
      setSavingPayment(false);
    }
  }

  // =========================
  // START EDITING PAYMENT
  // =========================

  function startEditingPayment(
    payment: Payment
  ) {
    if (payment.status !== "active") {
      alert(
        "This payment has been reversed and can no longer be edited."
      );
      return;
    }

    setEditingPaymentId(payment.id);

    setEditPaymentAmount(
      String(payment.amount)
    );

    setEditPaymentMethod(
      payment.payment_method
    );

    setEditPaymentDate(
      payment.payment_date
    );

    setEditPaymentReference(
      payment.payment_reference || ""
    );

    setEditPaymentNotes(
      payment.notes || ""
    );
  }

  // =========================
  // CANCEL EDITING PAYMENT
  // =========================

  function cancelEditingPayment() {
    setEditingPaymentId(null);

    setEditPaymentAmount("");
    setEditPaymentMethod(
      "Bank Transfer"
    );
    setEditPaymentDate("");
    setEditPaymentReference("");
    setEditPaymentNotes("");
  }

  // =========================
  // UPDATE / REPLACE PAYMENT
  // =========================

  async function updatePayment(
    paymentId: string
  ) {
    if (!booking || !venueId) {
      return;
    }

    const payment = payments.find(
      (item) => item.id === paymentId
    );

    if (!payment) {
      alert("Payment not found.");
      return;
    }

    if (payment.status !== "active") {
      alert(
        "This payment has been reversed and can no longer be edited."
      );
      return;
    }

    const amount =
      Number(editPaymentAmount);

    if (
      !editPaymentAmount ||
      amount <= 0
    ) {
      alert(
        "Please enter a valid payment amount."
      );
      return;
    }

    if (!editPaymentDate) {
      alert(
        "Please select the payment date."
      );
      return;
    }

    const totalExcludingCurrentPayment =
      payments.reduce(
        (total, item) => {
          if (
            item.id === paymentId ||
            item.status !== "active"
          ) {
            return total;
          }

          return (
            total + Number(item.amount)
          );
        },
        0
      );

    const bookingTotal =
      Number(booking.total_amount);

    if (
      totalExcludingCurrentPayment +
        amount >
      bookingTotal
    ) {
      alert(
        `This payment would exceed the booking total of ${formatCurrency(
          bookingTotal
        )}.`
      );
      return;
    }

    try {
      setUpdatingPayment(true);

      // =========================
      // VERIFY BOOKING OWNERSHIP
      // =========================

      const {
        data: ownedBooking,
        error: ownedBookingError,
      } = await supabase
        .from("bookings")
        .select("id")
        .eq("id", booking.id)
        .eq("venue_id", venueId)
        .single();

      if (
        ownedBookingError ||
        !ownedBooking
      ) {
        throw new Error(
          "You do not have permission to update this payment."
        );
      }

      const amountChanged =
        amount !== Number(payment.amount);

      // =========================
      // AMOUNT CHANGE
      // =========================
      // Never directly overwrite payments.amount.
      // PostgreSQL atomically reverses the old
      // payment and creates the replacement.

      if (amountChanged) {
        const reversalReason =
          window.prompt(
            "Why is the payment amount being changed?",
            "Payment amount corrected"
          );

        if (
          reversalReason === null
        ) {
          return;
        }

        if (
          !reversalReason.trim()
        ) {
          alert(
            "Please provide a reason for changing the payment amount."
          );
          return;
        }

        const {
          data: replacementPaymentId,
          error: replacementError,
        } = await supabase.rpc(
          "replace_booking_payment",
          {
            p_payment_id: paymentId,
            p_new_amount: amount,
            p_payment_method:
              editPaymentMethod,
            p_payment_reference:
              editPaymentReference.trim() ||
              null,
            p_payment_date:
              editPaymentDate,
            p_notes:
              editPaymentNotes.trim() ||
              null,
            p_reversal_reason:
              reversalReason.trim(),
          }
        );

        if (replacementError) {
          throw replacementError;
        }

        console.log(
          "PAYMENT REPLACED ATOMICALLY:",
          replacementPaymentId
        );

        await loadBooking();
        cancelEditingPayment();

        alert(
          "Payment amount changed successfully. The original payment was reversed and a replacement payment was created."
        );

        return;
      }

      // =========================
      // METADATA-ONLY UPDATE
      // =========================

      const {
        error: updateError,
      } = await supabase
        .from("payments")
        .update({
          payment_method:
            editPaymentMethod,
          payment_date:
            editPaymentDate,
          payment_reference:
            editPaymentReference.trim() ||
            null,
          notes:
            editPaymentNotes.trim() ||
            null,
        })
        .eq("id", paymentId)
        .eq("booking_id", booking.id)
        .eq("status", "active");

      if (updateError) {
        throw updateError;
      }

      await loadBooking();
      cancelEditingPayment();

      alert(
        "Payment details updated successfully."
      );
    } catch (err: any) {
      console.error(
        "UPDATE PAYMENT ERROR:",
        err
      );

      alert(
        err?.message ||
          "Unable to update payment."
      );

      await loadBooking();
    } finally {
      setUpdatingPayment(false);
    }
  }

  // =========================
  // REVERSE PAYMENT
  // =========================

  async function reversePayment(
    payment: Payment
  ) {
    if (!booking || !venueId) {
      return;
    }

    if (payment.status !== "active") {
      alert(
        "This payment has already been reversed."
      );
      return;
    }

    const reason =
      window.prompt(
        "Why are you reversing this payment?",
        "Payment reversed"
      );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      alert(
        "Please provide a reason for reversing the payment."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Reverse ${formatCurrency(
          Number(payment.amount)
        )} payment?\n\nThe payment will remain in history as reversed and will no longer count toward the booking balance.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setReversingPayment(true);

      const {
        data: reversalTransactionId,
        error: reversalError,
      } = await supabase.rpc(
        "reverse_booking_payment",
        {
          p_payment_id: payment.id,
          p_reason: reason.trim(),
        }
      );

      if (reversalError) {
        throw reversalError;
      }

      console.log(
        "PAYMENT REVERSED:",
        reversalTransactionId
      );

      await loadBooking();

      if (
        editingPaymentId ===
        payment.id
      ) {
        cancelEditingPayment();
      }

      alert(
        "Payment reversed successfully."
      );
    } catch (err: any) {
      console.error(
        "REVERSE PAYMENT ERROR:",
        err
      );

      alert(
        err?.message ||
          "Unable to reverse payment."
      );

      await loadBooking();
    } finally {
      setReversingPayment(false);
    }
  }

  // =========================
  // GENERATE PAYMENT RECEIPT
  // =========================

  function generatePaymentReceipt(
    payment: Payment
  ) {
    if (!booking) {
      return;
    }

    const totalPaid =
      payments.reduce(
        (total, item) =>
          item.status === "active"
            ? total + Number(item.amount)
            : total,
        0
      );

    const outstandingBalance =
      Math.max(
        Number(
          booking.total_amount
        ) - totalPaid,
        0
      );

    const paymentStatus =
      calculatePaymentStatus(
        totalPaid,
        Number(
          booking.total_amount
        )
      );

    const receiptNumber =
      `VFR-${payment.id
        .slice(0, 8)
        .toUpperCase()}`;

    const doc = new jsPDF();

    // =========================
    // HEADER
    // =========================

    doc.setFontSize(24);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "VenueFlow",
      20,
      25
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "Wedding & Event Venue Management",
      20,
      32
    );

    doc.setFontSize(18);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "PAYMENT RECEIPT",
      190,
      25,
      {
        align: "right",
      }
    );

    doc.setFontSize(10);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      `Receipt No: ${receiptNumber}`,
      190,
      32,
      {
        align: "right",
      }
    );

    doc.setDrawColor(
      200,
      200,
      200
    );

    doc.line(
      20,
      40,
      190,
      40
    );

    // =========================
    // CLIENT INFORMATION
    // =========================

    doc.setFontSize(12);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Client Information",
      20,
      52
    );

    autoTable(doc, {
      startY: 58,
      theme: "plain",

      styles: {
        fontSize: 10,
        cellPadding: 3,
      },

      columnStyles: {
        0: {
          fontStyle: "bold",
          cellWidth: 45,
        },

        1: {
          cellWidth: 125,
        },
      },

      body: [
        [
          "Client",
          booking.client_name,
        ],

        [
          "Event Type",
          booking.event_type ||
            "-",
        ],

        [
          "Event Date",
          formatDate(
            booking.event_date
          ),
        ],

        [
          "Venue",
          booking.venue_name ||
            "-",
        ],

        [
          "Guests",
          String(
            booking.guests
          ),
        ],
      ],
    });

    const clientTableEnd =
      (doc as any)
        .lastAutoTable.finalY;

    // =========================
    // PAYMENT INFORMATION
    // =========================

    const paymentTableStart =
      clientTableEnd + 10;

    doc.setFontSize(12);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Payment Information",
      20,
      paymentTableStart
    );

    autoTable(doc, {
      startY:
        paymentTableStart + 6,

      theme: "grid",

      head: [
        [
          "Description",
          "Details",
        ],
      ],

      body: [
        [
          "Payment Date",
          formatDate(
            payment.payment_date
          ),
        ],

        [
          "Amount Received",
          formatCurrency(
            Number(
              payment.amount
            )
          ),
        ],

        [
          "Payment Method",
          payment.payment_method,
        ],

        [
          "Reference",
          payment.payment_reference ||
            "-",
        ],

        [
          "Notes",
          payment.notes ||
            "-",
        ],
      ],

      styles: {
        fontSize: 10,
        cellPadding: 4,
      },

      headStyles: {
        fontStyle: "bold",
      },
    });

    const paymentTableEnd =
      (doc as any)
        .lastAutoTable.finalY;

    // =========================
    // PAYMENT SUMMARY
    // =========================

    const summaryStart =
      paymentTableEnd + 12;

    doc.setFontSize(12);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      "Payment Summary",
      20,
      summaryStart
    );

    autoTable(doc, {
      startY:
        summaryStart + 6,

      theme: "plain",

      styles: {
        fontSize: 10,
        cellPadding: 4,
      },

      columnStyles: {
        0: {
          fontStyle: "bold",
          cellWidth: 100,
        },

        1: {
          halign: "right",
          cellWidth: 70,
        },
      },

      body: [
        [
          "Booking Total",
          formatCurrency(
            Number(
              booking.total_amount
            )
          ),
        ],

        [
          "Total Paid",
          formatCurrency(
            totalPaid
          ),
        ],

        [
          "Outstanding Balance",
          formatCurrency(
            outstandingBalance
          ),
        ],

        [
          "Payment Status",
          paymentStatus,
        ],
      ],
    });

    const summaryTableEnd =
      (doc as any)
        .lastAutoTable.finalY;

    // =========================
    // FOOTER
    // =========================

    const footerStart =
      summaryTableEnd + 15;

    doc.setFontSize(11);

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      "Thank you for your payment.",
      20,
      footerStart
    );

    doc.setFontSize(9);

    doc.setTextColor(
      100,
      100,
      100
    );

    doc.text(
      "This receipt was generated by VenueFlow.",
      20,
      footerStart + 8
    );

    doc.text(
      `Booking ID: ${booking.id}`,
      20,
      285
    );

    doc.text(
      "VenueFlow",
      190,
      285,
      {
        align: "right",
      }
    );

    const safeClientName =
      booking.client_name
        .replace(
          /[^a-z0-9]/gi,
          "-"
        )
        .toLowerCase();

    doc.save(
      `VenueFlow-Payment-Receipt-${safeClientName}-${receiptNumber}.pdf`
    );
  }

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-50 p-8">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <p className="text-gray-500">
                Loading booking...
              </p>
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  // =========================
  // ERROR
  // =========================

  if (error) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-50 p-8">
          <div className="mx-auto max-w-6xl">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="mb-6 text-sm font-semibold text-gray-600 hover:text-black"
            >
              ← Back to Bookings
            </button>

            <div className="rounded-xl border border-red-200 bg-red-50 p-8">
              <h1 className="text-xl font-bold text-red-700">
                Unable to load booking
              </h1>

              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  // =========================
  // BOOKING NOT FOUND
  // =========================

  if (!booking) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-50 p-8">
          <div className="mx-auto max-w-6xl">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/bookings"
                )
              }
              className="mb-6 text-sm font-semibold text-gray-600 hover:text-black"
            >
              ← Back to Bookings
            </button>

            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <h1 className="text-xl font-bold">
                Booking not found
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                The booking you are looking for
                does not exist.
              </p>
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  // =========================
  // PAYMENT CALCULATIONS
  // =========================

  const totalPaid =
    payments.reduce(
      (total, payment) =>
        payment.status === "active"
          ? total + Number(payment.amount)
          : total,
      0
    );

  const outstandingBalance =
    Math.max(
      Number(
        booking.total_amount
      ) - totalPaid,
      0
    );

  const paymentStatus =
    calculatePaymentStatus(
      totalPaid,
      Number(
        booking.total_amount
      )
    );

  // =========================
  // SERVICES TOTAL
  // =========================

  const servicesTotal =
    bookingItems.reduce(
      (total, item) =>
        total +
        Number(item.total_price),
      0
    );

  // =========================
  // PAGE
  // =========================

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="mx-auto max-w-6xl">

          {/* TOP BAR */}

          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/bookings"
                  )
                }
                className="mb-3 text-sm font-semibold text-gray-500 hover:text-black"
              >
                ← Back to Bookings
              </button>

              <h1 className="text-3xl font-bold text-gray-900">
                Booking Details
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                View and manage this booking.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {booking.quote_id && (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/quotes/${booking.quote_id}`
                    )
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                >
                  View Quote
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/bookings/${booking.id}/edit`
                  )
                }
                className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Edit Booking
              </button>
            </div>
          </div>

          {/* BOOKING OVERVIEW */}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {booking.client_name}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Booking ID:{" "}
                  {booking.id}
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    booking.status ===
                    "Confirmed"
                      ? "bg-green-100 text-green-700"
                      : booking.status ===
                        "Completed"
                      ? "bg-blue-100 text-blue-700"
                      : booking.status ===
                        "Cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {booking.status}
                </span>

                <select
                  value={
                    booking.status
                  }
                  onChange={(event) =>
                    updateBookingStatus(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    updatingStatus
                  }
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                >
                  {bookingStatuses.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Event Type
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {booking.event_type ||
                    "-"}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Event Date
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {formatDate(
                    booking.event_date
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Number of Guests
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {booking.guests}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Venue
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {booking.venue_name ||
                    "-"}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Booking Amount
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {formatCurrency(
                    Number(
                      booking.total_amount
                    )
                  )}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Created
                </p>

                <p className="mt-2 font-semibold text-gray-900">
                  {new Date(
                    booking.created_at
                  ).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </p>
              </div>

            </div>
          </section>

          {/* SERVICES / BOOKING ITEMS */}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Services & Packages
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Services included in this booking.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {bookingItems.length}{" "}
                {bookingItems.length ===
                1
                  ? "Service"
                  : "Services"}
              </div>
            </div>

            {bookingItems.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="font-medium text-gray-700">
                  No services attached to this booking.
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  This booking does not have any
                  package or service items recorded.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Service
                      </th>

                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Quantity
                      </th>

                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Unit Price
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {bookingItems.map(
                      (item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-4">
                            <p className="font-semibold text-gray-900">
                              {
                                item.package_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Package / Service
                            </p>
                          </td>

                          <td className="px-3 py-4 text-sm text-gray-700">
                            {Number(
                              item.quantity
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-gray-700">
                            {formatCurrency(
                              Number(
                                item.unit_price
                              )
                            )}
                          </td>

                          <td className="px-3 py-4 text-right font-semibold text-gray-900">
                            {formatCurrency(
                              Number(
                                item.total_price
                              )
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-right font-semibold text-gray-700"
                      >
                        Services Total
                      </td>

                      <td className="px-3 py-4 text-right text-lg font-bold text-gray-900">
                        {formatCurrency(
                          servicesTotal
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* PAYMENT SUMMARY */}

          <section className="mb-6">

            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Financial Summary
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Track the booking total, payments received and
                outstanding balance.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Booking Total
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    Number(
                      booking.total_amount
                    )
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Total Paid
                </p>

                <p className="mt-2 text-2xl font-bold text-green-600">
                  {formatCurrency(
                    totalPaid
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Outstanding Balance
                </p>

                <p className="mt-2 text-2xl font-bold text-red-600">
                  {formatCurrency(
                    outstandingBalance
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">
                  Payment Status
                </p>

                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                      paymentStatus ===
                      "Paid"
                        ? "bg-green-100 text-green-700"
                        : paymentStatus ===
                          "Partially Paid"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {paymentStatus}
                  </span>
                </div>
              </div>

            </div>
          </section>

          {/* ADD PAYMENT */}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                Add Payment
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Record a payment received from the client.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    paymentAmount
                  }
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target
                        .value
                    )
                  }
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>

                <select
                  value={
                    paymentMethod
                  }
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                >
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

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payment Date
                </label>

                <input
                  type="date"
                  value={
                    paymentDate
                  }
                  onChange={(event) =>
                    setPaymentDate(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Reference
                </label>

                <input
                  type="text"
                  value={
                    paymentReference
                  }
                  onChange={(event) =>
                    setPaymentReference(
                      event.target
                        .value
                    )
                  }
                  placeholder="Transaction reference"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Notes
                </label>

                <input
                  type="text"
                  value={
                    paymentNotes
                  }
                  onChange={(event) =>
                    setPaymentNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Optional notes"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-black"
                />
              </div>

            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">

              <button
                type="button"
                onClick={
                  addPayment
                }
                disabled={
                  savingPayment ||
                  outstandingBalance <=
                    0
                }
                className="rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPayment
                  ? "Saving..."
                  : outstandingBalance <=
                    0
                  ? "Booking Fully Paid"
                  : "Add Payment"}
              </button>

              <p className="text-sm text-gray-500">
                Outstanding:{" "}
                <span className="font-semibold text-gray-900">
                  {formatCurrency(
                    outstandingBalance
                  )}
                </span>
              </p>

            </div>
          </section>

          {/* PAYMENT HISTORY */}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Payment History
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  All payments recorded for this booking.
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                {payments.length}{" "}
                {payments.length ===
                1
                  ? "Payment"
                  : "Payments"}
              </div>

            </div>

            {payments.length ===
            0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">

                <p className="font-medium text-gray-700">
                  No payments recorded yet.
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Add the first payment using the form above.
                </p>

              </div>
            ) : (
              <div className="space-y-4">

                {payments.map(
                  (payment) => {
                    const isEditing =
                      editingPaymentId ===
                      payment.id;

                    if (isEditing) {
                      return (
                        <div
                          key={
                            payment.id
                          }
                          className="rounded-xl border border-gray-300 bg-gray-50 p-5"
                        >

                          <div className="mb-4">
                            <h3 className="font-bold text-gray-900">
                              Edit Payment
                            </h3>

                            <p className="mt-1 text-xs text-gray-500">
                              Payment ID:{" "}
                              {
                                payment.id
                              }
                            </p>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Amount
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  editPaymentAmount
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPaymentAmount(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                              />

                              <p className="mt-1 text-xs text-gray-500">
                                Changing the amount reverses this payment and creates a replacement transaction atomically.
                              </p>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Payment Method
                              </label>

                              <select
                                value={
                                  editPaymentMethod
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPaymentMethod(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                              >
                                {paymentMethods.map(
                                  (
                                    method
                                  ) => (
                                    <option
                                      key={
                                        method
                                      }
                                      value={
                                        method
                                      }
                                    >
                                      {
                                        method
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Payment Date
                              </label>

                              <input
                                type="date"
                                value={
                                  editPaymentDate
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPaymentDate(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Reference
                              </label>

                              <input
                                type="text"
                                value={
                                  editPaymentReference
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPaymentReference(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium text-gray-700">
                                Notes
                              </label>

                              <input
                                type="text"
                                value={
                                  editPaymentNotes
                                }
                                onChange={(
                                  event
                                ) =>
                                  setEditPaymentNotes(
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-black"
                              />
                            </div>

                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">

                            <button
                              type="button"
                              onClick={() =>
                                updatePayment(
                                  payment.id
                                )
                              }
                              disabled={
                                updatingPayment
                              }
                              className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                              {updatingPayment
                                ? "Saving..."
                                : "Save Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={
                                cancelEditingPayment
                              }
                              disabled={
                                updatingPayment
                              }
                              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>

                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={
                          payment.id
                        }
                        className="rounded-xl border border-gray-200 p-5"
                      >

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Amount
                              </p>

                              <p className="mt-1 font-bold text-gray-900">
                                {formatCurrency(
                                  Number(
                                    payment.amount
                                  )
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Method
                              </p>

                              <p className="mt-1 font-semibold text-gray-900">
                                {
                                  payment.payment_method
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Date
                              </p>

                              <p className="mt-1 font-semibold text-gray-900">
                                {formatDate(
                                  payment.payment_date
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Reference
                              </p>

                              <p className="mt-1 break-all font-semibold text-gray-900">
                                {
                                  payment.payment_reference ||
                                  "-"
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Status
                              </p>

                              <span
                                className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  payment.status === "active"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {payment.status === "active"
                                  ? "Active"
                                  : "Reversed"}
                              </span>
                            </div>

                          </div>

                          <div className="flex justify-end gap-2">

                            {payment.status === "active" && (
                              <button
                                type="button"
                                onClick={() =>
                                  startEditingPayment(
                                    payment
                                  )
                                }
                                disabled={
                                  reversingPayment
                                }
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              >
                                Edit
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                generatePaymentReceipt(
                                  payment
                                )
                              }
                              disabled={
                                reversingPayment
                              }
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Receipt
                            </button>

                            {payment.status === "active" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  reversePayment(
                                    payment
                                  )
                                }
                                disabled={
                                  reversingPayment
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {reversingPayment
                                  ? "Reversing..."
                                  : "Reverse"}
                              </button>
                            ) : (
                              <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-500">
                                Reversed
                              </span>
                            )}

                          </div>
                        </div>

                        {payment.status === "reversed" && (
                          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Reversal Details
                            </p>

                            <p className="mt-1 text-sm text-gray-700">
                              Reversed on {
                                payment.reversed_at
                                  ? new Date(
                                      payment.reversed_at
                                    ).toLocaleString("en-GB")
                                  : "-"
                              }
                            </p>

                            <p className="mt-1 text-sm text-gray-700">
                              Reason: {
                                payment.reversal_reason ||
                                "-"
                              }
                            </p>
                          </div>
                        )}

                        {payment.notes && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Notes
                            </p>

                            <p className="mt-1 text-sm text-gray-700">
                              {
                                payment.notes
                              }
                            </p>
                          </div>
                        )}

                        <div className="mt-4 border-t border-gray-100 pt-3">
                          <p className="text-xs text-gray-400">
                            Payment ID:{" "}
                            {
                              payment.id
                            }
                          </p>
                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}
          </section>

          {/* LINKED RECORDS */}

          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <h2 className="text-xl font-bold text-gray-900">
              Linked Records
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Quote
                </p>

                {booking.quote_id ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/quotes/${booking.quote_id}`
                      )
                    }
                    className="mt-2 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    View Linked Quote →
                  </button>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No linked quote.
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Enquiry
                </p>

                {booking.enquiry_id ? (
                  <p className="mt-2 break-all text-sm font-medium text-gray-700">
                    {
                      booking.enquiry_id
                    }
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">
                    No linked enquiry.
                  </p>
                )}
              </div>

            </div>
          </section>

          {/* BOOKING INFORMATION */}

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

            <h2 className="text-lg font-bold text-gray-900">
              Booking Information
            </h2>

            <div className="mt-4 space-y-2 text-sm">

              <p className="break-all text-gray-600">
                <span className="font-semibold text-gray-900">
                  Booking ID:
                </span>{" "}
                {booking.id}
              </p>

              <p className="text-gray-600">
                <span className="font-semibold text-gray-900">
                  Created:
                </span>{" "}
                {new Date(
                  booking.created_at
                ).toLocaleString(
                  "en-GB"
                )}
              </p>

            </div>
          </section>

        </div>
      </main>
    </CRMLayout>
  );
}