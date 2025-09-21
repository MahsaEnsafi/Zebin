// src/components/ProfilePanel.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import Dashboard from "./Dashboard.jsx";
import UserInfoPanel from "./UserInfoPanel.jsx";
import NotificationsPanel from "./NotificationsPanel.jsx";
import MyBookmarks from "./MyBookmarks.jsx";
import MyPhotos from "./MyPhotos.jsx";

import AdminNews from "./AdminNews.jsx";
import AdminArticles from "./AdminArticles.jsx";
import AdminGuide from "./AdminGuide.jsx";

const API_FALLBACK = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/**
 * ProfilePanel
 * ---------------------------
 * صفحه‌ی پروفایل کاربر که شامل:
 *  - داشبورد (نمای کلی وضعیت)
 *  - اطلاعات کاربری
 *  - اعلان‌ها
 *  - نشانک‌ها
 *  - عکس‌های من
 *  - پنل ادمین (فقط برای role=admin)
 *
 * نکات:
 *  - اگر کاربر از قبل در context موجود باشد (useAuth)، از همان داده استفاده می‌کنیم.
 *  - اگر فقط توکن داریم ولی user را نداریم، از /users/me واکشی می‌کنیم.
 *  - تب فعال (activeTab) و زیرتب ادمین (adminSubtab) در state نگه‌داری می‌شوند.
 *  - با کوئری‌های آدرس (?mode=...) تب‌های ادمین را فعال می‌کنیم (برای سناریوهای «ویرایش»).
 */

/* ---------- آیکون‌های ساده (SVG) ---------- */
/** Utility کوچک برای رندر یک SVG با path داده‌شده */
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d={path} />
  </svg>
);

/** مسیرهای SVG برای آیکون‌های منو/گزینه‌ها */
const icons = {
  home: "M3 10.2 12 3l9 7.2V20a2 2 0 0 1-2 2h-5v-6H9v6H4a2 2 0 0 1-2-2v-9.8Z",
  user: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.2 0-9 2.1-9 5v3h18v-3c0-2.9-4.8-5-9-5Z",
  bell: "M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6v-5a6 6 0 0 0-12 0v5l-2 2v1h16v-1Z",
  image:
    "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 5a2 2 0 1 0 2-2 2 2 0 0 0-2 2Zm-1 9h12l-4.5-6-3.5 4.5L8.5 13Z",
  campaign:
    "M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z",
  tools:
    "M21.7 18.3 14.4 11a5.5 5.5 0 0 0-7-7L9 5.6 7.6 7 5.1 4.5A5.5 5.5 0 0 0 4 9l7.3 7.3 6.4 6.4 4-4Z",
  chevronLeft: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12Z",
};

/**
 * Item
 * --------------
 * یک آیتم کلیک‌پذیر برای لیست‌های سایدبار
 * props:
 *  - icon: نام آیکون (کلیدهای شی icons)
 *  - children: متن/برچسب آیتم
 *  - active: آیا در حال حاضر تب فعال است؟ (برای استایل)
 *  - onClick: هندلر کلیک
 *  - badge: عدد/برچسب کوچک (مثلاً شمارنده اعلان‌ها)
 */
const Item = ({ icon, children, active, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl transition border ${
      active ? "bg-emerald-200/60 border-emerald-300" : "hover:bg-emerald-50 border-transparent"
    }`}
  >
    <Icon path={icons[icon]} className="w-5 h-5 text-emerald-600" />
    <span className="flex-1">{children}</span>
    {typeof badge !== "undefined" && (
      <span className="ml-2 text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-lg">
        {badge}
      </span>
    )}
    <Icon path={icons.chevronLeft} className="w-4 h-4 opacity-60" />
  </button>
);

/* ---------- Component اصلی ---------- */
export default function ProfilePanel({ apiBase }) {
  const location = useLocation();

  // از context احراز هویت: توکن، کاربر، تابع رفرش، و apiBase (اگر در context ست شده)
  const { token, user, refreshUser, apiBase: ctxApiBase } = useAuth();

  // اولویت انتخاب آدرس API: prop → context → fallback محیط
  const API = apiBase || ctxApiBase || API_FALLBACK;

  // state داده‌ی کاربر (از context یا واکشی /users/me)
  const [data, setData] = useState(user || null);
  // اگر توکن هست ولی user نداریم → loading true تا /users/me واکشی شود
  const [loading, setLoading] = useState(!user && !!token);
  const [error, setError] = useState("");

  // تب‌های موجود: dashboard | profile | notifications | photos | bookmarks | admin
  const [activeTab, setActiveTab] = useState("dashboard");
  // زیرتب ادمین: news | articles | guide
  const [adminSubtab, setAdminSubtab] = useState("news");

  /* --- بارگذاری /users/me وقتی فقط توکن داریم (یا تغییر کرد) --- */
  useEffect(() => {
    let ignore = false;

    (async () => {
      // اگر user از قبل در context هست → همین را بگذار و تمام
      if (user) {
        setData(user);
        setLoading(false);
        return;
      }
      // اگر توکنی نداریم → کاربر ناشناس
      if (!token) {
        setData(null);
        setLoading(false);
        return;
      }

      // واکشی اطلاعات کاربر
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API}/users/me`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        if (!ignore) {
          setData(j);
          // در صورت وجود، context را هم تازه کن (اختیاری/سازگاری)
          if (typeof refreshUser === "function") refreshUser(j);
        }
      } catch {
        if (!ignore) setError("خطا در دریافت اطلاعات کاربر");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [API, token, user, refreshUser]);

  /* --- فعال‌سازی تب‌های ادمین با توجه به querystring (برای مسیرهای ویرایش/افزودن) --- */
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const m = qs.get("mode");
    if (m === "edit-news" || m === "add") {
      setActiveTab("admin");
      setAdminSubtab("news");
    } else if (m === "edit-article" || m === "add-article") {
      setActiveTab("admin");
      setAdminSubtab("articles");
    } else if (m === "guide" || m === "edit-guide" || m === "add-guide") {
      setActiveTab("admin");
      setAdminSubtab("guide");
    }
  }, [location.search]);

  // نام نمایشی و نقش کاربر برای کارت پروفایل سایدبار
  const displayName = data?.displayName || data?.nickname || data?.username || "کاربر";
  const roleLabel = data?.role === "admin" ? "ادمین" : "کاربر";
  const isAdmin = data?.role === "admin";

  /* --- هندلرهای ثابت برای سوئیچ تب‌ها --- */
  const handleGoTab = (t) => setActiveTab(t);
  const handleGoAdmin = (sub) => {
    setActiveTab("admin");
    setAdminSubtab(sub);
  };

  return (
    <div className="w-full min-h-screen bg-zinc-50 py-8" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ---------- سایدبار ---------- */}
        <aside className="md:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* کارت پروفایل کاربر (نام و نقش) */}
            <div className="bg-emerald-100/70 rounded-2xl p-5 shadow-sm border border-emerald-200">
              <div className="flex items-center gap-3">
                {/* آواتار ساده (placeholder) */}
                <div className="w-14 h-14 rounded-full bg-emerald-200" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-800 truncate">{displayName}</div>
                  <div className="text-sm text-zinc-600 mt-0.5">عضویت: {roleLabel}</div>
                </div>
              </div>

              {/* پیام خطا در واکشی /users/me */}
              {error && (
                <div className="mt-3 text-xs text-rose-700 bg-white/70 border border-rose-200 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {/* فهرست تب‌های اصلی */}
              <div className="mt-5 border-t border-emerald-200 pt-3 space-y-1.5">
                <Item icon="home" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")}>
                  داشبورد
                </Item>
                <Item icon="user" active={activeTab === "profile"} onClick={() => setActiveTab("profile")}>
                  اطلاعات کاربری
                </Item>
                <Item
                  icon="bell"
                  active={activeTab === "notifications"}
                  onClick={() => setActiveTab("notifications")}
                  badge={data?.counts?.notifications}
                >
                  اعلان‌ها
                </Item>
              </div>
            </div>

            {/* کارت «فعالیت‌های من» (میانبر به تب‌های بوکمارک/عکس/ادمین) */}
            <div className="bg-emerald-100/70 rounded-2xl p-5 shadow-sm border border-emerald-200">
              <div className="text-zinc-700 font-medium mb-3">فعالیت‌های من در سایت</div>
              <div className="space-y-1.5">
                <Item icon="campaign" active={activeTab === "bookmarks"} onClick={() => setActiveTab("bookmarks")}>
                  نشانک‌های من
                </Item>
                <Item icon="image" active={activeTab === "photos"} onClick={() => setActiveTab("photos")}>
                  عکس‌های من
                </Item>

                {/* لینک‌ها و ابزارهای ادمین فقط برای نقش admin */}
                {isAdmin && (
                  <>
                    <Item icon="tools" active={activeTab === "admin"} onClick={() => setActiveTab("admin")}>
                      ابزار ادمین
                    </Item>

                    {/* صفحهٔ مدیریت نقش‌ها (Route جداگانه) */}
                    <Link
                      to="/admin/roles"
                      className="block text-right px-4 py-3 rounded-xl transition border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      مدیریت نقش کاربران
                    </Link>

                    {/* صفحهٔ ارسال اعلان (Route جداگانه) */}
                    <Link
                      to="/admin/notifs"
                      className="block text-right mt-2 px-4 py-3 rounded-xl transition border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    >
                      ارسال اعلان
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- محتوای اصلی ---------- */}
        <main className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border p-6 min-h-[420px] text-zinc-700">
            {/* اسکلت بارگذاری وقتی /users/me در حال واکشی است */}
            {loading ? (
              <div className="space-y-3">
                <div className="h-5 bg-zinc-200 rounded w-1/3 animate-pulse" />
                <div className="h-4 bg-zinc-200 rounded w-2/3 animate-pulse" />
                <div className="h-4 bg-zinc-200 rounded w-1/2 animate-pulse" />
              </div>
            ) : (
              <>
                {/* تب‌ها را اینجا رندر می‌کنیم—فقط یکی در هر لحظه */}
                {activeTab === "dashboard" && (
                  <Dashboard apiBase={API} data={data} goTab={handleGoTab} goAdmin={handleGoAdmin} />
                )}

                {activeTab === "profile" && <UserInfoPanel apiBase={API} />}

                {activeTab === "notifications" && <NotificationsPanel apiBase={API} />}

                {activeTab === "photos" && <MyPhotos />}

                {activeTab === "bookmarks" && <MyBookmarks />}

                {/* پنل ادمین (فقط برای admin) */}
                {activeTab === "admin" && isAdmin && (
                  <section className="rounded-2xl border border-emerald-200 p-5 bg-emerald-50/60">
                    {/* سوییچر زیرتب‌های ادمین */}
                    <div className="flex flex-wrap gap-3 mb-4 items-center">
                      <button
                        className={`px-4 py-2 rounded-xl border ${
                          adminSubtab === "news" ? "bg-emerald-600 text-white border-emerald-600" : ""
                        }`}
                        onClick={() => setAdminSubtab("news")}
                      >
                        مدیریت خبرها
                      </button>
                      <button
                        className={`px-4 py-2 rounded-xl border ${
                          adminSubtab === "articles" ? "bg-emerald-600 text-white border-emerald-600" : ""
                        }`}
                        onClick={() => setAdminSubtab("articles")}
                      >
                        مدیریت مقالات علمی
                      </button>
                      <button
                        className={`px-4 py-2 rounded-xl border ${
                          adminSubtab === "guide" ? "bg-emerald-600 text-white border-emerald-600" : ""
                        }`}
                        onClick={() => setAdminSubtab("guide")}
                      >
                        مدیریت راهنما
                      </button>
                    </div>

                    {/* محتوای هر زیرتب ادمین */}
                    {adminSubtab === "news" ? (
                      <AdminNews apiBase={API} currentUser={data} />
                    ) : adminSubtab === "articles" ? (
                      <AdminArticles apiBase={API} currentUser={data} />
                    ) : (
                      <AdminGuide apiBase={API} />
                    )}
                  </section>
                )}

                {/* اگر کاربر ادمین نبود ولی به تب admin رفته بود */}
                {activeTab === "admin" && !isAdmin && (
                  <div className="text-sm text-rose-600">دسترسی غیرمجاز.</div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
