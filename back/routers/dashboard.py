# routers/dashboard.py
# -----------------------------------------------------------------------------
# روتر داشبورد کاربر
# - خروجی این روتر خلاصه‌ای از وضعیت کاربر و چند مورد اخیرِ قابل‌نمایش را
#   برمی‌گرداند (مثل اعلان‌ها).
# - تمام اندپوینت‌ها خصوصی‌اند و بر اساس کاربر احرازشده پاسخ می‌دهند.
# - مدل خروجی با schemas.DashboardOut تایپ‌شده است.
# -----------------------------------------------------------------------------

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

import model, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def _profile_completion(u: model.UserTable) -> int:
    """
    امتیاز تکمیل پروفایل (0..100)
    - بر اساس پر بودن فیلدهای کلیدی محاسبه می‌شود.
    - اگر فیلدی را در مدل ندارید (مثلاً email_verified)، آن خط را حذف/کامنت کنید.
    """
    score = 0

    # اگر یکی از username یا email وجود داشته باشد، 25 امتیاز
    if getattr(u, "username", None) or getattr(u, "email", None):
        score += 25

    # نام نمایشی → 25 امتیاز
    if getattr(u, "display_name", None):
        score += 25

    # آواتار → 25 امتیاز
    if getattr(u, "avatar_url", None):
        score += 25

    # تایید ایمیل → 25 امتیاز
    # توجه: در بعضی نسخه‌های مدل ممکن است email_verified وجود نداشته باشد.
    if getattr(u, "email_verified", False):
        score += 25

    # تضمین محدوده‌ی 0..100
    return max(0, min(score, 100))

def _build_dashboard(db: Session, u: model.UserTable) -> schemas.DashboardOut:
    """
    داده‌های داشبورد را از روی دیتابیس می‌سازد.
    - شمارش اعلان‌های نخوانده (unread_cnt)
    - استخراج چند اعلان آخر برای نمایش در «recent»
    - محاسبه‌ی درصد تکمیل پروفایل
    """
    N = model.Notification

    # تعداد اعلان‌های نخوانده برای کاربر:
    # - شامل اعلان‌های «شخصی» (user_id == u.id) و «عمومی» (user_id IS NULL)
    # - is_read ممکن است در رکوردهای قدیمی NULL باشد؛ بنابراین False یا NULL هر دو «نخوانده» فرض می‌شوند.
    unread_cnt = (
        db.query(func.count(N.id))
        .filter(
            or_(N.user_id == u.id, N.user_id.is_(None)),
            or_(N.is_read.is_(False), N.is_read.is_(None)),
        )
        .scalar()
        or 0  # اگر None شد، 0 برگردان
    )

    # ۵ اعلان آخر برای نمایش در داشبورد
    recent_notifs = (
        db.query(N)
        .filter(or_(N.user_id == u.id, N.user_id.is_(None)))
        .order_by(N.created_at.desc())
        .limit(5)
        .all()
    )

    # نگاشت اعلان‌ها به آیتم‌های قابل‌نمایش در داشبورد
    # - title: عنوان اعلان (fallback: «اعلان جدید»)
    # - link: اگر لینک نداریم، /profile را بگذار
    # - createdAt: به ISO تبدیل می‌شود تا سمت کلاینت قابل‌نمایش باشد
    recent_items = [
        schemas.DashboardItem(
            title=n.title or "اعلان جدید",
            link=(n.link or "/profile"),
            createdAt=(n.created_at or datetime.utcnow()).isoformat(),
        )
        for n in recent_notifs
    ]

    # ساخت بخش شمارنده‌ها
    counts = schemas.DashboardCounts(
        notifications=unread_cnt,
        profile_completion=_profile_completion(u),
    )

    # مدل نهایی خروجی
    return schemas.DashboardOut(counts=counts, recent=recent_items)

# -----------------------------------------------------------------------------
# GET /dashboard  و  GET /dashboard/
# هر دو مسیر برای سازگاری فعال‌اند؛ خروجی یکسان است.
# نیازمند احراز هویت (Bearer token)
# -----------------------------------------------------------------------------
@router.get("", response_model=schemas.DashboardOut)
@router.get("/", response_model=schemas.DashboardOut)
def get_dashboard_root(
    db: Session = Depends(get_db),
    current_user: model.UserTable = Depends(get_current_user),
):
    """داشبورد کاربر احرازشده (مسیر ریشه‌ی داشبورد)."""
    return _build_dashboard(db, current_user)

# -----------------------------------------------------------------------------
# GET /dashboard/me
# مسیر معادل (درصورت تمایل به جداسازی معنایی)
# -----------------------------------------------------------------------------
@router.get("/me", response_model=schemas.DashboardOut)
def get_dashboard_me(
    db: Session = Depends(get_db),
    current_user: model.UserTable = Depends(get_current_user),
):
    """داشبورد کاربر احرازشده (مسیر /me)."""
    return _build_dashboard(db, current_user)
