// src/components/AdminSendNotif.jsx
// ============================================================================
// کامپوننت «ارسال اعلان» برای پنل ادمین
// ----------------------------------------------------------------------------
// این فرم به ادمین اجازه می‌دهد اعلان (Notification) بسازد و آن را:
//
//   • برای «همهٔ کاربران» ارسال کند    → target = "all"
//   • فقط برای «یک کاربر خاص» بر اساس ایمیل → target = "user", email = "<user@email>"
//
// قرارداد بک‌اند (نمونه‌ی رایج):
//   POST /notifs
//   Body (JSON):
//   {
//     "target": "all" | "user",
//     "email":  "<email or null>",
//     "type":   "news" | "article" | "update" | "promo" | ... (آزاد طبق بک‌اند),
//     "title":  "متن عنوان اعلان",
//     "body":   "متن اختیاری اعلان" | null,
//     "link":   "/articles/42" یا "https://..." | null
//   }
//
// نکات:
//   • هدر Authorization باید Bearer <JWT> باشد؛ این JWT باید نقش ادمین داشته باشد.
//   • در این کامپوننت، توکن از local/sessionStorage خوانده می‌شود (سمت کلاینت).
//   • اعتبارسنجی‌های دقیق (مثل صحت ایمیل) بهتر است در بک‌اند هم انجام شود.
//   • اگر audience = "user" انتخاب شود، فیلد ایمیل در UI required می‌شود.
//   • state `busy` از ارسال چندباره جلوگیری می‌کند و دکمه را غیرفعال می‌سازد.
// ============================================================================

import { useState } from "react";

// آدرس پایه‌ی API از env (در صورت نبود، 127.0.0.1:8000)
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// کمکی: خواندن JWT از localStorage یا sessionStorage
function getToken() {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    ""
  );
}

export default function AdminSendNotif() {
  // مخاطب اعلان: همه یا یک کاربر خاص
  const [audience, setAudience] = useState("all"); // "all" | "user"
  // ایمیلِ کاربر مقصد (وقتی audience === "user")
  const [email, setEmail] = useState("");

  // نوع اعلان (اختیاری؛ صرفاً به بک‌اند پاس می‌دهیم)
  const [type, setType] = useState("news");

  // فیلدهای محتوایی اعلان
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  // وضعیت ارسال و پیام بازخورد
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // ارسال فرم
  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      // 1) خواندن توکن فعلی
      const token = getToken();

      // 2) ساخت درخواست POST به /notifs
      const res = await fetch(`${BASE}/notifs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // توجه: اگر توکن خالی باشد، بک‌اند باید 401 برگرداند
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // مخاطب اعلان:
          //   "all"  → برای همه
          //   "user" → فقط یک کاربر (در این صورت email را نیز می‌فرستیم)
          target: audience,
          email: audience === "user" ? email.trim() : null,

          // متادیتای نوع اعلان: از گزینه‌های UI یا هر رشته‌ای که بک‌اند قبول کند
          type,

          // محتوای اعلان
          title,               // ← الزامی (input دارای required است)
          body: body || null,  // ← اختیاری؛ اگر خالی بود null بفرست
          link: link || null,  // ← اختیاری؛ می‌تواند داخلی یا خارجی باشد
        }),
      });

      // 3) مدیریت خطاهای HTTP
      if (!res.ok) {
        // تلاش برای نمایش متن خطا جهت دیباگ بهتر
        const txt = await res.text();
        throw new Error(`${res.status} ${txt}`);
      }

      // 4) موفقیت: (اگر بک‌اند JSON برگرداند، می‌توانی اینجا بخوانی)
      await res.json().catch(() => {}); // مصرف پاسخ اختیاری

      // 5) پیام موفقیت + پاک‌سازی برخی فیلدها
      setMsg("اعلان با موفقیت ثبت شد ✅");
      setTitle("");
      setBody("");
      setLink("");
    } catch (err) {
      // نمایش پیام خطا برای کاربر
      setMsg(`خطا: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6" dir="rtl">
      <h1 className="text-lg font-semibold mb-4">ارسال اعلان</h1>

      {/* فرم ارسال اعلان */}
      <form onSubmit={onSubmit} className="space-y-4">
        {/* انتخاب مخاطب اعلان: همه یا یک کاربر خاص */}
        <fieldset className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="aud"
              checked={audience === "all"}
              onChange={() => setAudience("all")}
            />
            همه کاربران
          </label>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="aud"
              checked={audience === "user"}
              onChange={() => setAudience("user")}
            />
            فقط یک کاربر (بر اساس ایمیل)
          </label>
        </fieldset>

        {/* اگر مخاطب «یک کاربر» باشد، فیلد ایمیل نمایش داده و required می‌شود */}
        {audience === "user" && (
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="ایمیل کاربر"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}

        {/* نوع اعلان (value آزاد؛ باید با بک‌اند هماهنگ باشد) */}
        <select
          className="w-full border rounded px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="news">خبر</option>
          <option value="article">مقاله</option>
          <option value="update">بروزرسانی</option>
          <option value="promo">پرومو</option>
        </select>

        {/* عنوان اعلان (الزامی) */}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="عنوان *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* متن اعلان (اختیاری) */}
        <textarea
          className="w-full border rounded px-3 py-2 min-h-28"
          placeholder="متن (اختیاری)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* لینک همراه اعلان (اختیاری)؛ می‌تواند داخلی یا خارجی باشد */}
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="لینک (اختیاری) — مثلا /articles/42 یا https://..."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />

        {/* دکمهٔ ارسال: در حالت busy غیرفعال می‌شود */}
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          {busy ? "در حال ارسال..." : "ارسال اعلان"}
        </button>

        {/* نمایش پیام نتیجهٔ عملیات */}
        {msg && <div className="text-sm mt-2">{msg}</div>}
      </form>
    </div>
  );
}
