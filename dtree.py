# train_decision_tree_fixed.py
import pandas as pd
import numpy as np
import joblib
import sqlite3
import os
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

def normalize_stage(stage):
    """Normalize growth stage names"""
    if pd.isna(stage):
        return "vegetative"
    
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

def create_synthetic_task_data():
    """Create synthetic task data for common crops"""
    
    print("🔧 Creating synthetic training data...")
    
    # Common crops and their typical tasks
    synthetic_data = []
    
    crops = ['rice', 'wheat', 'maize', 'tomato', 'potato', 'soybean']
    stages = ['vegetative', 'flowering', 'fruiting', 'maturity']
    
    for crop in crops:
        for stage in stages:
            # Create multiple samples with variations
            for i in range(3):  # 3 samples per crop-stage combination
                # Vary environmental conditions
                if crop == 'rice':
                    soil_ph = np.random.uniform(5.5, 7.5)
                    temp = np.random.uniform(25, 35)
                    humidity = np.random.uniform(70, 90)
                    # Rice-specific tasks
                    if stage == 'vegetative':
                        task = 'Irrigation' if humidity < 80 else 'Fertilization'
                    elif stage == 'flowering':
                        task = 'Pest_Control'
                    elif stage == 'fruiting':
                        task = 'Weed_Control'
                    else:
                        task = 'Harvesting'
                        
                elif crop == 'wheat':
                    soil_ph = np.random.uniform(6.0, 8.0)
                    temp = np.random.uniform(15, 25)
                    humidity = np.random.uniform(50, 70)
                    if stage == 'vegetative':
                        task = 'Fertilization'
                    elif stage == 'flowering':
                        task = 'Irrigation' if humidity < 60 else 'Pest_Control'
                    elif stage == 'fruiting':
                        task = 'Weed_Control'
                    else:
                        task = 'Harvesting'
                        
                elif crop == 'maize':
                    soil_ph = np.random.uniform(5.5, 7.5)
                    temp = np.random.uniform(20, 30)
                    humidity = np.random.uniform(60, 80)
                    if stage == 'vegetative':
                        task = 'Irrigation' if temp > 28 else 'Fertilization'
                    elif stage == 'flowering':
                        task = 'Pest_Control'
                    elif stage == 'fruiting':
                        task = 'Harvesting'
                    else:
                        task = 'Weed_Control'
                        
                elif crop == 'tomato':
                    soil_ph = np.random.uniform(5.5, 7.0)
                    temp = np.random.uniform(20, 30)
                    humidity = np.random.uniform(50, 70)
                    if stage == 'vegetative':
                        task = 'Fertilization'
                    elif stage == 'flowering':
                        task = 'Irrigation'
                    elif stage == 'fruiting':
                        task = 'Pest_Control'
                    else:
                        task = 'Harvesting'
                
                # Add some randomness
                if np.random.random() < 0.2:  # 20% chance of different task
                    tasks = ['Irrigation', 'Fertilization', 'Pest_Control', 'Weed_Control', 'Soil_Amendment', 'Harvesting']
                    task = np.random.choice([t for t in tasks if t != task])
                
                synthetic_data.append({
                    'crop_type': crop,
                    'growth_stage': stage,
                    'soil_ph': round(soil_ph, 1),
                    'air_temperature_c': round(temp, 1),
                    'relative_humidity_pct': round(humidity, 1),
                    'task': task
                })
    
    df = pd.DataFrame(synthetic_data)
    print(f"✅ Created {len(df)} synthetic samples")
    print(f"   Crops: {df['crop_type'].unique()}")
    print(f"   Tasks: {df['task'].unique()}")
    
    return df

def load_real_data():
    """Try to load real data from database"""
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # Check for crop_data table
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='crop_data';")
        if cursor.fetchone():
            # Load crop data
            crop_df = pd.read_sql("SELECT * FROM crop_data", conn)
            print(f"✅ Loaded {len(crop_df)} records from crop_data")
            
            # Normalize crop names to lowercase
            if 'crop_type' in crop_df.columns:
                crop_df['crop_type'] = crop_df['crop_type'].str.lower()
            
            # Normalize growth stages
            if 'growth_stage' in crop_df.columns:
                crop_df['growth_stage'] = crop_df['growth_stage'].apply(normalize_stage)
            
            # Check if we have task column
            task_cols = [col for col in crop_df.columns if 'task' in col.lower() or 'action' in col.lower()]
            
            if task_cols:
                task_col = task_cols[0]
                crop_df['task'] = crop_df[task_col]
                print(f"✅ Using task column: {task_col}")
            else:
                # Create synthetic tasks
                print("⚠️ No task column found, creating synthetic tasks...")
                crop_df['task'] = 'Fertilization'  # Default task
                
                # Assign tasks based on conditions
                for idx, row in crop_df.iterrows():
                    crop = str(row.get('crop_type', '')).lower()
                    stage = row.get('growth_stage', 'vegetative')
                    temp = row.get('air_temperature_c', 25)
                    
                    if 'rice' in crop and stage == 'vegetative':
                        crop_df.at[idx, 'task'] = 'Irrigation'
                    elif 'wheat' in crop and stage == 'flowering':
                        crop_df.at[idx, 'task'] = 'Pest_Control'
                    elif 'tomato' in crop and temp > 28:
                        crop_df.at[idx, 'task'] = 'Irrigation'
            
            # Select needed columns
            needed_cols = ['crop_type', 'growth_stage', 'soil_ph', 
                          'air_temperature_c', 'relative_humidity_pct', 'task']
            
            available_cols = [col for col in needed_cols if col in crop_df.columns]
            df = crop_df[available_cols].copy()
            
            # Fill missing numeric values
            numeric_cols = ['soil_ph', 'air_temperature_c', 'relative_humidity_pct']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = df[col].fillna(df[col].median())
            
            print(f"✅ Prepared {len(df)} real data samples")
            return df
            
        else:
            print("❌ crop_data table not found")
            return None
            
    except Exception as e:
        print(f"❌ Error loading real data: {e}")
        return None
    finally:
        if 'conn' in locals():
            conn.close()

def train_decision_tree_fixed():
    """Train Decision Tree model with better error handling"""
    
    os.makedirs("models", exist_ok=True)
    
    print("="*60)
    print("🌱 DECISION TREE TRAINING (FIXED VERSION)")
    print("="*60)
    
    # Try to load real data first
    df = load_real_data()
    
    # If no real data or very little, use synthetic data
    if df is None or len(df) < 10:
        print("\n⚠️ Insufficient real data, using synthetic data...")
        df = create_synthetic_task_data()
    else:
        print(f"\n✅ Using real data with {len(df)} samples")
    
    print(f"\n📋 DATASET INFO:")
    print(f"   Total samples: {len(df)}")
    print(f"   Features: {list(df.columns)}")
    
    # Show crop distribution
    print(f"\n🌱 CROP DISTRIBUTION:")
    crop_counts = df['crop_type'].value_counts()
    for crop, count in crop_counts.items():
        print(f"   {crop}: {count} samples ({count/len(df)*100:.1f}%)")
    
    # Show task distribution
    print(f"\n📝 TASK DISTRIBUTION:")
    task_counts = df['task'].value_counts()
    for task, count in task_counts.items():
        print(f"   {task}: {count} samples ({count/len(df)*100:.1f}%)")
    
    # Prepare features and target
    X = df[['crop_type', 'growth_stage', 'soil_ph', 
            'air_temperature_c', 'relative_humidity_pct']].copy()
    y = df['task']
    
    # Encode categorical features - VERY IMPORTANT: Save what we encode!
    print(f"\n🔤 ENCODING FEATURES...")
    task_encoders = {}
    
    # Encode crop_type
    crop_encoder = LabelEncoder()
    X['crop_type'] = crop_encoder.fit_transform(X['crop_type'])
    task_encoders['task_crop_type_encoder'] = crop_encoder
    print(f"   Crops encoded: {list(crop_encoder.classes_)}")
    
    # Encode growth_stage
    stage_encoder = LabelEncoder()
    X['growth_stage'] = stage_encoder.fit_transform(X['growth_stage'])
    task_encoders['task_growth_stage_encoder'] = stage_encoder
    print(f"   Stages encoded: {list(stage_encoder.classes_)}")
    
    # Encode target (tasks)
    task_target_encoder = LabelEncoder()
    y_encoded = task_target_encoder.fit_transform(y)
    task_encoders['task_target_encoder'] = task_target_encoder
    print(f"   Tasks encoded: {list(task_target_encoder.classes_)}")
    
    # Split data
    print(f"\n📊 SPLITTING DATA...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    print(f"   Training samples: {len(X_train)}")
    print(f"   Testing samples: {len(X_test)}")
    
    # Train Decision Tree
    print(f"\n🏗️  TRAINING DECISION TREE...")
    dt = DecisionTreeClassifier(
        max_depth=6,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42
    )
    dt.fit(X_train, y_train)
    
    # Evaluate
    y_pred = dt.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n📈 EVALUATION RESULTS:")
    print(f"   Accuracy: {accuracy:.4f}")
    print(f"\n📋 Classification Report:")
    print(classification_report(y_test, y_pred, 
                                target_names=task_target_encoder.classes_))
    
    # Save everything
    print(f"\n💾 SAVING MODELS...")
    joblib.dump(dt, "models/dt_task.pkl")
    joblib.dump(task_encoders, "models/task_encoders.pkl")
    joblib.dump(list(X.columns), "models/dt_feature_names.pkl")
    
    # Create and save training summary
    training_summary = {
        'crops_trained': list(crop_encoder.classes_),
        'stages_trained': list(stage_encoder.classes_),
        'tasks_trained': list(task_target_encoder.classes_),
        'accuracy': accuracy,
        'n_samples': len(df),
        'feature_names': list(X.columns)
    }
    joblib.dump(training_summary, "models/task_training_summary.pkl")
    
    print(f"\n✅ TRAINING COMPLETE!")
    print(f"   Models saved to 'models/' folder")
    print(f"   Crops available: {len(crop_encoder.classes_)}")
    print(f"   Tasks available: {len(task_target_encoder.classes_)}")
    
    # Quick test to verify
    print(f"\n🧪 QUICK VERIFICATION TEST:")
    test_crops = ['rice', 'wheat', 'tomato', 'maize']
    for crop in test_crops:
        if crop in crop_encoder.classes_:
            print(f"   ✓ '{crop}' is available for predictions")
        else:
            print(f"   ✗ '{crop}' NOT available (was not in training data)")
    
    return dt, task_encoders

if __name__ == "__main__":
    train_decision_tree_fixed()