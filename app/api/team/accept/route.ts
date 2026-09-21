import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const authHeader =
      request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (userError || !user || !user.email) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired invitation session.",
        },
        { status: 401 }
      );
    }

    const email = user.email
      .trim()
      .toLowerCase();

    const {
      data: invitation,
      error: invitationError,
    } = await supabaseAdmin
      .from("team_invitations")
      .select(
        "id, venue_id, email, role, status, expires_at"
      )
      .ilike("email", email)
      .eq("status", "pending")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (invitationError) {
      console.error(
        "INVITATION LOOKUP ERROR:",
        invitationError
      );

      return NextResponse.json(
        {
          error:
            "Could not find your invitation.",
        },
        { status: 500 }
      );
    }

    if (!invitation) {
      return NextResponse.json(
        {
          error:
            "No pending invitation was found for this email address.",
        },
        { status: 404 }
      );
    }

    if (
      invitation.expires_at &&
      new Date(invitation.expires_at) < new Date()
    ) {
      await supabaseAdmin
        .from("team_invitations")
        .update({
          status: "expired",
        })
        .eq("id", invitation.id);

      return NextResponse.json(
        {
          error:
            "This invitation has expired. Please ask the venue owner to send a new invitation.",
        },
        { status: 410 }
      );
    }

    const {
      data: existingProfile,
      error: profileLookupError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileLookupError) {
      console.error(
        "PROFILE LOOKUP ERROR:",
        profileLookupError
      );

      return NextResponse.json(
        {
          error:
            "Could not check your team profile.",
        },
        { status: 500 }
      );
    }

    if (!existingProfile) {
      const { error: profileError } =
        await supabaseAdmin
          .from("profiles")
          .insert({
            id: user.id,
            venue_id: invitation.venue_id,
            email,
            role: invitation.role,
          });

      if (profileError) {
        console.error(
          "PROFILE CREATION ERROR:",
          profileError
        );

        return NextResponse.json(
          {
            error:
              "Could not create your team profile.",
          },
          { status: 500 }
        );
      }
    }

    const { error: acceptError } =
      await supabaseAdmin
        .from("team_invitations")
        .update({
          status: "accepted",
        })
        .eq("id", invitation.id);

    if (acceptError) {
      console.error(
        "INVITATION ACCEPT ERROR:",
        acceptError
      );

      return NextResponse.json(
        {
          error:
            "Your account was created, but the invitation could not be marked as accepted.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Team membership completed successfully.",
    });
  } catch (error) {
    console.error(
      "TEAM ACCEPT ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while accepting the invitation.",
      },
      { status: 500 }
    );
  }
}