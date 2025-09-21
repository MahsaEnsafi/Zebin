// src/pages/Predict.jsx
/**
 * صفحه «پیش‌بینی تفکیک زباله» با آپلود تصویر
 * --------------------------------------------------------------------
 * این صفحه به کاربر اجازه می‌دهد یک تصویر از زباله/بسته‌بندی بارگذاری کند،
 * آن را به سرور (مدل کلاسیفایر) بفرستد، و نتیجهٔ پیش‌بینی را با درصد اطمینان
 * دریافت و نمایش دهد. اگر کاربر لاگین باشد، می‌تواند تصویر را در «عکس‌های من»
 * ذخیره کند (بک‌اند باید این امکان را با پارامتر save پشتیبانی کند).
 *
 * نکات مهم:
 * - برای ارسال به /predict/ نیاز به توکن JWT داریم؛ اگر نباشد با پیام مناسب
 *   به صفحهٔ ورود هدایت می‌کنیم.
 * - برای آپلود FormData هرگز "Content-Type" را دستی تنظیم نکنید؛ مرورگر خودش
 *   boundary را ست می‌کند. تنها هدر مهم در اینجا Authorization است.
 * - در صورت وضعیت 401 (توکن منقضی/نامعتبر)، توکن را پاک می‌کنیم و پیام
 *   مناسب نشان داده می‌شود.
 * - URL.createObjectURL قابل آزادسازی است؛ در unmount/تعویض فایل باید
 *   URL.revokeObjectURL انجام دهیم تا memory leak رخ ندهد.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { setToken as setStoredToken } from "../lib/api";

// آدرس نهایی API برای پیش‌بینی
const API_URL =
  (import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000") + "/predict/";

// نگاشت شناسه‌های کلاس به معادل فارسی جهت نمایش
const FA_LABELS = {
  cardboard: "مقوا",
  glass: "شیشه",
  metal: "فلز",
  paper: "کاغذ",
  plastic: "پلاستیک",
  trash: "زبالهٔ متفرقه",
};

export default function Predict() {
  // از context: توکن احراز هویتِ فعلی کاربر
  const { token } = useAuth();
  const navigate = useNavigate();

  // stateهای محلی UI
  const [file, setFile] = useState(null);     // فایل انتخابی
  const [preview, setPreview] = useState(""); // URL پیش‌نمایش از فایل انتخابی
  const [result, setResult] = useState(null); // نتیجهٔ پیش‌بینی (class, confidence, saved?, photo_id?, url?)
  const [error, setError] = useState("");     // پیام خطا
  const [info, setInfo] = useState("");       // پیام موفقیت/راهنما
  const [loading, setLoading] = useState(false);   // وضعیت ارسال/در حال پردازش
  const [saveToLib, setSaveToLib] = useState(!!token); // آیا در «عکس‌های من» ذخیره شود؟
  const [unauth, setUnauth] = useState(false);       // اگر 401 دریافت شد → true

  /* همگام‌سازی با وضعیت ورود/خروج
     - اگر کاربر وارد شد، چک‌مارک ذخیره فعال می‌ماند
     - خطاهای قبلی مرتبط با عدم احراز را پاک می‌کنیم */
  useEffect(() => {
    setSaveToLib(!!token);
    if (token) {
      setUnauth(false);
      setError("");
    }
  }, [token]);

  /* آزادسازی URL پیش‌نمایش هنگام خروج یا تعویض فایل
     - اگر preview فعال است، در cleanup آزادش می‌کنیم */
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  /**
   * انتخاب فایل:
   * - ساخت preview از فایل جدید
   * - پاک‌سازی نتیجه/پیام‌ها
   */
  function onPick(e) {
    const f = e.target.files?.[0] || null;
    // اگر قبلاً preview داشتیم، آزادش کنیم
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
    setResult(null);
    setError("");
    setInfo("");
    setUnauth(false);
  }

  /**
   * ارسال فایل برای پیش‌بینی:
   * - نیازمند توکن (اگر نباشد کاربر را به لاگین هدایت می‌کنیم)
   * - بدنه از نوع FormData (file + [save=1]) است
   * - اگر پاسخ 401 بود، توکن را از storage پاک می‌کنیم و دکمهٔ «ورود» را نمایش می‌دهیم
   * - در صورت موفقیت، نتیجه را در state ذخیره می‌کنیم
   */
  async function send() {
    setError("");
    setInfo("");
    setResult(null);

    // اگر کاربر لاگین نیست
    if (!token) {
      setUnauth(true);
      setError("برای ارسال پیش‌بینی باید عضو باشید و وارد حساب کاربری شوید.");
      return;
    }
    // اگر فایلی انتخاب نشده
    if (!file) {
      setError("لطفاً یک تصویر انتخاب کنید.");
      return;
    }

    try {
      setLoading(true);

      // ساخت FormData و افزودن فایل
      const form = new FormData();
      form.append("file", file);
      // اگر کاربر می‌خواهد ذخیره کند و از قبل 401 نخورده‌ایم
      if (!unauth && saveToLib) form.append("save", "1");

      const res = await fetch(API_URL, {
        method: "POST",
        body: form,
        // مهم: Content-Type را برای FormData تنظیم نکنید
        headers: { Authorization: `Bearer ${token}` },
      });

      // اگر نشست نامعتبر شده بود
      if (res.status === 401) {
        setUnauth(true);
        setError("نشست شما منقضی شده است. لطفاً دوباره وارد شوید.");
        // پاک‌کردن توکن خراب از storage (همگام‌سازی با سایر تب‌ها)
        setStoredToken(null);
        return;
      }

      // سایر خطاهای سرور
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "خطای نامشخص از سرور");
      }

      // نتیجهٔ موفق
      const data = await res.json(); // { class, confidence, saved?, photo_id?, url? }
      setResult(data);
      if (data.saved) setInfo("عکس با موفقیت در «عکس‌های من» ذخیره شد.");
    } catch (e) {
      setError(e.message || "خطا در پردازش درخواست");
    } finally {
      setLoading(false);
    }
  }

  // برچسب فارسی کلاس و درصد اطمینان برای نمایش
  const faClass = result ? (FA_LABELS[result.class] || result.class) : "";
  const conf = result ? Number(result.confidence) : 0;

  /* ------------------------------- UI ------------------------------- */
  return (
    <div dir="rtl" className="max-w-5xl mx-auto px-4 py-10 text-right">
      <h1 className="text-3xl font-bold text-center mb-8">پیش‌بینی تفکیک زباله</h1>

      {/* بلوک پیام خطا + دکمهٔ ورود (در صورت unauth یا نبود توکن) */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span className="flex-1">{error}</span>
          {(unauth || !token) && (
            <button
              onClick={() =>
                navigate("/login", {
                  state: {
                    msg: "برای پیش‌بینی ابتدا وارد شوید.",
                    from: { pathname: "/predict" },
                  },
                })
              }
              className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700"
            >
              ورود
            </button>
          )}
        </div>
      )}

      {/* پیام‌های اطلاعاتی (مانند ذخیره شدن عکس) */}
      {info && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          {info}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* ستون چپ: پیش‌نمایش تصویر + نتیجهٔ پیش‌بینی */}
        <div>
          {/* پیش‌نمایش */}
          {preview ? (
            <img src={preview} alt="پیش‌نمایش" className="w-full rounded-xl border" />
          ) : (
            <div className="h-52 grid place-items-center rounded-xl border text-gray-400">
              هنوز تصویری انتخاب نشده
            </div>
          )}

          {/* نمایش نتیجه (در صورت موجود بودن) */}
          {result && (
            <div className="mt-4 rounded-lg border bg-gray-50 p-4">
              <div>
                <b>کلاس:</b> {faClass}
              </div>
              <div className="mt-2">
                <b>اطمینان:</b> {(conf * 100).toFixed(1)}%
              </div>
              {/* نوار پیشرفتِ اطمینان */}
              <div className="mt-2 h-2 w-full rounded bg-gray-200 overflow-hidden">
                <div
                  className="h-2 bg-emerald-600"
                  style={{
                    width: `${Math.min(100, Math.max(0, conf * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ستون راست: باکس انتخاب فایل + کنترل‌ها */}
        <div className="border-2 border-dashed rounded-xl p-6">
          <label className="mb-4 block text-gray-600">تصویر را انتخاب کنید</label>
          <input type="file" accept="image/*" onChange={onPick} className="block" />

          <div className="mt-6 flex items-center gap-3">
            {/* دکمهٔ ارسال برای پیش‌بینی */}
            <button
              onClick={send}
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "در حال ارسال..." : "پیش‌بینی"}
            </button>

            {/* گزینهٔ «ذخیره در عکس‌های من» فقط وقتی توکن معتبر داریم */}
            {token && !unauth && (
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveToLib}
                  onChange={(e) => setSaveToLib(e.target.checked)}
                />
                <span>ذخیره در عکس‌های من</span>
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
