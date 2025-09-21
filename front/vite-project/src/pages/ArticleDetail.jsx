// src/pages/ArticleDetail.jsx
import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";

export default function ArticleDetail({ apiBase }) {
  // گرفتن id از آدرس (مثلاً /articles/42)
  const { id } = useParams();

  // آدرس پایه‌ی API: یا prop دریافتی، یا متغیر محیطی VITE_API_BASE، یا لوکال
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // stateها: شیء مقاله و پیام خطا
  const [article, setArticle] = useState(null);
  const [error, setError] = useState("");

  // واکشی جزئیات مقاله وقتی کامپوننت mount می‌شود یا id/BASE عوض می‌شود
  useEffect(() => {
    (async () => {
      try {
        // درخواست GET برای /articles/:id
        const res = await fetch(`${BASE}/articles/${id}`);
        if (!res.ok) throw new Error("مقاله پیدا نشد");

        // تبدیل پاسخ به JSON و ذخیره در state
        const data = await res.json();
        setArticle(data);
      } catch (e) {
        // اگر خطا بود، پیام را در state بگذار تا به کاربر نشان دهیم
        setError(e.message);
      }
    })();

    // نکته‌ی اختیاری: اگر نگران race/abort هستی می‌توانی از AbortController استفاده کنی
    // و در return همین useEffect آن را abort کنی تا memory leak نشود.
  }, [BASE, id]);

  // حالت خطا
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  // حالت در حال بارگذاری (تا زمانی که article نیامده)
  if (!article) return <div className="p-4">در حال بارگذاری…</div>;

  // رندر صفحه‌ی جزئیات مقاله
  return (
    <div dir="rtl" className="container mx-auto px-4 py-8">
      {/* عنوان مقاله */}
      <h1 className="text-2xl font-bold mb-2">{article.title}</h1>

      {/* اگر دسته‌بندی وجود دارد نشان بده */}
      {article.category && (
        <p className="text-sm opacity-70 mb-4">دسته‌بندی: {article.category}</p>
      )}

      {/* تصویر شاخص مقاله (اختیاری) */}
      {article.image && (
        <img
          src={article.image}
          alt={article.title}
          className="mb-4 rounded-xl"
        />
      )}

      {/* خلاصه مقاله (اختیاری) */}
      {article.summary && <p className="mb-4">{article.summary}</p>}

      {/* متن مقاله */}
      <div className="prose max-w-none">
        {/*
          اگر content متنی ساده است (plain text) همین کافی‌ست.
          اگر بک‌اند HTML برمی‌گرداند و می‌خواهی قالب‌بندی HTML حفظ شود:
          به‌جای نودِ متن، از dangerouslySetInnerHTML استفاده کن (با دقت امنیتی):
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: article.content || "" }}
          />
          ⚠️ حتماً مطمئن شو که HTML از سمت سرور sanitize شده باشد.
        */}
        {article.content}
      </div>

      {/* لینک منبع (اختیاری) */}
      {article.source && (
        <p className="mt-6 text-sm">
          منبع:{" "}
          <a
            href={article.source}
            className="text-blue-600 underline"
            target="_blank"
            rel="noreferrer"
          >
            {article.source}
          </a>
        </p>
      )}

      {/* لینک بازگشت به فهرست مقالات */}
      <div className="mt-8">
        <Link to="/articles" className="text-blue-600 underline">
          بازگشت به لیست مقالات
        </Link>
      </div>
    </div>
  );
}
