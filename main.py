import os, re, uuid, shutil
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from pymongo import MongoClient
from dotenv import load_dotenv

# ----------------------- Load Environment Variables -----------------------
load_dotenv()

MEDIA_ROOT = os.getenv("MEDIA_ROOT", "media")
os.makedirs(MEDIA_ROOT, exist_ok=True)

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "vehiclereg")

JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = "HS256"
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "60"))

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@vr.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# ----------------------- Security & DB Setup -----------------------
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
admin_hash = pwd_ctx.hash(ADMIN_PASSWORD)

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
cars = db["cars"]
cars.create_index("reg", unique=True)
cars.create_index([("brand", 1), ("model", 1)])


# ----------------------- Helper Functions -----------------------
def norm_reg(reg: str) -> str:
    """Normalize registration number"""
    return re.sub(r"\s+", "", reg or "").upper()


def create_token(payload: dict, minutes=JWT_EXPIRE_MIN):
    """Generate JWT token"""
    to_encode = payload.copy()
    to_encode["exp"] = datetime.utcnow() + timedelta(minutes=minutes)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def parse_token(token: str):
    """Decode JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


# ----------------------- Dependencies -----------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def admin_required(token: str = Depends(oauth2_scheme)):
    """Allow only admin users"""
    data = parse_token(token)
    if data.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return data


# ----------------------- Pydantic Models -----------------------
class VehicleIn(BaseModel):
    reg: str
    brand: str
    model: str
    year: int
    price: float
    kms: int = Field(ge=0)
    fuel: str
    transmission: str
    owner: str
    description: str


class VehicleOut(VehicleIn):
    images: List[str] = []
    is_sold: bool = False


class CarQuery(BaseModel):
    q: Optional[str] = None
    brand: Optional[str] = None
    max_price: Optional[float] = None
    is_sold: Optional[bool] = None


# ----------------------- FastAPI App -----------------------
app = FastAPI(title="Vehicle Registry API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded media (car images)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


# ----------------------- Root Endpoint -----------------------
@app.get("/")
def root():
    return {"ok": True, "service": "Vehicle Registry API"}


# ----------------------- Auth -----------------------
@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    """Simple Admin Login"""
    if form.username.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(401, "Invalid credentials")
    if not pwd_ctx.verify(form.password, admin_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_token({"sub": ADMIN_EMAIL, "role": "admin"})
    return {"access_token": token, "token_type": "bearer"}


# ----------------------- Cars: List -----------------------
@app.get("/cars", response_model=List[VehicleOut])
def list_cars(
    q: Optional[str] = None,
    brand: Optional[str] = None,
    max_price: Optional[float] = None,
    is_sold: Optional[bool] = None,
    limit: int = Query(100, le=500),
):
    """Fetch list of cars"""
    query = {}
    if q:
        query["$or"] = [
            {"brand": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
            {"reg": {"$regex": norm_reg(q), "$options": "i"}},
        ]
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if max_price is not None:
        query["price"] = {"$lte": max_price}
    if is_sold is not None:
        query["is_sold"] = is_sold

    docs = list(cars.find(query, {"_id": 0}).limit(limit))
    return docs or []


# ----------------------- Cars: Create -----------------------
@app.post("/cars", dependencies=[Depends(admin_required)], response_model=VehicleOut)
async def create_car(
    reg: str = Form(...),
    brand: str = Form(...),
    model: str = Form(...),
    year: int = Form(...),
    price: float = Form(...),
    kms: int = Form(...),
    fuel: str = Form(...),
    transmission: str = Form(...),
    owner: str = Form(...),
    description: str = Form(...),
    images: List[UploadFile] = File(default=[]),
):
    """Admin can create a new car entry"""
    nreg = norm_reg(reg)
    if cars.find_one({"reg": nreg}):
        raise HTTPException(409, "Registration already exists")

    # Save uploaded images
    img_urls: List[str] = []
    out_dir = os.path.join(MEDIA_ROOT, nreg)
    os.makedirs(out_dir, exist_ok=True)

    for idx, f in enumerate(images):
        ext = os.path.splitext(f.filename)[1] or ".jpg"
        fname = f"{idx:03d}_{uuid.uuid4().hex}{ext}"
        path = os.path.join(out_dir, fname)
        with open(path, "wb") as w:
            shutil.copyfileobj(f.file, w)
        img_urls.append(f"/media/{nreg}/{fname}")

    doc = {
        "reg": nreg,
        "brand": brand,
        "model": model,
        "year": year,
        "price": float(price),
        "kms": int(kms),
        "fuel": fuel,
        "transmission": transmission,
        "owner": owner,
        "description": description,
        "images": img_urls,
        "is_sold": False,
    }

    cars.insert_one(doc)
    return doc


# ----------------------- Cars: Get by Reg -----------------------
@app.get("/cars/{reg}", response_model=VehicleOut)
def get_car(reg: str):
    """Get car details by registration number"""
    doc = cars.find_one({"reg": norm_reg(reg)}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Vehicle not found")
    return doc


# ----------------------- Cars: Delete -----------------------
@app.delete("/cars/{reg}", dependencies=[Depends(admin_required)])
def delete_car(reg: str):
    """Delete a car entry (and its images)"""
    nreg = norm_reg(reg)
    res = cars.find_one_and_delete({"reg": nreg})
    if not res:
        raise HTTPException(404, "Vehicle not found")

    folder = os.path.join(MEDIA_ROOT, nreg)
    if os.path.isdir(folder):
        shutil.rmtree(folder, ignore_errors=True)

    return {"ok": True, "deleted": nreg}


# ----------------------- Cars: Mark Sold -----------------------
@app.patch("/cars/{reg}/sold", dependencies=[Depends(admin_required)])
def mark_car_sold(reg: str):
    """Mark a car as sold"""
    nreg = norm_reg(reg)
    res = cars.find_one({"reg": nreg})
    if not res:
        raise HTTPException(404, "Vehicle not found")

    cars.update_one({"reg": nreg}, {"$set": {"is_sold": True}})
    return {"ok": True, "reg": nreg, "status": "sold"}

@app.patch("/cars/{reg}", dependencies=[Depends(admin_required)], response_model=VehicleOut)
async def update_car(
    reg: str,
    brand: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    price: Optional[float] = Form(None),
    kms: Optional[int] = Form(None),
    fuel: Optional[str] = Form(None),
    transmission: Optional[str] = Form(None),
    owner: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
):
    nreg = norm_reg(reg)
    doc = cars.find_one({"reg": nreg})
    if not doc:
        raise HTTPException(404, "Vehicle not found")

    update_data = {}
    for k, v in dict(
        brand=brand,
        model=model,
        year=year,
        price=price,
        kms=kms,
        fuel=fuel,
        transmission=transmission,
        owner=owner,
        description=description,
    ).items():
        if v is not None:
            update_data[k] = v

    if not update_data:
        raise HTTPException(400, "No fields to update")

    cars.update_one({"reg": nreg}, {"$set": update_data})
    final_doc = cars.find_one({"reg": nreg}, {"_id": 0})
    return final_doc
