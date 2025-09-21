// src/components/FeatureBox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// باکسِ «میانبر قابلیت‌ها» در صفحه‌ی خانه:
// - لینک‌های سریع به بخش‌های اصلی سایت را به‌صورت کارت‌های تیره نمایش می‌دهد.
// - اگر کاربر وارد شده باشد (توکن در storage)، آیتم «کمپین من» هم اضافه می‌شود.
// - ریسپانسیو با Tailwind: 1 ستون → 2 ستون (sm) → 4 ستون (lg)
// ─────────────────────────────────────────────────────────────────────────────

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function FeatureBox() {
  // وضعیت ورود کاربر (خیلی ساده بر اساس وجود توکن در storage)
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // نکته: در AuthContext توکن ممکن است در localStorage یا sessionStorage باشد.
    // این کامپوننت فعلاً فقط localStorage را چک می‌کند.
    // اگر ورود «جلسه‌ای» (Remember off) دارید، می‌توانید sessionStorage را هم بررسی کنید:
    // const hasToken =
    //   !!localStorage.getItem("access_token") || !!sessionStorage.getItem("access_token");
    // setLoggedIn(hasToken);
    setLoggedIn(!!localStorage.getItem("access_token"));
  }, []);

  // لیست آیتم‌ها برای نمایش در باکس
  // - هر آیتم: عنوان، توضیح، و مسیر مقصد (to)
  // - اگر کاربر وارد شده باشد، «کمپین من» را هم اضافه می‌کنیم.
  const items = [
    { title: "مقالات علمی", desc: "مطالب علمی درباره بازیافت و محیط‌زیست", to: "/articles" },
    { title: "اخبار بازیافت", desc: "جدیدترین خبرهای محیط‌زیستی و بازیافت", to: "/recycle-news" },
    { title: "تفکیک زباله", desc: "تفکیک هوشمند زباله", to: "/predict" },
    { title: "راهنما", desc: "قوانین و نکات سریع تفکیک", to: "/guide" },
    // اگر صفحه/مسیر «کمپین» ندارید، این مورد را حذف کنید یا به مقصد مناسب تغییر دهید.
    ...(loggedIn ? [{ title: "کمپین من", desc: "ثبت مشارکت‌ها و دیدن امتیاز", to: "/campaign" }] : []),
  ];

  return (
    // گرید ریسپانسیو: فاصله 16px؛ در sm دو ستون؛ در lg چهار ستون
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Link
          key={it.title}
          to={it.to}
          // کارت تیره با متن روشن، گوشه‌های گرد، و سایه ملایم
          // hover: سایه کمی بیشتر می‌شود
          className="block rounded-2xl bg-slate-900 text-slate-50 p-6 shadow-sm hover:shadow-md transition"
          // دسترسی بهتر (اختیاری):
          // aria-label={`رفتن به ${it.title}`}
        >
          <div className="text-xl font-extrabold">{it.title}</div>
          <div className="mt-2 text-slate-300 text-sm">{it.desc}</div>
        </Link>
      ))}
    </div>
  );
}
