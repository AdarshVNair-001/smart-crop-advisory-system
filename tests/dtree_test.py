# quick_fix_test.py
import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings('ignore')

def quick_test():
    """Quick test that creates and tests a simple model"""
    
    print("="*60)
    print("🚀 QUICK DECISION TREE TEST")
    print("="*60)
    
    from sklearn.tree import DecisionTreeClassifier
    from sklearn.preprocessing import LabelEncoder
    
    # Create simple synthetic data with common crops
    print("🔧 Creating simple training data...")
    
    data = []
    crops = ['rice', 'wheat', 'tomato', 'maize']
    stages = ['vegetative', 'flowering']
    
    for crop in crops:
        for stage in stages:
            for i in range(5):  # 5 samples per combination
                # Simple rule-based task assignment
                if crop == 'rice' and stage == 'vegetative':
                    task = 'Irrigation'
                elif crop == 'wheat' and stage == 'flowering':
                    task = 'Fertilization'
                elif crop == 'tomato':
                    task = 'Pest_Control'
                else:
                    task = 'Weed_Control'
                
                data.append({
                    'crop_type': crop,
                    'growth_stage': stage,
                    'soil_ph': np.random.uniform(5.5, 7.5),
                    'air_temperature_c': np.random.uniform(20, 30),
                    'relative_humidity_pct': np.random.uniform(50, 80),
                    'task': task
                })
    
    df = pd.DataFrame(data)
    print(f"✅ Created {len(df)} training samples")
    print(f"   Crops: {df['crop_type'].unique()}")
    print(f"   Tasks: {df['task'].unique()}")
    
    # Train a quick model
    print(f"\n🏗️  Training quick model...")
    
    X = df[['crop_type', 'growth_stage', 'soil_ph', 
            'air_temperature_c', 'relative_humidity_pct']].copy()
    y = df['task']
    
    # Encode
    crop_encoder = LabelEncoder()
    stage_encoder = LabelEncoder()
    task_encoder = LabelEncoder()
    
    X['crop_type'] = crop_encoder.fit_transform(X['crop_type'])
    X['growth_stage'] = stage_encoder.fit_transform(X['growth_stage'])
    y_encoded = task_encoder.fit_transform(y)
    
    # Train
    dt = DecisionTreeClassifier(max_depth=4, random_state=42)
    dt.fit(X, y_encoded)
    
    # Save (for later use)
    os.makedirs("models", exist_ok=True)
    
    task_encoders = {
        'task_crop_type_encoder': crop_encoder,
        'task_growth_stage_encoder': stage_encoder,
        'task_target_encoder': task_encoder
    }
    
    joblib.dump(dt, "models/dt_task_quick.pkl")
    joblib.dump(task_encoders, "models/task_encoders_quick.pkl")
    joblib.dump(list(X.columns), "models/dt_feature_names_quick.pkl")
    
    print(f"\n✅ Quick model saved!")
    print(f"   Crops trained: {list(crop_encoder.classes_)}")
    print(f"   Tasks available: {list(task_encoder.classes_)}")
    
    # Test with common crops
    print(f"\n🧪 TESTING WITH COMMON CROPS:")
    
    test_cases = [
        ('rice', 'vegetative', 6.5, 28, 75),
        ('wheat', 'flowering', 7.0, 22, 65),
        ('tomato', 'vegetative', 6.2, 26, 60),
        ('maize', 'flowering', 6.8, 30, 70)
    ]
    
    for crop, stage, ph, temp, humidity in test_cases:
        try:
            # Prepare input
            input_df = pd.DataFrame([{
                'crop_type': crop,
                'growth_stage': stage,
                'soil_ph': ph,
                'air_temperature_c': temp,
                'relative_humidity_pct': humidity
            }])
            
            # Encode
            input_df['crop_type'] = crop_encoder.transform(input_df['crop_type'])
            input_df['growth_stage'] = stage_encoder.transform(input_df['growth_stage'])
            
            # Predict
            pred = dt.predict(input_df)[0]
            task = task_encoder.inverse_transform([pred])[0]
            proba = dt.predict_proba(input_df)[0][pred]
            
            print(f"\n🌱 {crop.title()} ({stage}):")
            print(f"   pH: {ph}, Temp: {temp}°C, Humidity: {humidity}%")
            print(f"   → Task: {task} ({proba:.1%})")
            
        except Exception as e:
            print(f"\n❌ Error with {crop}: {e}")

if __name__ == "__main__":
    import os
    quick_test()