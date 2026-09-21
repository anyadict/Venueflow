"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState(
    "Processing your invitation..."
  );
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function processInvitation() {
      try {
        const hash = window.location.hash;

        if (!hash) {
          setError(
            "This invitation link is invalid or has expired."
          );
          return;
        }

        const params = new URLSearchParams(
          hash.substring(1)
        );

        const accessToken =
          params.get("access_token");

        const refreshToken =
          params.get("refresh_token");

        const authError =
          params.get("error");

        const errorDescription =
          params.get("error_description");

        if (authError) {
          setError(
            errorDescription ||
              "This invitation link is invalid or has expired."
          );
          return;
        }

        if (!accessToken || !refreshToken) {
          setError(
            "The invitation session could not be established."
          );
          return;
        }

        const {
          data,
          error: sessionError,
        } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (
          sessionError ||
          !data.session
        ) {
          console.error(
            "INVITATION SESSION ERROR:",
            sessionError
          );

          setError(
            sessionError?.message ||
              "Could not establish your invitation session."
          );

          return;
        }

        /*
         * IMPORTANT:
         *
         * We accept the invitation BEFORE changing
         * the password.
         *
         * Changing the password can invalidate the
         * current access token.
         */

        const response = await fetch(
          "/api/team/accept",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${data.session.access_token}`,
            },
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          console.error(
            "TEAM ACCEPT ERROR:",
            result
          );

          setError(
            result.error ||
              "Could not complete your team membership."
          );

          return;
        }

        setStatus(
          "Invitation accepted successfully."
        );

        setReady(true);

        // Remove authentication tokens from URL.
        window.history.replaceState(
          {},
          document.title,
          "/auth/callback"
        );
      } catch (error) {
        console.error(
          "INVITATION PROCESSING ERROR:",
          error
        );

        setError(
          "Something went wrong while processing your invitation."
        );
      }
    }

    processInvitation();
  }, []);

  async function finishAccountSetup(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");

    if (!password || !confirmPassword) {
      setError(
        "Please enter and confirm your password."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Your invitation session has expired. Please request a new invitation."
        );
        setSaving(false);
        return;
      }

      const {
        error: passwordError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (passwordError) {
        console.error(
          "PASSWORD SETUP ERROR:",
          passwordError
        );

        setError(
          passwordError.message ||
            "Could not set your password."
        );

        setSaving(false);
        return;
      }

      /*
       * Password has now been successfully created.
       *
       * The invitation and profile were already
       * accepted before this step.
       */

      router.replace("/dashboard");
    } catch (error) {
      console.error(
        "ACCOUNT SETUP ERROR:",
        error
      );

      setError(
        "Something went wrong while completing your account."
      );

      setSaving(false);
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Invitation Problem
          </h1>

          <p className="mt-4 text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/login")
            }
            className="mt-6 w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            {status}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Please wait...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Complete Your Account
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          Your invitation has been accepted.
          Create a password to finish setting up
          your VenueFlow account.
        </p>

        <form
          onSubmit={finishAccountSetup}
          className="mt-6 space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              placeholder="Confirm your password"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Completing account..."
              : "Complete Account"}
          </button>
        </form>
      </div>
    </main>
  );
}