# back/schemas.py
# ----------------------------------------------------------------------
# این فایل «اسکیمای پایتانتیک (Pydantic)» را برای ورودی/خروجی API نگه می‌دارد.
# - از مدل‌های ORM (SQLAlchemy) فقط برای سریال‌سازی/دِسریال‌سازی استفاده می‌شود.
# - ConfigDict(from_attributes=True) باعث می‌شود اسکیمای پایتانتیک مستقیماً
#   از attribute های ORM (شیء) مقدار بگیرد، نه صرفاً از dict.
# - alias ها برای نگاشت snake_case (پایگاه‌داده/ORM) به camelCase (خروجی JSON) استفاده می‌شوند.
# - Literal برای محدود کردن مقادیر مجاز برخی فیلدها (مثل role) استفاده شده است.
# ----------------------------------------------------------------------

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, EmailStr, constr

# ---------------------- انواع مشترک/ثابت‌ها ----------------------
# نقش‌های مجاز کاربر
Role = Literal["user", "admin"]


# ============================== Users ==============================
class _UserBase(BaseModel):
    """
    مدل پایه‌ی کاربر برای خروجی‌ها.
    نکات:
    - from_attributes=True: مقادیر را مستقیم از شیء ORM می‌خواند (مثلاً user.display_name).
    - populate_by_name=True: اجازه می‌دهد با alias هم مقداردهی/خوانده شود
      (مثلاً displayName <-> display_name).
    """
    model_config = ConfigDict(
        from_attributes=True,    # خواندن مستقیم از ORM بدون dict شدن
        populate_by_name=True,   # استفاده از نام‌های alias هنگام ورودی/خروجی
    )

    username: str
    role: Role = "user"
    # نگاشت snake_case پایگاه‌داده به camelCase در JSON
    displayName: Optional[str] = Field(None, alias="display_name")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    avatarUrl: Optional[str] = Field(None, alias="avatar_url")


class UserOut(_UserBase):
    """خروجی کاربر در پاسخ‌های API (همان _UserBase)."""
    pass


class UserCreate(BaseModel):
    """
    ورودی ساخت کاربر جدید.
    نکته: برای سازگاری با فرانت، username همان ایمیل است.
    """
    username: EmailStr
    password: constr(min_length=6)
    role: Role = Field(default="user", description="نقش کاربر (پیش‌فرض user)")


class RoleUpdate(BaseModel):
    """ورودی تغییر نقش کاربر (ادمین)."""
    role: Role


# ============================== Auth ==============================
class Token(BaseModel):
    """خروجی استاندارد توکن ورود."""
    access_token: str
    token_type: str


class ChangePassword(BaseModel):
    """ورودی برای تغییر رمز عبور کاربر."""
    current_password: str
    new_password: str


# ============================ Dashboard ============================
class DashboardCounts(BaseModel):
    """بخش شمارنده‌ها در داشبورد."""
    model_config = ConfigDict(from_attributes=True)
    notifications: int = 0
    profile_completion: int = 10


class DashboardItem(BaseModel):
    """
    یک آیتم «فعالیت اخیر» یا مشابه.
    نکته: اگر بخواهید زمان را datetime نگه دارید، باید در روتر isoformat کنید/بردارید.
    """
    title: str
    link: Optional[str] = None
    createdAt: Optional[str] = None  # برای سادگی به صورت str


class DashboardOut(BaseModel):
    """خروجی کامل داشبورد."""
    counts: DashboardCounts
    recent: List[DashboardItem] = Field(default_factory=list)


# ============================== News ==============================
class NewsBase(BaseModel):
    """فیلدهای مشترک خبرها (ورودی/خروجی)."""
    title: str
    summary: str
    content: str
    category: Optional[str] = None
    image: Optional[str] = None
    source: Optional[str] = None


class NewsCreate(NewsBase):
    """ورودی ساخت خبر جدید (همان فیلدهای NewsBase)."""
    pass


class News(NewsBase):
    """
    خروجی یک خبر.
    from_attributes=True باعث می‌شود id و بقیه فیلدها از ORM خوانده شوند.
    """
    model_config = ConfigDict(from_attributes=True)
    id: int


# ============================ Articles ============================
class ArticleBase(BaseModel):
    """فیلدهای مشترک مقاله (ورودی/خروجی)."""
    title: str
    summary: Optional[str] = None
    content: str
    category: Optional[str] = None
    source: Optional[str] = None
    image: Optional[str] = None


class ArticleCreate(ArticleBase):
    """ورودی ساخت مقاله جدید (همان ArticleBase)."""
    pass


class ArticleUpdate(BaseModel):
    """
    ورودی ویرایش مقاله (همه اختیاری تا PATCH/PUT ساده شود).
    اگر در روتر از PATCH استفاده می‌کنید، None بودن یعنی «تغییر نده».
    """
    title: Optional[str] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    source: Optional[str] = None
    image: Optional[str] = None


class Article(BaseModel):
    """
    خروجی مقاله.
    نکته: اگر می‌خواهید فرمت خروجی را با فرانت هماهنگ‌تر کنید (مثلاً alias)،
    می‌توانید مثل کاربران alias تعریف کنید.
    """
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    summary: Optional[str] = None
    content: str
    category: Optional[str] = None
    source: Optional[str] = None
    image: Optional[str] = None


# ============================== Guide ==============================
# نوع‌های مجاز آیتم‌های راهنما
GuideKind = Literal["yes", "no", "prep", "note"]


class GuideCategoryOut(BaseModel):
    """
    خروجی یک «دسته» راهنما برای صفحه‌ی عمومی.
    نکته: این مدل «لیست ساده‌شده» از آیتم‌ها را به شکل آرایه‌ی رشته‌ها می‌دهد
    (examplesYes/No, prep, notes)؛ اگر در بک‌اند به‌صورت ItemTable نگه می‌دارید،
    در روتر باید این آرایه‌ها را از روی آ‌یتم‌ها بسازید.
    """
    slug: str
    name: str
    description: str
    color: str
    examplesYes: List[str]
    examplesNo: List[str]
    prep: List[str]
    notes: Optional[List[str]] = None


class GuideCategoryCreate(BaseModel):
    """ورودی ساخت دسته‌ی راهنما."""
    slug: Optional[str] = None
    name: str
    description: str
    color: str = "border-blue-300 bg-blue-50"


class GuideCategoryUpdate(BaseModel):
    """ورودی ویرایش دسته‌ی راهنما (فیلدها اختیاری)."""
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class GuideItemCreate(BaseModel):
    """ورودی ساخت آیتم جدید زیر یک دسته."""
    kind: GuideKind
    text: str


class GuideItemOut(BaseModel):
    """خروجی آیتم (برای فهرست‌کردن ساده)."""
    kind: GuideKind
    text: str


class GuideCategoryWithItems(BaseModel):
    """
    خروجی ترکیبی: دسته به همراه لیست آیتم‌ها (برای بخش ادمین/مدیریت).
    از ORM مستقیم پر می‌شود.
    """
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    description: str
    color: str
    items: List[GuideItemOut]


class GuideItemUpdate(BaseModel):
    """
    ورودی ویرایش آیتم.
    - kind/text اختیاری؛ اگر None بمانند تغییر نمی‌کنند.
    - categorySlug: انتقال آیتم به دسته‌ی دیگر.
    """
    kind: Optional[GuideKind] = None
    text: Optional[str] = None
    categorySlug: Optional[str] = None


# =========================== Notifications ===========================
# نوع‌های مجاز اعلان؛ رشته‌ی آزاد هم پشتیبانی می‌شود (| str)
NotifType = Literal["system", "content", "moderation", "role", "message"]


class NotificationOut(BaseModel):
    """
    خروجی اعلان.
    نکته:
    - created_at به‌صورت datetime برمی‌گردد و FastAPI آن را خودکار به ISO-8601 تبدیل می‌کند.
    - اگر در فرانت نیاز به فرمت خاص دارید، همان‌جا فرمت کنید (toLocaleString و …).
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    type: NotifType | str = "content"   # اگر نوع جدیدی اضافه شد، از str هم می‌پذیرد
    title: Optional[str] = None
    body: Optional[str] = None
    link: Optional[str] = None
    is_read: bool = False
    created_at: datetime
    meta: Optional[dict] = None


# ============================ Bookmarks ============================
# نوع هدف‌های مجاز نشانک
BookmarkType = Literal["news", "articles", "guide"]


class BookmarkCreate(BaseModel):
    """
    ورودی ایجاد نشانک.
    نکته: target_id به‌صورت string است تا هم id عددی و هم slug متنی را پوشش دهد.
    """
    target_type: BookmarkType
    target_id: str  # ← پشتیبانی از slug


class BookmarkOut(BaseModel):
    """خروجی آیتم نشانک (برای فهرست‌کردن ساده)."""
    model_config = ConfigDict(from_attributes=True)
    target_type: BookmarkType
    target_id: str
    created_at: datetime


# ================== Photos (Prediction Library) ==================
class PhotoOut(BaseModel):
    """
    خروجی لیست «عکس‌های من».
    نکته مهم:
    - اینجا فیلد زمان را created_at گذاشته‌ایم. اگر در جدول ORM شما «uploaded_at» است
      در روتر یکی از این دو کار را بکنید:
        1) کلید خروجی را به created_at تغییر نام دهید؛ یا
        2) این اسکیمای پایتانتیک را به uploaded_at تغییر دهید/alias بگذارید.
    - فیلد url باید در روتر ساخته شود (مثلاً بر اساس file_path + BASE_URL).
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    url: str
    predicted_class: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime  # ← اگر ORM شما uploaded_at دارد، در روتر map کنید یا این فیلد را عوض کنید.


class PredictOut(BaseModel):
    """
    پاسخ /predict/ هنگام ذخیرهٔ اختیاری.
    نکته:
    - چون کلمه‌ی 'class' کلمه‌ای رزرو/حساس است، در پایتانتیک با alias تعریف می‌شود:
      class_ در پایتانتیک  <->  "class" در JSON.
    - اگر می‌خواهید کلید JSON حتماً 'class' باشد، هنگام return از FastAPI
      `model_dump(by_alias=True)` استفاده کنید.
    """
    model_config = ConfigDict(populate_by_name=True)

    class_: str = Field(..., alias="class")   # خروجی JSON: "class"
    confidence: float
    photo_id: Optional[int] = None
    url: Optional[str] = None
    saved: bool = False
