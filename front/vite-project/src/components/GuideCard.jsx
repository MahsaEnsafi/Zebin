// src/components/GuideCard.jsx
// -----------------------------------------------------------------------------
// کارت هر «دسته» در صفحه‌ی راهنما.
// - هدر کارت: نام/توضیح دسته + دکمه‌ی ذخیره در نشانک‌ها
// - محتوای بازشونده (آکاردئون): ۴ ستون آیتم‌ها بر اساس kind (yes | no | prep | note)
// - از APIهای lib/api برای چک/تغییر وضعیت نشانک استفاده می‌کند.
// - با props isOpen/onToggle از بیرون کنترل می‌شود (Parent آکاردئون را مدیریت می‌کند).
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { isAuthed, isBookmarked, toggleBookmark } from "../lib/api";

// کلاس‌ها/برچسب‌های نمایشی برای هر نوع آیتم
const KIND_META = {
  yes:  { label: "قابل بازیافت", box: "bg-emerald-50 border-emerald-200" },
  no:   { label: "غیرقابل",      box: "bg-rose-50 border-rose-200"     },
  prep: { label: "آماده‌سازی",    box: "bg-amber-50 border-amber-200"   },
  note: { label: "نکات",          box: "bg-sky-50 border-sky-200"       },
};

/**
 * GuideCard
 * ---------------------------------------------------------------------------
 * props:
 *  - item:     شیء دسته (id, slug, name, description, color)
 *  - items:    آرایه آیتم‌های مربوط به همین دسته (از سرور گرفته شده)
 *  - isOpen:   آیا محتوای کارت باز است؟ (برای آکاردئون)
 *  - onToggle: تابعی برای باز/بستن کارت (توسط والد مدیریت می‌شود)
 */
export default function GuideCard({ item, items = [], isOpen, onToggle }) {
  // با دیستراکت کردن، فیلدهای مهم دسته را می‌گیریم
  const { id, slug, name, description, color = "" } = item || {};

  // وضعیت دکمه‌ی نشانک
  const [saved, setSaved]   = useState(false); // آیا در نشانک‌ها هست؟
  const [saving, setSaving] = useState(false); // در حال ارسال درخواست؟

  // کلید ذخیره: اگر id نبود از slug استفاده می‌کنیم (هرکدام موجود بود)
  const key    = id ?? slug;
  const keyStr = key != null ? String(key) : null;
  const canSave = !!keyStr; // آیا شناسه‌ای داریم که بتوان ذخیره/حذف کرد؟

  /**
   * اثر برای مقداردهی اولیه‌ی دکمه‌ی نشانک:
   * - اگر شناسه معتبر نداشتیم، کاری نکن.
   * - اگر داشتیم، از سرور می‌پرسیم آیا این مورد قبلاً ذخیره شده یا نه.
   * - cancelled برای جلوگیری از setState بعد از unmount
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canSave) return;
      try {
        const s = await isBookmarked("guide", keyStr);
        if (!cancelled) setSaved(!!s);
      } catch {
        // سکوت: اگر خطایی در چک رخ دهد، فقط وضعیت اولیه را false می‌گذاریم
      }
    })();
    return () => { cancelled = true; };
  }, [canSave, keyStr]);

  /**
   * کلیک روی دکمه‌ی نشانک:
   * - از Bubble جلوگیری می‌کنیم تا آکاردئون با کلیک روی دکمه باز/بسته نشود.
   * - اگر کاربر لاگین نیست → پیام
   * - اگر شناسه نامعتبر است → پیام
   * - در غیر این صورت toggleBookmark را صدا می‌زنیم و UI را به‌روز می‌کنیم.
   */
  async function onBookmarkClick(e) {
    e?.stopPropagation?.();
    e?.preventDefault?.();

    if (!isAuthed()) {
      alert("برای ذخیره باید وارد حساب شوید.");
      return;
    }
    if (!canSave) {
      alert("این مورد شناسه‌ی معتبری برای ذخیره ندارد.");
      return;
    }

    try {
      setSaving(true);
      const now = await toggleBookmark("guide", keyStr);
      setSaved(!!now);
    } catch (err) {
      alert(err?.message || "خطا در تغییر نشانک");
    } finally {
      setSaving(false);
    }
  }

  /**
   * دسترسی‌پذیری (A11y):
   * - با Enter یا Space نیز بتوان کارت را باز/بسته کرد.
   */
  const onCardKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.();
    }
  };

  /**
   * گروه‌بندی آیتم‌ها بر اساس kind:
   * - خروجی: { yes:[], no:[], prep:[], note:[] }
   * - useMemo تا در هر رندر مجدد حساب نشود مگر زمانی که items عوض شود.
   */
  const grouped = useMemo(() => {
    const g = { yes: [], no: [], prep: [], note: [] };
    for (const it of items || []) {
      const k = it?.kind;
      if (k && g[k]) g[k].push(it);
    }
    return g;
  }, [items]);

  return (
    <div
      role="button" // برای دسترسی‌پذیری: کارت مثل دکمه رفتار می‌کند
      tabIndex={0}  // قابل فوکوس با کیبورد
      onClick={onToggle}
      onKeyDown={onCardKey}
      className={`text-right rounded-2xl border ${color || "border-zinc-200"} p-5 hover:shadow transition focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white`}
      aria-expanded={isOpen} // وضعیت آکاردئون برای screen reader
      aria-controls={`guide-${slug || keyStr || "item"}`} // ارتباط هدر با محتوای بازشونده
    >
      {/* هدر کارت: عنوان، توضیح کوتاه، دکمه نشانک */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold truncate">{name}</h2>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBookmarkClick}
            disabled={!canSave || saving}
            className={`px-3 py-1.5 rounded-lg border text-sm transition
              ${saved
                ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"}
              ${(!canSave || saving) ? "opacity-60 cursor-not-allowed" : ""}`}
            title={
              !canSave
                ? "شناسه/اسلاگ معتبر ندارد."
                : saved
                ? "حذف از نشانک‌ها"
                : "ذخیره در نشانک‌ها"
            }
            aria-pressed={saved}
            aria-busy={saving}
          >
            {saving ? "در حال ذخیره…" : saved ? "در نشانک‌هاست" : "ذخیره"}
          </button>
        </div>
      </div>

      {/* بخش بازشونده: چهار ستون آیتم‌ها به تفکیک kind */}
      {isOpen && (
        <div id={`guide-${slug || keyStr || "item"}`} className="mt-5 text-sm">
          <div className="grid md:grid-cols-4 gap-4">
            {(["yes","no","prep","note"]).map((k) => {
              const meta = KIND_META[k];        // برچسب و رنگ باکس این ستون
              const list = grouped[k] || [];    // آیتم‌های این ستون
              return (
                <div key={k} className={`rounded-xl border ${meta.box} p-3`}>
                  {/* هدر ستون: عنوان + تعداد آیتم‌ها */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{meta.label}</div>
                    <span className="text-xs opacity-70">{list.length} مورد</span>
                  </div>

                  {/* بدنه ستون: لیست آیتم‌ها یا خط تیره اگر خالی بود */}
                  {list.length === 0 ? (
                    <div className="text-xs opacity-60">—</div>
                  ) : (
                    <ul className="list-disc pr-4 space-y-1">
                      {list.map((it) => (
                        <li key={it.id || it.text}>{it.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
