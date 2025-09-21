// src/components/GuideBox.jsx
// -----------------------------------------------------------------------------
// نمایش «راهنمای تفکیک» به‌صورت کارت‌های دسته‌بندی‌شده + جستجو + آکاردئون
// APIهای مورد انتظار:
//   GET  /guide/                         → آرایه‌ای از دسته‌ها [{slug, name, description, color, ...}]
//   GET  /guide/:slug/items              → آرایه‌ای از آیتم‌ها [{id, kind:"yes|no|prep|note", text}]
// این کامپوننت، هم دسته‌ها را می‌گیرد و هم آیتم‌های هر دسته را برای نمایش داخل کارت.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import GuideCard from "./GuideCard";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/** 
 * useHashOpen
 * ----------------------------
 * اگر آدرس صفحه شامل #slug باشد، همان دسته در آکاردئون باز شود.
 * مثال: /guide#plastic  → دسته‌ی plastic باز می‌شود.
 */
function useHashOpen() {
  const { hash } = useLocation();
  // hash به صورت "#something" است؛ # را حذف می‌کنیم
  return (hash || "").replace("#", "") || null;
}

/**
 * SkeletonCards
 * ----------------------------
 * اسکلت لودینگ برای کارت‌ها (فقط UI)
 */
function SkeletonCards({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse border rounded-2xl p-5 bg-white">
          <div className="h-5 w-2/3 bg-slate-200 rounded mb-3" />
          <div className="h-4 w-full bg-slate-200 rounded mb-2" />
          <div className="h-4 w-5/6 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function GuideBox() {
  // لیست دسته‌ها از /guide/
  const [cats, setCats] = useState([]);
  // نگاشت slug → آرایه آیتم‌ها (برای هر دسته، آیتم‌های مخصوص خودش)
  const [itemsBySlug, setItemsBySlug] = useState({});
  // وضعیت درخواست‌ها برای مدیریت UI
  const [status, setStatus] = useState("idle"); // "loading" | "success" | "error"
  const [err, setErr] = useState("");
  // عبارت جستجو
  const [q, setQ] = useState("");

  // کنترل آکاردئون از طریق hash
  const hashOpen = useHashOpen();
  const [openSlug, setOpenSlug] = useState(hashOpen);
  useEffect(() => setOpenSlug(hashOpen), [hashOpen]);

  /**
   * واکشی داده‌ها:
   * 1) گرفتن دسته‌ها
   * 2) برای هر دسته، گرفتن آیتم‌هایش
   * از AbortController برای لغو درخواست‌ها هنگام unmount استفاده می‌کنیم.
   */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setStatus("loading");
        setErr("");

        // --- 1) دریافت دسته‌ها
        const r = await fetch(`${API_BASE}/guide/`, {
          signal: ac.signal,
          credentials: "include",          // اگر بک‌اند کوکی نیاز ندارد، حذفش هم مشکلی ندارد
          headers: { Accept: "application/json" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const categories = await r.json();
        const list = Array.isArray(categories) ? categories : [];
        setCats(list);

        // --- 2) دریافت آیتم‌های هر دسته (به‌صورت موازی)
        const entries = await Promise.all(
          list.map(async (c) => {
            try {
              const rr = await fetch(
                `${API_BASE}/guide/${encodeURIComponent(c.slug)}/items`,
                { signal: ac.signal, headers: { Accept: "application/json" } }
              );
              const arr = rr.ok ? await rr.json() : [];
              return [c.slug, Array.isArray(arr) ? arr : []];
            } catch {
              // اگر برای یک دسته خطا شد، نمایش آن دسته بدون آیتم‌ها ادامه می‌یابد
              return [c.slug, []];
            }
          })
        );
        setItemsBySlug(Object.fromEntries(entries));

        setStatus("success");
      } catch (e) {
        // اگر کامپوننت unmount شود، خطای AbortError طبیعی است
        if (e.name !== "AbortError") {
          setErr("خطا در دریافت داده");
          setStatus("error");
        }
      }
    })();
    // cleanup: لغو درخواست‌های درحال انجام
    return () => ac.abort();
  }, []);

  /**
   * فیلتر نتایج:
   * - روی نام/توضیح/اسلاگ دسته
   * - و متن آیتم‌های همان دسته
   * با useMemo تا هر تایپ کوچک باعث محاسبه‌ی مجددِ غیرضروری نشود.
   */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cats;

    return cats.filter((c) => {
      // جستجو در خود دسته
      const inCat =
        (c?.name || "").toLowerCase().includes(term) ||
        (c?.description || "").toLowerCase().includes(term) ||
        (c?.slug || "").toLowerCase().includes(term);

      // جستجو در آیتم‌های این دسته
      const arr = itemsBySlug[c.slug] || [];
      const inItems = arr.some((it) => (it?.text || "").toLowerCase().includes(term));

      return inCat || inItems;
    });
  }, [cats, itemsBySlug, q]);

  // ----------------------------- UI -----------------------------
  return (
    <section aria-busy={status === "loading"}>
      {/* نوار جستجو + شمار نتایج فیلتر شده */}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو (بطری، کارتن، کمپوست…)"
          className="w-full md:w-96 rounded-xl border px-4 py-2"
          aria-label="جستجو در دسته‌های راهنما"
        />
        <span className="text-xs text-slate-500">{filtered.length} نتیجه</span>
      </div>

      {/* حالت‌های مختلف وضعیت */}
      {status === "loading" && <SkeletonCards />}
      {status === "error" && (
        <p className="text-red-600" role="status">{err}</p>
      )}
      {status === "success" && filtered.length === 0 && (
        <p className="text-slate-600">موردی مطابق جستجو یافت نشد.</p>
      )}

      {/* لیست کارت‌ها (وقتی موفق شدیم) */}
      {status === "success" && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <GuideCard
              key={c.slug}
              item={c}
              items={itemsBySlug[c.slug] || []} // آیتم‌های مختص این دسته
              isOpen={openSlug === c.slug}      // باز/بسته بودن آکاردئون
              onToggle={() =>
                setOpenSlug(openSlug === c.slug ? null : c.slug)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
