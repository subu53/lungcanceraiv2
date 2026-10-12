from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    RADIOLOGIST = "radiologist"
    CLINICIAN = "clinician"


class CaseStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    REVIEWED = "reviewed"


class ReviewStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED = "edited"


class Classification(str, enum.Enum):
    NORMAL = "Normal cases"
    BENIGN = "Benign cases"
    MALIGNANT = "Malignant cases"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CLINICIAN)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    cases = relationship("Case", back_populates="uploader")
    reviews = relationship("Diagnosis", back_populates="reviewer")


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    file_path = Column(String, nullable=False)
    file_type = Column(String, default="png")
    metadata_json = Column(JSON, default={})
    status = Column(Enum(CaseStatus), default=CaseStatus.UPLOADED)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User", back_populates="cases")
    diagnosis = relationship("Diagnosis", uselist=False, back_populates="case")


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), unique=True)

    # Classification Results
    classification = Column(String, nullable=True)  # "Normal cases", "Benign cases", "Malignant cases"
    confidence = Column(Float, nullable=True)
    all_probabilities = Column(JSON, nullable=True)  # {"Normal cases": 0.1, "Benign cases": 0.2, ...}
    gradcam_path = Column(String, nullable=True)  # Path to Grad-CAM heatmap PNG

    # Interpretation
    interpretation_text = Column(Text, nullable=True)

    # Review
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)
    review_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="diagnosis")
    reviewer = relationship("User", back_populates="reviews")
