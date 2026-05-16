import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Guards all /admin/* routes — non-admins are sent home.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.claims.sub)
    .single();

  if (!profile?.is_admin) redirect("/");

  return <>{children}</>;
}
