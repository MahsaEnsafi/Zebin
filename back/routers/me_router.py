# back/routers/me_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path

from database import get_db
from auth import get_current_user
from model import UserPhotoTable

# روترِ ناحیهٔ کاربری (endpoints مربوط به خود کاربر لاگین‌کرده)
router = APIRouter(prefix="/me", tags=["Me"])

# ریشهٔ پروژهٔ back و پوشهٔ uploads (همان‌جایی که فایل‌ها ذخیره/سرو می‌شوند)
BASE_DIR = Path(__file__).resolve().parents[1]      # back/
UPLOADS_DIR = BASE_DIR / "uploads"

def _to_public_url(path_str: str) -> str:
    """
    ورودی: مسیر ذخیره‌شده در دیتابیس (ممکن است absolute/relative یا با backslash ویندوز باشد)
    خروجی: یک URL عمومی که با /uploads شروع می‌شود تا توسط StaticFiles سرو شود.
    - تمام backslash ها به slash تبدیل می‌شوند.
    - اگر مسیر از قبل با /uploads شروع شده باشد همان را برمی‌گرداند.
    - اگر 'uploads/...' باشد، یک '/' ابتدای آن اضافه می‌شود.
    - در غیر این صورت، با یک '/' شروع شده و مسیر را relative به ریشهٔ اپ برمی‌گرداند.
    """
    if not path_str:
        return ""
    p = str(path_str).replace("\\", "/")
    if p.startswith("/uploads/"):
        return p
    if p.startswith("uploads/"):
        return "/" + p
    # حالت‌های دیگر (مسیر نسبی دیگر) را هم به شکل '/something' برمی‌گردانیم
    return "/" + p.lstrip("/")

def _physical_path_from_db(path_str: str) -> Path:
    """
    مسیر فیزیکیِ فایل روی دیسک را از مقدار ذخیره‌شده در DB برمی‌سازد.
    - ورودی می‌تواند '/uploads/...' یا 'uploads/...' یا مسیر نسبی/مطلق باشد.
    - در صورت نسبی بودن، به BASE_DIR متصل می‌شود.
    توجه: این تابع صرفاً برای حذف فایل استفاده می‌شود؛
    اعتبارسنجی اضافه (مثلاً جلوگیری از path traversal) در صورت نیاز قابل افزودن است.
    """
    if not path_str:
        return UPLOADS_DIR
    p = str(path_str).replace("\\", "/")
    if p.startswith("/uploads/"):
        return BASE_DIR / p.lstrip("/")
    if p.startswith("uploads/"):
        return BASE_DIR / p
    abs_p = Path(p)
    return abs_p if abs_p.is_absolute() else (BASE_DIR / p)

@router.get("/photos")
def list_my_photos(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    لیست «عکس‌های من» برای کاربر فعلی.
    - با توجه به اسکیماهای متفاوت، ستون زمان را به‌ترتیب created_at / uploaded_at / id انتخاب می‌کنیم.
    - خروجی شامل id، URL قابل‌دسترسی (public)، کلاس پیش‌بینی، اطمینان و زمان آپلود است.
    """
    # تعیین ستونی که بر اساس آن مرتب‌سازی نزولی انجام شود
    order_col = getattr(UserPhotoTable, "created_at", None) \
            or getattr(UserPhotoTable, "uploaded_at", None) \
            or UserPhotoTable.id

    rows = (
        db.query(UserPhotoTable)
        .filter(UserPhotoTable.user_id == user.id)
        .order_by(order_col.desc())
        .all()
    )

    out = []
    for r in rows:
        # بعضی نسخه‌ها created_at ندارند و از uploaded_at استفاده می‌کنند
        ts = getattr(r, "created_at", None) or getattr(r, "uploaded_at", None)
        out.append({
            "id": r.id,
            # URL عمومی که با /uploads شروع می‌شود (StaticFiles روی /uploads mount شده است)
            "url": _to_public_url(str(r.file_path)),
            "predicted_class": r.predicted_class,
            "confidence": float(r.confidence or 0),
            # زمان را به ISO برمی‌گردانیم تا سمت کلاینت به‌راحتی پارس/نمایش دهد
            "uploaded_at": ts.isoformat() if ts else None,
        })
    return out

@router.delete("/photos/{photo_id}", status_code=204)
def delete_my_photo(photo_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """
    حذف یک عکس از کتابخانهٔ کاربر:
    - فقط عکس‌هایی که مالک‌شان کاربر فعلی است قابل حذف هستند.
    - در صورت وجود فایل فیزیکی روی دیسک، تلاش می‌کنیم آن را نیز پاک کنیم (خطاها نادیده گرفته می‌شوند).
    - در نهایت رکورد دیتابیس حذف می‌شود و 204 برگردانده می‌شود.
    """
    row = (
        db.query(UserPhotoTable)
        .filter(UserPhotoTable.id == photo_id, UserPhotoTable.user_id == user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="عکس پیدا نشد.")

    # حذف فایل از دیسک (اگر موجود بود) — خطاهای فایل‌سیستمی عمداً بلعیده می‌شود تا حذف DB انجام شود
    try:
        phys = _physical_path_from_db(str(row.file_path))
        if phys.exists():
            phys.unlink()
    except Exception:
        pass

    db.delete(row)
    db.commit()
    return
