# back/routers/predict.py
# روتر «Predict» برای دریافت تصویر، ارسال آن به سرور مدل (TensorFlow Serving)،
# دریافت پیش‌بینی و (در صورت درخواست و ورود کاربر) ذخیره‌کردن نتیجه و فایل در دیسک/دیتابیس.
# نکات کلیدی:
#  - احراز هویت اختیاری است: پیش‌بینی همگانی است ولی ذخیره‌کردن عکس نیاز به ورود دارد.
#  - مسیر ذخیره‌سازی فایل‌ها با main.py هماهنگ است و از /uploads سرو می‌شود.
#  - پیش‌پردازش تصویر مطابق VGG16 (preprocess_input) انجام می‌شود.
#  - درخواست به سرور مدل با requests (بلوکینگ) انجام می‌شود؛ برای CPU-bound نبودن بهتر است
#    در آینده از async + httpx استفاده شود یا کار به صف پس‌زمینه سپرده شود.

from typing import Optional
import inspect
from fastapi import APIRouter, HTTPException, File, UploadFile, Depends, Form, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from pathlib import Path
from PIL import Image
import numpy as np
from io import BytesIO
import requests
import uuid
from tensorflow.keras.applications.vgg16 import preprocess_input

from auth import get_current_user
from database import get_db
from model import UserPhotoTable

router = APIRouter(prefix="/predict", tags=["Predict"])

# آدرس TensorFlow Serving (نام مدل و نسخه را بر اساس استقرار خودتان تنظیم کنید)
ENDPOINT = "http://localhost:8501/v1/models/Zebin_VGG16:predict"

# برچسب‌های کلاس خروجی مدل (ترتیب باید با آموزش/سرویس یکسان باشد)
CLASS_NAMES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]

# اندازه‌ی ورودی مورد انتظار مدل (VGG16 معمولاً 224×224 است؛ اینجا 256×256 در نظر گرفته شده)
IMG_SIZE = (256, 256)

# ⬇️ محاسبه‌ی مسیر پوشه‌ی uploads مشابه back/main.py
BASE_DIR = Path(__file__).resolve().parents[1]   # پوشه‌ی back/
UPLOADS_DIR = BASE_DIR / "uploads"

# شِمای Bearer برای واکشی توکن به‌صورت «اختیاری»
_bearer = HTTPBearer(auto_error=False)

async def get_current_user_optional(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: Session = Depends(get_db),
):
    """
    احراز هویت اختیاری:
      - اگر Authorization نداشتیم => None برگردان (کاربر ناشناس).
      - اگر داشتیم، تلاش می‌کنیم get_current_user را با امضای سازگار صدا بزنیم.
    این انعطاف به خاطر تفاوت‌های احتمالی در امضای تابع get_current_user در پروژه‌های مختلف است.
    """
    if not creds:
        return None
    token = creds.credentials
    try:
        # حالت معمول: get_current_user(token=..., db=...)
        obj = get_current_user(token=token, db=db)
        if inspect.iscoroutine(obj):
            obj = await obj
        return obj
    except TypeError:
        # سازگاری: برخی پیاده‌سازی‌ها request می‌گیرند
        try:
            obj = get_current_user(request=request, db=db)
            if inspect.iscoroutine(obj):
                obj = await obj
            return obj
        except Exception:
            return None
    except Exception:
        return None

def _read_image(data: bytes) -> np.ndarray:
    """
    خواندن بایت‌های تصویر و تبدیل به آرایه‌ی NumPy با اندازه‌ی ثابت IMG_SIZE و سه‌کاناله (RGB).
    سپس preprocess_input مخصوص VGG16 اعمال می‌شود (کاستن میانگین کانال‌ها و غیره).
    خروجی: آرایه‌ی float32 با شکل (H, W, 3) و مقادیر پیش‌پردازش‌شده.
    """
    image = Image.open(BytesIO(data)).convert("RGB").resize(IMG_SIZE)
    arr = np.asarray(image, dtype=np.float32)
    return preprocess_input(arr)

def _save_user_file(user_id: int, filename: str, data: bytes) -> tuple[str, int]:
    """
    ذخیره‌ی فایل خام در مسیر back/uploads/photos/<user_id>/<uuid>.<ext>
    - ext از نام فایل ورودی گرفته می‌شود (در نبود، jpg)
    - خروجی: (public_url, size) که public_url با mount /uploads در main.py قابل سرو است.
    """
    dest_dir = UPLOADS_DIR / "photos" / str(user_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(filename or "").suffix or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    dest_path = dest_dir / name
    dest_path.write_bytes(data)

    size = dest_path.stat().st_size
    public_url = f"/uploads/photos/{user_id}/{name}"
    return public_url, size

@router.post("/")
async def predict(
    file: UploadFile = File(...),      # فایل تصویر (الزامی)
    save: bool = Form(False),          # اگر True و کاربر لاگین باشد، عکس و متادیتا ذخیره می‌شود
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_optional),  # کاربر اختیاری
):
    # ۱) خواندن فایل
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="فایل نامعتبر است.")

    # (اختیاری) می‌توانید نوع MIME را هم بررسی کنید: image/*

    # ۲) پیش‌پردازش و فراخوانی سرور مدل
    try:
        image = _read_image(raw)                   # (H, W, 3) float32
        payload = {"instances": [image.tolist()]}  # TensorFlow Serving: JSON, لیستِ لیست‌ها
        resp = requests.post(ENDPOINT, json=payload, timeout=30)
        if not resp.ok:
            # 502 برای خطای سرویس مدل مناسب‌تر از 500 برنامه‌ی اصلی است
            raise HTTPException(status_code=502, detail=f"Model server error: {resp.status_code}")
        prediction = np.array(resp.json()["predictions"][0])  # آرایه‌ی logits/probs
    except HTTPException:
        # خطاهایی که خودمان ساخته‌ایم را دوباره پرتاب می‌کنیم
        raise
    except Exception as e:
        # هر خطای دیگر در پردازش/درخواست مدل
        raise HTTPException(status_code=500, detail=f"خطا در پردازش تصویر/مدل: {e}")

    # ۳) استخراج کلاس و اطمینان
    predicted_cls = CLASS_NAMES[int(np.argmax(prediction))]
    confidence = float(np.max(prediction))

    # پاسخ پایه (در صورت عدم ذخیره)
    result = {"class": predicted_cls, "confidence": confidence, "photo_id": None, "url": None, "saved": False}

    # ۴) ذخیره‌ی اختیاری (نیازمند ورود)
    if save:
        if current_user is None:
            # اگر کاربر ناشناس است ولی save خواسته، 401، تا فرانت بفهمد باید لاگین کند
            raise HTTPException(status_code=401, detail="برای ذخیره باید وارد شوید.")
        # نوشتن فایل روی دیسک و ساخت URL عمومی
        public_url, size = _save_user_file(current_user.id, file.filename or "image.jpg", raw)
        # ثبت رکورد در دیتابیس (کتابخانه‌ی عکس‌های کاربر)
        row = UserPhotoTable(
            user_id=current_user.id,
            file_path=public_url.lstrip("/"),  # در DB نسبی نگه می‌داریم (uploads/...)
            mime=file.content_type or "",
            size=size,
            original_name=file.filename or "",
            predicted_class=predicted_cls,
            confidence=confidence,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        # افزودن مشخصات ذخیره به پاسخ
        result.update({"photo_id": row.id, "url": public_url, "saved": True})

    return result

# نکات بهبود در آینده (Optional):
# - استفاده از httpx.AsyncClient برای غیرهمزمان‌سازی درخواست مدل.
# - اعتبارسنجی نوع/اندازه‌ی فایل (مثلاً محدودیتِ <5MB و mime image/*).
# - ثبت لاگ‌های خطا و متریک‌ها (مدت inference، نرخ خطا).
# - قرار دادن ENDPOINT و IMG_SIZE در تنظیمات محیطی (env).
