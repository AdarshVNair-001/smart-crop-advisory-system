# train_svm_complete.py
import pandas as pd
import numpy as np
import joblib
import sqlite3
import os
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from imblearn.over_sampling import SMOTE  # For handling class imbalance
import warnings
warnings.filterwarnings('ignore')

def create_ambiguity_dataset():
    """Create ambiguity resolution dataset"""
    
    print("📊 Creating ambiguity resolution dataset...")
    
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.path.join(BASE_DIR, "smart_crop.db")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # Check for ambiguity/decision data
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        
        # Look for decision/ambiguity related tables
        decision_tables = [t for t in tables if 'decision' in t.lower() or 
                          'ambiguity' in t.lower() or 'svm' in t.lower()]
        
        if decision_tables:
            # Load from existing decision table
            table_name = decision_tables[0]
            df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
            print(f"✅ Loaded {len(df)} records from '{table_name}'")
            
        else:
            # Create synthetic ambiguity dataset based on agricultural conditions
            print("⚠️ No decision table found, creating synthetic ambiguity dataset...")
            df = create_synthetic_ambiguity_data()
        
        conn.close()
        return df
        
    except Exception as e:
        print(f"❌ Error creating dataset: {e}")
        import traceback
        traceback.print_exc()
        return None

def create_synthetic_ambiguity_data():
    """Create synthetic ambiguity resolution data"""
    
    print("🔧 Creating synthetic ambiguity dataset...")
    
    # Define features for ambiguity resolution
    # These are typical conditions that create ambiguity in agricultural decisions
    
    data = []
    
    # Common ambiguity scenarios in agriculture
    scenarios = [
        # Rain predicted + sensitive stage = Delay
        {'rain_predicted': 1, 'stage_sensitive': 1, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 0},  # Delay
         
        # No rain + non-sensitive + no stress = Proceed
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 1},  # Proceed
         
        # Multiple stress factors = Delay
        {'rain_predicted': 0, 'stage_sensitive': 1, 'ph_stress': 1, 
         'temp_stress': 1, 'dt_flag': 1, 'decision': 0},  # Delay
         
        # Rain but non-sensitive stage = Proceed (with caution)
        {'rain_predicted': 1, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 1},  # Proceed
         
        # DT flag off = Delay (wait for decision tree)
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 0, 'decision': 0},  # Delay
         
        # Temperature stress only = Delay
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 1, 'dt_flag': 1, 'decision': 0},  # Delay
         
        # pH stress only = Delay
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 1, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 0},  # Delay
    ]
    
    # Expand dataset with variations
    for scenario in scenarios:
        # Add the base scenario
        data.append(scenario)
        
        # Add variations with slight changes
        for i in range(3):  # 3 variations per base scenario
            variation = scenario.copy()
            
            # Add some randomness
            if np.random.random() < 0.3:
                # Flip one feature
                feature = np.random.choice(['rain_predicted', 'stage_sensitive', 
                                          'ph_stress', 'temp_stress', 'dt_flag'])
                variation[feature] = 1 - variation[feature]
                
                # Update decision based on new conditions
                variation['decision'] = determine_decision(variation)
            
            data.append(variation)
    
    # Add more diverse scenarios
    additional_scenarios = [
        # Edge cases
        {'rain_predicted': 1, 'stage_sensitive': 1, 'ph_stress': 1, 
         'temp_stress': 1, 'dt_flag': 1, 'decision': 0},  # All bad = Delay
         
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 0, 'decision': 0},  # DT off = Delay
         
        {'rain_predicted': 0, 'stage_sensitive': 1, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 0},  # Sensitive stage = Delay
         
        {'rain_predicted': 1, 'stage_sensitive': 0, 'ph_stress': 1, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 0},  # Rain + pH stress = Delay
         
        # Favorable conditions
        {'rain_predicted': 0, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 1},  # All good = Proceed
         
        {'rain_predicted': 1, 'stage_sensitive': 0, 'ph_stress': 0, 
         'temp_stress': 0, 'dt_flag': 1, 'decision': 1},  # Rain but okay = Proceed
    ]
    
    data.extend(additional_scenarios)
    
    df = pd.DataFrame(data)
    
    # Remove duplicates
    df = df.drop_duplicates()
    
    print(f"✅ Created {len(df)} synthetic ambiguity samples")
    print(f"   Features: {list(df.columns)}")
    print(f"   Decision distribution:")
    print(f"     Delay (0): {len(df[df['decision'] == 0])} samples")
    print(f"     Proceed (1): {len(df[df['decision'] == 1])} samples")
    
    return df

def determine_decision(scenario):
    """Determine decision based on conditions"""
    # Rule-based decision making
    delay_factors = 0
    
    # Factors that suggest delay
    if scenario['rain_predicted'] == 1:
        delay_factors += 1
    if scenario['stage_sensitive'] == 1:
        delay_factors += 1
    if scenario['ph_stress'] == 1:
        delay_factors += 1
    if scenario['temp_stress'] == 1:
        delay_factors += 1
    if scenario['dt_flag'] == 0:  # DT not confident
        delay_factors += 2
    
    # Decision rule: If 2 or more delay factors, delay
    if delay_factors >= 2:
        return 0  # Delay
    else:
        return 1  # Proceed

def train_svm_model():
    """Train SVM model for ambiguity resolution"""
    
    os.makedirs("models", exist_ok=True)
    
    print("="*60)
    print("🌱 SMART CROP - AMBIGUITY RESOLUTION SYSTEM (SVM)")
    print("="*60)
    
    # Step 1: Create ambiguity dataset
    df = create_ambiguity_dataset()
    if df is None or len(df) == 0:
        print("❌ No data available for training")
        return
    
    print("\n📋 DATASET SUMMARY:")
    print(f"   Total samples: {len(df)}")
    print(f"   Features: {df.shape[1] - 1}")  # Excluding target
    
    # Show data preview
    print("\n📊 DATA PREVIEW:")
    print(df.head())
    
    # Check for required columns
    required_features = ['rain_predicted', 'stage_sensitive', 'ph_stress', 
                        'temp_stress', 'dt_flag', 'decision']
    
    missing_cols = [col for col in required_features if col not in df.columns]
    if missing_cols:
        print(f"❌ Missing columns: {missing_cols}")
        print("Creating dataset with required columns...")
        df = create_synthetic_ambiguity_data()
    
    # Prepare features and target
    print("\n🎯 PREPARING FEATURES AND TARGET:")
    feature_cols = ['rain_predicted', 'stage_sensitive', 'ph_stress', 
                   'temp_stress', 'dt_flag']
    
    X = df[feature_cols].copy()
    y = df['decision']
    
    # Check class distribution
    print(f"\n📈 CLASS DISTRIBUTION:")
    class_counts = y.value_counts()
    for val, count in class_counts.items():
        decision = "Delay" if val == 0 else "Proceed"
        percentage = count / len(y) * 100
        print(f"   {decision}: {count} samples ({percentage:.1f}%)")
    
    # Handle class imbalance if necessary
    if abs(class_counts[0] - class_counts[1]) > len(y) * 0.3:  # If imbalance > 30%
        print("\n⚠️  Class imbalance detected, applying SMOTE...")
        try:
            smote = SMOTE(random_state=42)
            X_resampled, y_resampled = smote.fit_resample(X, y)
            print(f"   After SMOTE: {len(X_resampled)} samples")
            print(f"   Class distribution: {pd.Series(y_resampled).value_counts().to_dict()}")
            X, y = X_resampled, y_resampled
        except Exception as e:
            print(f"   SMOTE failed: {e}, proceeding with original data")
    
    # Split data
    print("\n📊 SPLITTING DATA:")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.2, 
        random_state=42,
        stratify=y,
        shuffle=True
    )
    
    print(f"   Training samples: {len(X_train)}")
    print(f"   Testing samples: {len(X_test)}")
    
    # Scale features (VERY IMPORTANT for SVM)
    print("\n⚖️  SCALING FEATURES (for SVM)...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("   ✓ Features scaled to mean=0, std=1")
    
    # Train SVM model
    print("\n🏗️  TRAINING SVM MODEL...")
    print("   This may take a moment...")
    
    svm = SVC(
        kernel='linear',      # Linear kernel for interpretability
        C=1.0,                # Regularization parameter
        probability=True,     # Enable probability estimates
        random_state=42,
        class_weight='balanced'  # Handle class imbalance
    )
    
    svm.fit(X_train_scaled, y_train)
    
    # Evaluate the model
    print("\n📈 MODEL EVALUATION:")
    
    # Training accuracy
    y_train_pred = svm.predict(X_train_scaled)
    train_accuracy = accuracy_score(y_train, y_train_pred)
    print(f"   Training Accuracy: {train_accuracy:.4f}")
    
    # Testing accuracy
    y_test_pred = svm.predict(X_test_scaled)
    test_accuracy = accuracy_score(y_test, y_test_pred)
    print(f"   Testing Accuracy: {test_accuracy:.4f}")
    
    print("\n📋 CLASSIFICATION REPORT:")
    print(classification_report(y_test, y_test_pred, 
                                target_names=['Delay', 'Proceed']))
    
    # Confusion Matrix
    print("\n🎯 CONFUSION MATRIX:")
    cm = confusion_matrix(y_test, y_test_pred)
    print(f"   True Negatives (Delay->Delay): {cm[0,0]}")
    print(f"   False Positives (Delay->Proceed): {cm[0,1]}")
    print(f"   False Negatives (Proceed->Delay): {cm[1,0]}")
    print(f"   True Positives (Proceed->Proceed): {cm[1,1]}")
    
    # Feature importance (for linear kernel)
    print("\n🔍 FEATURE IMPORTANCE (Linear Coefficients):")
    if svm.kernel == 'linear':
        feature_importance = pd.DataFrame({
            'feature': feature_cols,
            'coefficient': svm.coef_[0],
            'abs_coefficient': abs(svm.coef_[0])
        }).sort_values('abs_coefficient', ascending=False)
        
        print(feature_importance)
        
        # Interpretation
        print("\n💡 INTERPRETATION:")
        for _, row in feature_importance.iterrows():
            feature = row['feature']
            coef = row['coefficient']
            if coef > 0:
                print(f"   • {feature}: Increases 'Proceed' likelihood")
            else:
                print(f"   • {feature}: Increases 'Delay' likelihood")
    
    # Save the model and scaler
    print("\n💾 SAVING MODELS...")
    
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    
    joblib.dump(svm, "models/svm_decision.pkl")
    joblib.dump(scaler, "models/svm_scaler.pkl")
    joblib.dump(feature_cols, "models/svm_feature_names.pkl")
    
    # Save training summary
    training_summary = {
        'n_samples': len(df),
        'n_features': len(feature_cols),
        'train_accuracy': train_accuracy,
        'test_accuracy': test_accuracy,
        'feature_names': feature_cols,
        'class_distribution': {
            'Delay': int(class_counts.get(0, 0)),
            'Proceed': int(class_counts.get(1, 0))
        },
        'svm_params': {
            'kernel': svm.kernel,
            'C': svm.C,
            'class_weight': svm.class_weight
        }
    }
    joblib.dump(training_summary, "models/svm_training_summary.pkl")
    
    print("\n✅ FILES SAVED TO 'models/' FOLDER:")
    print("   • svm_decision.pkl - SVM model")
    print("   • svm_scaler.pkl - Feature scaler")
    print("   • svm_feature_names.pkl - Feature names")
    print("   • svm_training_summary.pkl - Training summary")
    
    print("\n📊 FINAL STATISTICS:")
    print(f"   Total samples: {training_summary['n_samples']}")
    print(f"   Features used: {training_summary['n_features']}")
    print(f"   Training accuracy: {training_summary['train_accuracy']:.4f}")
    print(f"   Testing accuracy: {training_summary['test_accuracy']:.4f}")
    print(f"   Delay samples: {training_summary['class_distribution']['Delay']}")
    print(f"   Proceed samples: {training_summary['class_distribution']['Proceed']}")
    
    # Quick verification
    print("\n🧪 QUICK VERIFICATION TEST:")
    test_samples = [
        [1, 1, 0, 0, 1],  # Rain + sensitive stage
        [0, 0, 0, 0, 1],  # All clear
        [0, 0, 1, 1, 1],  # Multiple stresses
    ]
    
    for i, sample in enumerate(test_samples, 1):
        sample_scaled = scaler.transform([sample])
        prediction = svm.predict(sample_scaled)[0]
        probability = svm.predict_proba(sample_scaled)[0][prediction]
        decision = "Delay" if prediction == 0 else "Proceed"
        
        print(f"\n   Test {i}:")
        print(f"      Features: Rain={sample[0]}, Sensitive={sample[1]}, pH={sample[2]}, Temp={sample[3]}, DT={sample[4]}")
        print(f"      Decision: {decision}")
        print(f"      Confidence: {probability:.2%}")
    
    print("\n🎉 SVM TRAINING COMPLETED SUCCESSFULLY!")
    print("="*60)
    
    return svm, scaler

if __name__ == "__main__":
    train_svm_model()