# back/main.py
"""
برنامه‌ی اصلی FastAPI برای بک‌اند «زبین»
-----------------------------------------------------------------------
این فایل نقطه‌ی ورود سرویس وب است و کارهای زیر را انجام می‌دهد:
  1) مقداردهی اولیه‌ی برنامه‌ی FastAPI
  2) پیکربندی CORS برای اجازه‌ی دسترسی فرانت (Vite روی پورت 5173)
  3) آماده‌سازی مسیر استاتیک /uploads برای سرو کردن فایل‌های آپلودی
  4) ثبت (mount/include) روترهای دامنه‌ای (users, news, articles, ...)
  5) یک اندپوینت ساده‌ی روت برای Health/Readiness

نکته مهم درباره دیتابیس:
- فراخوانی model.Base.metadata.create_all(bind=engine) جداول را بر اساس
  مدل‌ها می‌سازد. این برای توسعه خوب است؛ در محیط تولید بهتر است از Alembic
  برای migration استفاده کنید تا تغییرات اسکیمای دیتابیس نسخه‌بندی شود.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

import model
from database import engine
# هر روتر مسئول یک «دامنه» از API است. مسیرهای آن‌ها داخل ماژول‌های routers تعریف شده.
from routers import (
    articles,        # /articles, /articles/{id}  — CRUD مقالات علمی
    users,           # /users/*                   — ثبت‌نام/ورود/اطلاعات کاربر
    dashboard,       # /dashboard                 — شمارنده‌ها، خلاصه وضعیت کاربر
    predict,         # /predict/                  — آپلود تصویر و پیش‌بینی کلاس زباله
    news,            # /news, /news/{id}         — CRUD خبرها
    guide,           # /guide/*                   — دسته‌ها و آیتم‌های راهنما
    notification,    # /notifs/*                  — اعلان‌ها (list/create/read-all/...)
    bookmarks,       # /bookmarks/*               — نشانک‌ها (add/remove/check/list)
    me_router,       # /me/*                      — منابع «مختص کاربر جاری» (مثل photos)
)

# ---------------------------------------------------------------------
# ساخت جداول (فقط برای توسعه). در تولید، Alembic توصیه می‌شود.
# ---------------------------------------------------------------------
model.Base.metadata.create_all(bind=engine)

# ---------------------------------------------------------------------
# ایجاد نمونه برنامه FastAPI
# می‌توانید title/version/docs_url را در صورت نیاز تنظیم کنید.
# ---------------------------------------------------------------------
app = FastAPI()

# ---------------------------------------------------------------------
# CORS: اجازه‌ی دسترسی فرانت (Vite dev server) به API
# - origins را مطابق محیط خود تنظیم کنید (مثلاً از env بخوانید).
# - allow_credentials=True برای ارسال کوکی/هدرهای احراز هویت ضروری است.
# ---------------------------------------------------------------------
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # در صورت نیاز: ["*"] فقط برای توسعه
    allow_credentials=True,
    allow_methods=["*"],         # اجازه همه‌ی متدها (GET/POST/PUT/DELETE/...)
    allow_headers=["*"],         # اجازه همه‌ی هدرها (مثلاً Authorization)
)

# ---------------------------------------------------------------------
# فایل‌های استاتیک آپلودی
# - پوشه‌ی «back/uploads» اگر وجود نداشته باشد ساخته می‌شود.
# - مسیر وب «/uploads» به همین پوشه mount می‌شود؛
#   بنابراین URL نهایی مثلاً: http://127.0.0.1:8000/uploads/myfile.jpg
# ---------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)  # ایجاد امن پوشه (idempotent)

# سرو کردن پوشه uploads در آدرس /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ---------------------------------------------------------------------
# ثبت روترها (namespace های API)
# هر روتر مسیرهای مربوط به دامنهٔ خودش را include می‌کند.
# اگر prefix یا tags نیاز دارید، داخل خود روتر تنظیم شده باشد.
# ---------------------------------------------------------------------
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(articles.router)
app.include_router(predict.router)
app.include_router(news.router)
app.include_router(guide.router)
app.include_router(notification.router)
app.include_router(bookmarks.router)
app.include_router(me_router.router)

# ---------------------------------------------------------------------
# اندپوینت ریشه — برای Health Check ساده یا معرفی سرویس
# ---------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "API is running"}

# ---------------------------------------------------------------------
# نکات اجرایی:
# - اجرا در توسعه:
#     uvicorn main:app --reload --host 0.0.0.0 --port 8000
# - مستندات:
#     Swagger UI:   /docs
#     ReDoc:        /redoc
# ---------------------------------------------------------------------
