// src/layouts/Footer.jsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-auto w-full border-t bg-gray-700 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between text-sm">
        <p>© {new Date().getFullYear()} Zebin. تمام حقوق محفوظ است.</p>
        <nav className="flex gap-6">
          <Link to="/contact" className="hover:text-emerald-300">تماس با ما</Link>
          <Link to="/about" className="hover:text-emerald-300">درباره ما</Link>
        </nav>
      </div>
    </footer>
  );
}

