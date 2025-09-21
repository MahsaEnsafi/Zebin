// src/components/Logo.jsx

// ۱) ایمپورت فایل لوگو به‌صورت asset (ویتب/CRA مسیر درست رو در خروجی می‌سازه)
import logo from '../assets/logo-tran.png';

// ۲) استایل‌های سراسری (اگر Tailwind دارید معمولاً در entry مثل main.jsx ایمپورت می‌شود)
//    اگر این فایل چندبار در پروژه ایمپورت شود، مراقب باشید index.css دوبار بارگذاری نشود.
import '../index.css';

/**
 * Logo
 * - لوگو را گوشه‌ی چپ-بالای صفحه نمایش می‌دهد.
 * - به‌صورت absolutely positioned است؛ یعنی نسبت به نزدیک‌ترین والدِ position‌دار (relative/absolute/…) جابه‌جا می‌شود.
 * - برای اینکه دقیقاً گوشه‌ی صفحه باشد، معمولاً آن را داخل ریشه‌ای قرار می‌دهند که position:relative داشته باشد
 *   یا خودِ این باکس را position:fixed بگذارید (بسته به نیاز UI).
 */
export default function Logo() {
  return (
    <div
      className="absolute top-4 left-4 p-0 m-0"
      // نکته: اگر می‌خواهید لوگو همیشه در گوشه‌ی صفحه ثابت بماند، بجای 'absolute' از 'fixed' استفاده کنید.
      // className="fixed top-4 left-4 p-0 m-0"
    >
      <img
        src={logo}
        alt="Zebin Logo"         // متن جایگزین برای دسترس‌پذیری (screen reader)
        className="h-24 ml-0 mt-0" // ارتفاع ثابت ~96px؛ در صورت نیاز می‌توانید responsive کنید: 'h-16 md:h-20 lg:h-24'
        // نکته: اگر تصویر purely تزئینی است، می‌توانید alt="" بگذارید تا توسط screen reader خوانده نشود.
      />
    </div>
  );
}
