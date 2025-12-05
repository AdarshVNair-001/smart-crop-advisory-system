# import_dataset.py (robust version)
# Usage: python import_dataset.py
import sqlite3
import pandas as pd
import os
from datetime import datetime
import sys

# ---------------------------
# YOUR FOLDER PATHS (UPDATE IF NEEDED)
# ---------------------------
CSV = r"D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\db\smart_crop_dataset.csv"
DB = r"D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\db\smart_crop_project.db"
SQL_SCHEMA = r"D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\db\schema_sqlite.sql"

# Fallback embedded schema (used only if schema file can't be read)
EMBEDDED_SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crop_dataset (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_type TEXT,
    soil_moisture_pct INTEGER,
    air_temperature_c REAL,
    relative_humidity_pct INTEGER,
    rainfall_last_7d_mm REAL,
    soil_ph REAL,
    nitrogen_ppm REAL,
    phosphorus_ppm REAL,
    potassium_ppm REAL,
    ec_dsm REAL,
    leaf_wetness REAL,
    ndvi REAL,
    action_label TEXT,
    imported_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
    prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_row_id INTEGER,
    model_name TEXT,
    predicted_label TEXT,
    confidence REAL,
    predicted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(dataset_row_id) REFERENCES crop_dataset(id)
);
"""

def connect_db(db_path=DB):
    conn = sqlite3.connect(db_path)
    return conn

def list_tables(conn):
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    rows = cur.fetchall()
    return [r[0] for r in rows]

def apply_schema_from_file(conn, schema_file=SQL_SCHEMA):
    if not os.path.exists(schema_file):
        print(f"[WARN] Schema file not found: {schema_file}")
        return False
    try:
        with open(schema_file, "r", encoding="utf-8") as f:
            schema = f.read()
        if not schema.strip():
            print(f"[WARN] Schema file is empty: {schema_file}")
            return False
        conn.executescript(schema)
        conn.commit()
        print(f"[OK] Applied schema from file: {schema_file}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to apply schema from file: {e}")
        return False

def apply_embedded_schema(conn):
    try:
        conn.executescript(EMBEDDED_SCHEMA)
        conn.commit()
        print("[OK] Applied embedded fallback schema.")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to apply embedded schema: {e}")
        return False

def ensure_schema(conn):
    tables = list_tables(conn)
    print(f"[INFO] Existing tables before ensure: {tables}")
    if "crop_dataset" in tables:
        print("[OK] crop_dataset table already exists.")
        return True
    # Try file schema
    ok = apply_schema_from_file(conn)
    if not ok:
        print("[INFO] Falling back to embedded schema.")
        ok = apply_embedded_schema(conn)
    # Re-check
    tables_after = list_tables(conn)
    print(f"[INFO] Tables after ensure: {tables_after}")
    return "crop_dataset" in tables_after

def load_csv_to_db(csv_path=CSV, db_path=DB):
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV file not found:\n{csv_path}")

    df = pd.read_csv(csv_path)
    print(f"[OK] Loaded CSV with {len(df)} rows and columns: {list(df.columns)}")

    expected_cols = [
        "crop_type","soil_moisture_pct","air_temperature_c","relative_humidity_pct",
        "rainfall_last_7d_mm","soil_ph","nitrogen_ppm","phosphorus_ppm","potassium_ppm",
        "ec_dsm","leaf_wetness","ndvi","action_label"
    ]

    # Ensure expected columns exist
    for col in expected_cols:
        if col not in df.columns:
            df[col] = pd.NA

    df = df[expected_cols]

    # Convert numeric columns
    numeric_cols = [
        "soil_moisture_pct","air_temperature_c","relative_humidity_pct",
        "rainfall_last_7d_mm","soil_ph","nitrogen_ppm","phosphorus_ppm",
        "potassium_ppm","ec_dsm","leaf_wetness","ndvi"
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    conn = connect_db(db_path)
    cur = conn.cursor()

    # Final safety: ensure table exists before inserting
    tables = list_tables(conn)
    if "crop_dataset" not in tables:
        print("[WARN] crop_dataset still missing — attempting to create using embedded schema.")
        apply_embedded_schema(conn)
        tables = list_tables(conn)
        if "crop_dataset" not in tables:
            conn.close()
            raise RuntimeError("crop_dataset table does not exist and could not be created.")

    print("[INFO] Inserting rows into crop_dataset...")
    inserted = 0
    try:
        # Use a transaction for speed
        cur.execute("BEGIN")
        for _, row in df.iterrows():
            cur.execute(
                """INSERT INTO crop_dataset
                   (crop_type, soil_moisture_pct, air_temperature_c, relative_humidity_pct,
                    rainfall_last_7d_mm, soil_ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm,
                    ec_dsm, leaf_wetness, ndvi, action_label, imported_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    None if pd.isna(row["crop_type"]) else str(row["crop_type"]).strip(),
                    None if pd.isna(row["soil_moisture_pct"]) else int(row["soil_moisture_pct"]),
                    None if pd.isna(row["air_temperature_c"]) else float(row["air_temperature_c"]),
                    None if pd.isna(row["relative_humidity_pct"]) else int(row["relative_humidity_pct"]),
                    None if pd.isna(row["rainfall_last_7d_mm"]) else float(row["rainfall_last_7d_mm"]),
                    None if pd.isna(row["soil_ph"]) else float(row["soil_ph"]),
                    None if pd.isna(row["nitrogen_ppm"]) else float(row["nitrogen_ppm"]),
                    None if pd.isna(row["phosphorus_ppm"]) else float(row["phosphorus_ppm"]),
                    None if pd.isna(row["potassium_ppm"]) else float(row["potassium_ppm"]),
                    None if pd.isna(row["ec_dsm"]) else float(row["ec_dsm"]),
                    None if pd.isna(row["leaf_wetness"]) else float(row["leaf_wetness"]),
                    None if pd.isna(row["ndvi"]) else float(row["ndvi"]),
                    None if pd.isna(row["action_label"]) else str(row["action_label"]).strip(),
                    datetime.utcnow().isoformat()
                )
            )
            inserted += 1
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    print(f"[OK] Inserted {inserted} rows into crop_dataset.")
    return inserted

def main():
    # Connect to DB (creates file if not exists)
    conn = connect_db(DB)
    conn.close()
    print(f"[OK] Database file ready at: {DB}")

    # Inspect and ensure schema
    conn = connect_db(DB)
    try:
        ok = ensure_schema(conn)
    finally:
        conn.close()

    if not ok:
        print("[ERROR] Could not ensure schema. Please check schema_sqlite.sql.")
        sys.exit(1)

    # Now import CSV
    try:
        inserted = load_csv_to_db()
        print("[DONE] Import complete.")
    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
