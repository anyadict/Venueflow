"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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

export default function QuoteDetails() {
const params = useParams();
const router = useRouter();

const quoteId = params.id as string;

const [quote, setQuote] = useState<Quote | null>(null);
const [loading, setLoading] = useState(true);
const [errorMessage, setErrorMessage] = useState("");

const formatCurrency = (amount: number) => {
return new Intl.NumberFormat("en-NG", {
style: "currency",
currency: "NGN",
maximumFractionDigits: 0,
}).format(Number(amount));
};

// --------------------------------------------------
// LOAD QUOTE
// --------------------------------------------------

async function loadQuote() {
setLoading(true);
setErrorMessage("");


const user = await getCurrentUser();

if (!user) {
  router.push("/login");
  return;
}

// Get user's venue
const { data: profile, error: profileError } =
  await supabase
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

  setLoading(false);
  return;
}

if (!profile?.venue_id) {
  setErrorMessage(
    "Your account is not connected to a venue."
  );

  setLoading(false);
  return;
}

// Load only this venue's quote
const { data, error } = await supabase
  .from("quotes")
  .select("*")
  .eq("id", quoteId)
  .eq("venue_id", profile.venue_id)
  .single();

if (error) {
  console.error(
    "SUPABASE QUOTE DETAILS ERROR:",
    error
  );

  setErrorMessage(
    `Unable to load quote: ${error.message}`
  );

  setLoading(false);
  return;
}

setQuote(data);
setLoading(false);


}

useEffect(() => {
if (quoteId) {
loadQuote();
}
}, [quoteId]);

// --------------------------------------------------
// GENERATE PDF
// --------------------------------------------------

function handleGeneratePDF() {
if (!quote) {
return;
}


const doc = new jsPDF();

const quoteNumber = `VF-${quote.id
  .slice(0, 8)
  .toUpperCase()}`;

const quoteDate = new Date(
  quote.created_at
).toLocaleDateString("en-NG");

/*
 * HEADER
 */

doc.setFontSize(24);
doc.setFont("helvetica", "bold");
doc.text("VenueFlow", 20, 25);

doc.setFontSize(10);
doc.setFont("helvetica", "normal");
doc.text(
  "Wedding & Event Venue Management",
  20,
  32
);

doc.setFontSize(18);
doc.setFont("helvetica", "bold");
doc.text("QUOTATION", 190, 25, {
  align: "right",
});

doc.setFontSize(10);
doc.setFont("helvetica", "normal");

doc.text(
  `Quote No: ${quoteNumber}`,
  190,
  32,
  {
    align: "right",
  }
);

doc.text(
  `Date: ${quoteDate}`,
  190,
  38,
  {
    align: "right",
  }
);

/*
 * DIVIDER
 */

doc.setLineWidth(0.5);
doc.line(20, 45, 190, 45);

/*
 * CLIENT INFORMATION
 */

doc.setFontSize(12);
doc.setFont("helvetica", "bold");
doc.text(
  "Client Information",
  20,
  58
);

doc.setFontSize(10);
doc.setFont("helvetica", "normal");

doc.text(
  `Client Name: ${quote.client_name}`,
  20,
  67
);

doc.text(
  `Number of Guests: ${quote.guests}`,
  20,
  74
);

doc.text(
  `Quote Status: ${quote.status}`,
  20,
  81
);

/*
 * TABLE DATA
 */

const tableData: string[][] = [];

tableData.push([
  "Catering",
  `${quote.catering_package} package`,
  formatCurrency(
    quote.catering_total
  ),
]);

tableData.push([
  "Bar",
  `${quote.bar_package} package`,
  formatCurrency(
    quote.bar_total
  ),
]);

if (quote.decoration) {
  tableData.push([
    "Decoration",
    "Selected",
    formatCurrency(
      quote.decoration_total
    ),
  ]);
}

if (quote.dj) {
  tableData.push([
    "DJ",
    "Selected",
    formatCurrency(
      quote.dj_total
    ),
  ]);
}

if (quote.photography) {
  tableData.push([
    "Photography",
    "Selected",
    formatCurrency(
      quote.photography_total
    ),
  ]);
}

/*
 * QUOTE TABLE
 */

autoTable(doc, {
  startY: 92,

  head: [
    [
      "Service",
      "Description",
      "Amount",
    ],
  ],

  body: tableData,

  theme: "grid",

  styles: {
    fontSize: 10,
    cellPadding: 5,
  },

  headStyles: {
    fontStyle: "bold",
  },

  columnStyles: {
    2: {
      halign: "right",
    },
  },
});

/*
 * GRAND TOTAL
 */

const finalY =
  (doc as any).lastAutoTable.finalY;

doc.setFontSize(14);
doc.setFont("helvetica", "bold");

doc.text(
  "Grand Total",
  130,
  finalY + 18
);

doc.text(
  formatCurrency(quote.total),
  190,
  finalY + 18,
  {
    align: "right",
  }
);

/*
 * TERMS
 */

doc.setFontSize(10);
doc.setFont("helvetica", "normal");

doc.text(
  "Thank you for considering VenueFlow for your event.",
  20,
  finalY + 40
);

doc.text(
  "This quotation is subject to availability and confirmation.",
  20,
  finalY + 47
);

/*
 * FOOTER
 */

doc.setFontSize(8);

doc.text(
  `VenueFlow | Quote ${quoteNumber}`,
  20,
  285
);

doc.text(
  "Generated electronically",
  190,
  285,
  {
    align: "right",
  }
);

/*
 * SAVE PDF
 */

const safeClientName =
  quote.client_name
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

doc.save(
  `VenueFlow-Quote-${safeClientName}.pdf`
);


}

// --------------------------------------------------
// LOADING
// --------------------------------------------------

if (loading) {
return ( <CRMLayout> <main className="min-h-screen bg-gray-100 p-8"> <div className="mx-auto max-w-4xl"> <div className="rounded-xl border bg-white p-8 text-center shadow-sm"> <p className="text-gray-500">
Loading quote... </p> </div> </div> </main> </CRMLayout>
);
}

// --------------------------------------------------
// ERROR
// --------------------------------------------------

if (errorMessage) {
return ( <CRMLayout> <main className="min-h-screen bg-gray-100 p-8"> <div className="mx-auto max-w-4xl"> <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700"> <p className="font-medium">
{errorMessage} </p> </div> </div> </main> </CRMLayout>
);
}

// --------------------------------------------------
// NOT FOUND
// --------------------------------------------------

if (!quote) {
return ( <CRMLayout> <main className="min-h-screen bg-gray-100 p-8"> <div className="mx-auto max-w-4xl"> <div className="rounded-xl border bg-white p-8 text-center shadow-sm"> <p className="text-gray-500">
Quote not found. </p> </div> </div> </main> </CRMLayout>
);
}

// --------------------------------------------------
// PAGE UI
// --------------------------------------------------

return ( <CRMLayout> <main className="min-h-screen bg-gray-100 p-8"> <div className="mx-auto max-w-4xl">

```
      {/* PAGE HEADER */}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Quote Details
          </h1>

          <p className="mt-2 text-gray-600">
            Full breakdown of the client quotation.
          </p>
        </div>

        <span className="w-fit rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700">
          {quote.status}
        </span>
      </div>

      {/* CLIENT INFORMATION */}

      <section className="mb-6 rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-bold text-gray-900">
          Client Information
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">

          <div>
            <p className="text-sm text-gray-500">
              Client Name
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {quote.client_name}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Number of Guests
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {quote.guests}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Quote Date
            </p>

            <p className="mt-1 text-lg font-semibold text-gray-900">
              {new Date(
                quote.created_at
              ).toLocaleDateString("en-NG")}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">
              Quote ID
            </p>

            <p className="mt-1 break-all text-sm font-medium text-gray-900">
              {quote.id}
            </p>
          </div>

        </div>
      </section>

      {/* QUOTE BREAKDOWN */}

      <section className="mb-6 rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-bold text-gray-900">
          Quote Breakdown
        </h2>

        <div className="divide-y">

          {/* Catering */}

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">
                Catering
              </p>

              <p className="text-sm capitalize text-gray-500">
                {quote.catering_package} package
              </p>
            </div>

            <p className="font-semibold text-gray-900">
              {formatCurrency(
                quote.catering_total
              )}
            </p>
          </div>

          {/* Bar */}

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">
                Bar
              </p>

              <p className="text-sm capitalize text-gray-500">
                {quote.bar_package} package
              </p>
            </div>

            <p className="font-semibold text-gray-900">
              {formatCurrency(
                quote.bar_total
              )}
            </p>
          </div>

          {/* Decoration */}

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">
                Decoration
              </p>

              <p className="text-sm text-gray-500">
                {quote.decoration
                  ? "Selected"
                  : "Not selected"}
              </p>
            </div>

            <p className="font-semibold text-gray-900">
              {formatCurrency(
                quote.decoration_total
              )}
            </p>
          </div>

          {/* DJ */}

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">
                DJ
              </p>

              <p className="text-sm text-gray-500">
                {quote.dj
                  ? "Selected"
                  : "Not selected"}
              </p>
            </div>

            <p className="font-semibold text-gray-900">
              {formatCurrency(
                quote.dj_total
              )}
            </p>
          </div>

          {/* Photography */}

          <div className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium text-gray-900">
                Photography
              </p>

              <p className="text-sm text-gray-500">
                {quote.photography
                  ? "Selected"
                  : "Not selected"}
              </p>
            </div>

            <p className="font-semibold text-gray-900">
              {formatCurrency(
                quote.photography_total
              )}
            </p>
          </div>

          {/* Grand Total */}

          <div className="flex items-center justify-between pt-6">
            <p className="text-xl font-bold text-gray-900">
              Grand Total
            </p>

            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(
                quote.total
              )}
            </p>
          </div>

        </div>
      </section>

      {/* ACTION BUTTONS */}

      <section className="flex flex-col gap-4 sm:flex-row">

        <button
          type="button"
          onClick={() =>
            router.push("/quotes/history")
          }
          className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-900 transition hover:bg-gray-50"
        >
          Back to Quote History
        </button>

        <button
          type="button"
          onClick={handleGeneratePDF}
          className="rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
        >
          Generate PDF
        </button>

        {quote.status === "Accepted" && (
          <button
            type="button"
            onClick={() =>
              router.push(
                `/bookings/new?quoteId=${quote.id}`
              )
            }
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700"
          >
            Create Booking
          </button>
        )}

      </section>

    </div>
  </main>
</CRMLayout>


);
}