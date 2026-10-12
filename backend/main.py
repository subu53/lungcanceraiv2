from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from . import models, database, auth
from .config import settings
from .routers import auth_router, cases_router, diagnosis_router

# Create tables
models.Base.metadata.create_all(bind=database.engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create default admin user
    db = database.SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == "admin@lung.ai").first()
        if not user:
            print("Creating default admin user: admin@lung.ai / admin123")
            hashed_password = auth.get_password_hash("admin123")
            admin_user = models.User(
                email="admin@lung.ai",
                name="System Administrator",
                hashed_password=hashed_password,
                role=models.UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()

        # Also create a demo radiologist
        rad = db.query(models.User).filter(models.User.email == "doctor@hospital.com").first()
        if not rad:
            print("Creating demo radiologist: doctor@hospital.com / doctor123")
            hashed_password = auth.get_password_hash("doctor123")
            rad_user = models.User(
                email="doctor@hospital.com",
                name="Dr. Sarah Kimani",
                hashed_password=hashed_password,
                role=models.UserRole.RADIOLOGIST,
                is_active=True,
            )
            db.add(rad_user)
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(cases_router.router, prefix="/api/cases", tags=["cases"])
app.include_router(diagnosis_router.router, prefix="/api/diagnosis", tags=["diagnosis"])


@app.get("/")
def read_root():
    return {"message": "Lung Cancer AI Classification System API is running"}
