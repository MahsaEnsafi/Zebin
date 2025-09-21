// src/components/NotificationsPanel.jsx
import React, { useEffect, useState } from "react";
import { API_BASE, jsonFetch, authHeaders } from "../lib/api";

/**
 * NotificationsPanel
 * -------------------
 * پنل نمایش و مدیریت اعلان‌ها (Notifications) برای کاربر لاگین‌شده.
 *
 * امکانات:
 *  - فیلتر اعلان‌ها: همه | خوانده‌نشده | خوانده‌شده
 *  - علامت‌گذاری یک اعلان به‌عنوان خوانده‌شده
 *  - علامت‌گذاری همه‌ی اعلان‌ها به‌عنوان خوانده‌شده
 *
 * اتصالات بک‌اند (REST):
 *  - GET    /notifs?only=all|unread|read
 *  - PATCH  /notifs/:id/read
 *  - PATCH  /notifs/read-all
 *
 * نکات پیاده‌سازی:
 *  - برای درخواست‌های PATCH از authHeaders() استفاده می‌کنیم تا هدر Authorization
 *    به‌صورت خودکار اضافه شود (JWT).
 *  - بعد از تغییر وضعیت خوانده‌شدن، یک رویداد window به نام 'dashboard:refresh'
 *    پرتاب می‌کنیم تا شمارنده‌ها در سایر بخش‌های UI (مثلاً داشبورد/سایدبار) تازه شوند.
 *  - اگر در تب دیگری توکن تغییر کند، با 'storage' event دوباره داده‌ها را می‌گیریم.
 *
 * props:
 *  - apiBase?: آدرس پایه‌ی API؛ اگر داده نشود از API_BASE استفاده می‌شود.
 */
export default function NotificationsPanel({ apiBase }) {
  // آدرس پایه‌ی API (اولویت با prop)
  const API = apiBase || API_BASE;

  // فیلتر فعلی (all | unread | read)
  const [filter, setFilter] = useState("all");
  // لیست اعلان‌ها
  const [items, setItems] = useState([]);
  // وضعیت بارگذاری
  const [loading, setLoading] = useState(true);
  // پیام خطا (در صورت وقوع)
  const [err, setErr] = useState("");

  /**
   * واکشی لیست اعلان‌ها بر اساس فیلتر انتخاب‌شده
   * - از jsonFetch استفاده می‌کنیم تا خطاها را بهتر مدیریت کند
   * - اگر پاسخ API آرایه نبود، لیست را خالی می‌گذاریم
   */
  async function loadNotifs(kind = filter) {
    try {
      setLoading(true);
      setErr("");
      const safe = ["all", "unread", "read"].includes(kind) ? kind : "all";
      const data = await jsonFetch(`/notifs?only=${safe}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "خطا در دریافت اعلان‌ها");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * علامت‌گذاری یک اعلان به‌عنوان خوانده‌شده
   * - درخواست PATCH می‌زنیم
   * - سپس در همان لحظه، UI را آپدیت می‌کنیم (optimistic update)
   * - در نهایت رویداد 'dashboard:refresh' برای تازه‌شدن بدج‌ها
   */
  async function markOneRead(id) {
    try {
      await fetch(`${API}/notifs/${id}/read`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      // پشتیبانی از هر دو کلید is_read و seen (سازگاری عقب‌رو)
      setItems((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, is_read: true, seen: true } : x
        )
      );
      // به سایر بخش‌های برنامه خبر بده
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch {
      // خطا را عمداً بی‌صدا می‌گیریم؛ می‌توان Toast اضافه کرد
    }
  }

  /**
   * علامت‌گذاری همه اعلان‌ها به‌عنوان خوانده‌شده
   * - درخواست PATCH به /notifs/read-all
   * - سپس تمام آیتم‌های state را خوانده‌شده می‌کنیم
   */
  async function markAllRead() {
    try {
      await fetch(`${API}/notifs/read-all`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true, seen: true })));
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch {
      // بی‌صدا؛ در صورت نیاز پیام خطا نمایش بده
    }
  }

  /**
   * بارگیری اولیه + رفرش هنگام تغییر فیلتر
   * همچنین اگر در تب دیگری access_token تغییر کرد، لیست را دوباره می‌گیریم.
   */
  useEffect(() => {
    loadNotifs(filter);

    const onStorage = (e) => {
      if (e.key === "access_token") loadNotifs(filter);
    };
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  /**
   * کمک‌کننده: تشخیص وضعیت خوانده‌شدن یک اعلان
   * - برخی بک‌اندها is_read دارند، برخی seen؛ هر دو پشتیبانی می‌شود.
   */
  const isRead = (n) => (typeof n.is_read === "boolean" ? n.is_read : !!n.seen);

  return (
    <section className="space-y-4" dir="rtl">
      {/* فیلترها و دکمهٔ «همه را خوانده کن» */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["all", "همه"],
          ["unread", "خوانده‌نشده"],
          ["read", "خوانده‌شده"],
        ].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full border ${
              filter === k
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {label}
          </button>
        ))}

        {/* دکمهٔ اکشن سمت چپ (mr-auto برای فاصله‌گذاری) */}
        <button
          onClick={markAllRead}
          className="mr-auto px-3 py-1.5 rounded-full border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
        >
          علامت‌گذاری همه به‌عنوان خوانده‌شده
        </button>
      </div>

      {/* محفظهٔ لیست اعلان‌ها */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        {loading ? (
          // اسکلت بارگذاری
          <div className="h-5 bg-zinc-200 rounded animate-pulse w-1/2" />
        ) : err ? (
          // نمایش خطا
          <div className="text-rose-700 text-sm bg-white border border-rose-200 rounded-lg p-3">
            {err}
          </div>
        ) : items.length === 0 ? (
          // حالت خالی
          <div className="text-sm text-zinc-600 px-2 py-1.5">اعلان یافت نشد.</div>
        ) : (
          // لیست اعلان‌ها
          <ul className="space-y-2">
            {items.map((n) => {
              const read = isRead(n);
              return (
                <li
                  key={n.id}
                  className={`bg-white rounded-xl border p-3 flex items-start gap-3 ${
                    read ? "border-emerald-100" : "border-emerald-300"
                  }`}
                >
                  {/* بخش متن اعلان */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-800">{n.title}</div>
                    {n.body && (
                      <div className="text-sm text-zinc-600 mt-0.5">{n.body}</div>
                    )}
                    <div className="mt-1 text-xs text-zinc-500">
                      {(n.created_at || n.createdAt || "")
                        .toString()
                        .replace("T", " ")
                        .slice(0, 16)}
                    </div>
                  </div>

                  {/* اکشن‌های هر آیتم: لینک + دکمه خوانده‌شدن */}
                  <div className="flex items-center gap-2">
                    {n.link && (
                      <a
                        href={n.link}
                        className="text-xs underline text-emerald-700"
                        target="_blank"
                        rel="noreferrer"
                      >
                        مشاهده
                      </a>
                    )}

                    {/* اگر خوانده نشده: دکمهٔ «خوانده شد»؛ وگرنه Badget وضعیت */}
                    {!read ? (
                      <button
                        onClick={() => markOneRead(n.id)}
                        className="text-xs px-2 py-1 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      >
                        خوانده شد
                      </button>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">
                        خوانده‌شده
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
