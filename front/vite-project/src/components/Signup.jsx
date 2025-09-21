// src/pages/Signup.jsx
import { useEffect, useMemo, useState } from "react";

/**
 * BASE
 * آدرس پایه‌ی API را از متغیر محیطی می‌گیرد وگرنه روی لوکال‌هاست می‌افتد.
 */
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/**
 * randCaptcha()
 * یک عدد ۵ رقمی تصادفی به‌صورت استرینگ تولید می‌کند.
 * مثال: "38420"
 */
const randCaptcha = () => String(Math.floor(10000 + Math.random() * 90000));

/**
 * toAsciiDigits(s)
 * تبدیل همه‌ی ارقام فارسی/عربی داخل رشته به ارقام لاتین (0-9)
 * + حذف فاصله‌ها و کاراکترهای مخفی (ZWNJ, LRM, RLM)
 * تا ورودی‌های کاربر استاندارد شود.
 */
function toAsciiDigits(s = "") {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return String(s)
    .split("")
    .map((ch) => {
      const iFa = fa.indexOf(ch);
      if (iFa > -1) return String(iFa);
      const iAr = ar.indexOf(ch);
      if (iAr > -1) return String(iAr);
      return ch;
    })
    .join("")
    .replace(/[\s\u200c\u200e\u200f]/g, ""); // حذف فاصله/کاراکترهای نامرئی
}

/**
 * cleanDigits(s)
 * فقط ارقام را نگه می‌دارد و به ۵ کاراکتر محدود می‌کند.
 * برای ورودی کپچا.
 */
const cleanDigits = (s = "") => toAsciiDigits(s).replace(/\D/g, "").slice(0, 5);

/**
 * Signup
 * صفحه‌ی ثبت‌نام با ایمیل + رمز عبور + کپچا ۵ رقمی.
 *
 * جریان کلی:
 * 1) اعتبارسنجی کلاینت: ایمیل/قدرت رمز/تطابق رمز/تیک قوانین/کپچا
 * 2) چک فوری موجود بودن ایمیل (debounced): GET /users/check?email=...
 * 3) ارسال ثبت‌نام: POST /users/signup (بدون تایید ایمیل)
 * 4) نمایش پیام موفقیت و ریست فیلدها/کپچا
 */
export default function Signup() {
  /* ----------------------- State ها ----------------------- */
  const [email, setEmail] = useState("");     // ایمیل کاربر
  const [pass, setPass] = useState("");       // رمز عبور
  const [pass2, setPass2] = useState("");     // تکرار رمز
  const [agree, setAgree] = useState(false);  // پذیرش قوانین
  const [showPass, setShowPass] = useState(false);   // نمایش/مخفی رمز
  const [showPass2, setShowPass2] = useState(false); // نمایش/مخفی تکرار رمز

  const [captcha, setCaptcha] = useState(randCaptcha());  // متن کپچا (۵ رقم)
  const [captchaInput, setCaptchaInput] = useState("");   // ورودی کاربر برای کپچا

  const [submitting, setSubmitting] = useState(false); // وضعیت ارسال فرم
  const [error, setError] = useState("");              // پیام خطای کلی
  const [ok, setOk] = useState(false);                 // موفقیت ثبت‌نام

  // وضعیت بررسی ایمیل تکراری
  const [emailTaken, setEmailTaken] = useState(false);   // true یعنی ایمیل قبلاً ثبت شده
  const [checkingEmail, setCheckingEmail] = useState(false); // در حال چک کردن از سرور

  /* ----------------------- اعتبارسنجی‌ها ----------------------- */

  // ایمیل با الگوی ساده اعتبارسنجی شود
  const emailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  // قدرت رمز: حداقل ۶ کاراکتر (می‌توانید پیچیده‌تر کنید)
  const passStrong = useMemo(() => pass.length >= 6, [pass]);

  // تطابق رمز و تکرار رمز
  const passMatch = useMemo(() => pass && pass === pass2, [pass, pass2]);

  // کپچا معتبر: ۵ رقم و برابر با مقدار تولید شده
  const captchaOk = useMemo(() => {
    const v = cleanDigits(captchaInput);
    const c = cleanDigits(String(captcha));
    return v.length === 5 && v === c;
  }, [captchaInput, captcha]);

  // اجازه‌ی ارسال فرم وقتی همه‌ی شروط برقرار است
  const canSubmit =
    emailValid &&
    !emailTaken &&
    passStrong &&
    passMatch &&
    captchaOk &&
    agree &&
    !submitting;

  /* ----------------------- Side Effects ----------------------- */

  // هر تغییری در فیلدهای مهم رخ دهد، پیام خطا ریست شود
  useEffect(() => {
    if (error) setError("");
  }, [email, pass, pass2, captchaInput, error]);

  // با تغییر ایمیل، فلگ "ایمیل تکراری" را ریست کن
  useEffect(() => {
    setEmailTaken(false);
  }, [email]);

  /**
   * بررسی موجود بودن ایمیل (debounced)
   * - فقط وقتی الگوی ایمیل معتبر است
   * - با تاخیر 450ms برای جلوگیری از درخواست‌های متوالی
   * - از AbortController برای کنسل درخواست‌های قبلی
   * پاسخ مورد انتظار: { available: boolean }
   */
  useEffect(() => {
    if (!emailValid) {
      setCheckingEmail(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const q = encodeURIComponent(email.trim().toLowerCase());
        const res = await fetch(`${BASE}/users/check?email=${q}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json(); // { available: boolean }
          setEmailTaken(!data.available);
        }
      } catch {
        // خطاهای شبکه‌ای را نادیده بگیر (UI را مختل نکن)
      } finally {
        setCheckingEmail(false);
      }
    }, 450);

    // پاکسازی: تایمر و درخواست قبلی را کنسل کن
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [email, emailValid]);

  /* ----------------------- Submit Handler ----------------------- */

  /**
   * onSubmit
   * - همه‌ی شروط باید برقرار باشند (canSubmit)
   * - POST به /users/signup با { username, password }
   * - در صورت موفقیت، ok=true و فیلدها/کپچا ریست می‌شوند
   * - در صورت خطا، تلاش می‌کنیم detail را از پاسخ سرور استخراج کنیم
   */
  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      setError("");
      setOk(false);
      setEmailTaken(false);

      const body = { username: email.trim().toLowerCase(), password: pass };
      const res = await fetch(`${BASE}/users/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // تلاش برای استخراج پیام خطای قابل‌فهم‌تر از پاسخ سرور
        let msg = `خطا (HTTP ${res.status})`;
        try {
          const j = await res.json();
          const detail = j?.detail;
          if (typeof detail === "string") {
            if (detail.includes("قبلاً ثبت شده")) {
              setEmailTaken(true);
              msg = "این ایمیل قبلاً ثبت شده است.";
            } else {
              msg = detail;
            }
          }
        } catch {
          // اگر JSON نبود، همان پیام کلی را نگه داریم
        }
        throw new Error(msg);
      }

      // ✅ موفقیت: بدون لینک تأیید ایمیل
      setOk(true);
      // ریست فیلدها
      setPass("");
      setPass2("");
      setCaptchaInput("");
      setCaptcha(randCaptcha()); // کپچا دوباره تولید شود
    } catch (err) {
      setError(err.message || "خطا در ثبت‌نام");
      setCaptchaInput(""); // در خطا ورودی کپچا را خالی می‌کنیم (خود کپچا را تغییر نمی‌دهیم)
    } finally {
      setSubmitting(false);
    }
  }

  /* ----------------------- UI ----------------------- */

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-zinc-50 flex items-start md:items-center justify-center py-10 md:py-16"
    >
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-6 md:px-10 pt-8">
            {/* تیتر صفحه */}
            <h1 className="text-2xl font-bold text-center mb-2">
              ثبت‌نام با ایمیل
            </h1>

            {/* تب‌های بالای فرم (فعلاً یک تب) */}
            <div className="mt-6 border-b">
              <div className="flex gap-6 text-sm">
                <button
                  type="button"
                  className="relative -mb-px border-b-2 border-emerald-600 px-3 pb-3 font-medium text-emerald-700"
                >
                  ثبت نام با ایمیل
                </button>
              </div>
            </div>

            {/* فرم ثبت‌نام */}
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* ایمیل */}
              <label className="block">
                <div className="mb-1 text-sm text-zinc-700">ایمیل</div>
                <input
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  className={`w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 ${
                    email && (!emailValid || emailTaken)
                      ? "border-rose-300 focus:ring-rose-200" // حالت خطا
                      : "border-zinc-300 focus:ring-emerald-200" // حالت عادی
                  }`}
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {/* پیام‌های کمکی/خطا برای ایمیل */}
                {email && !emailValid && (
                  <div className="text-xs text-rose-600 mt-1">
                    فرمت ایمیل صحیح نیست.
                  </div>
                )}
                {emailValid && emailTaken && (
                  <div className="text-xs text-rose-600 mt-1">
                    این ایمیل قبلاً ثبت شده است.
                  </div>
                )}
                {emailValid && checkingEmail && (
                  <div className="text-xs text-zinc-500 mt-1">
                    در حال بررسی ایمیل…
                  </div>
                )}
              </label>

              {/* رمز و تکرار رمز */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* رمز */}
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-700">کلمه عبور</div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      autoComplete="new-password"
                      className={`w-full rounded-xl border px-4 py-3 pr-10 outline-none focus:ring-2 ${
                        pass && !passStrong
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-zinc-300 focus:ring-emerald-200"
                      }`}
                      placeholder="حداقل ۶ کاراکتر"
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                    />
                    {/* دکمه نمایش/مخفی کردن رمز */}
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600"
                    >
                      {showPass ? "مخفی" : "نمایش"}
                    </button>
                  </div>
                  {/* پیام ضعف رمز */}
                  {pass && !passStrong && (
                    <div className="text-xs text-rose-600 mt-1">
                      حداقل ۶ کاراکتر لازم است.
                    </div>
                  )}
                </label>

                {/* تکرار رمز */}
                <label className="block">
                  <div className="mb-1 text-sm text-zinc-700">
                    تکرار کلمه عبور
                  </div>
                  <div className="relative">
                    <input
                      type={showPass2 ? "text" : "password"}
                      autoComplete="new-password"
                      className={`w-full rounded-xl border px-4 py-3 pr-10 outline-none focus:ring-2 ${
                        pass2 && !passMatch
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-zinc-300 focus:ring-emerald-200"
                      }`}
                      placeholder="دوباره رمز را وارد کنید"
                      value={pass2}
                      onChange={(e) => setPass2(e.target.value)}
                    />
                    {/* دکمه نمایش/مخفی کردن تکرار رمز */}
                    <button
                      type="button"
                      onClick={() => setShowPass2((v) => !v)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600"
                    >
                      {showPass2 ? "مخفی" : "نمایش"}
                    </button>
                  </div>
                  {/* پیام عدم تطابق رمز */}
                  {pass2 && !passMatch && (
                    <div className="text-xs text-rose-600 mt-1">
                      با کلمه عبور یکسان نیست.
                    </div>
                  )}
                </label>
              </div>

              {/* کپچا ساده ۵ رقمی */}
              <div>
                <div className="mb-1 text-sm text-zinc-700">عبارت امنیتی</div>
                <div className="flex gap-3">
                  {/* دکمه‌ی رفرش کپچا */}
                  <button
                    type="button"
                    onClick={() => {
                      setCaptcha(randCaptcha());
                      setCaptchaInput("");
                    }}
                    title="تازه‌سازی"
                    className="rounded-xl border bg-zinc-100 px-3 py-2 text-sm"
                  >
                    🔄
                  </button>

                  {/* نمایش کد کپچا با کمی اعوجاج/فاصله */}
                  <div
                    dir="ltr"
                    className="select-none rounded-xl border bg-white h-[44px] px-4 flex items-center justify-center tracking-widest font-mono"
                  >
                    <span
                      style={{
                        filter: "blur(0.2px)",
                        transform: "skewX(-8deg)",
                        letterSpacing: "0.3rem",
                        userSelect: "none",
                      }}
                      className="text-lg"
                    >
                      {captcha.split("").map((ch, i) => (
                        <span
                          key={i}
                          style={{
                            transform: `rotate(${i % 2 ? -12 : 10}deg)`,
                            display: "inline-block",
                            opacity: 0.9,
                            marginInline: "2px",
                          }}
                        >
                          {ch}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* ورودی کپچا؛ فقط عدد و حداکثر ۵ رقم */}
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={5}
                    className="flex-1 rounded-xl border px-4 py-3 outline-none focus:ring-2 border-zinc-300 focus:ring-emerald-200"
                    placeholder="عدد موجود در کادر را وارد نمایید"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(cleanDigits(e.target.value))}
                  />
                </div>
                {/* پیام خطای کپچا وقتی ۵ رقم وارد شده اما برابر نیست */}
                {cleanDigits(captchaInput).length === 5 && !captchaOk && (
                  <div className="text-xs text-rose-600 mt-1">
                    عبارت امنیتی نادرست است.
                  </div>
                )}
              </div>

              {/* پذیرش قوانین */}
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  با ثبت‌نام،{" "}
                  <a href="/terms" className="text-emerald-600 underline">
                    قوانین
                  </a>{" "}
                  و{" "}
                  <a href="/privacy" className="text-emerald-600 underline">
                    حریم خصوصی
                  </a>{" "}
                  را می‌پذیرم.
                </span>
              </label>

              {/* پیام‌های کلی (خطا/موفقیت) */}
              {error && <div className="text-sm text-rose-600">{error}</div>}
              {ok && (
                <div className="text-sm text-emerald-700">
                  ثبت‌نام انجام شد.
                </div>
              )}

              {/* دکمهٔ ثبت‌نام */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full rounded-3xl px-6 py-3 font-semibold transition ${
                    canSubmit
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-emerald-200 text-white cursor-not-allowed"
                  }`}
                >
                  {submitting ? "در حال ارسال…" : "ثبت نام"}
                </button>
              </div>

              {/* لینک رفتن به صفحه‌ی ورود */}
              <div className="text-center text-sm text-zinc-600 mt-2 mb-8">
                کاربر سایت هستید؟{" "}
                <a href="/login" className="text-emerald-600 underline">
                  به صفحه ورود بازگردید
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
