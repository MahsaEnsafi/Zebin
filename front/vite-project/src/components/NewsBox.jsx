// src/components/NewsBox.jsx
import NewsItem from "./NewsItem";
import { useState, useEffect } from "react";

/**
 * آدرس پایه‌ی API:
 * - از متغیر محیطی VITE_API_BASE (در زمان build) خوانده می‌شود
 * - اگر ست نبود، به localhost روی پورت 8000 برمی‌گردد
 */
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/**
 * NewsBox:
 * - فهرست خبرها را از بک‌اند واکشی می‌کند (GET /news)
 * - وضعیت‌های بارگذاری/خطا/خالی را مدیریت می‌کند
 * - هر خبر را با کامپوننت NewsItem نمایش می‌دهد
 */
export default function NewsBox() {
  // state برای آرایه‌ی خبرها
  const [news, setNews] = useState([]);
  // state برای نمایش اسپینر/اسکلتون
  const [loading, setLoading] = useState(true);
  // state برای نگه‌داشتن پیام خطا (اگر fetch شکست بخورد)
  const [error, setError] = useState("");

  /**
   * useEffect (on mount):
   * - فقط یک بار اجرا می‌شود
   * - خبرها را از سرور می‌گیرد
   */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(""); // هر خطای قبلی را پاک کن

        // فراخوانی اندپوینت خبرها
        const res = await fetch(`${API_BASE}/news`);

        // اگر پاسخ 2xx نبود، یک خطا پرتاب کن تا به catch برویم
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // انتظار: آرایه‌ای از خبرها
        const data = await res.json();

        // اطمینان از آرایه بودن پاسخ (در صورت نیاز می‌توان بررسی‌های بیشتری کرد)
        setNews(Array.isArray(data) ? data : []);
      } catch (e) {
        // پیام خطای کاربرپسند
        setError("خطا در دریافت اخبار");
      } finally {
        // چه موفق چه ناموفق، بارگذاری پایان یافته
        setLoading(false);
      }
    }

    load();
  }, []); // وابستگی خالی یعنی فقط بار اول اجرا شود

  // حالت‌های مختلف UI بر اساس وضعیت
  if (loading) return <p>در حال بارگذاری....</p>;

  if (error) return <p className="text-red-600">{error}</p>;

  if (news.length === 0) return <p>هیچ خبری موجود نیست</p>;

  return (
    <div className="space-y-6">
      {news.map((n) => (
        // نکته‌ی مهم: key لازم است تا React لیست را بهینه مدیریت کند
        <NewsItem
          key={n.id}             // ← اضافه شد
          id={n.id}
          title={n.title}
          summary={n.summary}
          content={n.content}
        />
      ))}
    </div>
  );
}

