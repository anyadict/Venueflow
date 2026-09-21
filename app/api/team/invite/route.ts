import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const role = String(body.role || "staff")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!["manager", "staff"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid team role." },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("venue_id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 404 }
      );
    }

    if (!["owner", "manager"].includes(profile.role)) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to invite team members.",
        },
        { status: 403 }
      );
    }

    if (user.email?.toLowerCase() === email) {
      return NextResponse.json(
        { error: "You cannot invite yourself." },
        { status: 400 }
      );
    }

    const { data: existingMember } =
      await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .eq("venue_id", profile.venue_id)
        .ilike("email", email)
        .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        {
          error:
            "This person is already a team member.",
        },
        { status: 409 }
      );
    }

    const { data: existingInvitation } =
      await supabaseAdmin
        .from("team_invitations")
        .select("id")
        .eq("venue_id", profile.venue_id)
        .ilike("email", email)
        .eq("status", "pending")
        .maybeSingle();

    if (existingInvitation) {
      return NextResponse.json(
        {
          error:
            "A pending invitation already exists for this email.",
        },
        { status: 409 }
      );
    }

    const {
      data: invitation,
      error: invitationError,
    } = await supabaseAdmin
      .from("team_invitations")
      .insert({
        venue_id: profile.venue_id,
        email,
        role,
        status: "pending",
      })
      .select()
      .single();

    if (invitationError || !invitation) {
      console.error(
        "INVITATION CREATE ERROR:",
        invitationError
      );

      return NextResponse.json(
        { error: "Could not create invitation." },
        { status: 500 }
      );
    }

    const { error: authInviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo:
            "http://localhost:3003/auth/callback",
        }
      );

    if (authInviteError) {
      console.error(
        "AUTH INVITATION ERROR:",
        authInviteError
      );

      await supabaseAdmin
        .from("team_invitations")
        .delete()
        .eq("id", invitation.id);

      return NextResponse.json(
        {
          error:
            authInviteError.message ||
            "Could not send invitation email.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Invitation sent to ${email}.`,
        invitation,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("TEAM INVITE ERROR:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}