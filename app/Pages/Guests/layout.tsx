import { redirect } from "next/navigation";
import { requireAuth } from "../../../lib/middleware/requireAuth";

export default async function GuestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth({
    roles: ["ADMIN", "RECEPTIONIST", "MANAGER"],
  });

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
