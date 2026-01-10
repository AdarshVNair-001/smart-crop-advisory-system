import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS fertilizer_data (
    Crop TEXT,
    Fertilizer TEXT,
    Form TEXT,
    Target_Nutrient TEXT,
    Application_Rate TEXT,
    Recommended_Stage TEXT,
    Frequency TEXT,
    Soil_pH_Range TEXT,
    Humidity TEXT,
    Remarks TEXT
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS crop_data (
    crop_type TEXT,
    soil_ph REAL,
    relative_humidity_pct REAL,
    air_temperature_c REAL,
    growth_stage TEXT
)
""")

conn.commit()
conn.close()

print("✅ Database created")
