import { redirect } from "next/navigation";
import {
  getCurrentProfile,
  getOptionalClaims,
  throwIfUnexpectedProfileError,
} from "@/lib/auth/server";

// If user is already logged in, send them home.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getOptionalClaims();

  if (auth) {
    const { profile, error } = await getCurrentProfile(auth);
    throwIfUnexpectedProfileError(error);

    if (!profile || profile.status === "pending") {
      redirect("/pending");
    }

    redirect("/");
  }

  return <>{children}</>;
}
