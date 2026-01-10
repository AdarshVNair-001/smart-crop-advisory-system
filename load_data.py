import pandas as pd
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")

fert_df = pd.read_csv(os.path.join(BASE_DIR, "Fertilizer.csv"))
crop_df = pd.read_csv(os.path.join(BASE_DIR, "smart_crop_dataset.csv"))

fert_df = fert_df.rename(columns={
    "Target Nutrient": "Target_Nutrient",
    "Application Rate (kg/ha)": "Application_Rate",
    "Recommended Stage": "Recommended_Stage",
    "Soil pH Range": "Soil_pH_Range",
    "Humidity Condition Favorable": "Humidity"
})

conn = sqlite3.connect(DB_PATH)
fert_df.to_sql("fertilizer_data", conn, if_exists="replace", index=False)
crop_df.to_sql("crop_data", conn, if_exists="replace", index=False)
conn.close()

print("✅data loaded into database")
