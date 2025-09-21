// src/main.jsx
// ─────────────────────────────────────────────────────────────────────────────
// نقطه‌ی ورود فرانت‌اند (React) + تعریف مسیرها (React Router v6)
// این فایل:
//  - Provider احراز هویت را در ریشه قرار می‌دهد
//  - گاردهای مسیر (RequireAuth/RequireAdmin) را برای بخش‌های محافظت‌شده اعمال می‌کند
//  - Layout کلی (Header/Footer) و همه‌ی Routeهای صفحات را می‌چیند
// ─────────────────────────────────────────────────────────────────────────────

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./index.css";

// لایه‌های صفحه (بالا/پایین)
import Header from "./layouts/Header.jsx";
import Footer from "./layouts/Footer.jsx";

// صفحات عمومی
import Home from "./pages/Home.jsx";
import Contact from "./pages/Contact.jsx";
import About from "./pages/About.jsx";
import ScientificArticles from "./pages/ScientificArticles.jsx";
import RecycleNews from "./pages/RecycleNews.jsx";
import Guide from "./pages/Guide.jsx";
// نکته: اگر فایل شما `src/pages/Predict.jsx` با P بزرگ است، این ایمپورت را هم هماهنگ کنید
// (در سیستم‌عامل‌های حساس به حروف بزرگ/کوچک مثل لینوکس مهم است)
import Predict from "./pages/predict.jsx";
import NewsDetail from "./pages/NewsDetail.jsx";
import ArticleDetail from "./pages/ArticleDetail.jsx";
import Terms from "./pages/Terms.jsx";
import Privacy from "./pages/Privacy.jsx";

// احراز هویت / پروفایل
import Login from "./components/Login.jsx";
import Signup from "./components/Signup.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";

// پنل‌های ادمین
import AdminRoles from "./components/AdminRoles.jsx";
import AdminSendNotif from "./components/AdminSendNotif.jsx"; // ⬅️ فرم ارسال اعلان

// ─────────────────────────────────────────────────────────────────────────────
// گارد مسیر: فقط کاربران واردشده اجازه‌ی مشاهده دارند
// اگر توکن نبود، به /login هدایت می‌کند و مسیر فعلی را در state برای بازگشت ذخیره می‌کند.
// msg: پیام اختیاری که می‌خواهید در صفحه‌ی لاگین نشان داده شود.
// ─────────────────────────────────────────────────────────────────────────────
function RequireAuth({
  children,
  msg = "برای استفاده از این بخش باید وارد شوید.",
}) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return (
      <Navigate to="/login" replace state={{ from: location, msg }} />
    );
  }
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// گارد مسیر ادمین: اگر کاربر وارد نشده باشد => /login
// اگر وارد است ولی نقش او admin نیست => /profile
// ─────────────────────────────────────────────────────────────────────────────
function RequireAdmin({ children }) {
  const { token, user } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user && user.role !== "admin") return <Navigate to="/profile" replace />;
  return children;
}

// ─────────────────────────────────────────────────────────────────────────────
// پوسته‌ی اصلی اپ: Router + Header/Footer + تعریف همه‌ی Routeها
// نکته: متغیر API_BASE را اینجا نمونه‌وار گرفتیم؛ فعلاً فقط به Login پاس شده.
// اگر لازم دارید می‌توانید به سایر صفحات هم props بدهید.
// ─────────────────────────────────────────────────────────────────────────────
function AppShell() {
  const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        {/* سربرگ ثابت سایت */}
        <Header />

        {/* محتوای اصلی صفحات */}
        <main className="flex-grow">
          <Routes>
            {/* صفحه‌ی خانه */}
            <Route path="/" element={<Home />} />

            {/* صفحات عمومی ساده */}
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/articles" element={<ScientificArticles />} />
            <Route path="/recycle-news" element={<RecycleNews />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* مسیرهای ادمین (محافظت‌شده با گارد ادمین) */}
            <Route
              path="/admin/roles"
              element={
                <RequireAdmin>
                  <AdminRoles />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/notifs"
              element={
                <RequireAdmin>
                  <AdminSendNotif />
                </RequireAdmin>
              }
            />

            {/* صفحه‌ی پیش‌بینی مدل (عمومی؛ اما خود صفحه اگر لازم داشت ورود را مدیریت می‌کند) */}
            <Route path="/predict" element={<Predict />} />

            {/* احراز هویت */}
            <Route path="/login" element={<Login apiBase={API_BASE} />} />
            <Route path="/signup" element={<Signup />} />

            {/* پروفایل/داشبورد کاربر — فقط برای اعضا */}
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <ProfilePanel />
                </RequireAuth>
              }
            />

            {/* صفحات جزئیات داینامیک خبر/مقاله */}
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/articles/:id" element={<ArticleDetail />} />

            {/* هر مسیر ناشناخته‌ای به خانه هدایت شود */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* پابرگ ثابت سایت */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// رندرِ اپلیکیشن در DOM
// StrictMode به شناسایی الگوهای مشکل‌ساز کمک می‌کند (فقط در توسعه)
// AuthProvider کانتکست احراز هویت را برای کل اپ فراهم می‌کند
// ─────────────────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </StrictMode>
);
