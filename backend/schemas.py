from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from .models import UserRole, CaseStatus, ReviewStatus


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None


class UserBase(BaseModel):
    email: str
    name: str


class UserCreate(UserBase):
    password: str
    role: UserRole = UserRole.CLINICIAN


class User(UserBase):
    id: int
    is_active: bool
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class ReviewUpdate(BaseModel):
    review_status: str  # "approved", "rejected", "edited"
    review_notes: Optional[str] = None


class DiagnosisResponse(BaseModel):
    id: int
    case_id: int
    classification: Optional[str] = None
    confidence: Optional[float] = None
    all_probabilities: Optional[Dict[str, float]] = None
    gradcam_url: Optional[str] = None
    interpretation_text: Optional[str] = None
    review_status: ReviewStatus
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    report_url: Optional[str] = None

    class Config:
        from_attributes = True


class CaseBase(BaseModel):
    patient_id: str


class Case(CaseBase):
    id: int
    uploaded_by_id: int
    file_type: str
    status: CaseStatus
    created_at: datetime
    diagnosis: Optional[DiagnosisResponse] = None

    class Config:
        from_attributes = True
