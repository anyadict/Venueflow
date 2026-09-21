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

    // Basic validation
    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!["manager", "staff"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid team role." },
        { status: 400 }
      );
    }

    // Get the authorization header sent by the browser
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Verify the logged-in user
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

    // Get the user's profile
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

    // Only owners and managers can invite staff
    if (!["owner", "manager"].includes(profile.role)) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to invite team members.",
        },
        { status: 403 }
      );
    }

    // Prevent inviting yourself
    if (user.email?.toLowerCase() === email) {
      return NextResponse.json(
        { error: "You cannot invite yourself." },
        { status: 400 }
      );
    }

    // Check whether this email is already a team member
    const { data: existingMember } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("venue_id", profile.venue_id)
      .ilike("email", email)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: "This person is already a team member." },
        { status: 409 }
      );
    }

    // Check for an existing pending invitation
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

    // Create our invitation record
    const { data: invitation, error: invitationError } =
      await supabaseAdmin
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

    // Send Supabase authentication invitation
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

      // Remove our invitation record if email sending failed
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