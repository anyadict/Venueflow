"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "@/app/components/CRMLayout";

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

const categories = [
  "Catering",
  "Bar",
  "Decoration",
  "DJ",
  "Photography",
  "Other",
];

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [venueId, setVenueId] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Catering");
  const [price, setPrice] = useState("");
  const [pricingType, setPricingType] = useState("fixed");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    setLoading(true);

    const user = await getCurrentUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("venue_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("PROFILE ERROR:", profileError);
      setLoading(false);
      return;
    }

    setVenueId(profile.venue_id);

    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .eq("venue_id", profile.venue_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("PACKAGES ERROR:", error);
    } else {
      setPackages(data || []);
    }

    setLoading(false);
  }

  async function handleAddPackage(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Please enter a package name.");
      return;
    }

    if (!price || Number(price) < 0) {
      alert("Please enter a valid price.");
      return;
    }

    if (!venueId) {
      alert("Venue information could not be found.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("packages")
      .insert({
        venue_id: venueId,
        name: name.trim(),
        category,
        price: Number(price),
        pricing_type: pricingType,
        description: description.trim() || null,
        is_active: true,
      });

    if (error) {
      console.error("ADD PACKAGE ERROR:", error);
      alert("Unable to add package.");
      setSaving(false);
      return;
    }

    setName("");
    setCategory("Catering");
    setPrice("");
    setPricingType("fixed");
    setDescription("");

    await loadPackages();

    setSaving(false);
  }

  async function togglePackage(
    packageItem: Package
  ) {
    const { error } = await supabase
      .from("packages")
      .update({
        is_active: !packageItem.is_active,
      })
      .eq("id", packageItem.id)
      .eq("venue_id", venueId);

    if (error) {
      console.error("TOGGLE PACKAGE ERROR:", error);
      alert("Unable to update package.");
      return;
    }

    await loadPackages();
  }

  async function deletePackage(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this package?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("packages")
      .delete()
      .eq("id", id)
      .eq("venue_id", venueId);

    if (error) {
      console.error("DELETE PACKAGE ERROR:", error);
      alert("Unable to delete package.");
      return;
    }

    await loadPackages();
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <CRMLayout>
      <div className="p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Packages & Services
          </h1>

          <p className="mt-2 text-gray-600">
            Manage the packages and services your venue offers.
          </p>
        </div>

        {/* Add Package */}

        <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">

          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Add Package or Service
          </h2>

          <form
            onSubmit={handleAddPackage}
            className="space-y-5"
          >

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Package Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. Premium Catering"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  {categories.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Price (₦)
                </label>

                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value)
                  }
                  placeholder="e.g. 8000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Pricing Type
                </label>

                <select
                  value={pricingType}
                  onChange={(e) =>
                    setPricingType(e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                >
                  <option value="fixed">
                    Fixed Price
                  </option>

                  <option value="per_guest">
                    Per Guest
                  </option>
                </select>
              </div>

            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
                placeholder="Describe what this package includes..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Adding..."
                : "Add Package"}
            </button>

          </form>
        </div>

        {/* Package List */}

        <div className="rounded-xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Packages & Services
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">
              Loading packages...
            </div>
          ) : packages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No packages or services have been added yet.
            </div>
          ) : (
            <div className="divide-y">

              {packages.map((item) => (
                <div
                  key={item.id}
                  className="p-6"
                >

                  <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">

                    <div className="flex-1">

                      <div className="mb-2 flex flex-wrap items-center gap-3">

                        <h3 className="text-lg font-semibold text-gray-900">
                          {item.name}
                        </h3>

                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                          {item.category}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            item.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {item.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>

                      </div>

                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(item.price)}
                        {item.pricing_type ===
                          "per_guest" && (
                          <span className="ml-1 text-sm font-normal text-gray-500">
                            / guest
                          </span>
                        )}
                      </p>

                      {item.description && (
                        <p className="mt-2 text-sm text-gray-600">
                          {item.description}
                        </p>
                      )}

                    </div>

                    <div className="flex gap-3">

                      <button
                        type="button"
                        onClick={() =>
                          togglePackage(item)
                        }
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        {item.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deletePackage(item.id)
                        }
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}

        </div>

      </div>
    </CRMLayout>
  );
}