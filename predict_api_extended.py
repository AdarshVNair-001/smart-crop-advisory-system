# predict_api_extended.py
# Usage: uvicorn predict_api_extended:app --reload
import os
import sqlite3
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any
import joblib
import pandas as pd

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ---------- CONFIG: update if needed ----------
DB_PATH = r"D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\db\smart_crop_project.db"
MODEL_PATH = os.path.join("models", "decision_tree_pipeline.joblib")  # relative to project folder
# ---------------------------------------------

app = FastAPI(title="Smart Crop Advisory - Extended API")

# Try load model pipeline
MODEL = None
if os.path.exists(MODEL_PATH):
    try:
        MODEL = joblib.load(MODEL_PATH)
        print("[OK] Loaded model:", MODEL_PATH)
    except Exception as e:
        print("[WARN] Could not load model:", e)
        MODEL = None
else:
    print("[INFO] Model file not found; API will use rule-based fallback.")

# Utilities
def get_conn():
    conn = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES|sqlite3.PARSE_COLNAMES)
    conn.row_factory = sqlite3.Row
    return conn

# Ensure minimal plantings table exists (idempotent)
EMBED_PLANTINGS = """
CREATE TABLE IF NOT EXISTS plantings (
    planting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    crop_type TEXT,
    planted_on TEXT,               -- ISO date string YYYY-MM-DD
    expected_harvest_date TEXT,    -- ISO date string
    created_at TEXT DEFAULT (datetime('now'))
);
"""
def ensure_plantings_table():
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(EMBED_PLANTINGS)
    conn.commit()
    conn.close()

ensure_plantings_table()

# Pydantic models
class PlantingCreate(BaseModel):
    name: str
    crop_type: Optional[str] = None
    planted_on: Optional[str] = None          # 'YYYY-MM-DD' (default today)
    expected_harvest_date: Optional[str] = None

# Helper: compute progress %
def compute_progress(planted_on_str: Optional[str], expected_harvest_str: Optional[str]) -> float:
    try:
        if not planted_on_str:
            return 0.0
        planted_on = datetime.fromisoformat(planted_on_str).date()
        today = date.today()
        if expected_harvest_str:
            expected = datetime.fromisoformat(expected_harvest_str).date()
        else:
            # default duration 30 days if expected not provided
            expected = planted_on + timedelta(days=30)
        total = (expected - planted_on).days
        if total <= 0:
            return 100.0 if today >= expected else 0.0
        elapsed = (today - planted_on).days
        pct = max(0.0, min(100.0, (elapsed / total) * 100.0))
        return round(pct, 2)
    except Exception:
        return 0.0

# Helper: fetch latest observation for a planting
def fetch_latest_observation_for_planting(planting_id: int) -> Optional[Dict[str,Any]]:
    conn = get_conn()
    cur = conn.cursor()
    # If observation rows table is 'observations' as per earlier schema:
    cur.execute("""
        SELECT * FROM observations
        WHERE planting_id = ?
        ORDER BY recorded_at DESC
        LIMIT 1
    """, (planting_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

# Helper: fetch latest dataset row if no planting-specific observation
def fetch_latest_dataset_row() -> Optional[Dict[str,Any]]:
    conn = get_conn()
    cur = conn.cursor()
    # fallback to crop_dataset table (your CSV import)
    try:
        cur.execute("SELECT * FROM crop_dataset ORDER BY id DESC LIMIT 1")
        row = cur.fetchone()
        conn.close()
        if not row:
            return None
        return dict(row)
    except Exception:
        conn.close()
        return None

# Simple fallback rule-based recommender if model not present
def rule_based_recommend(obs: Dict[str,Any]) -> Dict[str,Any]:
    # thresholds — tweak as necessary
    soil_moisture_thresh = 30          # percent
    nitrogen_thresh = 20.0             # ppm (example)
    # fallback logic:
    sm = obs.get("soil_moisture_pct")
    n = obs.get("nitrogen_ppm")
    rec = "none"
    reason = ""
    if sm is None and n is None:
        rec = "none"
        reason = "no data"
    else:
        if sm is not None and sm < soil_moisture_thresh:
            rec = "water"
            reason = f"soil_moisture {sm} < {soil_moisture_thresh}"
        elif n is not None and n < nitrogen_thresh:
            rec = "fertilize"
            reason = f"nitrogen {n} < {nitrogen_thresh}"
        else:
            rec = "none"
            reason = "values within thresholds"
    return {"recommendation": rec, "confidence": 0.6, "reason": reason}

# Endpoint: list plantings
@app.get("/plantings")
def list_plantings():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM plantings ORDER BY planting_id")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    # add progress for each
    for r in rows:
        r["progress_pct"] = compute_progress(r.get("planted_on"), r.get("expected_harvest_date"))
    return {"plantings": rows}

# Endpoint: create planting
@app.post("/plantings")
def create_planting(p: PlantingCreate):
    planted_on = p.planted_on or date.today().isoformat()
    if p.expected_harvest_date is None:
        # default 30 days
        expected = (datetime.fromisoformat(planted_on).date() + timedelta(days=30)).isoformat()
    else:
        expected = p.expected_harvest_date
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO plantings (name, crop_type, planted_on, expected_harvest_date)
        VALUES (?, ?, ?, ?)
    """, (p.name, p.crop_type, planted_on, expected))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {"planting_id": new_id, "planted_on": planted_on, "expected_harvest_date": expected, "progress_pct": compute_progress(planted_on, expected)}

# Endpoint: get planting + progress
@app.get("/plantings/{planting_id}")
def get_planting(planting_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM plantings WHERE planting_id = ?", (planting_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Planting not found")
    r = dict(row)
    r["progress_pct"] = compute_progress(r.get("planted_on"), r.get("expected_harvest_date"))
    return r

# Endpoint: advance day manually (for testing)
@app.post("/plantings/{planting_id}/advance_day")
def advance_day(planting_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT planted_on, expected_harvest_date FROM plantings WHERE planting_id = ?", (planting_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Planting not found")
    planted_on = row[0]
    expected = row[1]
    # advance planted_on backwards by 1 day (so progress increases) — quick test helper
    try:
        p = datetime.fromisoformat(planted_on).date() - timedelta(days=1)
        cur.execute("UPDATE plantings SET planted_on = ? WHERE planting_id = ?", (p.isoformat(), planting_id))
        conn.commit()
    except Exception:
        conn.close()
        raise HTTPException(status_code=500, detail="Could not advance day")
    conn.close()
    return {"ok": True, "new_planted_on": p.isoformat(), "progress_pct": compute_progress(p.isoformat(), expected)}

# Endpoint: recommend action for planting TODAY
@app.get("/plantings/{planting_id}/recommend")
def recommend_for_planting(planting_id: int):
    # fetch planting
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM plantings WHERE planting_id = ?", (planting_id,))
    p = cur.fetchone()
    if not p:
        conn.close()
        raise HTTPException(status_code=404, detail="Planting not found")
    planting = dict(p)
    # fetch latest observation for planting
    obs = fetch_latest_observation_for_planting(planting_id)
    if not obs:
        # fallback use latest dataset row
        obs = fetch_latest_dataset_row()
    if not obs:
        conn.close()
        return {"recommendation": "none", "confidence": 0.0, "reason": "no observation or dataset available", "progress_pct": compute_progress(planting.get("planted_on"), planting.get("expected_harvest_date"))}
    # prepare feature vector (DataFrame) expected by model/pipeline
    df = pd.DataFrame([{
        "crop_type": obs.get("crop_type") or planting.get("crop_type"),
        "soil_moisture_pct": obs.get("soil_moisture_pct"),
        "air_temperature_c": obs.get("air_temperature_c"),
        "relative_humidity_pct": obs.get("relative_humidity_pct"),
        "rainfall_last_7d_mm": obs.get("rainfall_last_7d_mm"),
        "soil_ph": obs.get("soil_ph"),
        "nitrogen_ppm": obs.get("nitrogen_ppm"),
        "phosphorus_ppm": obs.get("phosphorus_ppm"),
        "potassium_ppm": obs.get("potassium_ppm"),
        "ec_dsm": obs.get("ec_dsm"),
        "leaf_wetness": obs.get("leaf_wetness"),
        "ndvi": obs.get("ndvi")
    }])
    # Use model if present
    if MODEL is not None:
        try:
            if hasattr(MODEL, "predict_proba"):
                probs = MODEL.predict_proba(df)
                idx = probs.argmax(axis=1)[0]
                pred_label = MODEL.classes_[idx]
                confidence = float(probs[0, idx])
            else:
                pred_label = MODEL.predict(df)[0]
                confidence = 1.0
            reason = "model"
            # log into predictions table if exists
            try:
                cur.execute("""
                    INSERT INTO predictions (dataset_row_id, model_name, predicted_label, confidence, predicted_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (obs.get("id") if "id" in obs else None, "decision_tree", str(pred_label), float(confidence), datetime.utcnow().isoformat()))
                conn.commit()
            except Exception:
                pass
            conn.close()
            return {
                "recommendation": str(pred_label),
                "confidence": float(confidence),
                "reason": reason,
                "progress_pct": compute_progress(planting.get("planted_on"), planting.get("expected_harvest_date"))
            }
        except Exception as e:
            # fallback to rule-based
            print("[WARN] Model prediction failed:", e)
            rec = rule_based_recommend(obs)
            rec["progress_pct"] = compute_progress(planting.get("planted_on"), planting.get("expected_harvest_date"))
            conn.close()
            return rec
    else:
        # model not present — use rule-based
        rec = rule_based_recommend(obs)
        rec["progress_pct"] = compute_progress(planting.get("planted_on"), planting.get("expected_harvest_date"))
        conn.close()
        return rec
