import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Lung Cancer AI Classification System"
    API_V1_STR: str = "/api"

    # Security
    SECRET_KEY: str = "INSECURE_DEV_SECRET_KEY_CHANGE_IN_PROD"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day for dev

    # Database (SQLite for dev)
    DATABASE_URL: str = "sqlite:///./lung_classification.db"

    # File Storage
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")

    # Model
    MODEL_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]

    class Config:
        env_file = ".env"


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "gradcam"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "reports"), exist_ok=True)
