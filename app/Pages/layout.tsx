import { checkAuth } from "@/lib/middleware/checkAuth";
import PagesShell from "./PagesShell";



export default async function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await checkAuth();

  return (
    <PagesShell>{children}</PagesShell>
  );
}
