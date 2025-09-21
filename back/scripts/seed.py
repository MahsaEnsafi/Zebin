# back/scripts/seed.py
"""
اسکریپت Seed دیتابیس برای پرکردن نمونه‌داده‌های اولیه (دمو/گیت‌هاب)

چه می‌سازد؟
- خبر (۳ آیتم) با title/summary/content/category/source
- مقاله (۳ آیتم) با تصویر placeholder
- راهنما (۴ دسته: plastic/paper/glass/organic) + آیتم‌های گروهی yes/no/prep/note

ویژگی‌ها:
- Idempotent: اگر خبر/مقاله‌ای با همان title یا دسته‌ای با همان slug از قبل باشد،
  دوباره ساخته نمی‌شود؛ آیتم‌های راهنما هم تکراری درج نمی‌شوند.
- اگر جدول‌ها موجود نباشند، ساخته می‌شوند (Base.metadata.create_all).

نحوۀ اجرا:
    cd back
    # (اختیاری) پیش‌نیازها: pip install -r requirements.txt
    python scripts/seed.py

محیط/دیتابیس:
- از پیکربندی database.py استفاده می‌کند (پیش‌فرض: sqlite:///./zebin.db).
- برای ریست کامل دادهٔ نمونه، فایل zebin.db را حذف کنید و دوباره اجرا کنید.

سفارشی‌سازی:
- آرایه‌های `news_data`، `articles_data` و لیست `guide` را طبق نیاز ویرایش کنید
  (مثلاً تغییر متن‌ها، افزودن تصویر واقعی به‌جای placeholder).

خروجی:
- در پایان تعداد رکوردهای ایجادشده چاپ می‌شود.
"""

# back/scripts/seed.py
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from pathlib import Path

import os
import sys

# دسترسی به ماژول‌های back/
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import engine, SessionLocal, Base
import model

def get_or_create_news(db: Session, title: str, **fields):
    row = db.query(model.NewsTable).filter(model.NewsTable.title == title).first()
    if row:
        return row, False
    row = model.NewsTable(title=title, **fields)
    db.add(row); db.commit(); db.refresh(row)
    return row, True

def get_or_create_article(db: Session, title: str, **fields):
    row = db.query(model.ArticleTable).filter(model.ArticleTable.title == title).first()
    if row:
        return row, False
    row = model.ArticleTable(title=title, **fields)
    db.add(row); db.commit(); db.refresh(row)
    return row, True

def get_or_create_category(db: Session, slug: str, **fields):
    row = db.query(model.GuideCategoryTable).filter(model.GuideCategoryTable.slug == slug).first()
    if row:
        # به‌روزرسانی سبک (مثلاً رنگ یا توضیح)
        for k, v in fields.items():
            setattr(row, k, v)
        db.commit(); db.refresh(row)
        return row, False
    row = model.GuideCategoryTable(slug=slug, **fields)
    db.add(row); db.commit(); db.refresh(row)
    return row, True

def ensure_item(db: Session, category_id: int, kind: model.GuideItemKind, text: str):
    exists = (
        db.query(model.GuideItemTable)
        .filter(
            and_(
                model.GuideItemTable.category_id == category_id,
                model.GuideItemTable.kind == kind,
                model.GuideItemTable.text == text,
            )
        ).first()
    )
    if exists:
        return False
    it = model.GuideItemTable(category_id=category_id, kind=kind, text=text)
    db.add(it); db.commit()
    return True

def main():
    print(">> Creating tables (if not exists)…")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    created = {"news": 0, "articles": 0, "cats": 0, "items": 0}

    # -------- News --------
    news_data = [
        dict(
            title="آغاز طرح تفکیک در مبدأ در چند شهر",
            summary="اجرای آزمایشی طرح تفکیک در مبدأ با مشارکت شهرداری‌ها آغاز شد.",
            content="در چند منطقهٔ شهری، مخازن جدید و برنامهٔ جمع‌آوری تفکیک‌شده راه‌اندازی شد.",
            category="ایران",
            image=None,
            source="https://example.com/news1",
        ),
        dict(
            title="نوآوری در بازیافت پلاستیک‌های چندلایه",
            summary="یک استارتاپ روش جدیدی برای بازیافت بسته‌بندی‌های چندلایه معرفی کرد.",
            content="این فناوری می‌تواند نرخ بازیافت را در صنعت بسته‌بندی افزایش دهد.",
            category="جهان",
            image=None,
            source="https://example.com/news2",
        ),
        dict(
            title="افتتاح مرکز کمپوست شهری",
            summary="فاز نخست مرکز کمپوست با ظرفیت پردازش روزانه افتتاح شد.",
            content="این مرکز با هدف کاهش دفن پسماند تر به بهره‌برداری رسید.",
            category="ایران",
            image=None,
            source="https://example.com/news3",
        ),
    ]
    for n in news_data:
        _, is_new = get_or_create_news(db, **n)
        created["news"] += 1 if is_new else 0

    # -------- Articles --------
    articles_data = [
        dict(
            title="راهنمای سریع تفکیک پلاستیک‌ها",
            summary="چگونه پلاستیک‌های متداول را تمیز و آمادهٔ بازیافت کنیم.",
            content="پلاستیک‌های دارای کُد ۱ و ۲ معمولاً در اولویت جمع‌آوری‌اند. ظرف‌ها را سریع بشویید و خشک کنید.",
            category="آموزشی",
            image="https://placehold.co/800x450?text=Zebin+Plastic",
            source=None,
        ),
        dict(
            title="چرخهٔ بازیافت شیشه از خانه تا کارخانه",
            summary="از جداسازی در منزل تا ذوب و تولید شیشهٔ جدید.",
            content="درپوش‌ها را جدا کنید و شیشه‌ها را بدون آلودگی تحویل دهید. شیشهٔ پیرکس/کریستال در جریان عادی نیست.",
            category="آموزشی",
            image="https://placehold.co/800x450?text=Zebin+Glass",
            source=None,
        ),
        dict(
            title="کمپوست خانگی در ۱۰ دقیقه",
            summary="یک راهنمای خیلی کوتاه برای شروع کمپوست در خانه.",
            content="پسماند تر را با مواد قهوه‌ای خشک ترکیب کنید، رطوبت و هوا را تنظیم کنید تا بوی نامطبوع ایجاد نشود.",
            category="راهنما",
            image="https://placehold.co/800x450?text=Zebin+Compost",
            source=None,
        ),
    ]
    for a in articles_data:
        _, is_new = get_or_create_article(db, **a)
        created["articles"] += 1 if is_new else 0

    # -------- Guide Categories + Items --------
    guide = [
        dict(
            slug="plastic",
            name="پلاستیک",
            description="نمونه‌های رایج و نکات آماده‌سازی پلاستیک‌ها.",
            color="border-blue-300 bg-blue-50",
            yes=["بطری‌های PET تمیز", "ظروف پلاستیکی تمیز"],
            no=["نی‌های پلاستیکی", "کیسه‌های بسیار نازکِ چرب"],
            prep=["شست‌وشو و خشک‌کردن", "فشرده‌سازی برای کاهش حجم"],
            note=["کُدهای ۱ و ۲ معمولاً اولویت دارند"],
        ),
        dict(
            slug="paper",
            name="کاغذ و مقوا",
            description="موارد قابل/غیرقابل بازیافت برای کاغذ و مقوا.",
            color="border-amber-300 bg-amber-50",
            yes=["روزنامهٔ خشک", "کارتن بدون لکهٔ چربی"],
            no=["دستمال کاغذی", "جعبه پیتزای چرب"],
            prep=["جدا کردن منگنه/چسب", "تا کردن برای کاهش حجم"],
            note=["کاغذهای فتوگلاسه معمولاً بازیافت نمی‌شوند"],
        ),
        dict(
            slug="glass",
            name="شیشه",
            description="چه شیشه‌هایی در جریان عادی بازیافت می‌شوند؟",
            color="border-green-300 bg-green-50",
            yes=["بطری‌های بی‌رنگ و سبز سالم"],
            no=["شیشهٔ شکسته، آینه و لامپ"],
            prep=["برداشتن درپوش‌ها", "شست‌وشوی سریع"],
            note=["پیرکس/کریستال معمولاً در جریان شیشهٔ عادی نیست"],
        ),
        dict(
            slug="organic",
            name="زباله‌تر / آلی",
            description="ورودی‌های مناسب برای کمپوست خانگی یا شهری.",
            color="border-emerald-300 bg-emerald-50",
            yes=["پسماند خوراکی و باغچه"],
            no=["پلاستیک/فلز/شیشه"],
            prep=["آبگیری و خرد کردنِ مواد حجیم"],
            note=["کمپوست خانگی بوی نامطبوع را کم می‌کند"],
        ),
    ]

    for c in guide:
        cat, is_new_cat = get_or_create_category(
            db,
            slug=c["slug"],
            name=c["name"],
            description=c["description"],
            color=c["color"],
        )
        created["cats"] += 1 if is_new_cat else 0

        def add_many(kind_name, texts):
            from model import GuideItemKind
            kind = GuideItemKind(kind_name)
            for t in texts:
                if ensure_item(db, cat.id, kind, t):
                    created["items"] += 1

        add_many("yes",  c.get("yes", []))
        add_many("no",   c.get("no", []))
        add_many("prep", c.get("prep", []))
        add_many("note", c.get("note", []))

    db.close()
    print(">> Seed done:", created)

if __name__ == "__main__":
    main()
