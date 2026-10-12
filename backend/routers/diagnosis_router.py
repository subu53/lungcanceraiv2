import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from PIL import Image

from .. import schemas, models, auth, database
from ..services import classification_service
from ..services.report_service import generate_pdf_report, REPORTS_DIR

router = APIRouter()


def _build_response(diagnosis: models.Diagnosis) -> dict:
    """Convert Diagnosis ORM to response dict with URLs."""
    gradcam_url = None
    if diagnosis.gradcam_path and os.path.exists(diagnosis.gradcam_path):
        gradcam_url = f"/api/diagnosis/{diagnosis.case_id}/gradcam"

    return {
        "id": diagnosis.id,
        "case_id": diagnosis.case_id,
        "classification": diagnosis.classification,
        "confidence": diagnosis.confidence,
        "all_probabilities": diagnosis.all_probabilities,
        "gradcam_url": gradcam_url,
        "interpretation_text": diagnosis.interpretation_text,
        "review_status": diagnosis.review_status,
        "reviewed_at": diagnosis.reviewed_at,
        "review_notes": diagnosis.review_notes,
        "report_url": f"/api/diagnosis/{diagnosis.case_id}/report",
    }


@router.post("/{case_id}")
async def run_classification(
    case_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.RADIOLOGIST, models.UserRole.ADMIN)),
):
    """Run AI classification on a case."""
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if case.status == models.CaseStatus.ANALYZING:
        raise HTTPException(status_code=400, detail="Analysis already in progress")

    # Check for existing diagnosis
    existing = db.query(models.Diagnosis).filter(models.Diagnosis.case_id == case_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Diagnosis already exists for this case")

    case.status = models.CaseStatus.ANALYZING
    db.commit()

    try:
        # Load image
        image = Image.open(case.file_path).convert("RGB")

        # Run classification
        result = classification_service.predict(image)

        # Generate Grad-CAM
        gradcam_path = classification_service.generate_gradcam(
            result["image_tensor"], result["pred_idx"], case.id
        )

        # Generate interpretation
        interpretation = classification_service.generate_interpretation(
            result["classification"], result["confidence"], result["probabilities"]
        )

        # Save diagnosis
        diagnosis = models.Diagnosis(
            case_id=case.id,
            classification=result["classification"],
            confidence=result["confidence"],
            all_probabilities=result["probabilities"],
            gradcam_path=gradcam_path,
            interpretation_text=interpretation,
            review_status=models.ReviewStatus.PENDING,
        )
        db.add(diagnosis)
        case.status = models.CaseStatus.COMPLETED
        db.commit()
        db.refresh(diagnosis)

        # Auto-generate PDF
        try:
            generate_pdf_report(
                case_id=case.id,
                patient_id=case.patient_id,
                classification=result["classification"],
                confidence=result["confidence"],
                probabilities=result["probabilities"],
                interpretation_text=interpretation,
                gradcam_path=gradcam_path,
                review_status=diagnosis.review_status.value,
            )
            print(f"  [OK] PDF report generated for case {case.id}")
        except Exception as pdf_err:
            print(f"  [WARNING] PDF generation failed (non-fatal): {pdf_err}")

        return _build_response(diagnosis)

    except Exception as e:
        case.status = models.CaseStatus.UPLOADED
        db.commit()
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@router.get("/{case_id}")
def get_diagnosis(
    case_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    diagnosis = db.query(models.Diagnosis).filter(models.Diagnosis.case_id == case_id).first()
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found for this case")
    return _build_response(diagnosis)


@router.get("/{case_id}/gradcam")
def get_gradcam(
    case_id: int,
    token: str,
    db: Session = Depends(database.get_db),
):
    """Serve the Grad-CAM heatmap image."""
    from jose import jwt, JWTError
    from ..config import settings
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    diagnosis = db.query(models.Diagnosis).filter(models.Diagnosis.case_id == case_id).first()
    if not diagnosis or not diagnosis.gradcam_path:
        raise HTTPException(status_code=404, detail="Grad-CAM not found")

    if not os.path.exists(diagnosis.gradcam_path):
        raise HTTPException(status_code=404, detail="Grad-CAM file not found")

    return FileResponse(diagnosis.gradcam_path, media_type="image/png")


@router.get("/{case_id}/report")
def download_report(
    case_id: int,
    token: str,
    db: Session = Depends(database.get_db),
):
    """Download the PDF report."""
    from jose import jwt, JWTError
    from ..config import settings
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    diagnosis = db.query(models.Diagnosis).filter(models.Diagnosis.case_id == case_id).first()
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found")

    filepath = os.path.join(REPORTS_DIR, f"case_{case_id}_report.pdf")

    if not os.path.exists(filepath):
        case = db.query(models.Case).filter(models.Case.id == case_id).first()
        if case:
            try:
                reviewer = None
                if diagnosis.reviewed_by_id:
                    reviewer_user = db.query(models.User).filter(models.User.id == diagnosis.reviewed_by_id).first()
                    reviewer = reviewer_user.name if reviewer_user else None
                generate_pdf_report(
                    case_id=case.id,
                    patient_id=case.patient_id,
                    classification=diagnosis.classification or "",
                    confidence=diagnosis.confidence or 0,
                    probabilities=diagnosis.all_probabilities or {},
                    interpretation_text=diagnosis.interpretation_text or "",
                    gradcam_path=diagnosis.gradcam_path,
                    review_status=diagnosis.review_status.value,
                    review_notes=diagnosis.review_notes,
                    reviewer_name=reviewer,
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to generate report: {e}")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(filepath, media_type="application/pdf", filename=f"LungAI_Report_Case_{case_id}.pdf")


@router.put("/{case_id}/review")
def review_diagnosis(
    case_id: int,
    review: schemas.ReviewUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.RADIOLOGIST, models.UserRole.ADMIN)),
):
    """Submit a review (approve/reject/edit) for a diagnosis."""
    diagnosis = db.query(models.Diagnosis).filter(models.Diagnosis.case_id == case_id).first()
    if not diagnosis:
        raise HTTPException(status_code=404, detail="Diagnosis not found")

    valid_statuses = {"approved", "rejected", "edited"}
    if review.review_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid review status. Must be one of: {valid_statuses}")

    diagnosis.review_status = models.ReviewStatus(review.review_status)
    diagnosis.reviewed_by_id = current_user.id
    diagnosis.review_notes = review.review_notes
    diagnosis.reviewed_at = datetime.utcnow()

    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if case:
        case.status = models.CaseStatus.REVIEWED

    db.commit()
    db.refresh(diagnosis)

    # Regenerate PDF with review info
    if case:
        try:
            generate_pdf_report(
                case_id=case.id,
                patient_id=case.patient_id,
                classification=diagnosis.classification or "",
                confidence=diagnosis.confidence or 0,
                probabilities=diagnosis.all_probabilities or {},
                interpretation_text=diagnosis.interpretation_text or "",
                gradcam_path=diagnosis.gradcam_path,
                review_status=diagnosis.review_status.value,
                review_notes=diagnosis.review_notes,
                reviewer_name=current_user.name,
            )
        except Exception:
            pass  # Non-fatal

    return _build_response(diagnosis)


@router.get("/{case_id}/image")
def get_uploaded_image(
    case_id: int,
    token: str,
    db: Session = Depends(database.get_db),
):
    """Serve the original uploaded CT image."""
    from jose import jwt, JWTError
    from ..config import settings
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if not os.path.exists(case.file_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(case.file_path, media_type=f"image/{case.file_type}")
