// src/components/MyBookmarks.jsx
import React, { useEffect, useState } from "react";
import { listBookmarks, removeBookmark } from "../lib/api";

/**
 * MyBookmarks
 * ------------------------------------------------------------------
 * فهرست «نشانک‌ها»ی کاربر را از بک‌اند می‌گیرد و نمایش می‌دهد.
 * - منبع داده: GET /bookmarks   (تابع listBookmarks در lib/api)
 * - حذف نشانک: DELETE /bookmarks/{type}/{id}  (تابع removeBookmark)
 *
 * هر آیتمِ نشانک (طبق قرارداد lib/api) معمولاً چنین فیلدهایی دارد:
 *  - target_type : "news" | "articles" | "guide"
 *  - target_id   : شناسه‌ی هدف (string/number/slug)
 *  - title       : عنوانی برای نمایش
 *  - link        : لینک مقصد برای دیدن مورد
 *  - created_at  : زمان ثبت نشانک (ISO string)
 */
export default function MyBookmarks() {
  // آرایه‌ی آیتم‌های نشانک
  const [items, setItems] = useState([]);

  // وضعیت بارگذاری لیست
  const [loading, setLoading] = useState(true);

  // پیام خطا (در صورت شکست)
  const [err, setErr] = useState("");

  /**
   * load()
   * فهرست نشانک‌ها را از سرور می‌گیرد و در state می‌گذارد.
   * در صورت خطا، متن خطا در err ذخیره می‌شود.
   */
  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await listBookmarks();          // ← فراخوانی API
      setItems(Array.isArray(data) ? data : []);   // ایمنی در برابر پاسخ غیرآرایه
    } catch (e) {
      setErr(e.message || "خطا در دریافت نشانک‌ها");
    } finally {
      setLoading(false);
    }
  };

  /**
   * del(type, id)
   * حذف یک نشانک خاص و سپس حذف آن از UI بدون ریلود کامل.
   * اگر خطا رخ دهد، فعلاً سایلنت است (می‌توانید alert بگذارید).
   */
  const del = async (t, id) => {
    try {
      await removeBookmark(t, id); // ← فراخوانی DELETE
      // حذف خوش‌بینانه از state (Optimistic UI)
      setItems((prev) => prev.filter((x) => !(x.target_type === t && x.target_id === id)));
    } catch {
      // اینجا می‌توانید setErr یا alert اضافه کنید
    }
  };

  // بار اول که کامپوننت mount می‌شود، لیست را بگیر
  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-4" dir="rtl">
      {/* تیتر بخش */}
      <h3 className="font-medium text-zinc-800">نشانک‌های من</h3>

      {/* جعبه‌ی حاوی محتوا / حالت‌ها */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        {/* حالت بارگذاری */}
        {loading ? (
          <div className="h-5 bg-zinc-200 rounded animate-pulse w-1/2" />
        ) : /* حالت خطا */
        err ? (
          <div className="text-rose-700 text-sm bg-white border border-rose-200 rounded-lg p-3">
            {err}
          </div>
        ) : /* حالت بدون داده */
        items.length === 0 ? (
          <div className="text-sm text-zinc-600 px-2 py-1.5">نشانکی ثبت نشده است.</div>
        ) : (
          /* حالت موفق: لیست نشانک‌ها */
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={`${it.target_type}-${it.target_id}`} // کلید یکتا با ترکیب نوع و شناسه
                className="bg-white rounded-xl border border-emerald-200 p-3 flex items-center justify-between gap-3"
              >
                {/* سمتِ اطلاعات آیتم */}
                <div className="min-w-0">
                  {/* نوع هدف را به فارسی نمایش می‌دهیم (ساده) */}
                  <div className="text-sm text-zinc-500">
                    {it.target_type === "news"
                      ? "خبر"
                      : it.target_type === "articles"
                      ? "مقاله"
                      : it.target_type === "guide"
                      ? "راهنما"
                      : it.target_type}
                  </div>

                  {/* لینک عنوان (اگر link داشت) */}
                  {it.link ? (
                    <a href={it.link} className="font-medium text-zinc-800 hover:underline">
                      {it.title}
                    </a>
                  ) : (
                    <span className="font-medium text-zinc-800">{it.title}</span>
                  )}

                  {/* زمان ایجاد؛ برش ساده‌ی ISO به yyyy-mm-dd HH:MM */}
                  <div className="mt-1 text-xs text-zinc-500">
                    {(it.created_at || "").replace("T", " ").slice(0, 16)}
                  </div>
                </div>

                {/* دکمه‌ی حذف نشانک */}
                <button
                  onClick={() => del(it.target_type, it.target_id)}
                  className="text-xs px-2 py-1 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                >
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
