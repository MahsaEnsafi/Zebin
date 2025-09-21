// src/components/AdminGuide.jsx
import { useEffect, useState } from "react";
import { api, BASE } from "../lib/api";

/* متادیتای ظاهری هر نوع آیتم */
const KIND_META = {
  yes:  { label: "قابل بازیافت", tone: "bg-emerald-50 border-emerald-200" },
  no:   { label: "غیرقابل",      tone: "bg-rose-50 border-rose-200"     },
  prep: { label: "آماده‌سازی",    tone: "bg-amber-50 border-amber-200"   },
  note: { label: "نکات",          tone: "bg-sky-50 border-sky-200"       },
};

function slugify(input = "") {
  return input
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .toLowerCase();
}

export default function AdminGuide() {
  const [cats, setCats] = useState(null);
  const [err, setErr] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    color: "border-blue-300 bg-blue-50",
  });

  const [itemsBySlug, setItemsBySlug] = useState({});
  const [adding, setAdding] = useState({}); // {slug: {kind, text}}

  async function load() {
    try {
      setErr(null);
      const res = await fetch(`${BASE}/guide/`);
      const data = await res.json();
      setCats(data);

      const entries = await Promise.all(
        data.map(async (c) => {
          const r = await fetch(`${BASE}/guide/${encodeURIComponent(c.slug)}/items`);
          return [c.slug, r.ok ? await r.json() : []];
        })
      );
      setItemsBySlug(Object.fromEntries(entries));
    } catch (e) {
      setErr(e.message || "خطا در بارگذاری");
    }
  }

  useEffect(() => { load(); }, []);

  async function createCategory(e) {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.slug?.trim()) payload.slug = slugify(payload.name);
      await api(`/guide/`, { method: "POST", body: JSON.stringify(payload) });
      setForm({ name: "", slug: "", description: "", color: "border-blue-300 bg-blue-50" });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function updateCategory(slug) {
    const name = prompt("نام جدید (خالی = بدون تغییر):");
    const description = prompt("توضیح جدید (خالی = بدون تغییر):");
    const color = prompt("کلاس رنگ جدید (خالی = بدون تغییر):");
    const body = {};
    if (name) body.name = name;
    if (description) body.description = description;
    if (color) body.color = color;
    if (!Object.keys(body).length) return;
    try {
      await api(`/guide/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteCategory(slug) {
    if (!confirm("حذف دسته و تمام آیتم‌هایش؟")) return;
    try {
      await api(`/guide/${encodeURIComponent(slug)}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function addItem(slug) {
    const s = (slug || "").trim();
    if (!s) return alert("اسلاگ دسته نامعتبر است");
    const f = adding[slug] || { kind: "yes", text: "" };
    if (!f.text?.trim()) return alert("متن آیتم را وارد کن");

    try {
      await api(`/guide/${encodeURIComponent(s)}/items`, {
        method: "POST",
        body: JSON.stringify({ kind: f.kind, text: f.text }),
      });
      setAdding((st) => ({ ...st, [slug]: { kind: "yes", text: "" } }));
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteItem(id) {
    if (!confirm("آیتم حذف شود؟")) return;
    try {
      await api(`/guide/items/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function editItem(item) {
    const newText = prompt("متن جدید:", item.text) ?? item.text;
    const newKind = prompt("نوع جدید (yes/no/prep/note):", item.kind) ?? item.kind;
    const newSlug = prompt("انتقال به slug دسته (خالی = بدون تغییر):", "");
    const body = {};
    if (newText !== item.text) body.text = newText;
    if (newKind !== item.kind) body.kind = newKind;
    if (newSlug) body.categorySlug = newSlug;
    if (!Object.keys(body).length) return;
    try {
      await api(`/guide/items/${item.id}`, { method: "PUT", body: JSON.stringify(body) });
      await load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div dir="rtl" className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">مدیریت راهنما</h1>

      {/* فرم ساخت دسته */}
      <form onSubmit={createCategory} className="rounded-2xl border p-4 mb-6 bg-white">
        <h2 className="font-semibold mb-3">افزودن دسته</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="rounded border p-2" required placeholder="نام*" value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}/>
          <input className="rounded border p-2" placeholder="اسلاگ (اختیاری)" value={form.slug}
                 onChange={(e) => setForm({ ...form, slug: e.target.value })}/>
          <input className="rounded border p-2 md:col-span-2" required placeholder="توضیح کوتاه*"
                 value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/>
          <input className="rounded border p-2 md:col-span-2" placeholder="کلاس رنگ Tailwind"
                 value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}/>
        </div>
        <button className="mt-3 rounded-lg border px-4 py-2">ثبت دسته</button>
      </form>

      {err && <p className="text-rose-600">{err}</p>}
      {!err && !cats && <p>در حال بارگذاری…</p>}
      {!err && cats && cats.length === 0 && <p>هیچ دسته‌ای ثبت نشده است.</p>}

      {/* کارت‌های زیباتر برای هر دسته + آیتم‌ها */}
      {!err && cats && cats.length > 0 && (
        <div className="flex flex-col gap-6">
          {cats.map((c) => {
            const colorClasses = c.color || "border-blue-300 bg-blue-50";
            const items = itemsBySlug[c.slug] || [];
            const byKind = {
              yes:  items.filter((i) => i.kind === "yes"),
              no:   items.filter((i) => i.kind === "no"),
              prep: items.filter((i) => i.kind === "prep"),
              note: items.filter((i) => i.kind === "note"),
            };

            return (
              <div key={c.slug} className="rounded-2xl border shadow-sm overflow-hidden bg-white">
                {/* هدر دسته با پس‌زمینه‌ی رنگ دسته */}
                <div className={`p-4 border-b flex items-start justify-between ${colorClasses}`}>
                  <div>
                    <div className="text-xs opacity-70">/{c.slug}</div>
                    <h3 className="font-bold text-lg mt-0.5">{c.name}</h3>
                    <p className="text-sm opacity-80 mt-1">{c.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg border px-3 py-1 text-sm bg-white/70"
                            onClick={() => updateCategory(c.slug)}>
                      ویرایش
                    </button>
                    <button className="rounded-lg border px-3 py-1 text-sm bg-white/70"
                            onClick={() => deleteCategory(c.slug)}>
                      حذف
                    </button>
                  </div>
                </div>

                {/* چهار ستون آیتم‌ها با استایل تفکیک‌شده */}
                <div className="p-4 grid md:grid-cols-4 gap-4">
                  {["yes", "no", "prep", "note"].map((k) => {
                    const meta = KIND_META[k];
                    const list = byKind[k];
                    return (
                      <div key={k} className={`rounded-xl border ${meta.tone} p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">{meta.label}</div>
                          <span className="text-xs opacity-70">{list.length} مورد</span>
                        </div>

                        <ul className="space-y-2 max-h-48 overflow-auto pr-1">
                          {list.length === 0 ? (
                            <li className="text-xs opacity-60">—</li>
                          ) : (
                            list.map((it) => (
                              <li key={it.id}
                                  className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 hover:shadow-sm">
                                <span className="text-sm">{it.text}</span>
                                <span className="flex gap-2">
                                  <button className="text-xs text-blue-700 hover:underline"
                                          onClick={() => editItem(it)}>ویرایش</button>
                                  <button className="text-xs text-rose-700 hover:underline"
                                          onClick={() => deleteItem(it.id)}>حذف</button>
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                {/* فرم افزودن آیتم به همین دسته */}
                <div className="px-4 pb-4">
                  <div className="rounded-xl border p-3">
                    <h4 className="font-semibold mb-2">افزودن آیتم به «{c.name}»</h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={adding[c.slug]?.kind ?? "yes"}
                        onChange={(e) =>
                          setAdding((s) => ({ ...s, [c.slug]: { ...(s[c.slug] || {}), kind: e.target.value } }))
                        }
                        className="rounded border p-2"
                      >
                        <option value="yes">قابل بازیافت</option>
                        <option value="no">غیرقابل</option>
                        <option value="prep">آماده‌سازی</option>
                        <option value="note">نکته</option>
                      </select>

                      <input
                        className="rounded border p-2 flex-1 min-w-[220px]"
                        placeholder="متن آیتم"
                        value={adding[c.slug]?.text ?? ""}
                        onChange={(e) =>
                          setAdding((s) => ({ ...s, [c.slug]: { ...(s[c.slug] || {}), text: e.target.value } }))
                        }
                      />

                      <button className="rounded-lg border px-3 py-2" onClick={() => addItem(c.slug)}>
                        افزودن
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
