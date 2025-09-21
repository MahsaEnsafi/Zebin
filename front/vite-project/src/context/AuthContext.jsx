// src/context/AuthContext.jsx
// کانتکست احراز هویت برنامه:
// - نگهداری و همگام‌سازی توکن (localStorage / sessionStorage)
// - واکشی پروفایل کاربر لاگین‌شده از /users/me
// - فراهم‌کردن login / logout برای بقیهٔ اپ
// - همگام‌سازی بین تب‌ها با رویدادهای storage و رویداد سفارشی auth:token

import { createContext, useContext, useEffect, useState } from "react";

// آدرس پایهٔ API از env، در غیر این صورت لوکال‌هاست
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// ساخت Context اولیه با مقادیر پیش‌فرض (برای autocomplete و جلوگیری از undefined)
const AuthCtx = createContext({
  token: null,         // توکن JWT فعلی (اگر کاربر لاگین باشد)
  user: null,          // آبجکت کاربر لاگین‌شده (نتیجهٔ /users/me)
  apiBase: API_BASE,   // برای اینکه کل اپ به base API دسترسی داشته باشد
  login: () => {},     // لاگین: ذخیرهٔ توکن و فعال‌کردن همگام‌سازی
  logout: () => {},    // خروج: پاک‌کردن توکن و اطلاعات کاربر
  refreshUser: () => {}, // به‌روزرسانی دستی آبجکت کاربر (در صورت نیاز)
});

// هوک میانبر برای دسترسی به مقادیر Context
export function useAuth() {
  return useContext(AuthCtx);
}

// گرفتن توکن ذخیره‌شده از localStorage یا sessionStorage (اولویت با local)
function getStoredToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    null
  );
}

// فراخوانی /users/me با توکن داده‌شده
async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ME ${res.status}`); // اگر توکن نامعتبر باشد، خطا می‌دهیم
  return await res.json();
}

// Provider اصلی که state و توابع auth را به درخت ری‌اکت تزریق می‌کند
export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken()); // مقدار اولیه از storage
  const [user, setUser] = useState(null);               // آبجکت کاربر (پس از fetch)

  // هر زمان token تغییر کند، پروفایل کاربر را از سرور می‌گیریم
  useEffect(() => {
    let ignore = false; // گارد برای جلوگیری از setState بعد از unmount
    (async () => {
      if (!token) {
        // اگر توکن نداریم، کاربر را null می‌کنیم
        setUser(null);
        return;
      }
      try {
        const me = await fetchMe(token);
        if (!ignore) setUser(me);
      } catch {
        if (!ignore) {
          // اگر دریافت پروفایل شکست خورد (مثلاً توکن نامعتبر بود):
          setUser(null);
          // توکن را از هر دو storage پاک کن تا وضعیت ناسازگار نشود
          localStorage.removeItem("access_token");
          sessionStorage.removeItem("access_token");
          setToken(null);
        }
      }
    })();
    return () => { ignore = true; };
  }, [token]);

  // همگام‌سازی بین تب‌های مختلف مرورگر:
  // اگر در تب دیگر توکن تغییر کرد، این تب نیز باخبر شود
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "access_token") {
        setToken(getStoredToken());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // همگام‌سازی سفارشی داخل همان تب/ایفریم:
  // هر جا در اپ، رویداد 'auth:token' dispatch شود، اینجا دوباره token را می‌خوانیم
  useEffect(() => {
    const onAuthToken = () => {
      setToken(getStoredToken());
    };
    window.addEventListener("auth:token", onAuthToken);
    return () => window.removeEventListener("auth:token", onAuthToken);
  }, []);

  // لاگین:
  // - اگر remember=true باشد، توکن در localStorage می‌رود (پایدارتر)
  // - در غیر این صورت در sessionStorage ذخیره می‌شود (تا پایان سشن)
  // - سپس token را در state ست می‌کنیم و رویداد auth:token را می‌فرستیم
  const login = (newToken, remember = true) => {
    if (remember) {
      localStorage.setItem("access_token", newToken);
      sessionStorage.removeItem("access_token");
    } else {
      sessionStorage.setItem("access_token", newToken);
      localStorage.removeItem("access_token");
    }
    setToken(newToken);
    window.dispatchEvent(new Event("auth:token"));
  };

  // خروج از حساب:
  // - توکن‌ها را از هر دو storage پاک می‌کنیم
  // - state مربوط به token و user را ریست می‌کنیم
  // - رویداد auth:token را برای همگام‌سازی بقیهٔ بخش‌ها ارسال می‌کنیم
  const logout = () => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    setToken(null);
    setUser(null);
    window.dispatchEvent(new Event("auth:token"));
  };

  // به‌روزرسانی دستی آبجکت کاربر (مثلاً بعد از ویرایش پروفایل)
  const refreshUser = (u) => setUser(u);

  // تزریق مقادیر و توابع به درخت ری‌اکت
  return (
    <AuthCtx.Provider
      value={{ token, user, login, logout, refreshUser, apiBase: API_BASE }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export { AuthCtx };
