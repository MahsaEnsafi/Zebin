// src/lib/api.js
/**
 * لایه‌ی کمکی برای فراخوانی‌های API در سمت فرانت
 * -------------------------------------------------
 * قابلیت‌ها:
 *  - تعیین آدرس پایه‌ی API از طریق VITE_API_BASE (با حذف اسلش انتهایی)
 *  - مدیریت توکن احراز هویت (خواندن/ذخیره در localStorage یا sessionStorage)
 *  - ساخت هدرهای استاندارد (Authorization, Accept, Content-Type)
 *  - یک wrapper یکنواخت برای fetch با تبدیل خطاها به پیام قابل‌خواندن
 *  - توابع دامنه‌ای آماده: اعلان‌ها (Notifications)، نشانک‌ها (Bookmarks)، عکس‌های من (Photos)
 *
 * نکات:
 *  - برای ارسال FormData، Content-Type را دستی ست نکنید تا مرورگر boundary را اضافه کند.
 *  - همه‌ی آدرس‌ها نسبی به BASE ساخته می‌شوند.
 */

export const BASE = (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");
export const API_BASE = BASE;

/* ---------------- Token helpers ---------------- */

/**
 * getToken()
 * خواندن توکن فعلی از localStorage یا sessionStorage
 * @returns {string} رشته‌ی توکن؛ اگر وجود نداشته باشد رشته‌ی خالی
 */
export const getToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  "";

/**
 * isAuthed()
 * آیا کاربر وارد شده است؟
 * توجه: صرفاً وجود توکن را چک می‌کند؛ صحت آن را تضمین نمی‌کند.
 * @returns {boolean}
 */
export const isAuthed = () => !!getToken();

/**
 * setToken(t, remember)
 * ذخیره/حذف توکن در storage مناسب و ارسال رویداد همگام‌سازی
 * @param {string} t - توکن JWT (اگر falsy باشد، توکن پاک می‌شود)
 * @param {boolean} [remember=true] - true => localStorage, false => sessionStorage
 * نکته: بعد از تغییر، رویداد سفارشی 'auth:token' dispatch می‌شود.
 */
export const setToken = (t, remember = true) => {
  const storage = remember ? localStorage : sessionStorage;
  if (t) {
    storage.setItem("access_token", t);
  } else {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
  }
  try { window?.dispatchEvent(new Event("auth:token")); } catch {}
};

/**
 * ساخت هدرهای پایه بر اساس توکن فعلی
 * @param {string} [token=getToken()] - توکن اختیاری برای override
 * @returns {Record<string,string>}
 */
const baseHeaders = (token = getToken()) => ({
  Accept: "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

/**
 * authHeaders(json)
 * سازگاری عقب‌رو برای فایل‌هایی که مستقیم هدر می‌خواهند
 * @param {boolean} [json=true] - اگر true باشد Content-Type: application/json ست می‌شود
 * @returns {Record<string,string>}
 * نکته: برای ارسال FormData باید json=false بدهید تا مرورگر Content-Type مناسب بگذارد.
 */
export const authHeaders = (json = true) => ({
  ...baseHeaders(),
  ...(json ? { "Content-Type": "application/json" } : {}),
});

/* ---------------- Fetch wrapper ---------------- */

/**
 * api(path, opts)
 * یک wrapper استاندارد برای fetch که:
 *  - Authorization و Accept را خودکار ست می‌کند
 *  - اگر body از نوع FormData باشد، Content-Type را ست نمی‌کند
 *  - خطاهای HTTP را به Error با پیام خوانا تبدیل می‌کند (detail از JSON یا متن خام)
 *  - بر اساس Content-Type خروجی JSON یا متن برمی‌گرداند
 *
 * @param {string} path - مسیر نسبی API (با اسلش ابتدایی، مثل: "/news")
 * @param {RequestInit} [opts={}] - گزینه‌های fetch
 * @returns {Promise<any>} - خروجی JSON یا متن؛ در 204 مقدار null
 * @throws {Error} - اگر status غیر ok باشد
 */
export async function api(path, opts = {}) {
  // تشخیص FormData برای تنظیم نکردن Content-Type
  const hasFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;

  const headers = {
    ...baseHeaders(),
    ...(!hasFormData ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  // مدیریت خطاها با پیام‌های انسانی
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        if (typeof j?.detail === "string") msg = j.detail;
        else if (Array.isArray(j?.detail) && j.detail[0]?.msg) msg = j.detail[0].msg;
        else msg = JSON.stringify(j);
      } else {
        msg = (await res.text()) || msg;
      }
    } catch {}
    throw new Error(msg);
  }

  // پاسخ بدون بدنه
  if (res.status === 204) return null;

  // بازگرداندن خروجی مناسب
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? await res.json() : await res.text();
}

// هم‌نام برای سازگاری با فایل‌های قدیمی
export const jsonFetch = api;

/* --------- رویداد ساده برای رفرش داشبورد/بدج‌ها --------- */

/**
 * emit(name)
 * شلیک یک رویداد سفارشی روی window (برای همگام‌سازی UI)
 * @param {string} name - نام رویداد (مثلاً 'dashboard:refresh')
 */
const emit = (name) => { try { window?.dispatchEvent(new Event(name)); } catch {} };

/**
 * onDashboardRefresh(fn)
 * شنوندهٔ رفرش داشبورد (برای به‌روزرسانی نشان‌ها/شمارنده‌ها)
 * @param {() => void} fn - تابعی که هنگام رخداد اجرا می‌شود
 * @returns {() => void} - تابع لغو لیسنر
 */
export const onDashboardRefresh = (fn) => {
  const h = () => fn();
  window?.addEventListener("dashboard:refresh", h);
  return () => window?.removeEventListener("dashboard:refresh", h);
};

/* ===================== Users / Roles ===================== */

/**
 * تغییر نقش کاربر توسط ایمیل (ادمین)
 * @param {string} email - ایمیل کاربر
 * @param {"admin"|"user"} role - نقش مقصد
 * @returns {Promise<any>}
 */
export function changeUserRoleByEmail(email, role) {
  const enc = encodeURIComponent(String(email).trim().toLowerCase());
  return api(`/users/by-email/${enc}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

/** ارتقا به ادمین */
export const promoteEmailToAdmin = (email) => changeUserRoleByEmail(email, "admin");
/** بازگرداندن به نقش کاربر عادی */
export const demoteEmailToUser  = (email) => changeUserRoleByEmail(email, "user");

/* ===================== Notifications ===================== */

/**
 * listNotifications(only, {limit, offset})
 * دریافت فهرست اعلان‌ها با فیلتر و صفحه‌بندی
 * @param {"all"|"unread"|"read"} [only="all"]
 * @param {{limit?: number, offset?: number}} [opts]
 * @returns {Promise<any[]>}
 */
export function listNotifications(only = "all", { limit = 50, offset = 0 } = {}) {
  const safe = ["all", "unread", "read"].includes(only) ? only : "all";
  return api(`/notifs?only=${safe}&limit=${limit}&offset=${offset}`);
}

/**
 * markNotificationRead(id)
 * علامت‌گذاری یک اعلان به‌عنوان خوانده‌شده
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export async function markNotificationRead(id) {
  await api(`/notifs/${id}/read`, { method: "PATCH" });
  emit("dashboard:refresh");
}

/**
 * markAllNotificationsRead()
 * علامت‌گذاری همهٔ اعلان‌ها به‌عنوان خوانده‌شده
 * @returns {Promise<void>}
 */
export async function markAllNotificationsRead() {
  await api(`/notifs/read-all`, { method: "PATCH" });
  emit("dashboard:refresh");
}

/**
 * createNotification(payload)
 * ساخت اعلان جدید (ادمین/سیستم)
 * @param {{title:string, body?:string, link?:string, type?:string, user_id?:number|null}} payload
 * @returns {Promise<any>}
 */
export function createNotification({ title, body, link, type = "content", user_id = null }) {
  return api(`/notifs`, {
    method: "POST",
    body: JSON.stringify({ title, body, link, type, user_id }),
  });
}

/**
 * deleteNotification(id)
 * حذف اعلان (ادمین یا صاحب اعلان شخصی)
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export function deleteNotification(id) {
  return api(`/notifs/${id}`, { method: "DELETE" });
}

/**
 * getUnreadBadgeCount()
 * گرفتن تعداد اعلان‌های خوانده‌نشده از /dashboard (اگر موجود باشد)
 * @returns {Promise<number>}
 */
export async function getUnreadBadgeCount() {
  const d = await api(`/dashboard`);
  return d?.counts?.notifications || 0;
}

/* ===================== Dashboard ===================== */

/**
 * getDashboard()
 * دریافت داده‌های داشبورد (در صورت پیاده‌سازی مسیر /dashboard در بک‌اند)
 * @returns {Promise<any>}
 */
export const getDashboard = () => api(`/dashboard`);

/* ===================== Bookmarks (نشانک‌ها) ===================== */
/**
 * قرارداد بک‌اند (سازگار با id یا slug):
 *  POST   /bookmarks                       body: { target_type, target_id<string> }
 *  DELETE /bookmarks/{type}/{id<string>}
 *  GET    /bookmarks/check?target_type=...&target_id=...
 *  GET    /bookmarks
 */

/**
 * normalizeTargetType(t)
 * نرمال‌سازی نوع هدف به یکی از 'news' | 'articles' | 'guide'
 * @param {string} t
 * @returns {"news"|"articles"|"guide"}
 * @throws {Error} اگر نوع ناشناخته باشد
 */
const normalizeTargetType = (t) => {
  const k = String(t || "").toLowerCase().trim();
  if (["news", "articles", "guide"].includes(k)) return k;
  if (k === "article") return "articles";
  if (k === "guides") return "guide";
  if (k === "new") return "news";
  throw new Error("Input should be 'news', 'articles' or 'guide'");
};

/**
 * listBookmarks()
 * فهرست همهٔ نشانک‌های کاربر
 * @returns {Promise<any[]>}
 */
export const listBookmarks = () => api(`/bookmarks`);

/**
 * addBookmark(type, id)
 * افزودن یک نشانک جدید
 * @param {"news"|"articles"|"guide"} targetType
 * @param {string|number} targetId - می‌تواند عدد یا slug باشد؛ به رشته تبدیل می‌شود
 * @returns {Promise<any>}
 */
export const addBookmark = (targetType, targetId) => {
  const tt = normalizeTargetType(targetType);
  return api(`/bookmarks`, {
    method: "POST",
    body: JSON.stringify({ target_type: tt, target_id: String(targetId) }),
  });
};

/**
 * removeBookmark(type, id)
 * حذف نشانک مشخص
 * @param {"news"|"articles"|"guide"} targetType
 * @param {string|number} targetId - عدد یا slug
 * @returns {Promise<void>}
 */
export const removeBookmark = (targetType, targetId) => {
  const tt = normalizeTargetType(targetType);
  return api(`/bookmarks/${encodeURIComponent(tt)}/${encodeURIComponent(String(targetId))}`, {
    method: "DELETE",
  });
};

/**
 * isBookmarked(type, id)
 * بررسی ذخیره بودن مورد (true/false)
 * @param {"news"|"articles"|"guide"} targetType
 * @param {string|number} targetId
 * @returns {Promise<boolean>}
 * نکته: پاسخ /bookmarks/check ممکن است boolean یا {bookmarked:boolean} باشد.
 */
export async function isBookmarked(targetType, targetId) {
  const tt = normalizeTargetType(targetType);
  const qs = new URLSearchParams({
    target_type: tt,
    target_id: String(targetId),
  });
  try {
    const r = await api(`/bookmarks/check?${qs.toString()}`);
    if (typeof r === "boolean") return r;
    return !!r?.bookmarked;
  } catch {
    // در صورت خطا false برمی‌گردانیم تا UI قفل نشود
    return false;
  }
}

/**
 * toggleBookmark(type, id)
 * تغییر وضعیت نشانک: اگر ذخیره شده بود حذف می‌کند، وگرنه اضافه می‌کند.
 * @param {"news"|"articles"|"guide"} targetType
 * @param {string|number} targetId
 * @returns {Promise<boolean>} وضعیت نهایی (true=ذخیره شد)
 */
export async function toggleBookmark(targetType, targetId) {
  if (!isAuthed()) throw new Error("برای ذخیره باید وارد شوید.");
  const tt = normalizeTargetType(targetType);
  const idStr = String(targetId);
  try {
    const saved = await isBookmarked(tt, idStr);
    if (saved) {
      await removeBookmark(tt, idStr);
      return false;
    } else {
      await addBookmark(tt, idStr);
      return true;
    }
  } finally {
    // به داشبورد/بدج‌ها خبر بده شمارنده‌ها را تازه کنند
    emit("dashboard:refresh");
  }
}

/* ===================== Photos (عکس‌های من) ===================== */

/**
 * listMyPhotos()
 * فهرست عکس‌های آپلود‌شدهٔ کاربر
 * @returns {Promise<Array<{id:number|string,url?:string,file_path?:string,predicted_class?:string,confidence?:number,uploaded_at?:string,created_at?:string}>>}
 */
export const listMyPhotos = () => api(`/me/photos`);

/**
 * deleteMyPhoto(id)
 * حذف یک عکس از گالری کاربر
 * @param {string|number} id
 * @returns {Promise<void>}
 */
export const deleteMyPhoto = (id) => api(`/me/photos/${id}`, { method: "DELETE" });
