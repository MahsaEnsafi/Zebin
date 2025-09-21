// src/components/ArticleBox.jsx
// ============================================================================
// «ArticleBox»
// ----------------------------------------------------------------------------
// این کامپوننت فهرست مقالات را از بک‌اند می‌گیرد و آن‌ها را با کمک
// کامپوننت فرزند «ArticleItem» نمایش می‌دهد.
//
// جریان کار:
//   1) در mount کامپوننت، یک درخواست GET به /articles می‌زنیم.
//   2) تا زمان اتمام درخواست، حالت loading=true است.
//   3) اگر پاسخ موفق نبود، پیام خطا نشان داده می‌شود.
//   4) در صورت موفقیت، آرایهٔ مقالات در state ذخیره و رندر می‌شود.
//
// نکات اجرایی:
//   • آدرس API از متغیر محیطی VITE_API_BASE خوانده می‌شود (فایل .env).
//     اگر ست نشده باشد، به  http://127.0.0.1:8000  برمی‌گردد.
//   • این کامپوننت هیچ propsی نمی‌گیرد و صرفاً لیست را نمایش می‌دهد.
//   • برای هر مقاله، «ArticleItem» را با props موردنیاز صدا می‌زنیم.
//   • می‌توانید در صورت نیاز، صفحه‌بندی/جستجو/فیلتر را بعداً اضافه کنید.
// ============================================================================

import { useEffect, useState } from "react";
import ArticleItem from "./ArticleItem";

// آدرس پایهٔ API (قابل تنظیم از طریق VITE_API_BASE)
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function ArticleBox() {
  // لیست مقالات
  const [articles, setArticles] = useState([]);
  // وضعیت بارگذاری
  const [loading, setLoading] = useState(true);
  // پیام خطا (در صورت وقوع)
  const [error, setError] = useState("");

  useEffect(() => {
    // تابع غیربلاک برای فراخوانی API
    async function load() {
      try {
        setLoading(true);
        setError("");

        // GET /articles
        const res = await fetch(`${API_BASE}/articles`);

        // اگر پاسخ OK نبود، خطا بده
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // بدنهٔ JSON را بخوان
        const data = await res.json();

        // انتظار می‌رود data آرایه‌ای از مقالات باشد
        setArticles(Array.isArray(data) ? data : []);
      } catch (e) {
        // پیام خطای یوزرفرندلی
        setError("خطا در دریافت مقالات");
      } finally {
        // چه خطا چه موفق، بارگذاری تمام شد
        setLoading(false);
      }
    }

    // در mount یک بار داده‌ها را بگیر
    load();
  }, []);

  // حالت‌های نمایشی بر اساس وضعیت
  if (loading) return <p>در حال بارگذاری…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (articles.length === 0) return <p>هیچ مقاله‌ای موجود نیست</p>;

  // رندر لیست مقالات با استفاده از ArticleItem
  return (
    <div className="space-y-6">
      {articles.map((a) => (
        <ArticleItem
          key={a.id}
          id={a.id}
          title={a.title}
          summary={a.summary}
          content={a.content}
        />
      ))}
    </div>
  );
}
