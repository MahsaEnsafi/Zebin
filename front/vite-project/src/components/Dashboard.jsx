// src/components/Dashboard.jsx
// -----------------------------------------------------------------------------
// داشبورد پروفایل کاربر
// - ظاهر کلی حفظ شده است.
// - تنها تغییر UI: دکمه‌های «رفتن به نشانک‌ها» و «رفتن به عکس‌ها» مثل دکمه‌ی
//   اعلان‌ها، حالت دکمه‌ی حاشیه‌دار (bordered button) گرفته‌اند.
// - داده‌ی شمارنده‌ی نشانک‌ها و عکس‌ها با فراخوانی API‌های موجود دریافت می‌شود.
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import { listBookmarks, listMyPhotos } from "../lib/api"; // برای شمارش

const DEF_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const getToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  "";

/**
 * props:
 * - apiBase?: string            // پایه‌ی API (اختیاری)
 * - data?: object               // اطلاعات کاربر برای محاسبه‌ی درصد تکمیل پروفایل
 * - goTab?: (tabName: string) => void
 *    نام تب‌های داخلی: "notifications" | "bookmarks" | "photos" | "profile"
 * - goAdmin?: (subtab: "news"|"articles"|"guide") => void
 */
export default function Dashboard({ apiBase = DEF_BASE, data: user, goTab, goAdmin }) {
  // وضعیت عمومی
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // شمارنده‌های اصلی داشبورد
  const [counts, setCounts] = useState({
    notifications: 0,
    messages: 0,              // جهت سازگاری نگه داشته شده
    profile_completion: 0,
  });

  // «فعالیت اخیر» دیگر نمایش داده نمی‌شود؛ جهت سازگاری باقی است
  const [recent, setRecent] = useState([]);

  // شمارش نشانک‌ها و عکس‌ها برای دو کارت اول
  const [bmCount, setBmCount] = useState(0);
  const [phCount, setPhCount] = useState(0);

  // بارگذاری داده‌های داشبورد + شمارنده‌های تکمیلی
  async function load() {
    setLoading(true);
    setErr("");
    const token = getToken();

    // تلاش اصلی: endpoint مخصوص داشبورد
    try {
      const r = await fetch(`${apiBase}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        setCounts({
          notifications: j?.counts?.notifications ?? 0,
          messages: j?.counts?.messages ?? 0,
          profile_completion: j?.counts?.profile_completion ?? 0,
        });
        setRecent(Array.isArray(j?.recent) ? j.recent : []);
      } else {
        // در صورت نبود endpoint یا خطا، fallback ساده
        const nr = await fetch(`${apiBase}/notifs?only=unread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let notifCount = 0;
        if (nr.ok) {
          const arr = await nr.json();
          notifCount = Array.isArray(arr) ? arr.length : 0;
        }
        // درصد تکمیل پروفایل (خیلی ساده)
        let pc = 0;
        if (user?.displayName) pc += 50;
        if (user?.avatarUrl) pc += 50;

        setCounts({
          notifications: notifCount,
          messages: 0,
          profile_completion: pc,
        });
        setRecent([]);
      }
    } catch (e) {
      console.error(e);
      setErr("خطا در بارگذاری داشبورد");
    } finally {
      setLoading(false);
    }

    // شمارش نشانک‌ها و عکس‌ها (مستقل از /dashboard)
    try {
      const [bms, photos] = await Promise.all([
        listBookmarks().catch(() => []),
        listMyPhotos().catch(() => []),
      ]);
      setBmCount(Array.isArray(bms) ? bms.length : 0);
      setPhCount(Array.isArray(photos) ? photos.length : 0);
    } catch {
      setBmCount(0);
      setPhCount(0);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // علامت‌گذاری همه‌ی اعلان‌ها به‌عنوان خوانده‌شده (در صورت نیاز)
  async function markAllRead() {
    const token = getToken();
    try {
      const r = await fetch(`${apiBase}/notifs/mark-all-read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      load();
      goTab?.("notifications");
    } catch (e) {
      console.error(e);
      setErr("علامت‌گذاری همه به عنوان خوانده‌شده ناموفق بود");
    }
  }

  // محاسبه‌ی امن درصد تکمیل پروفایل
  const pc = Math.max(0, Math.min(100, Number(counts.profile_completion || 0)));

  return (
    <div className="space-y-4" dir="rtl">
      {/* باکس خطا */}
      {err && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {err}
        </div>
      )}

      {/* حالت شِکلتون هنگام بارگذاری */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* ردیف سه کارت بالایی (ظاهر حفظ شده) */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* کارت ۱: نشانک‌های من */}
            <div className="bg-white border rounded-xl p-4">
              <div className="font-medium mb-2">نشانک‌های من</div>
              <div className="text-sm text-zinc-600">{bmCount} مورد ذخیره‌شده</div>
              <div className="mt-3">
                {/* تغییر اصلی: لینک ساده → دکمه‌ی حاشیه‌دار مثل اعلان‌ها */}
                <button
                  type="button"
                  onClick={() => goTab && goTab("bookmarks")}
                  className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm"
                >
                  رفتن به نشانک‌ها
                </button>
              </div>
            </div>

            {/* کارت ۲: عکس‌های من */}
            <div className="bg-white border rounded-xl p-4">
              <div className="font-medium mb-2">عکس‌های من</div>
              <div className="text-sm text-zinc-600">{phCount} تصویر ذخیره‌شده</div>
              <div className="mt-3">
                {/* تغییر اصلی: لینک ساده → دکمه‌ی حاشیه‌دار مثل اعلان‌ها */}
                <button
                  type="button"
                  onClick={() => goTab && goTab("photos")}
                  className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm"
                >
                  رفتن به عکس‌ها
                </button>
              </div>
            </div>

            {/* کارت ۳: اعلان‌ها (بدون تغییر) */}
            <div className="bg-white border rounded-xl p-4">
              <div className="font-medium mb-2">اعلان‌ها</div>
              <div className="text-sm text-zinc-600">
                {counts.notifications} مورد خوانده‌نشده
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => goTab && goTab("notifications")}
                  className="px-3 py-1.5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm"
                >
                  رفتن به اعلان‌ها
                </button>
                {/* اگر دکمه «همه را خوانده کن» لازم بود، کامنت زیر را باز کنید */}
                {/* <button
                  type="button"
                  onClick={markAllRead}
                  className="px-3 py-1.5 rounded-lg border text-sm"
                >
                  همه را خوانده کن
                </button> */}
              </div>
            </div>
          </div>

          {/* ردیف پایین: تکمیل پروفایل + میانبرها */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* نوار تکمیل پروفایل */}
            <div className="bg-white border rounded-xl p-4">
              <div className="font-medium mb-2">تکمیل پروفایل</div>
              <div className="h-3 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className={`h-3 ${pc >= 70 ? "bg-emerald-600" : "bg-rose-500"}`}
                  style={{ width: `${pc}%` }}
                />
              </div>
              <div className="text-xs text-zinc-600 mt-1">{pc}%</div>
            </div>

            {/* میانبرها */}
            <div className="bg-white border rounded-xl p-4">
              <div className="font-medium mb-2">میانبرها</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => goTab && goTab("profile")}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  ویرایش حساب
                </button>

                {/* منطقی‌تر: کاربر را به تب عکس‌ها ببرد */}
                <button
                  type="button"
                  onClick={() => goTab && goTab("photos")}
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  آپلود عکس
                </button>

                {/* میانبرهای ادمین */}
                {user?.role === "admin" && (
                  <>
                    <button
                      type="button"
                      onClick={() => goAdmin && goAdmin("news")}
                      className="px-3 py-1.5 border rounded-lg text-sm"
                    >
                      مدیریت خبرها
                    </button>
                    <button
                      type="button"
                      onClick={() => goAdmin && goAdmin("articles")}
                      className="px-3 py-1.5 border rounded-lg text-sm"
                    >
                      مدیریت مقالات
                    </button>
                    <a href="/admin/notifs" className="px-3 py-1.5 border rounded-lg text-sm">
                      ارسال اعلان
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
