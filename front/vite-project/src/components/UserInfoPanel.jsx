// UserInfoPanel.jsx (no bio, no prefs) — improved
// این کامپوننت صفحه «اطلاعات کاربری» را نشان می‌دهد:
// - گرفتن اطلاعات کاربر لاگین‌شده از /users/me
// - ویرایش نام نمایشی/ایمیل/تلفن/آواتار با PUT /users/me
// - تغییر رمز عبور با POST /users/change-password
// توجه: این نسخه «بیو» و «تنظیمات ترجیحی» ندارد (همانطور که در نام فایل آمده).

import React, { useEffect, useMemo, useState } from "react";

export default function UserInfoPanel({ apiBase }) {
  // آدرس پایهٔ API: اگر prop داده نشود، از env یا لوکال‌هاست استفاده می‌کنیم
  const BASE =
    apiBase || import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  // دریافت توکن از storage (ساده‌ترین حالت؛ اگر context دارید می‌توانید از آن بخوانید)
  const token = localStorage.getItem("access_token");

  // هدرهای پیش‌فرض درخواست‌ها (Authorization فقط وقتی token داریم)
  // useMemo برای جلوگیری از ساخت آبجکت جدید در هر رندر
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // وضعیت‌ها
  const [loading, setLoading] = useState(true);  // بارگذاری اطلاعات اولیه کاربر
  const [saving, setSaving] = useState(false);   // وضعیت ذخیره (عمومی برای فرم‌ها)
  const [error, setError] = useState("");        // پیام خطای کلی
  const [ok, setOk] = useState("");              // پیام موفقیت کلی

  // داده‌های فرم (نمایش و ویرایش اطلاعات پایهٔ کاربر)
  const [form, setForm] = useState({
    username: "",     // فقط‌خواندنی؛ روی سرور تغییر نمی‌دهیم
    displayName: "",
    email: "",
    phone: "",
    role: "",         // برای نمایش نقش (user/admin)، قابل ویرایش نیست
    avatarUrl: "",    // URL تصویر پروفایل
  });

  // واکشی اطلاعات کاربر در mount (یا تغییر BASE/headers)
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE}/users/me`, { headers });
        if (!res.ok) throw await buildHttpError(res); // تبدیل پاسخ خطا به Error قابل‌خواندن
        const data = await res.json();
        if (ignore) return;

        // پر کردن فرم با داده‌های دریافتی (fallback ها برای پشتیبانی از فیلدهای مختلف)
        setForm({
          username: data.username || "",
          displayName: data.displayName || data.nickname || "",
          email: data.email || "",
          phone: data.phone || "",
          role: data.role || "user",
          avatarUrl: data.avatarUrl || "",
        });
      } catch (e) {
        if (!ignore) setError(e.message || "خطا در دریافت اطلاعات");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true; // محافظت در برابر setState پس از unmount
    };
  }, [BASE, headers]);

  // هلسپر کوچک برای آپدیت فیلدی از فرم
  const onChange = (name, value) =>
    setForm((f) => ({
      ...f,
      [name]: value,
    }));

  // ذخیره‌سازی اطلاعات پایهٔ کاربر (displayName/email/phone/avatarUrl)
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    setError("");
    setOk("");

    // اعتبارسنجی سادهٔ ایمیل و تلفن در کلاینت
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("ایمیل معتبر نیست.");
    if (phone && !/^[0-9+\-() ]{6,20}$/.test(phone))
      return setError("شماره تماس معتبر نیست.");

    // فقط فیلدهایی که قرار است سرور قبول کند را ارسال می‌کنیم
    const payload = {
      displayName: form.displayName?.trim() || "",
      email,
      phone,
      avatarUrl: form.avatarUrl?.trim() || "",
    };

    try {
      setSaving(true);
      const res = await fetch(`${BASE}/users/me`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await buildHttpError(res);
      const updated = await res.json();

      setOk("تغییرات با موفقیت ذخیره شد.");

      // همگام‌سازی وضعیت فرم با دادهٔ تاییدشدهٔ سرور
      setForm((prev) => ({
        ...prev,
        displayName: updated.displayName || "",
        email: updated.email || "",
        phone: updated.phone || "",
        avatarUrl: updated.avatarUrl || "",
      }));
    } catch (e) {
      setError(e.message || "ذخیره‌سازی ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  // تغییر رمز عبور کاربر
  // POST /users/change-password  { current_password, new_password }
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (saving) return;

    setError("");
    setOk("");

    // از خود فرم HTML مقدار فیلدها را می‌گیریم (نیازی به state جدا نیست)
    const formEl = e.currentTarget;
    const current = formEl.currentPassword.value.trim();
    const newpass = formEl.newPassword.value.trim();
    const repeat = formEl.repeatPassword.value.trim();

    if (!newpass || newpass.length < 6)
      return setError("رمز جدید حداقل ۶ کاراکتر باشد.");
    if (newpass !== repeat) return setError("تکرار رمز مطابق نیست.");

    try {
      setSaving(true);
      const res = await fetch(`${BASE}/users/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          current_password: current,
          new_password: newpass,
        }),
      });
      if (!res.ok) throw await buildHttpError(res);

      setOk("رمز عبور با موفقیت تغییر کرد.");
      formEl.reset(); // پاک کردن فیلدهای فرم تغییر رمز
    } catch (e) {
      setError(e.message || "تغییر رمز ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {/* اسکلت لودر هنگام واکشی اولیه */}
      {loading ? (
        <Skeleton />
      ) : (
        <>
          {/* باکس پیام عمومی (یا خطا یا موفقیت) */}
          {(error || ok) && (
            <div
              className={`rounded-xl p-3 text-sm border ${
                error
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              {error || ok}
            </div>
          )}

          {/* فرم مشخصات پایهٔ کاربر */}
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="col-span-1 md:col-span-2">
              <div className="text-zinc-800 font-medium mb-2">
                مشخصات کاربری
              </div>

              {/* فیلدها: نام کاربری (فقط‌خواندنی)، نام نمایشی، ایمیل، تلفن */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="نام کاربری" value={form.username} disabled />
                <Field
                  label="نام نمایشی"
                  value={form.displayName}
                  onChange={(v) => onChange("displayName", v)}
                />
                <Field
                  label="ایمیل"
                  type="email"
                  value={form.email}
                  onChange={(v) => onChange("email", v)}
                />
                <Field
                  label="شماره تماس"
                  value={form.phone}
                  onChange={(v) => onChange("phone", v)}
                />
              </div>
            </div>

            {/* آواتار: URL تصویر + پیش‌نمایش ساده */}
            <div className="col-span-1">
              <label className="block text-sm mb-1 text-zinc-700">
                آدرس تصویر پروفایل
              </label>
              <input
                className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-rose-300"
                placeholder="https://example.com/avatar.jpg"
                value={form.avatarUrl}
                onChange={(e) => onChange("avatarUrl", e.target.value)}
              />
              <div className="mt-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-rose-200 overflow-hidden">
                  {/* اگر URL معتبر باشد تصویر نمایش داده می‌شود؛ در خطا مخفی می‌کنیم */}
                  {form.avatarUrl ? (
                    <img
                      src={form.avatarUrl}
                      alt="avatar preview"
                      className="w-14 h-14 object-cover"
                      onError={(ev) => (ev.currentTarget.style.display = "none")}
                    />
                  ) : null}
                </div>
                <span className="text-xs text-zinc-500">
                  (بعداً می‌توانی آپلود مستقیم اضافه کنی)
                </span>
              </div>
            </div>

            {/* دکمه ذخیره تغییرات */}
            <div className="md:col-span-2 flex gap-2 justify-start">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
            </div>
          </form>

          {/* فرم امنیت / تغییر رمز */}
          <form
            onSubmit={handleChangePassword}
            className="border rounded-2xl p-4 bg-white shadow-sm"
          >
            <div className="text-zinc-800 font-medium mb-4">
              امنیت حساب / تغییر رمز
            </div>

            {/* سه فیلد: رمز فعلی، رمز جدید، تکرار رمز جدید */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field
                label="رمز فعلی"
                type="password"
                name="currentPassword"
                required
              />
              <Field
                label="رمز جدید"
                type="password"
                name="newPassword"
                required
              />
              <Field
                label="تکرار رمز جدید"
                type="password"
                name="repeatPassword"
                required
              />
            </div>

            {/* دکمه تغییر رمز */}
            <div className="mt-3">
              <button
                disabled={saving}
                className="px-4 py-2 rounded-xl border hover:bg-zinc-50 disabled:opacity-60"
              >
                تغییر رمز
              </button>
            </div>
          </form>

          {/* وضعیت حساب: نمایش نقش (user/admin) */}
          <div className="border rounded-2xl p-4 bg-white shadow-sm">
            <div className="text-zinc-800 font-medium mb-2">وضعیت حساب</div>
            <div className="text-sm text-zinc-600">
              نقش:{" "}
              <strong>{form.role === "admin" ? "ادمین" : "کاربر"}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Field
 * کامپوننت ورودی عمومی با لیبل.
 * - اگر onChange داده شود، کنترل‌شده است؛ در غیر این صورت فقط‌خواندنی/غیرکنترل‌شده.
 * - از name/required برای فرم تغییر رمز استفاده می‌شود.
 */
function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
  name,
  required,
}) {
  return (
    <div>
      <label className="block text-sm mb-1 text-zinc-700">{label}</label>
      <input
        name={name}
        type={type}
        disabled={disabled}
        required={required}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:bg-zinc-100"
      />
    </div>
  );
}

/**
 * Skeleton
 * اسکلت بارگذاری ساده برای جای‌خالیِ محتوا.
 */
function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 bg-zinc-200 rounded w-1/3 animate-pulse" />
      <div className="h-4 bg-zinc-200 rounded w-2/3 animate-pulse" />
      <div className="h-4 bg-zinc-200 rounded w-1/2 animate-pulse" />
    </div>
  );
}

/**
 * buildHttpError(res)
 * تلاش می‌کند از پاسخ HTTP (JSON یا متن) پیام خطای قابل‌خواندن بسازد.
 * - detail/message اگر موجود بود استفاده می‌شود
 * - در غیر این صورت بخشی از متن پاسخ نمایش داده می‌شود
 */
async function buildHttpError(res) {
  const text = await res.text();
  let msg = `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text);
    if (j?.detail) msg += `: ${typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)}`;
    else if (j?.message) msg += `: ${j.message}`;
    else if (text) msg += `: ${text.slice(0, 140)}`;
  } catch {
    if (text) msg += `: ${text.slice(0, 140)}`;
  }
  return new Error(msg);
}
