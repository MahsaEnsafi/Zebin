# back/routers/predict.py
# روتر «Predict»: دریافت تصویر، پیش‌پردازش، ارسال به TensorFlow Serving،
# دریافت نتیجه و (در صورت تقاضا + ورود کاربر) ذخیره‌سازی فایل و متادیتا.
# نکات:
#  - آدرس سرویس مدل و نام مدل از ENV هم قابل تنظیم است.
#  - هر دو مسیر /predict و /predict/ پشتیبانی می‌شود.
#  - لاگ و متن خطای TF-Serving در پاسخ 502 برگردانده می‌شود تا عیب‌یابی آسان شود.
#  - اندازه ورودی پیش‌فرض 224x224 (VGG16) است؛ در صورت تفاوت، IMG_SIZE را تغییر دهید.

from typing import Optional, Tuple
import os
import uuid
import inspect
import logging
from io import BytesIO
from pathlib import Path

import numpy as np
import requests
from PIL import Image
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Security,
    UploadFile,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from tensorflow.keras.applications.vgg16 import preprocess_input

from auth import get_current_user
from database import get_db
from model import UserPhotoTable

# ---------------------- تنظیمات و ثوابت ----------------------

router = APIRouter(prefix="/predict", tags=["Predict"])

# قابل تنظیم از ENV (برای توسعه/دیپلوی)
TF_SERVING_URL = os.getenv("TF_SERVING_URL", "http://127.0.0.1:8501")
MODEL_NAME = os.getenv("MODEL_NAME", "Zebin_VGG16")
PREDICT_URL = f"{TF_SERVING_URL}/v1/models/{MODEL_NAME}:predict"

# برچسب‌های کلاس خروجی (ترتیب باید با آموزش یکسان باشد)
CLASS_NAMES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]

# اندازه ورودی مدل (VGG16 استاندارد: 224x224)
IMG_SIZE: Tuple[int, int] = (256, 256)

# مسیر ذخیره‌سازی فایل‌های آپلودشده (سرو می‌شود از طریق /uploads در main.py)
BASE_DIR = Path(__file__).resolve().parents[1]  # پوشه back/
UPLOADS_DIR = BASE_DIR / "uploads"

# امنیت (Bearer اختیاری)
_bearer = HTTPBearer(auto_error=False)

# لاگر
logger = logging.getLogger(__name__)


# ---------------------- کمک‌تابع‌ها ----------------------

async def get_current_user_optional(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
    db: Session = Depends(get_db),
):
    """
    احراز هویت اختیاری:
      - بدون Authorization => None
      - با Authorization => تلاش برای صدا زدن get_current_user با امضاهای رایج
    """
    if not creds:
        return None
    token = creds.credentials
    try:
        obj = get_current_user(token=token, db=db)
        if inspect.iscoroutine(obj):
            obj = await obj
        return obj
    except TypeError:
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
    تبدیل بایت‌های تصویر به آرایه NumPy با اندازه ثابت و سه‌کاناله RGB
    سپس اعمال preprocess_input مخصوص VGG16.
    خروجی: float32 با شکل (H, W, 3)
    """
    try:
        image = Image.open(BytesIO(data)).convert("RGB").resize(IMG_SIZE)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"فایل تصویر نامعتبر است: {e}")
    arr = np.asarray(image, dtype=np.float32)
    arr = preprocess_input(arr)  # مطابق VGG16
    return arr


def _save_user_file(user_id: int, filename: str, data: bytes) -> Tuple[str, int]:
    """
    ذخیره فایل خام در back/uploads/photos/<user_id>/<uuid>.<ext>
    خروجی: (public_url, size)
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


# ---------------------- اندپوینت‌ها ----------------------

@router.post("")
@router.post("/")
async def predict(
    file: UploadFile = File(...),      # تصویر (الزامی)
    save: bool = Form(False),          # ذخیره‌ی نتیجه و فایل در صورت ورود
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    # ۱) خواندن فایل
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="فایل خالی یا نامعتبر است.")

    # ۲) پیش‌پردازش و تماس با سرویس مدل
    try:
        image = _read_image(raw)  # (H,W,3) float32
        payload = {"instances": [image.tolist()]}  # شکل [1,H,W,3]

        # تایم‌اوت بالا (inference نخستین بار کمی طولانی‌تر است)
        resp = requests.post(PREDICT_URL, json=payload, timeout=120)

        if not resp.ok:
            # متن خطای TF-Serving را هم لاگ و هم به کلاینت می‌دهیم برای عیب‌یابی
            logger.warning("TF-Serving error %s: %s", resp.status_code, resp.text[:500])
            raise HTTPException(
                status_code=502,
                detail=f"Model server error {resp.status_code}: {resp.text}"
            )

        data = resp.json()
        arr = data.get("predictions") or data.get("outputs")
        if arr is None:
            raise HTTPException(status_code=502, detail=f"Unexpected TF Serving response: {data}")
        prediction = np.array(arr[0], dtype=np.float32)

    except HTTPException:
        raise
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="Timeout هنگام فراخوانی سرویس مدل.")
    except Exception as e:
        logger.exception("predict failed")
        raise HTTPException(status_code=500, detail=f"خطا در پردازش تصویر/مدل: {e}")

    # ۳) استخراج کلاس و اعتماد
    idx = int(np.argmax(prediction))
    predicted_cls = CLASS_NAMES[idx] if 0 <= idx < len(CLASS_NAMES) else str(idx)
    confidence = float(np.max(prediction))

    result = {
        "class": predicted_cls,
        "confidence": confidence,
        "photo_id": None,
        "url": None,
        "saved": False,
    }

    # ۴) ذخیره‌ی اختیاری (نیازمند ورود)
    if save:
        if current_user is None:
            raise HTTPException(status_code=401, detail="برای ذخیره باید وارد شوید.")
        public_url, size = _save_user_file(current_user.id, file.filename or "image.jpg", raw)
        row = UserPhotoTable(
            user_id=current_user.id,
            file_path=public_url.lstrip("/"),
            mime=file.content_type or "",
            size=size,
            original_name=file.filename or "",
            predicted_class=predicted_cls,
            confidence=confidence,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        result.update({"photo_id": row.id, "url": public_url, "saved": True})

    return result


@router.get("/_config")
def debug_config():
    """
    اندپوینت کمکی برای دیباگ تنظیمات (استفاده فقط در توسعه).
    """
    return {
        "tf_serving_url": TF_SERVING_URL,
        "model_name": MODEL_NAME,
        "predict_url": PREDICT_URL,
        "img_size": IMG_SIZE,
    }
