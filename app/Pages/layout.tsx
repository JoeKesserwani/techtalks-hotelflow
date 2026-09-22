import { checkAuth } from "@/lib/middleware/checkAuth";
import Sidebar from "@/components/Navbars/navbar";
import styles from "./pages-layout.module.css";

export default async function PagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await checkAuth();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.content}>{children}</div>
    </div>
  );
}