// src/components/NewsItem.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { isAuthed, isBookmarked, toggleBookmark } from "../lib/api";

/**
 * NewsItem
 *  - یک کارت/آیتم خبر را نمایش می‌دهد (عنوان، خلاصه، بخشی از محتوا)
 *  - دکمه‌ی "مشاهده" برای رفتن به صفحه‌ی خبر
 *  - دکمه‌ی "ذخیره" برای افزودن/حذف از نشانک‌ها (Bookmarks)
 *
 * props:
 *  - id: شناسه‌ی خبر (برای لینک و نشانک الزامی است)
 *  - title: عنوان خبر
 *  - summary: خلاصه خبر (اختیاری)
 *  - content: متن خبر (برای پیش‌نمایش خطی)
 */
export default function NewsItem({ id, title, summary, content }) {
  // آیا این خبر در نشانک‌های کاربر ذخیره است؟
  const [saved, setSaved] = useState(false);
  // وضعیت در حال ارسال/تغییر نشانک (برای غیرفعال‌سازی دکمه)
  const [saving, setSaving] = useState(false);

  // ابزارهای مسیریابی برای هدایت کاربر (مثلاً به صفحه‌ی لاگین)
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * در بار اول (و هر بار که id عوض شود)، وضعیت اولیه‌ی نشانک را چک کن:
   * - اگر کاربر لاگین باشد و این خبر قبلاً ذخیره شده باشد، saved=true
   * - اگر خطایی رخ دهد، سکوت می‌کنیم تا UI خراب نشود
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) return; // اگر id نداریم، نشانک معنی ندارد
      try {
        const exists = await isBookmarked("news", id);
        if (!cancelled) setSaved(!!exists);
      } catch {
        /* نادیده بگیر: خطای شبکه/احراز هویت را اینجا سطح‌بندی نمی‌کنیم */
      }
    })();

    // cleanup برای جلوگیری از setState روی کامپوننت unmount‌شده
    return () => {
      cancelled = true;
    };
  }, [id]);

  /**
   * کلیک روی دکمه‌ی ذخیره/حذف از نشانک‌ها
   * - اگر کاربر لاگین نباشد، او را با پیام مناسب به /login هدایت می‌کنیم
   * - در غیر این صورت toggleBookmark را صدا می‌زنیم که وضعیت نهایی را برمی‌گرداند
   */
  async function onBookmarkClick() {
    if (!isAuthed()) {
      // هدایت به لاگین با state برای بازگشت به صفحه‌ی فعلی و پیام دوستانه
      navigate("/login", {
        replace: false,
        state: {
          from: location,
          msg: "برای ذخیره در نشانک‌ها باید وارد شوید.",
        },
      });
      return;
    }

    try {
      setSaving(true);
      // toggleBookmark: true => ذخیره شد | false => حذف شد
      const finalState = await toggleBookmark("news", id);
      setSaved(!!finalState);
    } catch (e) {
      // نمایش پیغام خطا به‌صورت ساده؛
      // می‌توان آن را به سیستم اعلان/Toast منتقل کرد
      alert(e?.message || "خطا در به‌روزرسانی نشانک");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="news-item border p-4 rounded-lg shadow-sm bg-white"
      dir="rtl"
    >
      {/* عنوان خبر */}
      <h2 className="font-bold text-lg mb-2">{title}</h2>

      {/* خلاصه (اختیاری) */}
      {summary && <p className="text-gray-600 text-sm mb-2">{summary}</p>}

      {/* پیش‌نمایش کوتاه از متن (سه خط) */}
      {content && (
        <p className="text-gray-800 leading-relaxed line-clamp-3">{content}</p>
      )}

      {/* دکمه‌ها: مشاهده + ذخیره/حذف از نشانک‌ها */}
      <div className="mt-3 flex items-center gap-3">
        {/* لینک مشاهده‌ی کامل خبر */}
        <Link
          to={`/news/${id}`}
          className="inline-block px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          مشاهده
        </Link>

        {/* دکمه‌ی ذخیره/حذف از نشانک‌ها
            - در حالت saving یا نبود id غیرفعال می‌شود
            - با saved استایل/متن تغییر می‌کند */}
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
          aria-pressed={saved} /* برای دسترس‌پذیری */
        >
          {saving ? "در حال ذخیره…" : saved ? "در نشانک‌هاست" : "ذخیره"}
        </button>
      </div>
    </article>
  );
}
