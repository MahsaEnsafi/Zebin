import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* =========================================================================
   AdminTools (مدیریت خبرها)
   - یک سوییچر ساده بین سه حالت است:
     1) manage : فهرست و حذف خبرها
     2) add    : فرم افزودن خبر جدید
     3) edit   : فرم ویرایش خبر موجود (بر اساس id در کوئری‌استرینگ)
   - حالت جاری بر اساس query string آدرس (mode & id) سینک می‌شود.
   ========================================================================= */
export default function AdminTools({ apiBase }) {
  const location = useLocation();         // دسترسی به آدرس/کوئری فعلی
  const navigate = useNavigate();         // جابه‌جایی بین مسیرها

  const [mode, setMode] = useState("manage"); // حالت UI: 'manage' | 'add' | 'edit'
  const [editId, setEditId] = useState(null); // شناسه خبر در حالت ویرایش

  // هر بار که querystring تغییر کند، حالت‌ها را به‌روز کن
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const m = qs.get("mode"); // مثل: add یا edit-news
    const id = qs.get("id");  // شناسهٔ خبر برای ویرایش

    if (m === "edit-news" && id) {
      setMode("edit");
      setEditId(id);
    } else if (m === "add") {
      setMode("add");
      setEditId(null);
    } else {
      setMode("manage");
      setEditId(null);
    }
  }, [location.search]);

  return (
    <section className="rounded-2xl border p-5 bg-rose-50/60">
      <h3 className="font-bold text-zinc-800 mb-3">مدیریت خبرها</h3>

      {/* دکمه‌های سوییچ حالت (تب‌های ساده) */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          className={`px-4 py-2 rounded-xl border ${
            mode === "manage" ? "bg-rose-600 text-white border-rose-600" : ""
          }`}
          onClick={() => navigate("/profile")} // بازگشت به حالت فهرست (بدون query)
        >
          فهرست خبرها
        </button>

        <button
          className={`px-4 py-2 rounded-xl border ${
            mode === "add" ? "bg-emerald-600 text-white border-emerald-600" : ""
          }`}
          onClick={() => navigate("/profile?mode=add")} // رفتن به فرم افزودن
        >
          افزودن خبر جدید
        </button>
      </div>

      {/* رندر شرطیِ بخش‌ها بر اساس mode */}
      {mode === "add" && <CreateNewsForm apiBase={apiBase} />}
      {mode === "manage" && <NewsManager apiBase={apiBase} />}
      {mode === "edit" && (
        <EditNewsForm
          apiBase={apiBase}
          id={editId}
          onDone={() => navigate("/profile")} // پس از ذخیره، بازگشت به فهرست
        />
      )}
    </section>
  );
}

/* =========================================================================
   NewsManager
   - فهرست خبرها + جستجو + حذف
   - خواندن لیست از GET /news
   - حذف با DELETE /news/:id
   ========================================================================= */
function NewsManager({ apiBase }) {
  // آدرس پایهٔ API (از props یا .env یا مقدار پیش‌فرض)
  const BASE = apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // وضعیت‌ها
  const [items, setItems] = useState([]);       // آرایهٔ خبرها
  const [q, setQ] = useState("");               // عبارت جستجو
  const [loading, setLoading] = useState(true); // لودینگ لیست
  const [busyId, setBusyId] = useState(null);   // هنگام حذف، id موردنظر را قفل می‌کنیم
  const [error, setError] = useState("");       // پیام خطا

  // توکن برای عملیات محافظت‌شده (در صورت نیاز)
  const token = localStorage.getItem("access_token");

  // هدرهای درخواست؛ با useMemo تا در هر رندر دوباره ساخته نشوند
  const headers = useMemo(() => {
    const h = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // واکشی لیست خبرها؛ هر بار q یا BASE یا headers عوض شد
  useEffect(() => {
    let ignore = false; // برای جلوگیری از setState پس از unmount

    async function load() {
      setLoading(true);
      setError("");
      try {
        // اگر بک‌اند از جستجو پشتیبانی می‌کند، q را در querystring بفرست
        const url = new URL(`${BASE}/news`);
        if (q) url.searchParams.set("q", q);

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("خطا در دریافت لیست خبرها");

        const data = await res.json();
        if (!ignore) setItems(data); // فرض بر این است که بک‌اند آرایه می‌دهد
      } catch (e) {
        if (!ignore) setError(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [BASE, headers, q]);

  // حذف یک خبر
  const handleDelete = async (id) => {
    if (!confirm("از حذف این خبر مطمئن هستید؟")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`${BASE}/news/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        // بک‌اند ممکن است detail بدهد
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "حذف انجام نشد");
      }
      // موفق: خبر را از لیست محلی حذف کن
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* جستجو */}
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded border p-2"
          placeholder="جستجو در عنوان/متن"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="rounded border px-3 py-2" onClick={() => setQ("")}>
          پاک‌سازی
        </button>
      </div>

      {/* نمایش خطا (درصورت وجود) */}
      {error && (
        <div className="rounded bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {/* جدول خبرها */}
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
            {/* حالت‌های مختلف نمایش بدنهٔ جدول */}
            {loading ? (
              <tr>
                <td className="p-3" colSpan={4}>در حال بارگذاری…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={4}>خبری یافت نشد</td>
              </tr>
            ) : (
              items.map((n, i) => (
                <tr key={n.id} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">
                    <div className="font-medium">{n.title}</div>
                    {n.summary && (
                      <div className="opacity-70 line-clamp-1">{n.summary}</div>
                    )}
                  </td>
                  <td className="p-2">{n.category || "-"}</td>
                  <td className="p-2 space-x-2 space-x-reverse">
                    {/* لینک مشاهدهٔ خبر (صفحهٔ عمومی) */}
                    <Link className="rounded border px-2 py-1" to={`/news/${n.id}`}>
                      مشاهده
                    </Link>

                    {/* رفتن به حالت ویرایش در همین صفحهٔ پروفایل */}
                    <Link
                      className="rounded border px-2 py-1"
                      to={`/profile?mode=edit-news&id=${n.id}`}
                    >
                      ویرایش
                    </Link>

                    {/* حذف خبر */}
                    <button
                      onClick={() => handleDelete(n.id)}
                      disabled={busyId === n.id}
                      className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-50"
                    >
                      {busyId === n.id ? "…" : "حذف"}
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

/* =========================================================================
   CreateNewsForm
   - فرم افزودن خبر جدید
   - POST /news  با بدنهٔ JSON
   - فیلدها: title, summary, content, category, source, image_url
   ========================================================================= */
function CreateNewsForm({ apiBase }) {
  const BASE = apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // فیلدهای فرم
  const [title, setTitle]       = useState("");
  const [summary, setSummary]   = useState("");
  const [content, setContent]   = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource]     = useState("");

  const [loading, setLoading] = useState(false); // وضعیت ارسال
  const [msg, setMsg]         = useState("");   // پیام نتیجه

  const token = localStorage.getItem("access_token");

  // ارسال فرم
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/news`, {
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
          image_url: imageUrl, // نام فیلد هماهنگ با بک‌اند
        }),
      });

      if (!res.ok) {
        // خطای متنی را هم نمایش بدهیم
        const t = await res.text();
        throw new Error(`خطا: ${res.status} - ${t}`);
      }

      // موفق: پیام و ریست فرم
      setMsg("✅ خبر با موفقیت ثبت شد.");
      setTitle("");
      setSummary("");
      setContent("");
      setImageUrl("");
      setCategory("");
      setSource("");
    } catch (err) {
      setMsg(err.message || "❌ خطا در ثبت خبر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-3 bg-white border rounded-xl p-4">
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
        <label className="block text-sm mb-1">متن خبر *</label>
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
          <label className="block text-sm mb-1">منبع خبر</label>
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
          {loading ? "در حال ارسال..." : "ثبت خبر"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}

/* =========================================================================
   EditNewsForm
   - بارگذاری خبر موجود با GET /news/:id و پر کردن فرم
   - ذخیره با PUT /news/:id
   - پس از موفقیت، onDone() صدا زده می‌شود تا به فهرست برگردد.
   ========================================================================= */
function EditNewsForm({ apiBase, id, onDone }) {
  const BASE = apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // فیلدهای فرم
  const [title, setTitle]       = useState("");
  const [summary, setSummary]   = useState("");
  const [content, setContent]   = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource]     = useState("");

  const [loading, setLoading] = useState(true);  // لود اولیهٔ محتوا
  const [saving, setSaving]   = useState(false); // وضعیت ذخیره
  const [msg, setMsg]         = useState("");    // پیام نتیجه

  const token = localStorage.getItem("access_token");

  // بارگذاری خبر برای پر کردن فرم
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/news/${id}`);
        if (!res.ok) throw new Error("خبر پیدا نشد");
        const data = await res.json();
        if (stop) return;

        // مقداردهی فیلدها از دادهٔ دریافتی
        setTitle(data.title || "");
        setSummary(data.summary || "");
        setContent(data.content || "");
        setCategory(data.category || "");
        setSource(data.source || "");
        setImageUrl(data.image_url || data.image || "");
      } catch (e) {
        setMsg(e.message || "خطا در دریافت خبر");
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => { stop = true; };
  }, [BASE, id]);

  // ذخیرهٔ تغییرات
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`${BASE}/news/${id}`, {
        method: "PUT", // اگر بک‌اند PATCH دارد، می‌توانید تغییر دهید
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
          image_url: imageUrl, // بسته به نام فیلد در بک‌اند
          image: imageUrl,     // اگر ستون دیتابیس 'image' باشد
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`خطا: ${res.status} - ${t}`);
      }

      setMsg("✅ تغییرات ذخیره شد.");
      onDone?.(); // بازگشت به فهرست
    } catch (err) {
      setMsg(err.message || "❌ خطا در ذخیره تغییرات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">در حال بارگذاری…</div>;

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-3 bg-white border rounded-xl p-4">
      <h4 className="font-bold text-lg mb-2">ویرایش خبر #{id}</h4>

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
        <label className="block text-sm mb-1">متن خبر *</label>
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
          <label className="block text-sm mb-1">منبع خبر</label>
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

        <button type="button" onClick={onDone} className="px-4 py-2 rounded-xl border">
          انصراف
        </button>

        {msg && <span className="text-sm">{msg}</span>}
      </div>
    </form>
  );
}
