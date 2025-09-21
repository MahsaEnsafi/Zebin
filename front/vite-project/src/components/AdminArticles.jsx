// src/components/AdminArticles.jsx
/**
 * مدیریت مقالات علمی (AdminArticles)
 *
 * این فایل سه بخش اصلی دارد:
 *  1) <AdminArticles />: سوییچر صفحه‌ی مدیریت که بین حالت‌های «فهرست»، «افزودن»، «ویرایش» جابه‌جا می‌شود.
 *  2) <ArticlesManager />: فهرست‌کردن، جستجو و حذف مقاله‌ها.
 *  3) <CreateArticleForm />: فرم افزودن مقاله‌ی جدید.
 *  4) <EditArticleForm />: فرم ویرایش مقاله‌ی موجود.
 *
 * قراردادهای API (با بک‌اند شما هماهنگ است):
 *  GET    /articles                 → فهرست مقالات (در صورت نیاز با ?q= برای جستجو)
 *  POST   /articles                 → ایجاد مقاله‌ی جدید
 *  GET    /articles/:id             → دریافت جزئیات مقاله
 *  PUT    /articles/:id             → بروزرسانی مقاله
 *  DELETE /articles/:id             → حذف مقاله
 *
 * نکته‌ها:
 *  - برای درخواست‌های محافظت‌شده، اگر توکن در localStorage باشد در هدر Authorization → Bearer اضافه می‌شود.
 *  - ناوبری بین حالت‌ها از طریق querystring (mode, id) انجام می‌شود تا URL قابل اشتراک باشد.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* --------------------------- کامپوننت اصلی --------------------------- */
export default function AdminArticles({ apiBase }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState("manage"); // حالت فعلی: manage | add | edit
  const [editId, setEditId] = useState(null); // شناسه‌ی رکوردی که باید ویرایش شود

  // هر بار querystring تغییر کند، حالت و شناسه را با URL همگام می‌کنیم
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const m = qs.get("mode");
    const id = qs.get("id");

    if (m === "edit-article" && id) {
      setMode("edit");
      setEditId(id);
    } else if (m === "add-article") {
      setMode("add");
      setEditId(null);
    } else {
      setMode("manage");
      setEditId(null);
    }
  }, [location.search]);

  return (
    <section className="rounded-2xl border p-5 bg-rose-50/60">
      <h3 className="font-bold text-zinc-800 mb-3">مدیریت مقالات علمی</h3>

      {/* دکمه‌های جابه‌جایی بین حالت‌ها */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* بازگشت به فهرست (manage) */}
        <button
          className={`px-4 py-2 rounded-xl border ${
            mode === "manage" ? "bg-rose-600 text-white border-rose-600" : ""
          }`}
          onClick={() => navigate("/profile")}
        >
          فهرست مقالات
        </button>

        {/* رفتن به حالت افزودن مقاله */}
        <button
          className={`px-4 py-2 rounded-xl border ${
            mode === "add" ? "bg-emerald-600 text-white border-emerald-600" : ""
          }`}
          onClick={() => navigate("/profile?mode=add-article")}
        >
          افزودن مقاله جدید
        </button>
      </div>

      {/* رندر بر اساس حالت */}
      {mode === "add" && <CreateArticleForm apiBase={apiBase} />}
      {mode === "manage" && <ArticlesManager apiBase={apiBase} />}
      {mode === "edit" && (
        <EditArticleForm
          apiBase={apiBase}
          id={editId}
          onDone={() => navigate("/profile")}
        />
      )}
    </section>
  );
}

/* ------------------------- لیست و حذف مقاله ------------------------- */
function ArticlesManager({ apiBase }) {
  // آدرس پایه‌ی API؛ اگر prop داده نشد، از env استفاده می‌کنیم
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // State ها
  const [items, setItems] = useState([]);     // لیست مقالات
  const [q, setQ] = useState("");             // عبارت جستجو
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // برای دکمه‌ی حذفِ در حال پردازش
  const [error, setError] = useState("");

  // توکن (در صورت وجود) را برای درخواست‌های حذف/مدیریت اضافه می‌کنیم
  const token = localStorage.getItem("access_token");
  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // بارگذاری فهرست مقالات (و فیلتر جستجو)
  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        // اگر بک‌اند امکان جستجو دارد، ?q= را ست می‌کنیم
        const url = new URL(`${BASE}/articles`);
        if (q) url.searchParams.set("q", q);

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("خطا در دریافت فهرست مقالات");

        const data = await res.json();
        if (!ignore) {
          // اگر پاسخ مستقیم آرایه بود همان را می‌گذاریم، در غیر این صورت items را بردار
          setItems(Array.isArray(data) ? data : (data.items ?? []));
        }
      } catch (e) {
        if (!ignore) setError(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [BASE, headers, q]);

  // حذف یک مقاله با تایید کاربر
  const handleDelete = async (id) => {
    if (!confirm("از حذف این مقاله مطمئن هستید؟")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`${BASE}/articles/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        // تلاش برای خواندن پیام خطای بک‌اند
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "حذف انجام نشد");
      }
      // حذف آیتم از state
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* نوار جستجو */}
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded border p-2"
          placeholder="جستجو در عنوان/خلاصه/متن"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="rounded border px-3 py-2" onClick={() => setQ("")}>
          پاک‌سازی
        </button>
      </div>

      {/* پیام خطا */}
      {error && (
        <div className="rounded bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {/* جدول فهرست مقالات */}
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-right">
              <th className="p-2">#</th>
              <th className="p-2">عنوان</th>
              <th className="p-2">دسته‌بندی</th>
              <th className="p-2">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              // ردیف لودینگ
              <tr>
                <td className="p-3" colSpan={4}>در حال بارگذاری…</td>
              </tr>
            ) : items.length === 0 ? (
              // خالی بودن لیست
              <tr>
                <td className="p-3" colSpan={4}>مقاله‌ای یافت نشد</td>
              </tr>
            ) : (
              // رندر آیتم‌ها
              items.map((a, i) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">
                    <div className="font-medium">{a.title}</div>
                    {a.summary && (
                      <div className="opacity-70 line-clamp-1">{a.summary}</div>
                    )}
                  </td>
                  <td className="p-2">{a.category || "-"}</td>
                  <td className="p-2 space-x-2 space-x-reverse">
                    {/* لینک مشاهده‌ی عمومی مقاله */}
                    <Link className="rounded border px-2 py-1" to={`/articles/${a.id}`}>
                      مشاهده
                    </Link>

                    {/* رفتن به حالت ویرایش در صفحه‌ی پروفایل/ادمین */}
                    <Link
                      className="rounded border px-2 py-1"
                      to={`/profile?mode=edit-article&id=${a.id}`}
                    >
                      ویرایش
                    </Link>

                    {/* حذف مقاله */}
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={busyId === a.id}
                      className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-50"
                    >
                      {busyId === a.id ? "…" : "حذف"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------- افزودن مقاله --------------------------- */
function CreateArticleForm({ apiBase }) {
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // State فیلدهای فرم
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // توکن برای هدر Authorization
  const token = localStorage.getItem("access_token");

  // ارسال فرم ایجاد مقاله
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/articles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          summary,
          content,
          category,
          source,
          image: imageUrl, // 👈 طبق مدل بک‌اند شما فیلد «image»
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`خطا: ${res.status} - ${t}`);
      }

      // ریست فرم و پیام موفقیت
      setMsg("✅ مقاله با موفقیت ثبت شد.");
      setTitle("");
      setSummary("");
      setContent("");
      setImageUrl("");
      setCategory("");
      setSource("");
    } catch (err) {
      setMsg(err.message || "❌ خطا در ثبت مقاله");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 grid gap-3 bg-white border rounded-xl p-4"
    >
      <div>
        <label className="block text-sm mb-1">عنوان *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">خلاصه</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">متن مقاله *</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>

      {/* فیلدهای جانبی */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">دسته‌بندی</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Image URL</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">منبع</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={loading}
          className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "در حال ارسال..." : "ثبت مقاله"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}

/* --------------------------- ویرایش مقاله --------------------------- */
function EditArticleForm({ apiBase, id, onDone }) {
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // State فیلدها + وضعیت
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);  // بارگذاری اولیه‌ی داده
  const [saving, setSaving] = useState(false);   // ذخیره تغییرات
  const [msg, setMsg] = useState("");

  const token = localStorage.getItem("access_token");

  // بارگذاری مقاله برای پر کردن فرم ویرایش
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/articles/${id}`);
        if (!res.ok) throw new Error("مقاله پیدا نشد");
        const a = await res.json();
        if (stop) return;

        // پر کردن فیلدها با داده‌ی دریافتی
        setTitle(a.title || "");
        setSummary(a.summary || "");
        setContent(a.content || "");
        setCategory(a.category || "");
        setSource(a.source || "");
        setImageUrl(a.image || a.image_url || "");
      } catch (e) {
        setMsg(e.message || "خطا در دریافت مقاله");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [BASE, id]);

  // ارسال فرم ویرایش (PUT/PATCH)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${BASE}/articles/${id}`, {
        method: "PUT", // اگر بک‌اند شما PATCH می‌پسندد، همین را به PATCH تغییر دهید
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          summary,
          content,
          category,
          source,
          image: imageUrl, // 👈 هم‌نام با بک‌اند
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`خطا: ${res.status} - ${t}`);
      }

      setMsg("✅ تغییرات ذخیره شد.");
      onDone?.(); // پس از موفقیت، به لیست برگرد
    } catch (err) {
      setMsg(err.message || "❌ خطا در ذخیره تغییرات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">در حال بارگذاری…</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 grid gap-3 bg-white border rounded-xl p-4"
    >
      <h4 className="font-bold text-lg mb-2">ویرایش مقاله #{id}</h4>

      <div>
        <label className="block text-sm mb-1">عنوان *</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm mb-1">خلاصه</label>
        <input
          className="w-full border rounded-lg px-3 py-2"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">متن مقاله *</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2"
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>

      {/* فیلدهای جانبی */}
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">دسته‌بندی</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Image URL</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">منبع</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
        </button>

        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-xl border"
        >
          انصراف
        </button>

        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
