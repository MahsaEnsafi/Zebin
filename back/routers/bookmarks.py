# routers/bookmarks.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Literal
import model, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])

BookmarkType = Literal["news", "articles", "guide"]

def _enrich(db: Session, row: model.Bookmark):
    """برای نمایش بهتر در UI: عنوان و لینک بساز."""
    title, link = "", "#"
    if row.target_type == "news":
        n = db.query(model.NewsTable).filter(model.NewsTable.id == row.target_id).first()
        if n: title, link = n.title, f"/news/{row.target_id}"
    elif row.target_type == "articles":
        a = db.query(model.ArticleTable).filter(model.ArticleTable.id == row.target_id).first()
        if a: title, link = a.title, f"/articles/{row.target_id}"
    elif row.target_type == "guide":
        g = db.query(model.GuideCategoryTable).filter(model.GuideCategoryTable.slug == row.target_id).first()
        if g: title, link = g.name, f"/guide#{g.slug}"
    return {
        "target_type": row.target_type,
        "target_id": row.target_id,
        "created_at": row.created_at,
        "title": title or row.target_id,
        "link": link,
    }

# ✅ هر دو مسیر بدون/با اسلش را پوشش بده تا 405 نگیری
@router.get("", response_model=List[schemas.BookmarkOut])
@router.get("/", response_model=List[schemas.BookmarkOut])
def list_my_bookmarks(
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    q = (db.query(model.Bookmark)
           .filter(model.Bookmark.user_id == user.id)
           .order_by(model.Bookmark.created_at.desc()))
    rows = q.all()
    # اگر می‌خواهی فیلدهای افزوده را هم برگردانی، response_model را بردار یا مدل جدید بساز
    # در حال حاضر فقط فیلدهای پایه در مدل هستند:
    return rows

# نسخهٔ غنی‌شده (اگر می‌خواهی title/link بیاید)
@router.get("/_full")
def list_my_bookmarks_full(
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    rows = (db.query(model.Bookmark)
              .filter(model.Bookmark.user_id == user.id)
              .order_by(model.Bookmark.created_at.desc())
              .all())
    return [_enrich(db, r) for r in rows]

@router.post("", response_model=schemas.BookmarkOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=schemas.BookmarkOut, status_code=status.HTTP_201_CREATED)
def add_bookmark(
    payload: schemas.BookmarkCreate,
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    exists = db.query(model.Bookmark).filter(
        and_(
            model.Bookmark.user_id == user.id,
            model.Bookmark.target_type == payload.target_type,
            model.Bookmark.target_id == payload.target_id,
        )
    ).first()
    if exists:
        return exists
    b = model.Bookmark(
        user_id=user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,  # ← string پشتیبانی می‌شود
    )
    db.add(b); db.commit(); db.refresh(b)
    return b

# ⬇️ این دو را حتماً رشته کن تا با slug هم کار کند
@router.delete("/{target_type}/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_bookmark(
    target_type: str,
    target_id: str,   # ← قبلاً int بود، اصلاح شد
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    row = db.query(model.Bookmark).filter(
        and_(
            model.Bookmark.user_id == user.id,
            model.Bookmark.target_type == target_type,
            model.Bookmark.target_id == target_id,
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="نشانک یافت نشد")
    db.delete(row); db.commit()
    return Response(status_code=204)

@router.get("/check", response_model=bool)
def is_bookmarked(
    target_type: str = Query(...),
    target_id: str = Query(...),  # ← قبلاً int بود، اصلاح شد
    db: Session = Depends(get_db),
    user: model.UserTable = Depends(get_current_user),
):
    exists = db.query(model.Bookmark).filter(
        and_(
            model.Bookmark.user_id == user.id,
            model.Bookmark.target_type == target_type,
            model.Bookmark.target_id == target_id,
        )
    ).first()
    return bool(exists)
