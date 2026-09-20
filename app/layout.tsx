import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
//added auth provider to wrap the entire app with authentication context
import { AuthProvider } from "@/components/Auth/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HotelFlow",
  description: "HotelFlow is a platform that helps hotels manage their operations efficiently and effectively. It provides tools for booking management, guest communication, and staff coordination, all in one easy-to-use interface.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >  
{/* /*Added AuthProvider to the body to provide authentication context to the entire app*/ }

     <body className="min-h-full flex flex-col">
       <AuthProvider>
         {children}
       </AuthProvider>
     </body>
      {/* <body className="min-h-full flex flex-col">{children}</body> */}
    </html>
  );
}
