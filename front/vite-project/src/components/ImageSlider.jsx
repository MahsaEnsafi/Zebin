// src/components/BannerSlider.jsx
import { useState, useEffect } from "react";
import forest1 from "../assets/forest1.jpg";
import forest2 from "../assets/forest2.jpg";
import forest3 from "../assets/forest3.jpg";

export default function BannerSlider() {
  // آرایه‌ی تصاویر اسلایدر (اینجا فایل‌های محلی ایمپورت شده‌اند)
  // اگر خواستید از URL استفاده کنید می‌توانید رشته‌ی URL را در این آرایه بگذارید.
  const images = [forest1, forest2, forest3];

  // index: شماره‌ی اسلاید فعلی (۰ تا length-1)
  const [index, setIndex] = useState(0);

  // تغییر خودکار اسلاید هر ۴ ثانیه
  // - setInterval در mount ساخته می‌شود
  // - در unmount پاک‌سازی می‌شود تا memory leak یا تداخل تایمر پیش نیاید
  // - وابستگی به images.length تا اگر تعداد تصاویر عوض شد، تایمر با وضعیت جدید sync شود
  useEffect(() => {
    const timer = setInterval(() => {
      // افزایش ایندکس و برگشت حلقه‌ای با عملگر % (modulo)
      setIndex((prev) => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  return (
    // ظرف اصلی اسلایدر:
    // - max-w برای محدود کردن پهنا
    // - rounded/overflow-hidden برای گوشه‌ی گرد و برش تصویر
    // - relative تا بتوانیم نقاط (دکمه‌ها) را absolute روی آن جای‌گذاری کنیم
    <div className="w-full max-w-4xl rounded-xl overflow-hidden shadow-lg relative">
      {/* تصویر اسلاید فعلی */}
      <img
        src={images[index]}
        alt="banner" // بهتر است در پروژه واقعی alt معنادار برای دسترسی‌پذیری تنظیم شود
        className="w-full h-64 object-cover transition-all duration-1000 ease-in-out"
        // object-cover: تصویر را به صورت برش‌خورده متناسب قاب می‌کند
        // transition/duration/ease: انیمیشن نرم هنگام تعویض اسلاید
      />

      {/* نقاط ناوبری پایین (دکمه‌های دایره‌ای) */}
      {/* absolute + left-1/2 + -translate-x-1/2 → مرکز کردن افقی */}
      <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)} // کلیک روی نقطه = حرکت به همان اسلاید
            className={`w-3 h-3 rounded-full ${
              index === i ? "bg-green-600" : "bg-gray-300"
            }`}
            // نکته: برای A11y می‌توانید aria-label={`رفتن به اسلاید ${i+1}`} هم اضافه کنید
          ></button>
        ))}
      </div>
    </div>
  );
}
