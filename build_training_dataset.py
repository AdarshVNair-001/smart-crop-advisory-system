import sqlite3
import pandas as pd
import os

def normalize_stage(stage):
    s = str(stage).lower()
    if "tiller" in s or "basal" in s:
        return "vegetative"
    if "flower" in s or "boot" in s:
        return "flowering"
    if "fruit" in s:
        return "fruiting"
    return "vegetative"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")

conn = sqlite3.connect(DB_PATH)
fert = pd.read_sql("SELECT * FROM fertilizer_data", conn)
crop = pd.read_sql("SELECT * FROM crop_data", conn)
conn.close()

fert["Crop"] = fert["Crop"].str.lower()
crop["crop_type"] = crop["crop_type"].str.lower()

fert["Recommended_Stage"] = fert["Recommended_Stage"].apply(normalize_stage)
crop["growth_stage"] = crop["growth_stage"].apply(normalize_stage)

merged = crop.merge(
    fert,
    left_on="crop_type",
    right_on="Crop",
    how="inner"
)

final_df = merged[[
    "crop_type",
    "soil_ph",
    "relative_humidity_pct",
    "air_temperature_c",
    "growth_stage",
    "Target_Nutrient",
    "Form",
    "Fertilizer"
]]

final_df.to_csv(os.path.join(BASE_DIR, "training_dataset.csv"), index=False)

print("✅ Training dataset created")
