from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from .. import schemas, models, auth, database
from ..config import settings

router = APIRouter()


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.User)
def read_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user


@router.post("/register", response_model=schemas.User)
def register(
    user: schemas.UserCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.ADMIN)),
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can register new users")

    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=auth.get_password_hash(user.password),
        role=user.role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=List[schemas.User])
def list_users(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.ADMIN)),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.ADMIN)),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and user_update.role is not None and user_update.role != current_user.role:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        if user.id == current_user.id and not user_update.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        user.is_active = user_update.is_active

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.require_role(models.UserRole.ADMIN)),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": f"User {user.email} deleted successfully"}
