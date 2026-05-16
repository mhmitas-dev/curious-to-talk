import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// If user is already logged in, send them home.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/");
  }

  return <>{children}</>;
}
