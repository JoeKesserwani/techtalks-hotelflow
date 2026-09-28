import { redirect } from "next/navigation";
import { requireAuth } from "../../../lib/middleware/requireAuth";

// The activity log exposes who did what across the whole hotel,
// so only managers may open it (the API enforces the same rule).
export default async function ActivityLogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth({ roles: ["MANAGER", "ADMIN"] });

  if (!session) {
    redirect("/");
  }

  return <>{children}</>;
}
