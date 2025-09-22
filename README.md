# Zebin

یک پروژهٔ فول‌استک با **بک‌اند Python/FastAPI** و **فرانت‌اند Vite (JS/TS)**.  
برخی فایل‌ها (داده/مدل) با **Git LFS** مدیریت می‌شوند.

## فهرست
- [پیش‌نیازها](#پیش‌نیازها)
- [نصب سریع](#نصب-سریع)
- [اجرای توسعه](#اجرای-توسعه)
- [ساختار پوشه‌ها](#ساختار-پوشه‌ها)
- [نکته دربارهٔ LFS](#نکته-دربارهٔ-lfs)
- [مجوز](#مجوز)

---

## پیش‌نیازها
- Python 3.10+
- Node.js 18+ و npm
- Git و Git LFS

## نصب سریع
```bash
git clone https://github.com/MahsaEnsafi/Zebin.git
cd Zebin

# دریافت فایل‌های بزرگ (LFS)
git lfs install
git lfs pull
```

### وابستگی‌های بک‌اند (Python/FastAPI)
اگر فایل `requirements.txt` داری:
```bash
pip install -r requirements.txt
```
اگر نداری، حداقل‌ها:
```bash
pip install fastapi "uvicorn[standard]"
```

### وابستگی‌های فرانت‌اند (Vite)
```bash
cd front
npm install
cd ..
```

## اجرای توسعه

### بک‌اند (FastAPI)
```bash
cd back
# اگر فایل اصلی‌ات متفاوت است، نام ماژول را اصلاح کن
uvicorn main:app --reload --port 8000
```
- API Docs: http://localhost:8000/docs

### فرانت‌اند (Vite)
```bash
cd front
npm run dev
```
- آدرس پیش‌فرض: http://localhost:5173

## ساختار پوشه‌ها
```
Zebin/
├─ back/                 # کدهای FastAPI
├─ front/                # کدهای Vite (JS/TS)
├─ data/                 # داده‌ها (بعضی تحت LFS)
├─ model/                # وزن/مدل‌ها (LFS)
├─ .gitattributes        # الگوهای Git LFS
├─ .gitignore
└─ README.md
```

## نکته دربارهٔ LFS
این مخزن از **Git LFS** استفاده می‌کند. پس از clone حتماً:
```bash
git lfs install
git lfs pull
```
اگر فایل بزرگ جدیدی اضافه می‌کنی، قبل از commit آن را به LFS بسپار:
```bash
git lfs track "model/**/variables.data-00000-of-00001"
git add .gitattributes
git commit -m "chore: track large artifacts with Git LFS"
```

## مجوز
License: MIT — متن کامل در فایل LICENSE
