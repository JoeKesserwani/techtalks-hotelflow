"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type CurrentUser = {
  fullName: string;
  role: string;
};

export type HotelInfo = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  address: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  email: string | null;
  phone: string | null;
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  setUser: (user: CurrentUser | null) => void;
  hotel: HotelInfo | null;
  currencySymbol: string;
  setHotelCurrency: (currency: string) => void;
  hotelLoading: boolean;
  hotelError: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getCurrencySymbol(currency: string | undefined) {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    LBP: "ل.ل",
  };

  return symbols[currency ?? "USD"] ?? currency ?? "$";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(() => pathname !== "/");
  const [hotel, setHotel] = useState<HotelInfo | null>(null);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const hotelLoading = Boolean(user && !hotel && !hotelError);

  const setUser = useCallback((nextUser: CurrentUser | null) => {
    setUserState(nextUser);
    setHotel(null);
    setHotelError(null);
  }, []);
  const setHotelCurrency = useCallback((currency: string) => {
    setHotel((currentHotel) =>
      currentHotel ? { ...currentHotel, currency } : currentHotel,
    );
  }, []);

  useEffect(() => {
    if (pathname === "/" || user) return;

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/v1/auth/me");
        if (!response.ok) return;

        const data: { user: CurrentUser } = await response.json();
        setUser(data.user);
      } finally {
        setLoading(false);
      }
    }

    loadCurrentUser().catch(() => setLoading(false));
  }, [pathname, setUser, user]);

  useEffect(() => {
    if (loading || !user) return;

    const controller = new AbortController();

    async function loadHotel() {
      try {
        const response = await fetch("/api/v1/hotel", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not load hotel information.");

        const data: HotelInfo = await response.json();
        setHotel(data);
        setHotelError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setHotel(null);
        setHotelError(
          error instanceof Error
            ? error.message
            : "Could not load hotel information.",
        );
      }
    }

    void loadHotel();
    return () => controller.abort();
  }, [loading, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        hotel,
        currencySymbol: getCurrencySymbol(hotel?.currency),
        setHotelCurrency,
        hotelLoading,
        hotelError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
