from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import aiofiles

from .. import schemas, models, auth, database
from ..config import settings

router = APIRouter()


@router.post("/upload", response_model=schemas.Case)
async def upload_case(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.RADIOLOGIST, models.UserRole.ADMIN)),
):
    allowed_exts = (".png", ".jpg", ".jpeg", ".dcm", ".zip")
    if not file.filename.lower().endswith(allowed_exts):
        raise HTTPException(status_code=400, detail=f"Invalid file format. Allowed: {', '.join(allowed_exts)}")

    case_uid = str(uuid.uuid4())
    file_ext = os.path.splitext(file.filename)[1].lower()
    stored_filename = f"{case_uid}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    patient_id = f"PAT-{case_uid[:8].upper()}"

    db_case = models.Case(
        patient_id=patient_id,
        uploaded_by_id=current_user.id,
        file_path=file_path,
        file_type=file_ext.replace(".", ""),
        metadata_json={"original_filename": file.filename, "file_size": len(content)},
        status=models.CaseStatus.UPLOADED,
    )
    db.add(db_case)
    db.commit()
    db.refresh(db_case)
    return db_case


@router.get("/", response_model=List[schemas.Case])
def list_cases(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    cases = db.query(models.Case).order_by(models.Case.created_at.desc()).offset(skip).limit(limit).all()
    return cases


@router.get("/{case_id}", response_model=schemas.Case)
def get_case(
    case_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
