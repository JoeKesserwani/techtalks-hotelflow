import { checkAuth } from "@/lib/middleware/checkAuth";

export default async function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await checkAuth();

  return children;
}