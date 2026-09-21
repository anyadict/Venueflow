"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Package = {
  id: string;
  venue_id: string;
  name: string;
  category: string;
  price: number;
  pricing_type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export default function QuoteBuilder() {
  const router = useRouter();

  const [clientName, setClientName] = useState("");
  const [guests, setGuests] = useState("");

  const [catering, setCatering] = useState("");
  const [bar, setBar] = useState("");

  const [decoration, setDecoration] = useState(false);
  const [dj, setDj] = useState(false);
  const [photography, setPhotography] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Venue
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  // Packages
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  const guestCount = Number(guests) || 0;

  // --------------------------------------------------
  // PACKAGE FILTERS
  // --------------------------------------------------

  const cateringPackages = packages.filter(
    (item) =>
      item.category === "Catering" &&
      item.is_active
  );

  const barPackages = packages.filter(
    (item) =>
      item.category === "Bar" &&
      item.is_active
  );

  const decorationPackages = packages.filter(
    (item) =>
      item.category === "Decoration" &&
      item.is_active
  );

  const djPackages = packages.filter(
    (item) =>
      item.category === "DJ" &&
      item.is_active
  );

  const photographyPackages = packages.filter(
    (item) =>
      item.category === "Photography" &&
      item.is_active
  );

  // --------------------------------------------------
  // SELECTED PACKAGES
  // --------------------------------------------------

  const selectedCatering = cateringPackages.find(
    (item) => item.id === catering
  );

  const selectedBar = barPackages.find(
    (item) => item.id === bar
  );

  const selectedDecoration =
    decorationPackages[0];

  const selectedDj = djPackages[0];

  const selectedPhotography =
    photographyPackages[0];

  // --------------------------------------------------
  // CALCULATIONS
  // --------------------------------------------------

  const cateringPrice =
    selectedCatering?.price || 0;

  const barPrice =
    selectedBar?.price || 0;

  const cateringTotal =
    selectedCatering?.pricing_type ===
    "per_guest"
      ? guestCount * cateringPrice
      : cateringPrice;

  const barTotal =
    selectedBar?.pricing_type ===
    "per_guest"
      ? guestCount * barPrice
      : barPrice;

  const decorationTotal =
    decoration && selectedDecoration
      ? selectedDecoration.pricing_type ===
        "per_guest"
        ? guestCount *
          selectedDecoration.price
        : selectedDecoration.price
      : 0;

  const djTotal =
    dj && selectedDj
      ? selectedDj.pricing_type ===
        "per_guest"
        ? guestCount * selectedDj.price
        : selectedDj.price
      : 0;

  const photographyTotal =
    photography && selectedPhotography
      ? selectedPhotography.pricing_type ===
        "per_guest"
        ? guestCount *
          selectedPhotography.price
        : selectedPhotography.price
      : 0;

  const total =
    cateringTotal +
    barTotal +
    decorationTotal +
    djTotal +
    photographyTotal;

  // --------------------------------------------------
  // CURRENCY
  // --------------------------------------------------

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // --------------------------------------------------
  // LOAD USER'S VENUE AND PACKAGES
  // --------------------------------------------------

  useEffect(() => {
    async function loadUserData() {
      setLoadingVenue(true);
      setLoadingPackages(true);
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
        setLoadingPackages(false);

        return;
      }

      if (!profile?.venue_id) {
        setErrorMessage(
          "Your account is not connected to a venue."
        );

        setLoadingVenue(false);
        setLoadingPackages(false);

        return;
      }

      const currentVenueId =
        profile.venue_id;

      setVenueId(currentVenueId);
      setLoadingVenue(false);

      // Load only this venue's active packages
      const {
        data: packageData,
        error: packageError,
      } = await supabase
        .from("packages")
        .select("*")
        .eq("venue_id", currentVenueId)
        .eq("is_active", true)
        .order("created_at", {
          ascending: true,
        });

      if (packageError) {
        console.error(
          "PACKAGES LOAD ERROR:",
          packageError
        );

        setErrorMessage(
          `Unable to load your packages: ${packageError.message}`
        );
      } else {
        setPackages(packageData || []);
      }

      setLoadingPackages(false);
    }

    loadUserData();
  }, [router]);

  // --------------------------------------------------
  // SAVE QUOTE
  // --------------------------------------------------

  async function handleSaveQuote() {
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    if (!venueId) {
      setSaving(false);

      setErrorMessage(
        "Unable to determine your venue. Please log in again."
      );

      return;
    }

    if (!clientName.trim()) {
      setSaving(false);

      setErrorMessage(
        "Please enter the client's name."
      );

      return;
    }

    if (guestCount <= 0) {
      setSaving(false);

      setErrorMessage(
        "Please enter a valid number of guests."
      );

      return;
    }

    if (
      cateringPackages.length > 0 &&
      !selectedCatering
    ) {
      setSaving(false);

      setErrorMessage(
        "Please select a catering package."
      );

      return;
    }

    const { error } = await supabase
      .from("quotes")
      .insert({
        venue_id: venueId,

        client_name: clientName.trim(),
        guests: guestCount,

        catering_package:
          selectedCatering?.name || "None",
        catering_total: cateringTotal,

        bar_package:
          selectedBar?.name || "None",
        bar_total: barTotal,

        decoration: decoration,
        decoration_total: decorationTotal,

        dj: dj,
        dj_total: djTotal,

        photography: photography,
        photography_total:
          photographyTotal,

        total: total,

        status: "Draft",
      });

    setSaving(false);

    if (error) {
      console.error(
        "SUPABASE QUOTE ERROR:",
        error
      );

      setErrorMessage(
        `Unable to save quote: ${error.message}`
      );

      return;
    }

    setMessage(
      "Quote saved successfully!"
    );

    setClientName("");
    setGuests("");

    setCatering(
      cateringPackages[0]?.id || ""
    );

    setBar("");

    setDecoration(false);
    setDj(false);
    setPhotography(false);
  }

  // --------------------------------------------------
  // LOADING UI
  // --------------------------------------------------

  if (
    loadingVenue ||
    loadingPackages
  ) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-100 p-8">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
              <p className="text-gray-500">
                Loading your packages...
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
        <div className="mx-auto max-w-5xl">

          {/* Page Header */}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Quote Builder
            </h1>

            <p className="mt-2 text-gray-600">
              Create and calculate quotes
              for wedding and event clients.
            </p>
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

          {/* No Packages Warning */}

          {packages.length === 0 && (
            <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
              <p className="font-medium">
                No active packages have been
                added yet.
              </p>

              <p className="mt-1 text-sm">
                Add packages from Packages &
                Services before creating quotes.
              </p>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-3">

            {/* Quote Form */}

            <section className="lg:col-span-2">
              <div className="rounded-xl border bg-white p-8 shadow-sm">

                <h2 className="mb-6 text-xl font-bold text-gray-900">
                  Quote Details
                </h2>

                <div className="space-y-6">

                  {/* Client Name */}

                  <div>
                    <label
                      htmlFor="clientName"
                      className="mb-2 block font-medium text-gray-900"
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
                      placeholder="e.g. Sarah Johnson"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                    />
                  </div>

                  {/* Number of Guests */}

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

                  {/* Catering */}

                  <div>
                    <label
                      htmlFor="catering"
                      className="mb-2 block font-medium text-gray-900"
                    >
                      Catering Package
                    </label>

                    <select
                      id="catering"
                      value={catering}
                      onChange={(event) =>
                        setCatering(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                    >
                      <option value="">
                        Select catering package
                      </option>

                      {cateringPackages.map(
                        (item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name} —{" "}
                            {formatCurrency(
                              item.price
                            )}
                            {item.pricing_type ===
                            "per_guest"
                              ? " / guest"
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Bar */}

                  <div>
                    <label
                      htmlFor="bar"
                      className="mb-2 block font-medium text-gray-900"
                    >
                      Bar Package
                    </label>

                    <select
                      id="bar"
                      value={bar}
                      onChange={(event) =>
                        setBar(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
                    >
                      <option value="">
                        None
                      </option>

                      {barPackages.map(
                        (item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name} —{" "}
                            {formatCurrency(
                              item.price
                            )}
                            {item.pricing_type ===
                            "per_guest"
                              ? " / guest"
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Extras */}

                  <div>
                    <h3 className="mb-4 font-medium text-gray-900">
                      Additional Services
                    </h3>

                    <div className="space-y-4">

                      {/* Decoration */}

                      {selectedDecoration && (
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">
                              {selectedDecoration.name}
                            </p>

                            <p className="text-sm text-gray-500">
                              {formatCurrency(
                                selectedDecoration.price
                              )}

                              {selectedDecoration.pricing_type ===
                              "per_guest"
                                ? " / guest"
                                : ""}
                            </p>
                          </div>

                          <input
                            type="checkbox"
                            checked={decoration}
                            onChange={(event) =>
                              setDecoration(
                                event.target.checked
                              )
                            }
                            className="h-5 w-5"
                          />
                        </label>
                      )}

                      {/* DJ */}

                      {selectedDj && (
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">
                              {selectedDj.name}
                            </p>

                            <p className="text-sm text-gray-500">
                              {formatCurrency(
                                selectedDj.price
                              )}

                              {selectedDj.pricing_type ===
                              "per_guest"
                                ? " / guest"
                                : ""}
                            </p>
                          </div>

                          <input
                            type="checkbox"
                            checked={dj}
                            onChange={(event) =>
                              setDj(
                                event.target.checked
                              )
                            }
                            className="h-5 w-5"
                          />
                        </label>
                      )}

                      {/* Photography */}

                      {selectedPhotography && (
                        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900">
                              {
                                selectedPhotography.name
                              }
                            </p>

                            <p className="text-sm text-gray-500">
                              {formatCurrency(
                                selectedPhotography.price
                              )}

                              {selectedPhotography.pricing_type ===
                              "per_guest"
                                ? " / guest"
                                : ""}
                            </p>
                          </div>

                          <input
                            type="checkbox"
                            checked={
                              photography
                            }
                            onChange={(
                              event
                            ) =>
                              setPhotography(
                                event.target
                                  .checked
                              )
                            }
                            className="h-5 w-5"
                          />
                        </label>
                      )}

                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* Quote Summary */}

            <section>
              <div className="sticky top-8 rounded-xl border bg-white p-8 shadow-sm">

                <h2 className="mb-6 text-xl font-bold text-gray-900">
                  Quote Summary
                </h2>

                <div className="space-y-4">

                  {/* Catering Total */}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Catering
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatCurrency(
                        cateringTotal
                      )}
                    </span>
                  </div>

                  {/* Bar Total */}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Bar
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatCurrency(
                        barTotal
                      )}
                    </span>
                  </div>

                  {/* Decoration */}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Decoration
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatCurrency(
                        decorationTotal
                      )}
                    </span>
                  </div>

                  {/* DJ */}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      DJ
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatCurrency(
                        djTotal
                      )}
                    </span>
                  </div>

                  {/* Photography */}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      Photography
                    </span>

                    <span className="font-medium text-gray-900">
                      {formatCurrency(
                        photographyTotal
                      )}
                    </span>
                  </div>

                  {/* Divider */}

                  <div className="border-t pt-5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        Total
                      </span>

                      <span className="text-2xl font-bold text-gray-900">
                        {formatCurrency(
                          total
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Save Button */}

                  <button
                    type="button"
                    onClick={
                      handleSaveQuote
                    }
                    disabled={
                      saving || !venueId
                    }
                    className="mt-4 w-full rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Quote"}
                  </button>

                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </CRMLayout>
  );
}