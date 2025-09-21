# back/database.py
# -------------------------------------------------------------------
# تنظیمات اتصال SQLAlchemy به پایگاه‌داده + ساخت Session و Base مشترک
# - به‌صورت پیش‌فرض از SQLite (فایل zebin.db در روت پروژه) استفاده می‌کند.
# - تابع get_db() برای تزریق وابستگی در FastAPI (Depends) ارائه می‌شود.
# -------------------------------------------------------------------

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base  # در SQLAlchemy 1.x
# نکته (SQLAlchemy 2.x): می‌توانید به‌جای خط بالا از این استفاده کنید:
# from sqlalchemy.orm import declarative_base

# -------------------------------------------------------------------
# ۱) رشتهٔ اتصال پایگاه‌داده
# -------------------------------------------------------------------
# قالب SQLite: "sqlite:///نسبی_به_پروژه" یا "sqlite:////مسیر/مطلق"
# اگر بعداً به Postgres/MariaDB مهاجرت کردید، این مقدار را عوض کنید؛ مثلا:
# postgresql+psycopg2://USER:PASS@HOST:PORT/DBNAME
SQLALCHEMY_DATABASE_URL = "sqlite:///./zebin.db"

# -------------------------------------------------------------------
# ۲) ساخت Engine
# -------------------------------------------------------------------
# connect_args={"check_same_thread": False} فقط برای SQLite لازم است
# (به FastAPI/ThreadPool اجازهٔ استفادهٔ همزمان از اتصال را می‌دهد)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {},
    # echo=True,  # ← برای دیباگ SQLها، موقتی روشن کنید
    future=True,  # سازگاری بهتر با سبک ۲.۰
)

# -------------------------------------------------------------------
# ۳) Session ساز (factory)
# -------------------------------------------------------------------
# - autoflush=False: تا وقتی commit/flush صریح نزنید، تغییرات به DB فلش نمی‌شوند.
# - autocommit=False: باید خودتان commit کنید (الگوی استاندارد تراکنش).
# - expire_on_commit=False (اختیاری): بعد از commit آبجکت‌ها را invalidate نکند.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,   # تایپ صریح سشن
    future=True,
)

# -------------------------------------------------------------------
# ۴) پایهٔ مدل‌ها (Base)
# -------------------------------------------------------------------
# همه‌ی کلاس‌های ORM شما باید از این Base ارث‌بری کنند:
# class User(Base): __tablename__=... ؛ ستون‌ها ...
Base = declarative_base()

# -------------------------------------------------------------------
# ۵) وابستگی FastAPI برای دریافت سشن
# -------------------------------------------------------------------
# این جنریتور در آغاز هر درخواست یک Session می‌دهد و در پایان آن را می‌بندد.
# در روترها به این شکل استفاده کنید:
#
#   from fastapi import Depends, APIRouter
#   from sqlalchemy.orm import Session
#   from .database import get_db
#
#   @router.get("/items")
#   def list_items(db: Session = Depends(get_db)):
#       return db.query(Item).all()
#
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        # در اختیار مسیر/سرویس قرار بده
        yield db
        # اگر الگوی «هر درخواست یک تراکنش» دارید، می‌توانید اینجا commit کنید.
        # اما معمولاً commit‌ها در سرویس/ریپوزیتوری انجام می‌شود.
    finally:
        # بستن اتصال (بازگرداندن به pool/آزادسازی)
        db.close()

# -------------------------------------------------------------------
# نکته‌های مهاجرت:
# - اگر به Postgres رفتید، check_same_thread را بردارید و driver درست نصب باشد:
#     pip install "psycopg[binary]"  یا  pip install psycopg2-binary
# - برای مدیریت اسکیما/مهاجرت‌ها از Alembic استفاده کنید.
# -------------------------------------------------------------------
