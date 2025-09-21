# back/auth.py
# ---------------------------------------------------------------------------
# ابزارهای احراز هویت مبتنی بر JWT و وابستگی‌های FastAPI
# ---------------------------------------------------------------------------

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import model
from database import get_db

# ---------- پیکربندی از .env ----------
from dotenv import load_dotenv
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(ENV_PATH)  # .env کنار پوشه‌ی back

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    # فقط برای توسعه: اگر .env نبود این مقدار استفاده می‌شود
    "JQMXt6YEKpG0EJGbhqM9l4q7C5w8Zhj2v5z_tuYl3OtyQTuWztxYDf1ZcfgfyIgEadGexPz3V5l8kzCBmMfqJg",
)
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ---------- bcrypt ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- OAuth2 ----------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

# ---------- توابع رمز ----------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# ---------- ساخت توکن ----------
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------- وابستگی‌ها ----------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> model.UserTable:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token نامعتبر",
        # headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise unauthorized
    except JWTError:
        raise unauthorized

    user = db.query(model.UserTable).filter(model.UserTable.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="کاربر پیدا نشد")
    return user

def get_admin_user(current_user: model.UserTable = Depends(get_current_user)) -> model.UserTable:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="دسترسی غیرمجاز")
    return current_user
