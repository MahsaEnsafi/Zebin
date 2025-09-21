// src/pages/NewsDetail.jsx
/**
 * نمایش جزئیات یک خبر
 * ------------------------------------------------------------------
 * این صفحه با گرفتن شناسه خبر از URL (پارامتر :id در react-router)
 * محتوای کامل همان خبر را از API دریافت و نمایش می‌دهد.
 *
 * props:
 * - apiBase?: string   ← اگر پاس داده نشود از VITE_API_BASE یا لوکال استفاده می‌کند.
 *
 * نکته‌ها:
 * - وضعیت‌های «در حال بارگذاری»، «خطا» و «موفق» را مدیریت می‌کنیم.
 * - اگر بک‌اند به‌جای image_url فیلد image برگرداند، باید بخش تصویر را مطابق آن تغییر دهید.
 */

import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";

export default function NewsDetail({ apiBase }) {
  // 1) گرفتن id از آدرس (مثلاً /news/42 → id="42")
  const { id } = useParams();

  // 2) تعیین آدرس پایهٔ API
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // 3) استیت‌ها: خبر و پیام خطا
  const [news, setNews] = useState(null);
  const [error, setError] = useState("");

  // 4) واکشی خبر هنگام mount و هر زمان id یا BASE تغییر کند
  useEffect(() => {
    (async () => {
      try {
        // درخواست به /news/:id
        const res = await fetch(`${BASE}/news/${id}`);
        if (!res.ok) throw new Error("خبر پیدا نشد");

        // تبدیل پاسخ به JSON و ذخیره در state
        const data = await res.json();
        setNews(data);
      } catch (e) {
        // در صورت خطا پیام مناسب را نشان می‌دهیم
        setError(e.message);
      }
    })();
  }, [BASE, id]);

  // 5) حالت‌های مختلف رندر
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!news) return <div className="p-4">در حال بارگذاری…</div>;

  // 6) UI نهایی خبر
  return (
    <div dir="rtl" className="container mx-auto px-4 py-8">
      {/* عنوان خبر */}
      <h1 className="text-2xl font-bold mb-4">{news.title}</h1>

      {/* تصویر خبر (در صورت وجود) */}
      {news.image_url && (
        <img
          src={news.image_url}
          alt={news.title}
          className="mb-4 rounded-xl"
        />
      )}
      {/* اگر API شما فیلد image برمی‌گرداند:
          {news.image && <img src={news.image} alt={news.title} … />} */}

      {/* خلاصه خبر (اختیاری) */}
      {news.summary && <p className="mb-4">{news.summary}</p>}

      {/* متن خبر — اگر HTML است و قصد رندر HTML دارید باید از dangerouslySetInnerHTML استفاده کنید.
          در حال حاضر به شکل متن ساده رندر می‌شود. */}
      <div className="prose max-w-none">{news.content}</div>

      {/* منبع خبر (اختیاری) */}
      {news.source && (
        <p className="mt-6 text-sm">
          منبع:{" "}
          <a
            href={news.source}
            className="text-blue-600 underline"
            target="_blank"
            rel="noreferrer"
          >
            {news.source}
          </a>
        </p>
      )}
    </div>
  );
}
