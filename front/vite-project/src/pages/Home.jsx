// src/pages/Home.jsx
import { Link } from "react-router-dom";
import FeatureBox from "../components/FeatureBox";
import ImageSlider from "../components/ImageSlider";

/**
 * صفحه خانه
 * - هیرو با اسلایدر تصویر
 * - دکمه‌های CTA: هدایت اصلی به /predict
 * - کارت‌های آمار
 * - سه بخش اصلی سایت (FeatureBox)
 * - راهنمای سریع تفکیک
 * - CTA میانی: دعوت مستقیم به «پیش‌بینی»
 */
export default function Home() {
  return (
    <div dir="rtl" className="flex flex-col items-stretch">
      {/* Hero */}
      <section className="relative">
        {/* هاله‌ی تزئینی پس‌زمینه */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(35rem_35rem_at_80%_-10%,#34d39920,transparent_60%)]" />

        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-[1.15] text-slate-900">
              به زِبین خوش آمدید!
            </h1>

            <p className="mt-4 text-slate-600 md:text-lg">
              هدف ما افزایش آگاهی محیط‌زیستی و آموزش تفکیک زباله برای داشتن زمینی سبزتر است.
            </p>

            {/* Slider با فاصله مناسب از متن */}
            <div className="mt-8">
              <ImageSlider />
            </div>

            {/* CTA اصلی */}
            <div className="mt-8 flex justify-center gap-3">
              <Link
                to="/predict"
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
              >
                شروع پیش‌بینی
              </Link>
              <Link
                to="/articles"
                className="px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 transition"
              >
                مطالب علمی
              </Link>
            </div>

            {/* آمار کوتاه */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                ["+۵۰", "مقاله آموزشی"],
                ["+۲۰", "راهنمای شهری"],
                ["+۱۰۰۰", "کاربر فعال"],
                ["۹۷٪", "رضایت کاربران"],
              ].map(([num, label]) => (
                <div
                  key={label}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm"
                >
                  <div className="text-xl font-bold text-slate-900">{num}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* سه بخش اصلی — وسط‌چین */}
      <section className="container mx-auto px-4 pb-12">
        <div className="flex justify-center">
          {/* FeatureBox خودش گرید/چیدمان را مدیریت می‌کند */}
          <FeatureBox />
        </div>
      </section>

      {/* راهنمای سریع تفکیک */}
      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-6 text-center">
            راهنمای سریع تفکیک
          </h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {/* پلاستیک */}
            <div className="p-5 rounded-xl bg-blue-50 border border-blue-100 text-center shadow-sm hover:shadow-md transition">
              <span className="text-4xl" aria-hidden>🧴</span>
              <h3 className="font-bold text-lg mt-2">پلاستیک</h3>
              <p className="text-sm text-slate-600 mt-1">بطری‌ها، ظروف یک‌بارمصرف تمیز</p>
              <Link
                to="/guide"
                className="inline-block mt-3 text-emerald-700 text-sm font-medium hover:underline"
              >
                دیدن راهنمای کامل
              </Link>
            </div>

            {/* کاغذ و مقوا */}
            <div className="p-5 rounded-xl bg-amber-50 border border-amber-100 text-center shadow-sm hover:shadow-md transition">
              <span className="text-4xl" aria-hidden>📄</span>
              <h3 className="font-bold text-lg mt-2">کاغذ و مقوا</h3>
              <p className="text-sm text-slate-600 mt-1">روزنامه، جعبه، کارتن خشک</p>
              <Link
                to="/guide"
                className="inline-block mt-3 text-emerald-700 text-sm font-medium hover:underline"
              >
                دیدن راهنمای کامل
              </Link>
            </div>

            {/* شیشه */}
            <div className="p-5 rounded-xl bg-green-50 border border-green-100 text-center shadow-sm hover:shadow-md transition">
              <span className="text-4xl" aria-hidden>🫙</span>
              <h3 className="font-bold text-lg mt-2">شیشه</h3>
              <p className="text-sm text-slate-600 mt-1">بطری‌ها و شیشه‌های تمیز بدون درپوش فلزی</p>
              <Link
                to="/guide"
                className="inline-block mt-3 text-emerald-700 text-sm font-medium hover:underline"
              >
                دیدن راهنمای کامل
              </Link>
            </div>

            {/* زباله‌تر */}
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 text-center shadow-sm hover:shadow-md transition">
              <span className="text-4xl" aria-hidden>🌿</span>
              <h3 className="font-bold text-lg mt-2">زباله‌تر</h3>
              <p className="text-sm text-slate-600 mt-1">پسماند غذایی؛ مناسب کمپوست خانگی</p>
              <Link
                to="/guide"
                className="inline-block mt-3 text-emerald-700 text-sm font-medium hover:underline"
              >
                دیدن راهنمای کامل
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA میانی — دعوت به پیش‌بینی */}
      <section className="container mx-auto px-4 pb-16">
        <div className="rounded-3xl bg-emerald-600 text-white p-7 md:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-right">
              <h3 className="text-xl md:text-2xl font-extrabold">با یک عکس شروع کن</h3>
              <p className="mt-1 text-emerald-50">
                         تصویر را بفرست تا سیستم نوع پسماند را بین شش دستهٔ استاندارد تشخیص دهد—پلاستیک، کاغذ،
                        مقوا، شیشه، فلز، زبالهٔ متفرقه. امکان ذخیره در «عکس‌های من» پس از ورود
              </p>
            </div>
            <Link
              to="/predict"
              className="px-6 py-3 rounded-xl bg-white text-emerald-700 font-semibold hover:bg-emerald-50 transition"
            >
              شروع پیش‌بینی
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
