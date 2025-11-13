from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

# --- Environment Variables / Config ---
ADMIN_EMAIL = "admin@vr.local"
ADMIN_PASSWORD = "admin123"
JWT_SECRET = "devsecret"
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = 60

# --- Password Hashing Context ---
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
admin_hash = pwd_ctx.hash(ADMIN_PASSWORD)

# --- Helper: Create JWT Token ---
def create_token(payload: dict, minutes=JWT_EXPIRE_MIN):
    to_encode = payload.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=minutes)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)

# --- FastAPI Login Endpoint ---
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    if form.username.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not pwd_ctx.verify(form.password, admin_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token({"sub": ADMIN_EMAIL, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}
