// src/components/BookmarkButton.jsx
// ============================================================================
// «BookmarkButton»
// ----------------------------------------------------------------------------
// یک دکمه‌ی عمومی برای «ذخیره/لغو ذخیره» آیتم‌ها در نشانک‌ها (Bookmarks).
//
// کاربرد:
//   <BookmarkButton type="articles" id={42} onChange={(saved)=>...} />
//
// props:
//   - type:     نوع آیتمی که می‌خواهیم نشانک کنیم. مقدارهای مجاز:
//               "news" | "articles" | "guide"
//               (با قرارداد بک‌اند هماهنگ است)
//   - id:       شناسه‌ی آیتم (رشته/عدد). لازم است تا بک‌اند بداند کدام
//               آیتم را ذخیره/حذف کند.
//   - className: کلاس‌های اضافی Tailwind/CSS برای container دکمه (اختیاری).
//   - onChange:  کال‌بک اختیاری. پس از موفقیت عملیات صدا زده می‌شود و
//               مقدار بولی وضعیت جدید ذخیره را برمی‌گرداند.
// رفتار:
//   - در mount (و هر بار تغییر type/id)، اگر کاربر لاگین باشد، از سرور
//     می‌پرسد آیا آیتم قبلاً در نشانک‌ها هست یا نه و state را ست می‌کند.
//   - با کلیک روی دکمه:
//       * اگر لاگین نباشد، پیام خطا نشان داده می‌شود (می‌توانید به‌جای پیام
//         کاربر را به /login هدایت کنید).
//       * اگر لاگین باشد، بسته به وضعیت فعلی، add یا remove انجام می‌شود.
//   - حالت busy از دوبار کلیک و مسابقه‌ی درخواست‌ها جلوگیری می‌کند.
//   - پیام خطا (err) زیر دکمه نشان داده می‌شود.
//
// وابستگی‌ها:
//   - lib/api → isAuthed, isBookmarked, addBookmark, removeBookmark
//     این توابع مسئول برقراری ارتباط با بک‌اند هستند.
//
// نکته:
//   - اگر خواستید UX بهتری داشته باشید، در قسمت not-logged-in می‌توانید
//     به /login ریدایرکت کنید و آدرس فعلی را در query/state نگه دارید.
// ============================================================================

import { useEffect, useState } from "react";
import { isAuthed } from "../lib/api";
import { isBookmarked, addBookmark, removeBookmark } from "../lib/api";

export default function BookmarkButton({
  type = "news",   // نوع پیش‌فرض: خبر
  id,              // شناسه‌ی آیتم
  className = "",  // کلاس اضافه برای container
  onChange,        // کال‌بک اختیاری برای اطلاع والد از تغییر وضعیت
}) {
  // آیا این آیتم ذخیره شده است؟
  const [saved, setSaved] = useState(false);
  // آیا عملیات در حال انجام است؟ (برای جلوگیری از کلیک‌های پشت‌سرهم)
  const [busy, setBusy] = useState(false);
  // پیام خطا (در صورت وقوع)
  const [err, setErr] = useState("");

  // ───────────────────── وضعیت اولیه‌ی «ذخیره بودن» آیتم ─────────────────────
  useEffect(() => {
    let ignore = false;
    setErr(""); // در هر بار تغییر type/id خطا را پاک کن

    // اگر کاربر لاگین نیست، نیازی به چک از سرور نیست
    if (!isAuthed()) {
      setSaved(false);
      return;
    }

    (async () => {
      try {
        // پرس‌وجو از سرور: آیا این آیتم برای کاربر نشانک شده؟
        const ok = await isBookmarked(type, id);
        if (!ignore) setSaved(!!ok);
      } catch {
        // اگر خطا رخ داد، UX را خراب نکن—فقط وضعیت را تغییر نده
      }
    })();

    return () => {
      // جلوگیری از setState روی کامپوننت unmount شده
      ignore = true;
    };
  }, [type, id]);

  // ─────────────────────────── کلیک روی دکمه ───────────────────────────
  async function toggle() {
    setErr("");           // پاک کردن پیام خطا قبل از شروع
    if (!isAuthed()) {
      // کاربر لاگین نیست → پیام بده (یا ریدایرکت کن)
      setErr("برای ذخیره باید وارد سایت شوید.");
      // نمونه‌ی ریدایرکت (اختیاری):
      // window.location.href = "/login?next=" + encodeURIComponent(location.pathname);
      return;
    }
    if (busy) return;     // جلوگیری از کلیک‌های تکراری
    setBusy(true);

    try {
      if (saved) {
        // اگر قبلاً ذخیره شده، حذفش کن
        await removeBookmark(type, id);
        setSaved(false);
        onChange?.(false); // والد را با وضعیت جدید خبر کن
      } else {
        // در غیر این صورت ذخیره کن
        await addBookmark(type, id);
        setSaved(true);
        onChange?.(true);  // والد را خبر کن
      }
    } catch (e) {
      // نمایش پیام خطا به کاربر
      setErr(e?.message || "خطا در ذخیره.");
    } finally {
      setBusy(false);
    }
  }

  // ──────────────────────────────── UI ────────────────────────────────
  return (
    <div className={`flex items-center gap-2 ${className}`} dir="rtl">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`px-3 py-1.5 rounded-lg border text-sm transition
          ${
            saved
              ? "bg-emerald-600 text-white border-emerald-600"
              : "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          }`}
        title={saved ? "لغو ذخیره" : "ذخیره"}
        // (اختیاری برای دسترس‌پذیری)
        aria-pressed={saved}
        aria-busy={busy}
      >
        {busy ? "..." : saved ? "ذخیره شد" : "ذخیره"}
      </button>

      {/* نمایش پیام خطا (اگر وجود داشته باشد) */}
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </div>
  );
}
