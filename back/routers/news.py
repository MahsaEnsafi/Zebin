from fastapi import HTTPException, Depends, APIRouter, status, Response
from sqlalchemy.orm import Session
from database import get_db
import model, schemas
from auth import get_current_user
from typing import List

# روتر مربوط به «خبرها»
# تمام مسیرها با /news شروع می‌شوند.
router = APIRouter(prefix="/news", tags=["News"])

@router.get("/", response_model=List[schemas.News])
def get_news(db: Session = Depends(get_db)):
    """
    دریافت فهرست همه خبرها (عمومی).
    - احراز هویت لازم نیست.
    - خروجی بر اساس اسکیمای Pydantic «schemas.News» سریالایز می‌شود.
    نکته: اگر نیاز به ترتیب خاص دارید، می‌توانید .order_by(model.NewsTable.id.desc()) اضافه کنید.
    """
    return db.query(model.NewsTable).all()

@router.post("/", response_model=schemas.News, status_code=status.HTTP_201_CREATED)
def create_news(
    news: schemas.NewsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ایجاد خبر جدید (فقط ادمین).
    - بدنه‌ی ورودی طبق «schemas.NewsCreate» است.
    - فقط کاربر با نقش admin مجاز است.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="فقط ادمین می‌تواند خبر ایجاد کند",
        )

    db_news = model.NewsTable(
        title=news.title,
        summary=news.summary,
        content=news.content,
        category=news.category,
        image=news.image,
        source=news.source,
    )
    db.add(db_news)
    db.commit()
    db.refresh(db_news)
    return db_news

@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_news(
    news_id: int,
    response: Response,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    حذف یک خبر (فقط ادمین).
    - اگر خبر یافت نشود 404 برمی‌گرداند.
    - در صورت موفقیت 204 (بدون بدنه) برمی‌گردد.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="فقط ادمین می‌تواند خبر را حذف کند",
        )

    item = db.query(model.NewsTable).filter(model.NewsTable.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="خبر پیدا نشد")

    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{news_id}", response_model=schemas.News)
def get_one_news(news_id: int, db: Session = Depends(get_db)):
    """
    دریافت جزئیات یک خبر (عمومی) با شناسه.
    - در صورت نبودن خبر: 404
    """
    item = db.query(model.NewsTable).filter(model.NewsTable.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="خبر پیدا نشد")
    return item

@router.put("/{news_id}", response_model=schemas.News)
def update(
    news_id: int,
    payload: schemas.NewsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    به‌روزرسانی کامل یک خبر (فقط ادمین).
    - از PUT استفاده شده و اسکیمای ورودی همان NewsCreate است (همه فیلدها را می‌پذیرد).
      اگر قصد «ویرایش جزئی» دارید، بهتر است یک اسکیمای ArticleUpdate/NewsUpdate تعریف کنید و PATCH به‌کار ببرید.
    - در صورت نبودن خبر: 404
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="فقط ادمین می‌تواند خبر را ویرایش کند",  # ← پیام تصحیح شد
        )

    item = db.query(model.NewsTable).filter(model.NewsTable.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="خبر پیدا نشد")

    # نکته: قبلاً این خط به‌اشتباه از عملگر مقایسه (==) استفاده می‌کرد.
    # اینجا باید انتساب انجام شود:
    item.title = payload.title
    item.content = payload.content
    item.summary = payload.summary
    item.category = payload.category
    item.image = payload.image
    item.source = payload.source

    db.commit()
    db.refresh(item)
    return item
