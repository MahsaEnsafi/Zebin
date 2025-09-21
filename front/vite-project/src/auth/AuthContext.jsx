// src/context/AuthContext.jsx
/**
 * Context احراز هویت (Auth)
 * - نگه‌داری توکن دسترسی و آبجکت کاربر در سراسـر اپ
 * - لاگین/لاگ‌اوت
 * - همگام‌سازی وضعیت بین تب‌ها (storage event)
 * - واکشی پروفایل کاربر (/users/me) هنگام تغییر توکن
 *
 * نکته‌ها:
 * 1) این پیاده‌سازی «توکن» را در localStorage یا sessionStorage نگه می‌دارد.
 * 2) اگر بک‌اند شما نیاز به هدر/فرمت خاص دارد، قسمت login را با API خود هماهنگ کنید.
 * 3) مقدار BASE از VITE_API_BASE خوانده می‌شود (در .env فرانت تنظیم کنید).
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/** آدرس پایه‌ی API (از Vite env یا پیش‌فرض لوکال) */
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/** ساخت Context ساده برای اشتراک‌گذاری وضعیت Auth */
const AuthContext = createContext(null);

/** خواندن توکن ذخیره‌شده از localStorage یا sessionStorage */
const readToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  "";

/**
 * <AuthProvider />
 * روتِ Provider برای احراز هویت که اطراف کل اپ پیچیده می‌شود.
 * state ها:
 *  - token: رشته‌ی JWT/Bearer
 *  - user: آبجکت کاربر دریافتی از /users/me
 *  - loadingUser: وضعیت در حال واکشی پروفایل
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  /**
   * fetchMe(t?)
   * پروفایل کاربر را از /users/me می‌گیرد و در state می‌گذارد.
   * اگر توکن نداشتیم، user را null می‌کند.
   */
  async function fetchMe(t = token) {
    if (!t) {
      setUser(null);
      return;
    }
    setLoadingUser(true);
    try {
      const res = await fetch(`${BASE}/users/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) throw new Error();
      setUser(await res.json());
    } catch {
      // اگر توکن نامعتبر/منقضی بود:
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  /**
   * login(username, password, remember=true)
   * درخواست ورود را به بک‌اند می‌زند و در صورت موفقیت:
   *  - توکن را در localStorage (یا sessionStorage) ذخیره می‌کند
   *  - state توکن را آپدیت می‌کند
   *  - بلافاصله پروفایل کاربر را می‌گیرد
   *
   * نکته: اینجا از x-www-form-urlencoded استفاده شده؛
   * اگر بک‌اند شما JSON می‌گیرد، هدر/بدنه را مطابق تغییر دهید.
   */
  async function login(username, password, remember = true) {
    const body = new URLSearchParams();
    body.append("username", (username || "").trim().toLowerCase());
    body.append("password", password || "");

    const res = await fetch(`${BASE}/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      // تلاش برای استخراج پیام خطا از بدنه‌ی JSON
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.detail) msg = Array.isArray(j.detail) ? j.detail[0]?.msg || msg : j.detail;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json(); // انتظار: { access_token, token_type }
    const tok = data.access_token;

    // ذخیره‌ی توکن در storage مناسب
    if (remember) {
      localStorage.setItem("access_token", tok);
      sessionStorage.removeItem("access_token");
    } else {
      sessionStorage.setItem("access_token", tok);
      localStorage.removeItem("access_token");
    }

    setToken(tok);
    await fetchMe(tok); // پس از ورود، پروفایل را بگیر
    return data;
  }

  /**
   * logout()
   * پاک‌کردن توکن از هر دو storage و ریست state ها
   */
  function logout() {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    setToken("");
    setUser(null);
  }

  /**
   * همگام‌سازی بین تب‌ها:
   * اگر در تب دیگری login/logout انجام شود (storage تغییر کند)،
   * این تب نیز token را مجدداً می‌خواند.
   */
  useEffect(() => {
    const onStorage = () => {
      const t = readToken();
      setToken(t);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   * هر بار token تغییر کرد، تلاش کن پروفایل تازه بگیری.
   * (اگر token خالی شود، fetchMe کاربر را null می‌کند)
   */
  useEffect(() => {
    fetchMe(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /** آبجکت مقدار Context؛ با useMemo برای جلوگیری از رندرهای بیهوده */
  const value = useMemo(
    () => ({
      BASE,            // برای دسترسی ساده در مصرف‌کننده‌ها
      token,           // توکن فعلی
      user,            // آبجکت کاربر (یا null)
      loadingUser,     // وضعیت بارگذاری /users/me
      login,           // تابع ورود
      logout,          // تابع خروج
      refreshUser: fetchMe, // دریافت مجدد پروفایل روی تقاضا
    }),
    [token, user, loadingUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * هوک دسترسی به AuthContext
 * مصرف: const { token, user, login, logout } = useAuth();
 */
export const useAuth = () => useContext(AuthContext);
