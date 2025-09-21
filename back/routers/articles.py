# back/routers/articles.py
# -----------------------------------------------------------------------------
# روتر مقالات (Articles)
# - مسیر پایه: /articles
# - عملیات‌ها: فهرست، مشاهده جزئیات، ایجاد، ویرایش، حذف
# - احراز هویت: ایجاد/ویرایش/حذف فقط برای ادمین (از طریق get_current_user)
# - مدل‌ها: schemas.Article, ArticleCreate, ArticleUpdate
# -----------------------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import model, schemas
from database import get_db
from sqlalchemy import or_                      # (فعلاً استفاده نشده؛ برای جستجو/فیلتر آینده)
from typing import List, Optional               # (Optional فعلاً استفاده نشده)
from auth import get_current_user               # وابستگی احراز هویت (Bearer JWT)

# ساخت روتر با پیشوند و تگ مشخص (برای سواگر/داکس)
router = APIRouter(prefix="/articles", tags=["Articles"])


@router.get("/", response_model=List[schemas.Article])
def get_articles(db: Session = Depends(get_db)):
    """
    دریافت فهرست همهٔ مقالات.

    - بدون نیاز به احراز هویت (عمومی).
    - خروجی با Pydantic: List[schemas.Article]  (ORM → JSON)
    - نکته: برای پروژه‌های بزرگ بهتر است صفحه‌بندی (limit/offset) اضافه شود.
    """
    return db.query(model.ArticleTable).all()


@router.get("/{article_id}", response_model=schemas.Article)
def get_article(article_id: int, db: Session = Depends(get_db)):
    """
    دریافت جزئیات یک مقاله با شناسهٔ عددی.

    پارامترها:
    - article_id: شناسهٔ رکورد در جدول articles

    رفتار:
    - اگر یافت نشود: 404
    - در غیر این صورت: شیء مقاله (Article) را برمی‌گرداند.
    """
    a = db.query(model.ArticleTable).filter(model.ArticleTable.id == article_id).first()
    if not a:
        raise HTTPException(404, detail="مقاله پیدا نشد")
    return a


@router.post("/", response_model=schemas.Article, status_code=status.HTTP_201_CREATED)
def create_article(
    article: schemas.ArticleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ایجاد مقالهٔ جدید — فقط برای ادمین.

    احراز هویت/مجوز:
    - get_current_user کاربر را از روی توکن می‌خواند.
    - اگر نقش کاربر 'admin' نباشد: 403

    بدنهٔ درخواست:
    - schemas.ArticleCreate  (title, content, ...)

    نتیجه:
    - رکورد جدید ساخته می‌شود و با status 201 برگردانده می‌شود.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="فقط ادمین میتواند مقاله ایجاد کند",
        )

    # ساخت نمونهٔ ORM از داده‌های ورودی
    db_article = model.ArticleTable(
        title=article.title,
        summary=article.summary,
        content=article.content,
        category=article.category,
        image=article.image,
        source=article.source,
    )

    # افزودن به سشن و ذخیره در دیتابیس
    db.add(db_article)
    db.commit()
    db.refresh(db_article)  # تازه‌سازی تا فیلدهای تولیدشده (id و ...) را داشته باشیم

    return db_article


@router.put("/{article_id}", response_model=schemas.Article)
def update_article(
    article_id: int,
    payload: schemas.ArticleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ویرایش مقاله — فقط برای ادمین.

    پارامترها:
    - article_id: شناسهٔ مقاله برای ویرایش
    - payload: فیلدهای قابل‌تغییر (همه اختیاری‌اند)

    رفتار:
    - 403 اگر نقش ادمین نباشد
    - 404 اگر رکورد پیدا نشود
    - اعمال تغییرات فقط روی فیلدهای ارسال‌شده (exclude_unset=True)
    """
    if current_user.role != "admin":
        raise HTTPException(403, detail="فقط ادمین می‌تواند ویرایش کند")

    a = db.query(model.ArticleTable).filter(model.ArticleTable.id == article_id).first()
    if not a:
        raise HTTPException(404, detail="مقاله پیدا نشد")

    # فقط فیلدهای ارسال‌شده را اعمال کن (PATCH-مانند)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(a, k, v)

    db.commit()
    db.refresh(a)
    return a


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    حذف مقاله — فقط برای ادمین.

    رفتار:
    - 403 اگر ادمین نباشد
    - 404 اگر مقاله موجود نباشد
    - در صورت موفقیت: 204 (بدون بدنهٔ پاسخ)
    """
    if current_user.role != "admin":
        raise HTTPException(403, detail="فقط ادمین می‌تواند حذف کند")

    a = db.query(model.ArticleTable).filter(model.ArticleTable.id == article_id).first()
    if not a:
        raise HTTPException(404, detail="مقاله پیدا نشد")

    db.delete(a)
    db.commit()
    return  # 204 No Content
