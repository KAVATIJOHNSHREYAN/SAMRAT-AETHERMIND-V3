from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import bcrypt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import settings
from app.db.postgres import get_db
from app.db.models import User

# Security definitions
security = HTTPBearer()

router = APIRouter(prefix="/auth", tags=["auth"])

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    username: Optional[str]
    preferred_language: str
    interface_style: str
    theme_style: str
    subscription_status: str

# Helpers using native bcrypt
def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    try:
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or expired session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found in system",
        )
    return user

# Routes
@router.post("/register", response_model=TokenResponse)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user_id = f"usr_{uuid_generator()}"
    new_user = User(
        id=new_user_id,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        subscription_status="free"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": new_user.id
    }

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not user.hashed_password or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

class GoogleLoginRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    profile_pic: Optional[str] = None

@router.post("/google", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    # Check if user already exists
    user = db.query(User).filter(User.email == payload.email).first()

    if not user:
        # Create user profile implicitly
        user_id = f"usr_{uuid_generator()}"
        first_name = None
        last_name = None

        if payload.name:
            parts = payload.name.split(" ", 1)
            first_name = parts[0]
            if len(parts) > 1:
                last_name = parts[1]

        user = User(
            id=user_id,
            email=payload.email,
            first_name=first_name,
            last_name=last_name,
            profile_picture_url=payload.profile_pic,
            subscription_status="free"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

class BiometricLoginRequest(BaseModel):
    mode: str # 'fingerprint' or 'face'

@router.post("/biometric", response_model=TokenResponse)
def biometric_login(payload: BiometricLoginRequest, db: Session = Depends(get_db)):
    email = f"fingerprint_user@samrat.ai" if payload.mode == 'fingerprint' else f"faceid_user@samrat.ai"

    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create user profile implicitly
        user_id = f"usr_{uuid_generator()}"

        user = User(
            id=user_id,
            email=email,
            first_name="Fingerprint" if payload.mode == 'fingerprint' else "Face ID",
            last_name="User",
            subscription_status="premium"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

class BiometricLoginRequest(BaseModel):
    mode: str # 'fingerprint' or 'face'

@router.post("/biometric", response_model=TokenResponse)
def biometric_login(payload: BiometricLoginRequest, db: Session = Depends(get_db)):
    email = f"fingerprint_user@samrat.ai" if payload.mode == 'fingerprint' else f"faceid_user@samrat.ai"

    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create user profile implicitly
        user_id = f"usr_{uuid_generator()}"

        user = User(
            id=user_id,
            email=email,
            first_name="Fingerprint" if payload.mode == 'fingerprint' else "Face ID",
            last_name="User",
            subscription_status="premium"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

from app.db.models import User, UserDevice

class BiometricRegisterRequest(BaseModel):
    credential_id: str
    public_key: Optional[str] = None
    device_name: str
    platform: str
    browser: str

class BiometricAuthenticateRequest(BaseModel):
    credential_id: str

class DeviceResponse(BaseModel):
    id: str
    device_name: str
    platform: str
    browser: str
    location: str
    biometrics_enabled: bool
    created_at: datetime
    last_login_at: datetime

@router.post("/biometrics/register")
def register_biometric_device(
    payload: BiometricRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if credential already registered
    existing_device = db.query(UserDevice).filter(UserDevice.credential_id == payload.credential_id).first()
    if existing_device:
        existing_device.user_id = current_user.id
        existing_device.device_name = payload.device_name
        existing_device.platform = payload.platform
        existing_device.browser = payload.browser
        existing_device.biometrics_enabled = True
        existing_device.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing_device)
        return {"status": "updated", "device_id": existing_device.id}

    new_device = UserDevice(
        user_id=current_user.id,
        credential_id=payload.credential_id,
        public_key=payload.public_key,
        device_name=payload.device_name,
        platform=payload.platform,
        browser=payload.browser,
        biometrics_enabled=True
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    return {"status": "registered", "device_id": new_device.id}

@router.post("/biometrics/authenticate", response_model=TokenResponse)
def authenticate_biometric_device(
    payload: BiometricAuthenticateRequest,
    db: Session = Depends(get_db)
):
    device = db.query(UserDevice).filter(
        UserDevice.credential_id == payload.credential_id,
        UserDevice.biometrics_enabled == True
    ).first()

    if not device:
        raise HTTPException(
            status_code=401,
            detail="Biometric credential not recognized or disabled for this device"
        )

    # Update last login time
    device.last_login_at = datetime.now(timezone.utc)
    db.commit()

    user = db.query(User).filter(User.id == device.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User account not found")

    access_token = create_access_token(data={"sub": user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id
    }

@router.get("/devices", response_model=list[DeviceResponse])
def get_user_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    devices = db.query(UserDevice).filter(UserDevice.user_id == current_user.id).all()
    return [
        {
            "id": dev.id,
            "device_name": dev.device_name,
            "platform": dev.platform,
            "browser": dev.browser,
            "location": dev.location or "Approximate / Local",
            "biometrics_enabled": dev.biometrics_enabled,
            "created_at": dev.created_at,
            "last_login_at": dev.last_login_at or dev.created_at
        }
        for dev in devices
    ]

@router.delete("/devices/{device_id}")
def delete_user_device(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(UserDevice).filter(
        UserDevice.id == device_id,
        UserDevice.user_id == current_user.id
    ).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    db.delete(device)
    db.commit()
    return {"status": "deleted", "device_id": device_id}

@router.post("/devices/logout-all")
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(UserDevice).filter(UserDevice.user_id == current_user.id).delete()
    db.commit()
    return {"status": "all_devices_removed"}

@router.get("/me", response_model=UserProfileResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "username": current_user.username,
        "preferred_language": current_user.preferred_language,
        "interface_style": current_user.interface_style,
        "theme_style": current_user.theme_style,
        "subscription_status": current_user.subscription_status
    }

def uuid_generator() -> str:
    import uuid
    return str(uuid.uuid4()).replace("-", "")[:12]

