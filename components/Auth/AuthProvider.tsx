"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
  hotelLoading: boolean;
  hotelError: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hotel, setHotel] = useState<HotelInfo | null>(null);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const hotelLoading = Boolean(user && !hotel && !hotelError);

  const setUser = useCallback((nextUser: CurrentUser | null) => {
    setUserState(nextUser);
    setHotel(null);
    setHotelError(null);
  }, []);

  useEffect(() => {
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
  }, [setUser]);

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
