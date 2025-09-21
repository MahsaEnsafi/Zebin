# routers/users.py
# -----------------------------------------------
# روتر «Users»:
#  - /users/check           : بررسی تکراری‌بودن ایمیل/نام‌کاربری
#  - /users/signup          : ثبت‌نام (بدون تأیید ایمیل؛ نقش پیش‌فرض user)
#  - /users/login           : ورود و دریافت توکن JWT
#  - /users/me              : دریافت پروفایل کاربرِ جاری
#  - /users/{id}/role       : تغییر نقش با شناسه (ادمین فقط)
#  - /users/by-email/{}/role: تغییر نقش با ایمیل (ادمین فقط)
#
# نکات مهم:
#  * خروجی‌ها با Pydantic schemas هم‌راستا شده‌اند (نام‌های camelCase مثل displayName).
#  * login از همان UserCreate استفاده می‌کند (username/password). اگر بخواهید می‌توانید
#    اسکیمای جدا تعریف کنید اما برای سادگی همین کافی است.
#  * ثبت‌نام ایمیل را هم در username و هم در email ذخیره می‌کند تا ورود با هر کدام کار کند.
#  * تغییر نقش نیازمند نقش ادمین است (get_current_user + بررسی role).
#  * مدت اعتبار توکن از ACCESS_TOKEN_EXPIRE_MINUTES خوانده می‌شود.
# -----------------------------------------------

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

import model, schemas
from database import get_db
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/users", tags=["Users"])


def _user_out(u: model.UserTable) -> schemas.UserOut:
    """
    مبدل ORM → اسکیمای خروجی (UserOut).
    این‌جا نگاشت فیلدهای snake_case مدل به کلیدهای camelCase خروجی انجام می‌شود.
    """
    return schemas.UserOut(
        username=u.username,
        role=u.role,
        displayName=u.display_name,
        email=u.email,
        avatarUrl=u.avatar_url,
    )


def _ensure_admin(current: model.UserTable):
    """گارد ساده: فقط ادمین اجازه‌ی عملیات مدیریتی دارد."""
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="فقط ادمین مجاز است")


# ---------- Check (optional) ----------
@router.get("/check")
def check_email(email: str = Query(..., min_length=3), db: Session = Depends(get_db)):
    """
    بررسی در دسترس بودن ایمیل/نام‌کاربری.
    - ورودی: ?email=user@example.com
    - خروجی: { "available": true|false }
    - معیار: اگر رکوردی با username==email یا email==email موجود باشد => available=false
    """
    q = (email or "").strip().lower()
    if "@" not in q:
        raise HTTPException(400, detail="ایمیل نامعتبر است")
    exists = (
        db.query(model.UserTable)
        .filter(or_(model.UserTable.username == q, model.UserTable.email == q))
        .first()
    )
    return {"available": not bool(exists)}


# ---------- Signup (بدون تأیید ایمیل) ----------
@router.post("/signup", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    ثبت‌نام کاربر جدید.
    - رمز با bcrypt هش می‌شود.
    - ایمیل هم در username و هم در email ذخیره می‌شود تا ورود با هر دو ممکن باشد.
    - تأیید ایمیل در این نسخه غیرفعال است (email_verified=True).
    """
    username = (payload.username or "").strip().lower()
    if not username or not payload.password:
        raise HTTPException(400, detail="ایمیل و کلمه عبور الزامی است")

    exists = (
        db.query(model.UserTable)
        .filter(or_(model.UserTable.username == username, model.UserTable.email == username))
        .first()
    )
    if exists:
        raise HTTPException(400, detail="این ایمیل/نام کاربری قبلاً ثبت شده است")

    # نقش پیش‌فرض user؛ در Swagger می‌توان admin را هم انتخاب کرد (با احتیاط!)
    role = payload.role or "user"

    user = model.UserTable(
        username=username,
        email=username,
        hashed_password=get_password_hash(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


# ---------- Login ----------
@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    ورود با username/email و password:
    - جستجو با or_(username==q, email==q)
    - اعتبارسنجی رمز با verify_password (bcrypt)
    - ساخت JWT با subject=username و انقضاء ACCESS_TOKEN_EXPIRE_MINUTES
    """
    q = (payload.username or "").strip().lower()
    user = (
        db.query(model.UserTable)
        .filter(or_(model.UserTable.username == q, model.UserTable.email == q))
        .first()
    )
    if not user or not verify_password(payload.password or "", user.hashed_password):
        raise HTTPException(status_code=401, detail="ایمیل/نام کاربری یا رمز نادرست است")

    expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(data={"sub": user.username}, expires_delta=expires)
    return schemas.Token(access_token=token, token_type="bearer")


# ---------- Me ----------
@router.get("/me", response_model=schemas.UserOut)
def read_me(current_user: model.UserTable = Depends(get_current_user)):
    """اطلاعات کاربر جاری بر اساس توکن Bearer."""
    return _user_out(current_user)


# =========================================================
#                 تغییر نقش (ادمین-فقط)
# =========================================================

# با "شناسه کاربر"
@router.patch("/{user_id}/role", response_model=schemas.UserOut)
def change_role_by_id(
    user_id: int,
    payload: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: model.UserTable = Depends(get_current_user),
):
    """
    تغییر نقش کاربر با id.
    - فقط ادمین مجاز است.
    - اگر نقش فعلی برابر نقش جدید باشد، بدون تغییر رکورد، همان خروجی برگردانده می‌شود.
    """
    _ensure_admin(current_user)

    user = db.query(model.UserTable).filter(model.UserTable.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="کاربر پیدا نشد")

    if user.role != payload.role:
        user.role = payload.role
        db.commit()
        db.refresh(user)

    return _user_out(user)


# با "ایمیل کاربر"
@router.patch("/by-email/{email}/role", response_model=schemas.UserOut)
def change_role_by_email(
    email: str,
    payload: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: model.UserTable = Depends(get_current_user),
):
    """
    تغییر نقش بر اساس ایمیل (username/email).
    - فقط ادمین مجاز است.
    - ایمیل ورودی trim/lower می‌شود؛ سپس جستجو روی فیلد email انجام می‌گیرد.
    """
    _ensure_admin(current_user)

    target = (email or "").strip().lower()
    user = db.query(model.UserTable).filter(model.UserTable.email == target).first()
    if not user:
        raise HTTPException(404, detail="کاربری با این ایمیل پیدا نشد")

    if user.role != payload.role:
        user.role = payload.role
        db.commit()
        db.refresh(user)

    return _user_out(user)
