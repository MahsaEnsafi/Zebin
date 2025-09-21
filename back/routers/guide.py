# routers/guide.py
# -----------------------------------------------------------------------------
# روتر مربوط به «راهنمای تفکیک»:
# - مدیریت دسته‌بندی‌ها (GuideCategoryTable) و آیتم‌های هر دسته (GuideItemTable)
# - اندپوینت‌های عمومی برای خواندن کل راهنما / یک دسته / آیتم‌های یک دسته
# - اندپوینت‌های ادمین برای ایجاد/ویرایش/حذف دسته و آیتم
# - تمام پاسخ‌های عمومی به مدل‌های Pydantic در schemas مپ می‌شوند
# -----------------------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, selectinload
from typing import List
import model, schemas
from database import get_db
from auth import get_current_user
import re

router = APIRouter(prefix="/guide", tags=["Guide"])

# -----------------------------------------------------------------------------
# ابزارک‌ها
# -----------------------------------------------------------------------------
def slugify(s: str) -> str:
    """
    تولید اسلاگ از یک رشتهٔ فارسی/انگلیسی:
    - lowercase
    - حذف کاراکترهای غیر مجاز (فقط حروف/عدد/خط تیره/فاصله/حروف فارسی اجازه دارند)
    - تبدیل فاصله‌ها (و نیم‌فاصله‌ها) به '-'
    - ادغام چند خط‌تیرهٔ پیاپی و trim
    """
    s = (s or "").strip().lower()
    # اجازه به \w (حروف/عدد و _)، فاصله، خط تیره، و محدودهٔ یونیکد فارسی
    s = re.sub(r"[^\w\s\-\u0600-\u06FF]", "", s)
    # تبدیل فاصله و نیم‌فاصله به '-'
    s = re.sub(r"[\s\u200c]+", "-", s)
    # ادغام چند - متوالی و حذف - ابتدا/انتها
    return re.sub(r"-+", "-", s).strip("-")

def to_out(cat: model.GuideCategoryTable) -> schemas.GuideCategoryOut:
    """
    تبدیل شیٔ ORM دسته‌بندی به خروجی Pydantic گروه‌بندی‌شده:
    - آیتم‌ها بر اساس kind به 4 گروه yes/no/prep/note تقسیم می‌شوند.
    - notes اگر خالی باشد، به‌صورت None بازگردانده می‌شود تا در JSON حذف شود.
    """
    groups = {"yes": [], "no": [], "prep": [], "note": []}
    for it in cat.items:
        groups[it.kind.value].append(it.text)

    return schemas.GuideCategoryOut(
        slug=cat.slug,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        examplesYes=groups["yes"],
        examplesNo=groups["no"],
        prep=groups["prep"],
        notes=groups["note"] or None,  # خالی = None
    )

# -----------------------------------------------------------------------------
# READ (عمومی)
# -----------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.GuideCategoryOut])
def get_categories(db: Session = Depends(get_db)):
    """
    همهٔ دسته‌بندی‌های راهنما + آیتم‌هایشان (گروه‌بندی‌شده در خروجی).
    - از selectinload برای جلوگیری از N+1 query استفاده شده است.
    """
    cats = (
        db.query(model.GuideCategoryTable)
        .options(selectinload(model.GuideCategoryTable.items))
        .all()
    )
    return [to_out(c) for c in cats]

@router.get("/{slug}", response_model=schemas.GuideCategoryOut)
def get_one_category(slug: str, db: Session = Depends(get_db)):
    """
    یک دسته‌بندی با اسلاگ + آیتم‌هایش (به‌صورت گروه‌بندی‌شده در خروجی).
    - 404 اگر دسته موجود نباشد.
    """
    c = (
        db.query(model.GuideCategoryTable)
        .options(selectinload(model.GuideCategoryTable.items))
        .filter(model.GuideCategoryTable.slug == slug)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="دسته‌بندی پیدا نشد")
    return to_out(c)

@router.get("/{slug}/items")
def get_items_of_category(slug: str, db: Session = Depends(get_db)):
    """
    آیتم‌های خامِ یک دسته (برای پنل ادمین):
    - بر خلاف دو اندپوینت بالا، این یکی response_model مشخصی ندارد و
      id هر آیتم را هم برمی‌گرداند تا عملیات ویرایش/حذف سمت ادمین آسان شود.
    """
    c = db.query(model.GuideCategoryTable).filter_by(slug=slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="دسته‌بندی پیدا نشد")
    items = db.query(model.GuideItemTable).filter_by(category_id=c.id).all()
    return [{"id": i.id, "kind": i.kind.value, "text": i.text} for i in items]

# -----------------------------------------------------------------------------
# CREATE/UPDATE/DELETE دسته‌ها (ادمین)
# -----------------------------------------------------------------------------
@router.post("/", response_model=schemas.GuideCategoryOut, status_code=status.HTTP_201_CREATED)
def creat_category(
    payload: schemas.GuideCategoryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ایجاد یک دسته‌بندی جدید:
    - فقط ادمین
    - ساخت اسلاگ از name یا slug ورودی
    - جلوگیری از اسلاگ تکراری (409)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند دسته ایجاد کند")

    slug = slugify(payload.slug or payload.name)
    if not slug:
        raise HTTPException(status_code=422, detail="slug یا name معتبر نیست")

    if db.query(model.GuideCategoryTable).filter_by(slug=slug).first():
        raise HTTPException(status_code=409, detail="Slug تکراری است")

    c = model.GuideCategoryTable(
        slug=slug,
        name=payload.name,
        description=payload.description,
        color=payload.color,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    # بارگذاری مجدد با آیتم‌ها برای خروجی یکدست
    c = (
        db.query(model.GuideCategoryTable)
        .options(selectinload(model.GuideCategoryTable.items))
        .filter_by(id=c.id)
        .first()
    )
    return to_out(c)

@router.put("/{slug}", response_model=schemas.GuideCategoryOut)
def update_category(
    slug: str,
    payload: schemas.GuideCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ویرایش اطلاعات یک دسته:
    - فقط ادمین
    - 404 اگر دسته وجود نداشته باشد
    - فقط فیلدهای ست‌شده در payload اعمال می‌شوند
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند ویرایش کند")

    c = db.query(model.GuideCategoryTable).filter_by(slug=slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="دسته‌بندی پیدا نشد")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(c, k, v)

    db.commit()
    db.refresh(c)

    # بارگذاری مجدد با آیتم‌ها برای خروجی یکدست
    c = (
        db.query(model.GuideCategoryTable)
        .options(selectinload(model.GuideCategoryTable.items))
        .filter_by(id=c.id)
        .first()
    )
    return to_out(c)

@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    slug: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    حذف یک دسته به‌همراه تمام آیتم‌های وابسته‌اش (به‌لطف ondelete='CASCADE' در FK):
    - فقط ادمین
    - 404 اگر دسته وجود نداشته باشد
    - 204 بدون بدنه در صورت موفقیت
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند حذف کند")

    c = db.query(model.GuideCategoryTable).filter_by(slug=slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="دسته‌بندی پیدا نشد")

    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# -----------------------------------------------------------------------------
# CREATE/UPDATE/DELETE آیتم‌ها (ادمین)
# -----------------------------------------------------------------------------
@router.post("/{slug}/items", status_code=status.HTTP_201_CREATED)
def create_item(
    slug: str,
    item: schemas.GuideItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    افزودن آیتم جدید به یک دسته:
    - فقط ادمین
    - kind باید یکی از 'yes' | 'no' | 'prep' | 'note' باشد (Pydantic تضمین می‌کند)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند آیتم اضافه کند")

    c = db.query(model.GuideCategoryTable).filter_by(slug=slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="دسته‌بندی پیدا نشد")

    it = model.GuideItemTable(category_id=c.id, kind=item.kind, text=item.text.strip())
    db.add(it)
    db.commit()
    db.refresh(it)
    return {"ok": True, "id": it.id}

@router.put("/items/{item_id}")
def update_item(
    item_id: int,
    payload: schemas.GuideItemUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    ویرایش یک آیتم:
    - فقط ادمین
    - امکان تغییر kind / متن / جابجایی به دستهٔ دیگر (با categorySlug)
    - در نهایت شناسه و وضعیت جدید آیتم برمی‌گردد (برای به‌روزرسانی UI سمت کلاینت)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند ویرایش کند")

    it = db.query(model.GuideItemTable).filter_by(id=item_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="آیتم پیدا نشد")

    if payload.kind is not None:
        # تبدیل رشته به Enum مدل (در صورت لزوم)
        it.kind = model.GuideItemKind(payload.kind)
    if payload.text is not None:
        it.text = payload.text.strip()
    if payload.categorySlug:
        dest = db.query(model.GuideCategoryTable).filter_by(slug=payload.categorySlug).first()
        if not dest:
            raise HTTPException(status_code=404, detail="دستهٔ مقصد پیدا نشد")
        it.category_id = dest.id

    db.commit()
    db.refresh(it)
    return {"id": it.id, "kind": it.kind.value, "text": it.text, "category_id": it.category_id}

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    حذف یک آیتم:
    - فقط ادمین
    - 404 اگر آیتم موجود نباشد
    - 204 بدون بدنه در صورت موفقیت
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="فقط ادمین می‌تواند حذف کند")

    it = db.query(model.GuideItemTable).filter_by(id=item_id).first()
    if not it:
        raise HTTPException(status_code=404, detail="آیتم پیدا نشد")

    db.delete(it)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
