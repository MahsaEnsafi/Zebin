// src/components/MyPhotos.jsx
import { useEffect, useState } from "react";
import { listMyPhotos, deleteMyPhoto } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/**
 * نگاشت کلاس‌های مدل به برچسب‌های فارسی
 * کلیدها باید دقیقاً با خروجی مدل (predicted_class) یکسان باشند.
 */
const FA_LABELS = {
  cardboard: "مقوا",
  glass: "شیشه",
  metal: "فلز",
  paper: "کاغذ",
  plastic: "پلاستیک",
  trash: "زبالهٔ متفرقه",
};

export default function MyPhotos() {
  // از کانتکست احراز هویت، base آدرس API را می‌گیریم (برای ساخت URL کامل)
  const { apiBase } = useAuth();

  // لیست رکوردهای عکس کاربر
  const [items, setItems] = useState([]);

  // فلگ بارگذاری و پیام خطا
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /**
   * buildPublicUrl(p):
   * برای هر رکورد عکس، URL قابل‌نمایش را می‌سازد.
   * - اگر بک‌اند خودش فیلد `url` را برگردانده باشد، همان استفاده می‌شود.
   * - اگر فقط `file_path` داشته باشیم، با پیشوند `/uploads/` می‌سازیم.
   * - اگر URL نسبی بود، با `apiBase` کامل می‌شود تا در مرورگر باز شود.
   */
  function buildPublicUrl(p) {
    // 1) ترجیح با urlی که از API آمده
    let u = p?.url;

    // 2) اگر url نداشتیم ولی file_path داریم، یک URL نسبی بساز
    if (!u && p?.file_path) {
      const clean = String(p.file_path).replace(/^\/+/, ""); // حذف اسلش‌های ابتدای مسیر
      u = `/uploads/${clean}`;
    }
    if (!u) return ""; // چیزی برای نمایش نداریم

    // 3) اگر نسبی است (با http/https شروع نمی‌شود) به apiBase بچسبان
    return /^https?:\/\//i.test(u) ? u : `${apiBase}${u.startsWith("/") ? "" : "/"}${u}`;
  }

  /**
   * prettyDate(p):
   * تاریخ نمایش‌دادنی از روی فیلدهای زمانی رکورد تولید می‌کند.
   * اولویت با `uploaded_at` است؛ اگر نبود از `created_at` استفاده می‌شود.
   * تلاش می‌کند به صورت محلی (fa-IR) فرمت کند؛ در غیراینصورت ISO را کوتاه می‌کند.
   */
  function prettyDate(p) {
    const raw = p?.uploaded_at || p?.created_at;
    if (!raw) return "";
    try {
      const d = new Date(raw);
      if (!isNaN(d)) {
        return d.toLocaleString("fa-IR"); // نمایش محلی (تاریخ/ساعت فارسی)
      }
    } catch {
      /* ignore */
    }
    // اگر تبدیل تاریخ موفق نبود، ISO را کمی خواناتر کنیم
    return String(raw).replace("T", " ").slice(0, 19);
  }

  /**
   * load():
   * لیست عکس‌ها را از سرور می‌گیرد (GET /me/photos) و در state می‌گذارد.
   * در صورت خطا، پیام خطا ست می‌شود اما UI از کار نمی‌افتد.
   */
  async function load() {
    try {
      setErr("");
      setLoading(true);
      const rows = await listMyPhotos(); // انتظار: آرایه‌ای از رکوردهای کاربر
      setItems(Array.isArray(rows) ? rows : []); // ایمن‌سازی در برابر پاسخ غیرآرایه
    } catch (e) {
      setErr(e?.message || "خطا در دریافت عکس‌ها");
    } finally {
      setLoading(false);
    }
  }

  // روی mount (بار اول) دیتا را بکش
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * onDelete(id):
   * حذف رکورد عکس کاربر با تایید کاربر.
   * پس از موفقیت، آیتم را از state پاک می‌کنیم (Optimistic UI).
   */
  async function onDelete(id) {
    if (!confirm("این عکس حذف شود؟")) return;
    try {
      await deleteMyPhoto(id); // DELETE /me/photos/{id}
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      alert(e?.message || "خطا در حذف عکس");
    }
  }

  return (
    <section className="text-right" dir="rtl">
      <h2 className="text-lg font-bold mb-4">عکس‌های من</h2>

      {/* جعبه‌ی خطا با دکمه‌ی تلاش مجدد */}
      {err && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 flex items-center justify-between">
          <span>{err}</span>
          <button
            onClick={load}
            className="text-rose-700 underline underline-offset-4"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {/* وضعیت بارگذاری */}
      {loading && <div className="text-sm text-zinc-500">در حال بارگذاری…</div>}

      {/* حالتِ بدون آیتم */}
      {!loading && !err && items.length === 0 && (
        <div className="text-sm text-zinc-500">فعلاً عکسی ندارید.</div>
      )}

      {/* گرید نمایش کارت‌های عکس */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((p) => {
          const url = buildPublicUrl(p);
          return (
            <div key={p.id} className="rounded-xl border overflow-hidden bg-white">
              {/* تصویر (اگر URL داشتیم)؛ با لینک به اصل عکس در تب جدید */}
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt=""
                    className="w-full aspect-[4/3] object-cover"
                  />
                </a>
              ) : (
                // Placeholder در صورت نبود تصویر
                <div className="w-full aspect-[4/3] grid place-items-center text-zinc-400">
                  بدون تصویر
                </div>
              )}

              {/* بدنه کارت: کلاس پیش‌بینی، اطمینان و تاریخ + حذف */}
              <div className="p-3 text-sm">
                <div>
                  <b>کلاس:</b>{" "}
                  {FA_LABELS[p.predicted_class] || p.predicted_class || "—"}
                </div>

                <div className="mt-1">
                  <b>اطمینان:</b>{" "}
                  {p.confidence != null
                    ? (Number(p.confidence) * 100).toFixed(1) + "%"
                    : "—"}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <time className="text-xs text-zinc-500">{prettyDate(p)}</time>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-rose-600 hover:underline"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
