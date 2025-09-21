// src/components/Login.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// آدرس پایه‌ی API از .env یا مقدار پیش‌فرض لوکال
const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // از کانتکست احراز هویت: توکن فعلی و تابع login
  // نکته: امضای تابع login در AuthContext توی پروژه‌ی شما مهم است.
  // اگر login(username, password, remember) باشد، پایین باید اصلاح شود.
  const { token, login } = useAuth();

  // وضعیت‌های فرم
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // اگر از قبل لاگین شده، همین حالا به پروفایل ریدایرکت کن
  useEffect(() => {
    if (token) navigate("/profile", { replace: true });
  }, [token, navigate]);

  // هندل ارسال فرم
  async function onSubmit(e) {
    e.preventDefault();
    if (!username || !password || submitting) return;

    try {
      setSubmitting(true);
      setError("");

      // درخواست لاگین به بک‌اند
      // (اینجا JSON ارسال می‌شود؛ اگر سرورت فرم‌urlencoded می‌خواهد، هدر/بدنه را تغییر بده)
      const res = await fetch(`${BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(username).trim().toLowerCase(),
          password,
        }),
      });

      // تبدیل خطای غیر 200/201 به پیام قابل‌خواندن
      if (!res.ok) {
        let msg = `خطا (HTTP ${res.status})`;
        try {
          const j = await res.json();
          if (j?.detail) {
            msg =
              Array.isArray(j.detail) && j.detail[0]?.msg
                ? j.detail[0].msg
                : j.detail;
          }
        } catch {}
        throw new Error(msg);
      }

      // انتظار پاسخ: { access_token, token_type }
      const data = await res.json();
      if (!data?.access_token) throw new Error("توکن دریافتی نامعتبر است");

      // نکتهٔ مهم:
      // اگر امضای login در AuthContext شما «login(username, password, remember)» است،
      // این خط باید بشود:  await login(username, password, remember)
      // اما اگر login(token, remember) تعریف کرده‌اید، همین خط درست است.
      login(data.access_token, remember);

      // اگر از صفحه‌ی محافظت‌شده آمده بود، به همانجا برگرد؛ در غیر این‌صورت /profile
      const dest = location.state?.from?.pathname || "/profile";
      navigate(dest, { replace: true });
    } catch (e2) {
      setError(e2.message || "ورود ناموفق بود");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-zinc-50 flex items-start md:items-center justify-center py-10 md:py-16"
    >
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-6 md:px-10 pt-10 pb-8">
            <h1 className="text-2xl font-bold text-center">ورود به سایت</h1>

            {/* تب‌های فرم (فعلاً فقط «ورود با کلمه عبور») */}
            <div className="mt-6 border-b">
              <div className="flex gap-6 text-sm">
                <button
                  type="button"
                  className="relative -mb-px border-b-2 border-emerald-600 px-3 pb-3 font-medium text-emerald-700"
                >
                  ورود با کلمه عبور
                </button>
              </div>
            </div>

            {/* فرم ورود */}
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {/* ایمیل / نام‌کاربری */}
              <label className="block">
                <div className="mb-1 text-sm text-zinc-700">ایمیل</div>
                <input
                  dir="ltr"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-xl border px-4 py-3 outline-none border-zinc-300 focus:ring-2 focus:ring-emerald-200"
                  placeholder="email@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>

              {/* گذرواژه + دکمه نمایش/مخفی */}
              <label className="block">
                <div className="mb-1 text-sm text-zinc-700">کلمه عبور</div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    className="w-full rounded-xl border px-4 py-3 pr-10 outline-none border-zinc-300 focus:ring-2 focus:ring-emerald-200"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600"
                  >
                    {showPass ? "مخفی" : "نمایش"}
                  </button>
                </div>
              </label>

              {/* پیام خطا */}
              {error && <div className="text-sm text-rose-600">{error}</div>}

              {/* دکمه‌ها و گزینه‌ها */}
              <div className="space-y-3 pt-2">
                {/* دکمه‌ی ورود؛ وقتی فیلدها خالی یا در حال ارسال‌اند، غیرفعال می‌شود */}
                <button
                  type="submit"
                  disabled={!username || !password || submitting}
                  className={`w-full rounded-3xl px-6 py-3 font-semibold transition ${
                    !username || !password || submitting
                      ? "bg-emerald-200 text-white cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {submitting ? "در حال ورود…" : "ورود"}
                </button>

                {/* «مرا به خاطر بسپار» → ذخیره توکن در localStorage بجای session */}
                <label className="flex items-center gap-2 text-sm text-zinc-700 justify-end">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  مرا به خاطر بسپار
                </label>

                {/* لینک ثبت‌نام */}
                <div className="text-center text-sm text-zinc-600">
                  کاربر جدید هستید؟{" "}
                  <Link to="/signup" className="text-emerald-600 underline">
                    در سایت عضو شوید
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
