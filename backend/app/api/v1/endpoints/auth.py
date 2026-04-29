"""
Authentication Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta
from typing import Optional

from app.core.config import settings
from app.core.security import create_access_token, verify_password, get_password_hash, verify_token
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse, Token, UserLogin

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Mock user database (replace with actual DB queries)
MOCK_USERS = {
    "officer1@crpf.gov.in": {
        "id": "1",
        "email": "officer1@crpf.gov.in",
        "hashed_password": get_password_hash("password123"),
        "role": "committee_member",
        "organization": "CRPF",
        "full_name": "Rajesh Kumar"
    },
    "bidder1@example.com": {
        "id": "2",
        "email": "bidder1@example.com",
        "hashed_password": get_password_hash("password123"),
        "role": "bidder",
        "organization": "ABC Corp",
        "full_name": "Suresh Sharma"
    }
}

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint for both officers and bidders."""
    user = MOCK_USERS.get(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "role": user["role"], "user_id": user["id"]},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user["role"],
        "user_id": user["id"]
    }

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register a new user (bidder or officer)."""
    if user_data.email in MOCK_USERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # In production, save to database
    new_user = {
        "id": str(len(MOCK_USERS) + 1),
        "email": user_data.email,
        "hashed_password": get_password_hash(user_data.password),
        "role": user_data.role,
        "organization": user_data.organization,
        "full_name": user_data.full_name
    }
    MOCK_USERS[user_data.email] = new_user
    
    return {
        "id": new_user["id"],
        "email": new_user["email"],
        "role": new_user["role"],
        "organization": new_user["organization"],
        "full_name": new_user["full_name"]
    }

@router.get("/me", response_model=UserResponse)
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get current logged-in user details."""
    payload = verify_token(token)
    email = payload.get("sub")
    user = MOCK_USERS.get(email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "organization": user["organization"],
        "full_name": user["full_name"]
    }
