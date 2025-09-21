# routers/notification.py
# روتر «اعلان‌ها»: مجموعه‌ای از مسیرها برای فهرست، شمارش نخوانده‌ها، خوانده‌کردن،
# ساخت و حذف اعلان‌ها. طراحی به‌گونه‌ای است که کاربر «فقط» اعلان‌های قابل‌مشاهده‌ی
# خودش را می‌بیند: یا اعلان‌های عمومی (user_id=None) یا اعلان‌هایی که برای خودش
# صادر شده است (user_id == current_user.id). وضعیت خوانده/نخوانده «سراسری» است
# (صرفاً یک فیلد is_read روی خود رکورد) و مدل چندگیرنده‌ایِ جداگانه استفاده نشده است.

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

import model, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/notifs", tags=["Notifications"])

def _is_admin(u: model.UserTable) -> bool:
    """بررسی نقش ادمین روی آبجکت کاربر ORM (ایمنی در برابر نبودن فیلد نقش)."""
    return getattr(u, "role", None) == "admin"


# -------------------------------------------------------------------
# GET /notifs
# فهرست اعلان‌های قابل‌مشاهده برای کاربر (عمومی + شخصی خودش)
# پارامتر only: all | unread | read  (فیلتر خوانده/نخوانده)
# پارامترهای limit/offset برای صفحه‌بندی
# خروجی با اسکیمای Pydantic: List[schemas.NotificationOut]
# -------------------------------------------------------------------
@router.get("", response_model=List[schemas.NotificationOut])
def list_notifications(
    only: str = Query("all", pattern="^(all|unread|read)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    # فقط اعلان‌های «قابل‌مشاهده» برای کاربر: عمومی (user_id IS NULL) یا متعلق به خودش
    q = (
        db.query(model.Notification)
        .filter(
            or_(
                model.Notification.user_id == user.id,
                model.Notification.user_id.is_(None),
            )
        )
    )

    # فیلتر خوانده/نخوانده روی همان مجموعه قابل‌مشاهده اعمال می‌شود
    if only == "unread":
        q = q.filter(
            or_(
                model.Notification.is_read.is_(False),
                model.Notification.is_read.is_(None),  # سازگاری عقب‌رو با رکوردهای قدیمی
            )
        )
    elif only == "read":
        q = q.filter(model.Notification.is_read.is_(True))

    # ترتیب: جدیدترین در ابتدا + صفحه‌بندی
    return (
        q.order_by(model.Notification.created_at.desc())
         .offset(offset)
         .limit(limit)
         .all()
    )


# -------------------------------------------------------------------
# GET /notifs/unread-count
# شمارش تعداد اعلان‌های نخوانده میان «قابل‌مشاهده‌ها» برای بج/داشبورد
# خروجی: {"unread": <int>}
# -------------------------------------------------------------------
@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    cnt = (
        db.query(func.count(model.Notification.id))
        .filter(
            or_(
                model.Notification.user_id == user.id,
                model.Notification.user_id.is_(None),
            ),
            or_(
                model.Notification.is_read.is_(False),
                model.Notification.is_read.is_(None),
            ),
        )
        .scalar()
        or 0
    )
    return {"unread": cnt}


# -------------------------------------------------------------------
# PATCH /notifs/{id}/read
# علامت‌گذاری یک اعلان به‌عنوان «خوانده‌شده» (سراسری).
# کاربر فقط می‌تواند اعلان «قابل‌مشاهده» را بخواند (عمومی/شخصی/ادمین).
# در موفقیت 204 بدون بدنه برمی‌گردد.
# -------------------------------------------------------------------
@router.patch("/{notif_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read_single(
    notif_id: int,
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    notif = db.query(model.Notification).filter(model.Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="اعلان یافت نشد.")

    # اجازه فقط اگر اعلان برای کاربر قابل‌مشاهده باشد (یا کاربر ادمین باشد)
    if not (
        notif.user_id is None
        or notif.user_id == user.id
        or _is_admin(user)
    ):
        # از دید کاربر، چنین اعلانى وجود ندارد
        raise HTTPException(status_code=404, detail="اعلان یافت نشد.")

    if not notif.is_read:
        notif.is_read = True
        db.commit()
    return Response(status_code=204)


# -------------------------------------------------------------------
# PATCH /notifs/read-all
# همه‌ی اعلان‌های «قابل‌مشاهده» کاربر را خوانده می‌کند (به‌صورت سراسری).
# خروجی: {"updated": <int>} تعداد رکوردهای به‌روزشده
# -------------------------------------------------------------------
@router.patch("/read-all")
def mark_read_all(
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    updated = (
        db.query(model.Notification)
        .filter(
            or_(
                model.Notification.user_id == user.id,
                model.Notification.user_id.is_(None),
            ),
            or_(
                model.Notification.is_read.is_(False),
                model.Notification.is_read.is_(None),
            ),
        )
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}


# -------------------------------------------------------------------
# POST /notifs
# ساخت اعلان جدید (فقط ادمین). در صورت نبود user_id اعلان «عمومی» است.
# response_model: schemas.NotificationOut
# -------------------------------------------------------------------
class NotifCreate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    link: Optional[str] = None
    type: Optional[str] = "content"   # content|moderation|role|message|...
    user_id: Optional[int] = None     # None => عمومی

@router.post("", response_model=schemas.NotificationOut, status_code=status.HTTP_201_CREATED)
def create_notification(
    payload: NotifCreate,
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="فقط ادمین مجاز است.")

    # is_read را صراحتاً False می‌گذاریم تا مقدار NULL ذخیره نشود (سازگاری بهتر)
    notif = model.Notification(
        user_id=payload.user_id,
        type=payload.type or "content",
        title=(payload.title or "").strip(),
        body=(payload.body or "").strip() or None,
        link=(payload.link or "").strip() or None,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


# -------------------------------------------------------------------
# DELETE /notifs/{id}
# حذف اعلان: ادمین می‌تواند هر اعلانى را حذف کند؛ کاربر عادی فقط اعلان «شخصی خودش» را.
# در موفقیت 204 بدون بدنه برمی‌گردد.
# -------------------------------------------------------------------
@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notif_id: int,
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    notif = db.query(model.Notification).filter(model.Notification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="اعلان یافت نشد.")

    # مجوز حذف: ادمین => همه؛ کاربر عادی => فقط اعلان‌های user_id == خودش
    if not _is_admin(user) and notif.user_id != user.id:
        raise HTTPException(status_code=403, detail="اجازه‌ی حذف ندارید.")

    db.delete(notif)
    db.commit()
    return Response(status_code=204)


# -------------------------------------------------------------------
# POST /notifs/_normalize-null-is_read   (اختیاری/ابزار ادمین)
# نرمال‌سازی رکوردهای قدیمی که فیلد is_read در آن‌ها NULL است، به False.
# برای یک‌بار مهاجرت/پاک‌سازی داده‌ها؛ در محیط عملیاتی استفاده نکنید مگر با آگاهی.
# -------------------------------------------------------------------
@router.post("/_normalize-null-is_read", status_code=204)
def normalize_null_is_read(
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    if not _is_admin(user):
        raise HTTPException(403, "فقط ادمین")
    db.query(model.Notification).filter(model.Notification.is_read.is_(None))\
      .update({"is_read": False}, synchronize_session=False)
    db.commit()
    return Response(status_code=204)
