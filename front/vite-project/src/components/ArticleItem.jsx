// src/components/ArticleItem.jsx
// ============================================================================
// «ArticleItem»
// ----------------------------------------------------------------------------
// کارتِ نمایش یک مقاله به‌همراه دکمه‌ی «مطالعه کامل» و «ذخیره در نشانک‌ها».
//
// ورودی‌ها (props):
//   - id:        شناسه‌ی عددی/رشته‌ای مقاله (برای لینک و نشانک لازم است)
//   - title:     عنوان مقاله
//   - summary:   خلاصهٔ کوتاه (اختیاری)
//   - content:   متن مقاله (برای پیش‌نمایش کوتاه روی کارت)
//
// رفتارها:
//   1) در mount (و هر بار تغییر id)، وضعیت ذخیره بودن مقاله در «نشانک‌ها»
//      را با API بررسی می‌کنیم و دکمه را مطابق آن تنظیم می‌کنیم.
//   2) اگر کاربر روی «ذخیره» کلیک کند:
//        - اگر وارد نشده باشد ⇒ به صفحه‌ی /login هدایت می‌شود
//          (state.from را ست می‌کنیم تا بعد از ورود بتواند برگردد).
//        - اگر وارد باشد ⇒ toggleBookmark صدا زده می‌شود و وضعیت دکمه تغییر می‌کند.
//   3) نکات دسترس‌پذیری: aria-pressed برای دکمه و کلاس‌های حالت disabled.
//
// وابستگی‌ها:
//   - react-router-dom: برای لینک و ناوبری/بازگشت پس از ورود.
//   - lib/api: توابع isAuthed/isBookmarked/toggleBookmark برای مدیریت نشانک‌ها.
// ============================================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { isAuthed, isBookmarked, toggleBookmark } from "../lib/api";

export default function ArticleItem({ id, title, summary, content }) {
  // آیا این مقاله در نشانک‌های کاربر ذخیره شده است؟
  const [saved, setSaved] = useState(false);
  // وضعیت در حال ارسال (برای غیرفعال کردن دکمه و نمایش «در حال ذخیره…»)
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // ────────────────────────── بارگذاری وضعیت ذخیره ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return; // بدون id امکان بررسی نداریم
      try {
        // پرس‌وجو از سرور: آیا این مقاله برای کاربر «نشانک» شده؟
        const s = await isBookmarked("articles", id);
        if (!cancelled) setSaved(!!s);
      } catch {
        // خطای شبکه/سرور را برای UX بی‌صدا نادیده می‌گیریم
      }
    })();

    // cleanup برای جلوگیری از setState روی کامپوننت unmount شده
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ────────────────────────── کلیک روی دکمهٔ نشانک ──────────────────────────
  async function onBookmarkClick() {
    // اگر لاگین نیست، به /login هدایت کن و مسیر فعلی را برای بازگشت ذخیره کن
    if (!isAuthed()) {
      navigate("/login", {
        replace: false,
        state: {
          from: location, // تا بعد از ورود برگردد به همین صفحه
          msg: "برای ذخیره در نشانک‌ها باید وارد شوید.",
        },
      });
      return;
    }

    try {
      setSaving(true);
      // toggle بین ذخیره/حذف در نشانک‌ها
      const nowSaved = await toggleBookmark("articles", id);
      setSaved(!!nowSaved);
    } catch (e) {
      // پیام خطا را به‌صورت ساده به کاربر نشان می‌دهیم
      alert(e?.message || "خطا در به‌روزرسانی نشانک");
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────── رندر کارت ────────────────────────────────
  return (
    <article className="border p-4 rounded-lg shadow-sm bg-white" dir="rtl">
      {/* عنوان */}
      <h2 className="font-bold text-lg mb-2">{title}</h2>

      {/* خلاصه (اختیاری) */}
      {summary && <p className="text-gray-600 text-sm mb-2">{summary}</p>}

      {/* پیش‌نمایش کوتاه از محتوا (سه خط) */}
      {content && (
        <p className="text-gray-800 leading-relaxed line-clamp-3">{content}</p>
      )}

      {/* اکشن‌ها: مطالعه کامل + ذخیره در نشانک‌ها */}
      <div className="mt-3 flex items-center gap-3">
        {/* لینک به صفحه‌ی کامل مقاله */}
        <Link
          to={`/articles/${id}`}
          className="inline-block text-blue-600 hover:underline"
        >
          مطالعه کامل
        </Link>

        {/* دکمه‌ی نشانک‌کردن/برداشتن نشانک */}
        <button
          type="button"
          onClick={onBookmarkClick}
          disabled={saving || !id}
          className={`px-3 py-1.5 rounded-lg border text-sm transition ${
            saved
              ? "border-emerald-600 text-emerald-700 bg-emerald-50"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          } ${saving || !id ? "opacity-60 cursor-not-allowed" : ""}`}
          title={saved ? "حذف از نشانک‌ها" : "ذخیره در نشانک‌ها"}
          aria-pressed={saved}
        >
          {saving ? "در حال ذخیره…" : saved ? "در نشانک‌هاست" : "ذخیره"}
        </button>
      </div>
    </article>
  );
}
