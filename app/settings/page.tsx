"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "../components/CRMLayout";

type Venue = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  currency: string;
  default_start_time: string;
  default_end_time: string;
};

export default function SettingsPage() {
  const router = useRouter();

  const [venue, setVenue] =
    useState<Venue | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * Load the logged-in user's venue.
   */
  useEffect(() => {
    async function loadVenue() {
      setLoading(true);
      setErrorMessage("");

      const user =
        await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * Find the venue connected
       * to the user's profile.
       */
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("venue_id")
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile?.venue_id
      ) {
        console.error(
          "PROFILE ERROR:",
          profileError
        );

        setErrorMessage(
          "Unable to identify your venue."
        );

        setLoading(false);
        return;
      }

      /*
       * Load only the user's venue.
       */
      const {
        data: venueData,
        error: venueError,
      } = await supabase
        .from("venues")
        .select(
          `
          id,
          name,
          email,
          phone,
          address,
          logo_url,
          website,
          description,
          currency,
          default_start_time,
          default_end_time
          `
        )
        .eq("id", profile.venue_id)
        .single();

      if (
        venueError ||
        !venueData
      ) {
        console.error(
          "VENUE ERROR:",
          venueError
        );

        setErrorMessage(
          "Unable to load venue settings."
        );

        setLoading(false);
        return;
      }

      setVenue(venueData);
      setLoading(false);
    }

    loadVenue();
  }, [router]);

  /*
   * Handle form changes.
   */
  function handleChange(
    field: keyof Venue,
    value: string
  ) {
    setVenue((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });

    setMessage("");
    setErrorMessage("");
  }

  /*
   * Save venue settings.
   */
  async function handleSave(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!venue) {
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    /*
     * Validate booking hours.
     */
    if (
      !venue.default_start_time ||
      !venue.default_end_time
    ) {
      setErrorMessage(
        "Please provide both default booking start and end times."
      );

      setSaving(false);
      return;
    }

    if (
      venue.default_end_time <=
      venue.default_start_time
    ) {
      setErrorMessage(
        "Default booking end time must be later than the start time."
      );

      setSaving(false);
      return;
    }

    const user =
      await getCurrentUser();

    if (!user) {
      router.push("/login");
      return;
    }

    /*
     * Confirm the venue belongs
     * to the logged-in user.
     */
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("venue_id")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.venue_id
    ) {
      setErrorMessage(
        "Unable to verify your venue."
      );

      setSaving(false);
      return;
    }

    /*
     * Update only the venue connected
     * to the authenticated user.
     */
    const { error } = await supabase
      .from("venues")
      .update({
        name: venue.name.trim(),

        email:
          venue.email?.trim() || null,

        phone:
          venue.phone?.trim() || null,

        address:
          venue.address?.trim() || null,

        website:
          venue.website?.trim() || null,

        description:
          venue.description?.trim() || null,

        currency:
          venue.currency || "NGN",

        default_start_time:
          venue.default_start_time,

        default_end_time:
          venue.default_end_time,
      })
      .eq(
        "id",
        profile.venue_id
      );

    if (error) {
      console.error(
        "VENUE UPDATE ERROR:",
        error
      );

      setErrorMessage(
        `Unable to save settings: ${error.message}`
      );

      setSaving(false);
      return;
    }

    setMessage(
      "Venue settings saved successfully."
    );

    setSaving(false);
  }

  if (loading) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-100 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border bg-white p-8 shadow-sm">
              <p className="text-gray-500">
                Loading venue settings...
              </p>
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  if (!venue) {
    return (
      <CRMLayout>
        <main className="min-h-screen bg-gray-100 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              {errorMessage ||
                "Venue settings could not be loaded."}
            </div>
          </div>
        </main>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-4xl">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Venue Settings
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your venue's business information and booking preferences.
            </p>
          </div>

          {/* Messages */}
          {message && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
              {message}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Settings Form */}
          <form
            onSubmit={handleSave}
            className="space-y-6"
          >

            {/* Business Information */}
            <section className="rounded-xl border bg-white p-6 shadow-sm">

              <h2 className="text-xl font-bold text-gray-900">
                Business Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Basic information about your venue.
              </p>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                {/* Venue Name */}
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Venue Name
                  </label>

                  <input
                    type="text"
                    value={venue.name}
                    onChange={(e) =>
                      handleChange(
                        "name",
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Business Email
                  </label>

                  <input
                    type="email"
                    value={venue.email || ""}
                    onChange={(e) =>
                      handleChange(
                        "email",
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Phone Number
                  </label>

                  <input
                    type="text"
                    value={venue.phone || ""}
                    onChange={(e) =>
                      handleChange(
                        "phone",
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Address
                  </label>

                  <textarea
                    value={venue.address || ""}
                    onChange={(e) =>
                      handleChange(
                        "address",
                        e.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Website
                  </label>

                  <input
                    type="url"
                    value={venue.website || ""}
                    onChange={(e) =>
                      handleChange(
                        "website",
                        e.target.value
                      )
                    }
                    placeholder="https://example.com"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Currency
                  </label>

                  <select
                    value={venue.currency}
                    onChange={(e) =>
                      handleChange(
                        "currency",
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  >
                    <option value="NGN">
                      Nigerian Naira (₦)
                    </option>

                    <option value="USD">
                      US Dollar ($)
                    </option>

                    <option value="GBP">
                      British Pound (£)
                    </option>

                    <option value="EUR">
                      Euro (€)
                    </option>
                  </select>
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Description
                  </label>

                  <textarea
                    value={
                      venue.description || ""
                    }
                    onChange={(e) =>
                      handleChange(
                        "description",
                        e.target.value
                      )
                    }
                    rows={4}
                    placeholder="Tell clients about your venue..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

              </div>

            </section>

            {/* Booking Settings */}
            <section className="rounded-xl border bg-white p-6 shadow-sm">

              <h2 className="text-xl font-bold text-gray-900">
                Booking Settings
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Set the default hours used when creating new bookings.
              </p>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                {/* Default Start Time */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Default Start Time
                  </label>

                  <input
                    type="time"
                    value={
                      venue.default_start_time.slice(
                        0,
                        5
                      )
                    }
                    onChange={(e) =>
                      handleChange(
                        "default_start_time",
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Example: 9:00 AM
                  </p>
                </div>

                {/* Default End Time */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Default End Time
                  </label>

                  <input
                    type="time"
                    value={
                      venue.default_end_time.slice(
                        0,
                        5
                      )
                    }
                    onChange={(e) =>
                      handleChange(
                        "default_end_time",
                        e.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Example: 5:00 PM
                  </p>
                </div>

              </div>

              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  These times will be used as the default start and end times for new bookings. You can still change the times for individual events.
                </p>
              </div>

            </section>

            {/* Logo */}
            <section className="rounded-xl border bg-white p-6 shadow-sm">

              <h2 className="text-xl font-bold text-gray-900">
                Venue Logo
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Logo uploading will be added in the next stage.
              </p>

              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">

                <p className="text-sm text-gray-500">
                  Logo upload coming soon
                </p>

              </div>

            </section>

            {/* Save */}
            <div className="flex justify-end">

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Save Settings"}
              </button>

            </div>

          </form>

        </div>
      </main>
    </CRMLayout>
  );
}