import { requireAdminProfile } from "@/lib/auth/server";

// Guards all /admin/* routes — non-admins are sent home.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminProfile();

  return <>{children}</>;
}
