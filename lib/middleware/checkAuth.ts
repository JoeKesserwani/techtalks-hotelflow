import { redirect } from "next/navigation";
import { requireAuth, type Role } from "./requireAuth";

export async function checkAuth(options?: { roles?: Role[] }) {
  const user = await requireAuth(options);

  if (!user) {
    redirect("/");
  }

  return user;
}