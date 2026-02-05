"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useValidateSession, useLogout } from "@/lib/hooks/useAuth";
import { JWTPayload } from "@/lib/types/auth";
import { jwtDecode } from "jwt-decode";

interface AuthContextType {
  user: JWTPayload | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize token and user from localStorage using lazy initialization
  const initializeAuth = () => {
    if (typeof window === "undefined") {
      return { token: null, user: null };
    }
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      try {
        const decoded = jwtDecode<JWTPayload>(storedToken);
        return { token: storedToken, user: decoded };
      } catch {
        localStorage.removeItem("auth_token");
        return { token: null, user: null };
      }
    }
    return { token: null, user: null };
  };

  const initialAuth = initializeAuth();
  const [token, setToken] = useState<string | null>(initialAuth.token);

  // Derive user from token using useMemo
  const derivedUser = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode<JWTPayload>(token);
    } catch {
      return null;
    }
  }, [token]);

  // Listen for storage changes (when token is set in another tab/window or custom event)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth_token") {
        const storedToken = e.newValue;
        if (storedToken) {
          try {
            jwtDecode<JWTPayload>(storedToken); // Validate token
            setToken(storedToken);
            // User will be derived from token via useMemo
          } catch {
            setToken(null);
          }
        } else {
          setToken(null);
        }
      }
    };

    // Listen for custom storage event (for same-tab updates)
    const handleCustomStorageChange = () => {
      const storedToken = localStorage.getItem("auth_token");
      if (storedToken) {
        try {
          jwtDecode<JWTPayload>(storedToken); // Validate token
          setToken(storedToken);
          // User will be derived from token via useMemo
        } catch {
          localStorage.removeItem("auth_token");
          setToken(null);
        }
      } else {
        setToken(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-storage-change", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "auth-storage-change",
        handleCustomStorageChange
      );
    };
  }, []);

  // Validate session
  const { data: sessionData, isLoading: isValidating } = useValidateSession();
  const logoutMutation = useLogout();

  const logout = () => {
    logoutMutation.mutate();
    setToken(null);
  };

  // For initial load, if we have a token and user, consider authenticated
  // Session validation will happen in the background
  const isAuthenticated = Boolean(
    !!token &&
      !!derivedUser &&
      (sessionData?.valid ?? (!!token && !!derivedUser && !isValidating))
  );

  const value: AuthContextType = {
    user: derivedUser,
    token,
    isLoading: isValidating,
    isAuthenticated,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
