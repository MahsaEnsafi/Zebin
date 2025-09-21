// src/components/AdminRoles.jsx
// -----------------------------------------------------------------------------
// این کامپوننت یک فرم ساده برای «تغییر نقش کاربر با ایمیل» فراهم می‌کند.
// - از دو تابع کمکی lib/api استفاده می‌کند:
//   1) promoteEmailToAdmin(email)  → نقش کاربر را "admin" می‌کند
//   2) demoteEmailToUser(email)    → نقش کاربر را "user" می‌کند
// پیش‌نیاز: بک‌اند باید دو مسیر PATCH مطابق این توابع داشته باشد و توکن ادمین را
// در هدر Authorization بررسی کند. دسترسی این صفحه را در روتر فقط برای ادمین باز بگذارید.
// -----------------------------------------------------------------------------

import { useState } from "react";
import { promoteEmailToAdmin, demoteEmailToUser } from "../lib/api"; // مسیر را مطابق پروژه‌ات تنظیم کن

export default function AdminRoles() {
  // مقدار ورودی ایمیل
  const [email, setEmail] = useState("");
  // وضعیت «در حال ارسال/پردازش» برای جلوگیری از چند کلیک پشت‌سرهم
  const [loading, setLoading] = useState(false);
  // پیام بازخورد به کاربر (موفق/خطا)
  const [msg, setMsg] = useState("");

  // اعتبارسنجی خیلی سادهٔ ایمیل (تنها برای UX؛ اعتبار اصلی با بک‌اند است)
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /**
   * تغییر نقش کاربر بر اساس targetRole
   * targetRole: "admin" | "user"
   */
  async function handleChange(targetRole) {
    // اگر ایمیل نامعتبر است یا مشغول هستیم کاری نکن
    if (!emailValid || loading) return;

    setLoading(true);
    setMsg("");

    try {
      // فراخوانی تابع مناسب بر اساس نقش هدف
      if (targetRole === "admin") {
        await promoteEmailToAdmin(email);
      } else {
        await demoteEmailToUser(email);
      }

      // پیام موفقیت
      setMsg(`نقش کاربر «${email.trim()}» به «${targetRole}» تغییر کرد.`);
    } catch (e) {
      // پیام خطا از استثناء یا متن پیش‌فرض
      setMsg(e.message || "خطا در تغییر نقش");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-[60vh] flex items-start justify-center">
      <div className="w-full max-w-xl mt-12">
        <h1 className="text-center text-xl font-bold mb-4">تغییر نقش کاربران</h1>

        {/* ورودی ایمیل (LTR برای خوانایی بهتر) */}
        <input
          dir="ltr"
          type="email"
          className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 ${
            // اگر ایمیل پر شده ولی نامعتبر است → استایل خطا
            email && !emailValid
              ? "border-rose-300 focus:ring-rose-200"
              : "border-zinc-300 focus:ring-emerald-200"
          }`}
          placeholder="example@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        {/* پیام راهنما برای ایمیل نامعتبر */}
        {email && !emailValid && (
          <div className="text-xs text-rose-600 mt-1">فرمت ایمیل صحیح نیست.</div>
        )}

        {/* دکمه‌ها: ارتقا به ادمین / تبدیل به user */}
        <div className="mt-4 flex gap-3">
          {/* ارتقا به نقش ادمین */}
          <button
            className={`px-4 py-2 rounded-xl text-white ${
              // فقط وقتی ایمیل معتبر و در حال پردازش نیستیم قابل کلیک باشد
              emailValid && !loading
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-emerald-200 cursor-not-allowed"
            }`}
            disabled={!emailValid || loading}
            onClick={() => handleChange("admin")}
          >
            ارتقا به ادمین
          </button>

          {/* تنزل/تبدیل نقش به user */}
          <button
            className={`px-4 py-2 rounded-xl ${
              emailValid && !loading
                ? "bg-white border border-zinc-300 hover:bg-zinc-50"
                : "bg-zinc-100 border border-zinc-200 cursor-not-allowed"
            }`}
            disabled={!emailValid || loading}
            onClick={() => handleChange("user")}
          >
            تبدیل به user
          </button>
        </div>

        {/* نمایش پیام نتیجهٔ عملیات (موفق/خطا) */}
        {msg && (
          <div className="mt-4 text-sm px-3 py-2 rounded-lg border bg-white">
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
