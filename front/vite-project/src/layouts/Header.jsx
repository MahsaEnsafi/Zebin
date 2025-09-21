// src/layouts/Header.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo-tran.png";   // ⬅️ لوگو اینجا ایمپورت شد

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function Header() {
  const { token, logout } = useAuth();
  const [me, setMe] = useState(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // گرفتن پروفایل کاربر
  useEffect(() => {
    let abort = false;
    if (!token) { setMe(null); return; }
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!abort && r.ok) setMe(await r.json());
      } catch {}
    })();
    return () => { abort = true; };
  }, [token]);

  // بستن منوی کاربری با کلیک بیرون
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const initials = (me?.full_name || me?.username || "من")
    .split(" ").map(s => s?.[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/85 border-b border-slate-200">
      {/* grid: [logo | nav(center) | auth/profile] */}
      <div className="max-w-6xl mx-auto px-4 h-16 grid grid-cols-[auto_1fr_auto] items-center">

        {/* لوگو سمت راست */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Zebin logo" className="h-8 w-auto" />
        </Link>

        {/* منو وسط */}
        <nav className="justify-self-center">
          <ul className="flex items-center gap-6 text-sm">
            <li><Link to="/predict" className="hover:text-emerald-700 transition">پیش‌بینی</Link></li>
            <li><Link to="/guide"  className="hover:text-emerald-600 transition">راهنما</Link></li>
            <li><Link to="/articles" className="hover:text-emerald-700 transition">مقالات علمی</Link></li>
            <li><Link to="/recycle-news" className="hover:text-emerald-700 transition">اخبار بازیافت</Link></li>
            <li><Link to="/" className="hover:text-emerald-700 transition">خانه</Link></li>
          </ul>
        </nav>

        {/* ورود/ثبت‌نام یا پروفایل سمت چپ */}
        <div className="justify-self-end">
          {!token ? (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 transition"
              >
                ورود
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                ثبت‌نام
              </Link>
            </div>
          ) : (
            <div className="relative">
              <button
                ref={btnRef}
                onClick={() => setOpen(v => !v)}
                className="w-10 h-10 rounded-full bg-emerald-600 text-white grid place-items-center font-semibold"
                aria-haspopup="menu"
                aria-expanded={open}
              >
                {initials}
              </button>
              {open && (
                <div
                  ref={menuRef}
                  className="absolute left-0 mt-2 bg-white border rounded-xl shadow-lg min-w-[220px] z-50"
                >
                  <div className="px-4 py-3 border-b">
                    <div className="font-semibold">
                      {me?.full_name || me?.username || "حساب کاربری"}
                    </div>
                    {me?.email && <div className="text-xs text-gray-500">{me.email}</div>}
                  </div>
                  <button
                    onClick={() => { setOpen(false); navigate("/profile"); }}
                    className="w-full text-right px-4 py-2 hover:bg-gray-50"
                  >
                    پنل کاربری
                  </button>
                  <button
                    onClick={() => { logout(); setOpen(false); navigate("/"); }}
                    className="w-full text-right px-4 py-2 text-red-600 hover:bg-red-50 rounded-b-xl"
                  >
                    خروج
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
