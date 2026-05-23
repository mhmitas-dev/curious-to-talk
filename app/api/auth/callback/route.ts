import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  // Use NEXT_PUBLIC_SITE_URL to handle Nginx proxy configurations correctly,
  // falling back to request origin if not set.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Sync Google OAuth display name to the public.profiles table
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name;

        const avatarUrl =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture;

        if (name || avatarUrl) {
          const updatePayload: Record<string, string> = {};
          if (name) updatePayload.display_name = name;
          if (avatarUrl) updatePayload.avatar_url = avatarUrl;

          await supabase
            .from("profiles")
            .update(updatePayload)
            .eq("id", user.id);
        }
      }

      // Redirect to the intended path
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
