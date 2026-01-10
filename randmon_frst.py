# train_random_forest_complete.py
import pandas as pd
import numpy as np
import joblib
import sqlite3
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from collections import Counter

def normalize_stage(stage):
    """Normalize growth stage names"""
    s = str(stage).lower()
    if "tiller" in s or "basal" in s or "vegetative" in s or "germination" in s:
        return "vegetative"
    if "flower" in s or "boot" in s or "panicle" in s:
        return "flowering"
    if "fruit" in s or "pod" in s or "tuber" in s or "fruiting" in s:
        return "fruiting"
    if "harvest" in s or "maturity" in s:
        return "maturity"
    return "vegetative"

def create_training_dataset():
    """Create training dataset from database (same as your code)"""
    print("📊 Creating training dataset from database...")
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        fert = pd.read_sql("SELECT * FROM fertilizer_data", conn)
        crop = pd.read_sql("SELECT * FROM crop_data", conn)
        conn.close()
        
        # Normalize crop names and stages
        fert["Crop"] = fert["Crop"].str.lower()
        crop["crop_type"] = crop["crop_type"].str.lower()
        
        fert["Recommended_Stage"] = fert["Recommended_Stage"].apply(normalize_stage)
        crop["growth_stage"] = crop["growth_stage"].apply(normalize_stage)
        
        # Merge datasets
        merged = crop.merge(
            fert,
            left_on="crop_type",
            right_on="Crop",
            how="inner"
        )
        
        # Select and rename columns
        final_df = merged[[
            "crop_type",
            "soil_ph",
            "relative_humidity_pct",
            "air_temperature_c",
            "growth_stage",
            "Target_Nutrient",
            "Form",
            "Fertilizer"
        ]].copy()
        
        # Clean up fertilizer names
        final_df["Fertilizer"] = final_df["Fertilizer"].str.strip()
        
        print(f"✅ Created training dataset with {len(final_df)} samples")
        print(f"   Unique fertilizers: {final_df['Fertilizer'].nunique()}")
        print(f"   Unique crops: {final_df['crop_type'].nunique()}")
        
        return final_df
        
    except Exception as e:
        print(f"❌ Error creating training dataset: {e}")
        return None

def train_random_forest_model():
    """Train Random Forest model for fertilizer recommendation"""
    
    os.makedirs("models", exist_ok=True)
    
    print("="*60)
    print("🌱 SMART CROP - FERTILIZER RECOMMENDATION SYSTEM")
    print("="*60)
    
    # Step 1: Create training dataset
    df = create_training_dataset()
    if df is None or len(df) == 0:
        print("❌ No data available for training")
        return
    
    print("\n📋 TRAINING DATA SUMMARY:")
    print(f"   Total samples: {len(df)}")
    print(f"   Features: {df.shape[1]}")
    
    # Show data preview
    print("\n📊 DATA PREVIEW:")
    print(df.head())
    
    # Check for missing values
    print("\n🔍 CHECKING DATA QUALITY:")
    missing = df.isnull().sum()
    if missing.sum() > 0:
        print("   Missing values found:")
        for col, count in missing[missing > 0].items():
            print(f"      {col}: {count} missing")
        # Fill missing numeric values
        numeric_cols = ['soil_ph', 'relative_humidity_pct', 'air_temperature_c']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = df[col].fillna(df[col].median())
                print(f"      Filled missing {col} with median")
    else:
        print("   ✓ No missing values found")
    
    # Check fertilizer distribution
    print("\n📈 FERTILIZER DISTRIBUTION:")
    fert_counts = df['Fertilizer'].value_counts()
    print(f"   Total unique fertilizers: {len(fert_counts)}")
    
    # Identify rare fertilizers (less than 2 samples)
    rare_ferts = fert_counts[fert_counts < 2].index.tolist()
    if rare_ferts:
        print(f"\n⚠️  WARNING: {len(rare_ferts)} fertilizers have only 1 sample:")
        for fert in rare_ferts[:10]:  # Show first 10
            print(f"      • {fert}")
        if len(rare_ferts) > 10:
            print(f"      ... and {len(rare_ferts) - 10} more")
        
        print(f"\n🔧 SOLUTION: Removing rare fertilizers for better model training")
        df = df[~df['Fertilizer'].isin(rare_ferts)].copy()
        print(f"   Removed {len(rare_ferts)} rare fertilizers")
        print(f"   Remaining samples: {len(df)}")
        print(f"   Remaining fertilizers: {df['Fertilizer'].nunique()}")
    
    # Check if we have enough data
    if len(df) < 10:
        print(f"\n❌ Not enough data for training. Only {len(df)} samples remaining.")
        return
    
    # Prepare features and target
    print("\n🎯 PREPARING FEATURES AND TARGET:")
    feature_cols = [
        'crop_type',
        'growth_stage', 
        'Target_Nutrient',
        'Form',
        'soil_ph',
        'relative_humidity_pct', 
        'air_temperature_c'
    ]
    
    # Make sure all features exist
    available_features = [col for col in feature_cols if col in df.columns]
    print(f"   Using features: {available_features}")
    
    X = df[available_features].copy()
    y = df['Fertilizer']
    
    # Encode categorical features
    print("\n🔤 ENCODING CATEGORICAL FEATURES:")
    fert_encoders = {}
    categorical_cols = ['crop_type', 'growth_stage', 'Target_Nutrient', 'Form']
    categorical_cols = [col for col in categorical_cols if col in X.columns]
    
    for col in categorical_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col])
        fert_encoders[f"fert_{col}_encoder"] = le
        print(f"   {col}: {len(le.classes_)} classes")
    
    # Encode target (fertilizer names)
    fert_target_encoder = LabelEncoder()
    y_encoded = fert_target_encoder.fit_transform(y)
    
    print(f"\n🎯 TARGET ENCODING:")
    print(f"   Fertilizers: {len(fert_target_encoder.classes_)}")
    print("\n   Available fertilizers:")
    for i, fert in enumerate(fert_target_encoder.classes_[:15]):  # Show first 15
        print(f"      {i+1:2d}. {fert}")
    if len(fert_target_encoder.classes_) > 15:
        print(f"      ... and {len(fert_target_encoder.classes_) - 15} more")
    
    # Split data with stratification if possible
    print("\n📊 SPLITTING DATA:")
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, 
            test_size=0.2, 
            random_state=42,
            stratify=y_encoded,
            shuffle=True
        )
        print("   ✓ Used stratified split")
    except ValueError as e:
        print(f"   ⚠️  Stratified split failed: {e}")
        print("   Using random split instead...")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, 
            test_size=0.2, 
            random_state=42,
            shuffle=True
        )
    
    print(f"   Training samples: {len(X_train)}")
    print(f"   Testing samples: {len(X_test)}")
    
    # Train Random Forest model
    print("\n🏗️  TRAINING RANDOM FOREST MODEL...")
    rf = RandomForestClassifier(
        n_estimators=100,  # You can increase this for better performance
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    rf.fit(X_train, y_train)
    
    # Evaluate the model
    print("\n📈 MODEL EVALUATION:")
    y_pred = rf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"   Test Accuracy: {accuracy:.4f}")
    
    print("\n📋 CLASSIFICATION REPORT:")
    print(classification_report(y_test, y_pred, 
                                target_names=fert_target_encoder.classes_,
                                zero_division=0))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': rf.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\n🎯 FEATURE IMPORTANCE:")
    print(feature_importance)
    
    # Save the model and encoders
    print("\n💾 SAVING MODELS...")
    joblib.dump(rf, "models/rf_fertilizer.pkl")
    joblib.dump(fert_encoders, "models/fert_encoders.pkl")
    joblib.dump(fert_target_encoder, "models/fert_target_encoder.pkl")
    joblib.dump(list(X.columns), "models/rf_feature_names.pkl")
    
    # Save training summary
    training_summary = {
        'n_samples': len(df),
        'n_features': len(X.columns),
        'n_fertilizers': len(fert_target_encoder.classes_),
        'accuracy': accuracy,
        'crops': list(fert_encoders.get('fert_crop_type_encoder', LabelEncoder()).classes_),
        'growth_stages': list(fert_encoders.get('fert_growth_stage_encoder', LabelEncoder()).classes_),
        'nutrients': list(fert_encoders.get('fert_Target_Nutrient_encoder', LabelEncoder()).classes_),
        'forms': list(fert_encoders.get('fert_Form_encoder', LabelEncoder()).classes_),
        'fertilizers': list(fert_target_encoder.classes_)
    }
    joblib.dump(training_summary, "models/training_summary.pkl")
    
    print("\n✅ FILES SAVED TO 'models/' FOLDER:")
    print("   • rf_fertilizer.pkl - Random Forest model")
    print("   • fert_encoders.pkl - Feature encoders")
    print("   • fert_target_encoder.pkl - Fertilizer encoder")
    print("   • rf_feature_names.pkl - Feature names")
    print("   • training_summary.pkl - Training summary")
    
    print("\n📊 FINAL STATISTICS:")
    print(f"   Samples used: {training_summary['n_samples']}")
    print(f"   Features: {training_summary['n_features']}")
    print(f"   Fertilizers: {training_summary['n_fertilizers']}")
    print(f"   Test accuracy: {training_summary['accuracy']:.4f}")
    
    print("\n🎉 TRAINING COMPLETED SUCCESSFULLY!")
    print("="*60)
    
    return rf, fert_encoders, fert_target_encoder

if __name__ == "__main__":
    train_random_forest_model()