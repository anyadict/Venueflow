"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import CRMLayout from "@/app/components/CRMLayout";

type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export default function TeamPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [venueId, setVenueId] = useState("");

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTeam() {
    setLoading(true);
    setError("");

    const user = await getCurrentUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("venue_id, email")
        .eq("id", user.id)
        .single();

    if (!profileError && profile && !profile.email) {
      const { error: emailUpdateError } =
        await supabase
          .from("profiles")
          .update({
            email: user.email,
          })
          .eq("id", user.id);

      if (emailUpdateError) {
        console.error(
          "PROFILE EMAIL UPDATE ERROR:",
          emailUpdateError
        );
      }
    }

    if (profileError || !profile) {
      console.error("PROFILE ERROR:", profileError);
      setError("Unable to load your venue profile.");
      setLoading(false);
      return;
    }

    setVenueId(profile.venue_id);

    const { data: memberData, error: memberError } =
      await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("venue_id", profile.venue_id)
        .order("created_at", {
          ascending: true,
        });

    if (memberError) {
      console.error("TEAM MEMBER ERROR:", memberError);
      setError("Unable to load team members.");
    } else {
      setMembers(memberData || []);
    }

    const { data: invitationData, error: invitationError } =
      await supabase
        .from("team_invitations")
        .select(
          "id, email, role, status, expires_at, created_at"
        )
        .eq("venue_id", profile.venue_id)
        .order("created_at", {
          ascending: false,
        });

    if (invitationError) {
      console.error(
        "INVITATION ERROR:",
        invitationError
      );
    } else {
      setInvitations(invitationData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTeam();
  }, []);

  async function handleInvitation() {
    setMessage("");
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter an email address.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!venueId) {
      setError("Venue information is not available.");
      return;
    }

    // Client-side duplicate check for faster feedback.
    // The API route performs the secure server-side check as well.
    const alreadyMember = members.some(
      (member) =>
        member.email?.toLowerCase() === cleanEmail
    );

    if (alreadyMember) {
      setError(
        "This person is already a team member."
      );
      return;
    }

    setSaving(true);

    try {
      // Get the current authenticated session.
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError(
          "Your session has expired. Please log in again."
        );
        return;
      }

      // Send the invitation request to our secure server route.
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Unable to send invitation."
        );
        return;
      }

      setEmail("");
      setRole("staff");

      setMessage(
        result.message ||
          "Invitation sent successfully."
      );

      await loadTeam();
    } catch (error) {
      console.error(
        "INVITATION REQUEST ERROR:",
        error
      );

      setError(
        "Something went wrong while sending the invitation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvitation(
    invitationId: string
  ) {
    setMessage("");
    setError("");

    const { error: updateError } =
      await supabase
        .from("team_invitations")
        .update({
          status: "cancelled",
        })
        .eq("id", invitationId)
        .eq("venue_id", venueId);

    if (updateError) {
      console.error(
        "CANCEL INVITATION ERROR:",
        updateError
      );

      setError(
        updateError.message ||
          "Unable to cancel invitation."
      );

      return;
    }

    setMessage("Invitation cancelled.");

    await loadTeam();
  }

  function formatDate(date: string | null) {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleDateString(
      "en-NG",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  if (loading) {
    return (
      <CRMLayout>
        <div className="p-8">
          <p className="text-gray-500">
            Loading team members...
          </p>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Team Members
          </h1>

          <p className="mt-2 text-gray-600">
            Manage the people who have access to your
            venue.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">

          <h2 className="text-xl font-semibold text-gray-900">
            Invite Team Member
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Create an invitation for a manager or
            staff member.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="staff@example.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Role
              </label>

              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-black"
              >
                <option value="staff">
                  Staff
                </option>

                <option value="manager">
                  Manager
                </option>
              </select>
            </div>

          </div>

          <button
            type="button"
            onClick={handleInvitation}
            disabled={saving}
            className="mt-5 rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Sending invitation..."
              : "Send Invitation"}
          </button>

        </div>

        <div className="mb-8 rounded-xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Current Team
            </h2>
          </div>

          {members.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No team members found.
            </div>
          ) : (
            <div className="divide-y">

              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between"
                >

                  <div>
                    <p className="font-medium text-gray-900">
                      {member.full_name ||
                        "Unnamed User"}
                    </p>

                    <p className="text-sm text-gray-500">
                      {member.email ||
                        "Email not available"}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700">
                    {member.role}
                  </span>

                </div>
              ))}

            </div>
          )}

        </div>

        <div className="rounded-xl border bg-white shadow-sm">

          <div className="border-b px-6 py-5">
            <h2 className="text-xl font-semibold text-gray-900">
              Pending Invitations
            </h2>
          </div>

          {invitations.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              No invitations found.
            </div>
          ) : (
            <div className="divide-y">

              {invitations.map(
                (invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                  >

                    <div>
                      <p className="font-medium text-gray-900">
                        {invitation.email}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Role:{" "}
                        <span className="capitalize">
                          {invitation.role}
                        </span>
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        Created:{" "}
                        {formatDate(
                          invitation.created_at
                        )}
                      </p>

                      <p className="text-xs text-gray-400">
                        Expires:{" "}
                        {formatDate(
                          invitation.expires_at
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                          invitation.status ===
                          "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : invitation.status ===
                                "accepted"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {invitation.status}
                      </span>

                      {invitation.status ===
                        "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            cancelInvitation(
                              invitation.id
                            )
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      )}

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>

      </div>
    </CRMLayout>
  );
}