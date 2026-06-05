"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isVerifiedUser: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  isVerifiedUser: false,
  isAuthenticated: false,
});

export function AuthProvider({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser | null;
}) {
  const value: AuthContextValue = {
    user,
    isAdmin: user?.role === "ADMIN",
    isVerifiedUser:
      user?.role === "ADMIN" || user?.role === "VERIFIED_USER",
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
