# model.py
# =============================================================================
# مدل‌های دیتابیس با SQLAlchemy (Declarative)
# -----------------------------------------------------------------------------
# این فایل جداول اصلی سامانه را تعریف می‌کند:
#   - Users: اطلاعات کاربر و رابطه با تصاویر کاربر
#   - Articles / News: محتوای علمی و خبری
#   - Guide: دسته‌بندی راهنما + آیتم‌های آن (yes/no/prep/note)
#   - Notifications: اعلان‌ها (عمومی یا مخصوص کاربر)
#   - Bookmarks: نشانک‌های کاربر برای محتواهای مختلف
#   - UserPhoto: کتابخانه‌ی تصاویر پیش‌بینی‌شده‌ی کاربر
#
# نکات:
# - در محیط توسعه می‌توانید با Base.metadata.create_all جداول را بسازید؛
#   در محیط واقعی از Alembic برای مهاجرت استفاده کنید.
# - زمان‌ها به‌صورت UTC ذخیره می‌شوند (datetime.utcnow).
# - در صورت نیاز طول فیلدها/ایندکس‌ها را با توجه به پایگاه‌داده‌ی هدف تنظیم کنید.
# =============================================================================

from sqlalchemy import Column, Integer, Float, String, DateTime, Text, Boolean, ForeignKey, Enum, Index, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import expression  # برای server_default و مقادیر بولی/زمانی
import enum
from database import Base                # Declarative Base پروژه
from datetime import datetime            # زمان فعلی (UTC)

# =============================== Users =======================================
class UserTable(Base):
    """
    جدول کاربران
    ------------
    - username: شناسه‌ی ورود (ایمیل/نام کاربری) — یکتا و ایندکس‌شده
    - hashed_password: رمز هش‌شده (هرگز رمز خام را ذخیره نکنید)
    - role: نقش ('user' | 'admin')
    - display_name / email / avatar_url: اطلاعات نمایشی کاربر

    روابط:
    - photos: یک‌به‌چند با UserPhotoTable (با حذف کاربر، تصاویرش هم حذف می‌شوند)
    """
    __tablename__ = "user"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, index=True, nullable=False)  # یکتا + ایندکس
    hashed_password = Column(String)                                        # طول کافی برای الگوریتم هش
    role = Column(String(20), default="user")                               # 'user' | 'admin'
    display_name = Column(String(100), nullable=True)
    email = Column(String(120), nullable=True)
    avatar_url = Column(String(255), nullable=True)

    # رابطه معکوس با جدول تصاویر کاربر
    photos = relationship(
        "UserPhotoTable",
        back_populates="user",
        cascade="all, delete-orphan",  # حذف کاربر -> حذف همه‌ی عکس‌ها
        lazy="selectin",               # بارگذاری کارآمد مجموعه‌ها
    )

# ============================== Articles =====================================
class ArticleTable(Base):
    """
    جدول مقالات علمی
    -----------------
    - title (ضروری)
    - summary (اختیاری)
    - content (متن کامل، ضروری)
    - category / source / image (اختیاری)
    """
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    summary = Column(String(500))
    content = Column(Text, nullable=False)
    category = Column(String(100))
    source = Column(String(300))
    image = Column(String(500))

# ================================ News =======================================
class NewsTable(Base):
    """
    جدول اخبار
    ----------
    - title, summary, content: فیلدهای اصلی خبر
    - category / image / source: فیلدهای اختیاری
    """
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=True)
    image = Column(String(255), nullable=True)
    source = Column(String(255), nullable=True)

# ================================= Guide =====================================
class GuideItemKind(str, enum.Enum):
    """نوع آیتم در راهنما: قابل/غیرقابل/آماده‌سازی/نکته"""
    yes = "yes"    # قابل بازیافت
    no = "no"      # غیر قابل بازیافت
    prep = "prep"  # نکات آماده‌سازی
    note = "note"  # نکات تکمیلی

class GuideCategoryTable(Base):
    """
    دسته‌بندی‌های راهنما (Guide)
    ----------------------------
    - slug: اسلاگ منحصربه‌فرد برای ارجاع/URL (unique + index)
    - name: نام دسته
    - description: توضیح کوتاه
    - color: کلاس ظاهر (Tailwind) برای کارت‌ها در فرانت (اختیاری)

    روابط:
    - items: آیتم‌های زیرمجموعه‌ی این دسته
    """
    __tablename__ = "guide_categories"

    id = Column(Integer, primary_key=True)
    slug = Column(String(64), unique=True, index=True, nullable=False)   # یکتا + ایندکس
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=False)
    color = Column(String(64), nullable=False, default="border-blue-300 bg-blue-50")

    items = relationship(
        "GuideItemTable",
        back_populates="category",
        cascade="all, delete-orphan",  # حذف دسته -> حذف آیتم‌ها
        lazy="selectin",
    )

class GuideItemTable(Base):
    """
    آیتم‌های هر دسته از راهنمای تفکیک
    ---------------------------------
    - category_id: ارجاع به دسته (Cascade on delete)
    - kind: نوع آیتم (Enum)
    - text: متن آیتم
    """
    __tablename__ = "guide_item"

    id = Column(Integer, primary_key=True)
    category_id = Column(
        Integer,
        ForeignKey("guide_categories.id", ondelete="CASCADE"),
        index=True
    )
    kind = Column(Enum(GuideItemKind), nullable=False)
    text = Column(Text, nullable=False)

    category = relationship("GuideCategoryTable", back_populates="items")

# ایندکس مرکب برای کوئری‌های پرتکرار: «آیتم‌های دسته X با نوع Y»
Index("ix_guide_items_cat_kind", GuideItemTable.category_id, GuideItemTable.kind)

# ============================ Notifications ==================================
class Notification(Base):
    """
    اعلان‌ها
    --------
    - user_id: اگر مقداردهی شود، اعلان برای همان کاربر است؛ در غیر این صورت عمومی/سیستمی تلقی می‌شود.
    - type: نوع اعلان (content|moderation|role|message|...)
    - title, body, link: عنوان/متن/لینک اختیاری
    - is_read: وضعیت خوانده‌شدن (پیش‌فرض False)
    - created_at: زمان ایجاد (UTC)
    - meta: داده‌های جانبی به‌صورت JSON
    """
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True, index=True)
    type = Column(String(32), default="content")   # گروه‌بندی اعلان‌ها
    title = Column(String(200))
    body = Column(Text, nullable=True)
    link = Column(String(512), nullable=True)

    # server_default برای سازگاری با درج رکورد مستقیم در DB
    is_read = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    meta = Column(JSON, nullable=True)

# ============================== Bookmarks ====================================
class Bookmark(Base):
    """
    نشانک‌ها (Bookmarks)
    --------------------
    کلید مرکب (user_id, target_type, target_id):
      - user_id: کاربرِ مالک نشانک
      - target_type: نوع هدف ('news' | 'articles' | 'guide')
      - target_id: شناسه هدف (می‌تواند عدد یا اسلاگ/رشته باشد)

    - created_at: زمان ذخیره‌سازی نشانک
    """
    __tablename__ = "bookmark"

    user_id = Column(Integer, ForeignKey("user.id"), primary_key=True, index=True)
    target_type = Column(String(16), primary_key=True)    # نوع هدف
    target_id = Column(String(128), primary_key=True)     # پشتیبانی از slug
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

# ایندکس کمکی برای گزارش‌گیری سریع بر اساس (user_id, target_type)
Index("ix_bookmark_user_type", Bookmark.user_id, Bookmark.target_type)

# ============================ User Photos ====================================
class UserPhotoTable(Base):
    """
    کتابخانه‌ی تصاویر کاربر (نتیجه‌ی پیش‌بینی)
    -------------------------------------------
    - user_id: صاحب عکس (حذف کاربر -> حذف عکس‌ها)
    - file_path: مسیر نسبی فایل روی سرور (مثلاً 'uploads/xyz.jpg')
    - mime / size / original_name: متادیتای فایل
    - predicted_class / confidence: خروجی مدل طبقه‌بندی
    - uploaded_at: زمان آپلود (پیش‌فرض هم سمت اپ و هم سمت DB)

    نکته: فایل‌ها معمولاً از مسیر /uploads (FastAPI StaticFiles) سرو می‌شوند.
    """
    __tablename__ = "user_photo"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("user.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # اطلاعات فایل
    file_path = Column(String(300), nullable=False)  # مسیر نسبی (داخل /uploads)
    mime = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)
    original_name = Column(String(255), nullable=True)

    # نتیجه مدل
    predicted_class = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)

    # زمان آپلود — مقدار پیش‌فرض هم در اپ و هم در DB
    uploaded_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=expression.text("CURRENT_TIMESTAMP")
    )

    # رابطه معکوس با کاربر
    user = relationship("UserTable", back_populates="photos")

# ایندکس برای کوئری «عکس‌های کاربر، مرتب‌سازی بر اساس جدیدترین آپلود»
Index("ix_user_photo_user_uploaded", UserPhotoTable.user_id, UserPhotoTable.uploaded_at.desc())
