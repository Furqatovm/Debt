"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "@/lib/api";
import type { Me } from "@/lib/types";
import { ToastHost } from "./ui";
import { SmsHost } from "./sms";

// sms: administrator SMS yuborishni yoqib qo'yganmi (o'chirilgan bo'lsa SMS tugmalari ko'rinmaydi)
type Ctx = {
  me: Me;
  reload: () => void;
  logout: () => void;
  can: (perm: string) => boolean;
  sms: boolean;
};
const SessionCtx = createContext<Ctx | null>(null);

let cachedMe: Me | null = null;
let cachedToken: string | null = null;
let meRequest: Promise<Me | null> | null = null;

export function useSession() {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession faqat SessionProvider ichida ishlaydi");
  return ctx;
}

/** Do'kon xodimlari uchun sessiya: token bo'lmasa /login sahifasiga yo'naltiradi */
export function SessionProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(cachedMe);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = getToken();
    if (!token) {
      cachedMe = null;
      cachedToken = null;
      router.replace("/login");
      return;
    }
    if (cachedToken !== token) {
      cachedMe = null;
      cachedToken = token;
      setMe(null);
      setError(null);
    }
    if (cachedMe) {
      setMe(cachedMe);
      return;
    }
    if (meRequest) {
      meRequest.then((m) => m && setMe(m)).catch((e) => setError(e.message));
      return;
    }
    meRequest = api<Me>("/auth/me")
      .then((m) => {
        if (!m.store) {
          router.replace("/admin");
          return null;
        }
        cachedMe = m;
        setMe(m);
        return m;
      })
      .catch((e: Error) => {
        setError(e.message);
        return null;
      })
      .finally(() => {
        meRequest = null;
      });
  }, [router]);

  useEffect(load, [load]);

  const logout = useCallback(() => {
    cachedMe = null;
    cachedToken = null;
    meRequest = null;
    setMe(null);
    setToken(null);
    router.replace("/login");
  }, [router]);

  if (error) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
        <div className="err">{error}</div>
        <button className="btn" style={{ marginTop: 12 }} onClick={logout}>
          Qaytadan kirish
        </button>
      </div>
    );
  }
  if (!me) return <>{fallback ?? null}</>;

  return (
    <SessionCtx.Provider
      value={{
        me,
        reload: load,
        logout,
        can: (p) => !!me.permissions[p],
        sms: me.sms,
      }}
    >
      {children}
      <ToastHost />
      <SmsHost />
    </SessionCtx.Provider>
  );
}
