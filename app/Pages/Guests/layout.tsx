import { redirect } from "next/navigation";
import { requireAuth } from "../../../lib/middleware/requireAuth";

export default async function GuestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth({
    roles: ["MANAGER", "RECEPTIONIST", "ADMIN"],
  });

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
