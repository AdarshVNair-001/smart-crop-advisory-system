# test_random_forest_complete.py
import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings('ignore')

def test_random_forest_model():
    """Test the trained Random Forest model"""
    
    print("="*60)
    print("🧪 SMART CROP - FERTILIZER RECOMMENDER TEST")
    print("="*60)
    
    # Load the trained model and components
    try:
        print("📂 Loading trained models...")
        rf_model = joblib.load("models/rf_fertilizer.pkl")
        fert_encoders = joblib.load("models/fert_encoders.pkl")
        fert_target_encoder = joblib.load("models/fert_target_encoder.pkl")
        rf_features = joblib.load("models/rf_feature_names.pkl")
        training_summary = joblib.load("models/training_summary.pkl")
        
        print("✅ Models loaded successfully!\n")
        
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        print("\n💡 Please run the training script first:")
        print("   python train_random_forest_complete.py")
        return
    
    # Display training summary
    print("📊 TRAINING SUMMARY:")
    print(f"   Samples trained on: {training_summary['n_samples']}")
    print(f"   Features used: {training_summary['n_features']}")
    print(f"   Fertilizers available: {training_summary['n_fertilizers']}")
    print(f"   Test accuracy: {training_summary['accuracy']:.4f}")
    
    # Show available options
    print("\n🌱 AVAILABLE OPTIONS:")
    print("-"*40)
    
    # Show available crops
    if 'crops' in training_summary:
        crops = training_summary['crops']
        print(f"Crops ({len(crops)}): {', '.join(crops)}")
    
    # Show available growth stages
    if 'growth_stages' in training_summary:
        stages = training_summary['growth_stages']
        print(f"Growth Stages ({len(stages)}): {', '.join(stages)}")
    
    # Show available nutrients
    if 'nutrients' in training_summary:
        nutrients = training_summary['nutrients']
        print(f"Target Nutrients ({len(nutrients)}): {', '.join(nutrients)}")
    
    # Show available forms
    if 'forms' in training_summary:
        forms = training_summary['forms']
        print(f"Forms ({len(forms)}): {', '.join(forms)}")
    
    # Show some fertilizers
    if 'fertilizers' in training_summary:
        ferts = training_summary['fertilizers']
        print(f"\nFertilizers (showing first 10 of {len(ferts)}):")
        for i, fert in enumerate(ferts[:10], 1):
            print(f"   {i:2d}. {fert}")
        if len(ferts) > 10:
            print(f"   ... and {len(ferts) - 10} more")
    
    # Create a test sample using available data
    print("\n" + "="*40)
    print("🧪 TESTING WITH SAMPLE DATA")
    print("="*40)
    
    # Get the first available crop for testing
    crop_encoder = fert_encoders['fert_crop_type_encoder']
    stage_encoder = fert_encoders['fert_growth_stage_encoder']
    nutrient_encoder = fert_encoders['fert_Target_Nutrient_encoder']
    form_encoder = fert_encoders['fert_Form_encoder']
    
    test_sample = {
        "crop_type": crop_encoder.classes_[0],  # First available crop
        "growth_stage": stage_encoder.classes_[0],  # First available stage
        "Target_Nutrient": nutrient_encoder.classes_[0],  # First available nutrient
        "Form": form_encoder.classes_[0],  # First available form
        "soil_ph": 6.5,
        "relative_humidity_pct": 70,
        "air_temperature_c": 25
    }
    
    print("\n📝 TEST INPUT:")
    for key, value in test_sample.items():
        if key == 'soil_ph':
            print(f"   Soil pH: {value}")
        elif key == 'relative_humidity_pct':
            print(f"   Relative Humidity: {value}%")
        elif key == 'air_temperature_c':
            print(f"   Air Temperature: {value}°C")
        else:
            print(f"   {key.replace('_', ' ').title()}: {value}")
    
    try:
        # Prepare the sample for prediction
        df_sample = pd.DataFrame([test_sample])
        
        # Encode categorical features
        for col in ['crop_type', 'growth_stage', 'Target_Nutrient', 'Form']:
            encoder_key = f"fert_{col}_encoder"
            if encoder_key in fert_encoders:
                encoder = fert_encoders[encoder_key]
                value = df_sample[col].iloc[0]
                df_sample[col] = encoder.transform([value])
        
        # Ensure correct column order
        df_sample = df_sample[rf_features]
        
        # Make prediction
        prediction_encoded = rf_model.predict(df_sample)[0]
        predicted_fertilizer = fert_target_encoder.inverse_transform([prediction_encoded])[0]
        
        # Get probabilities
        probabilities = rf_model.predict_proba(df_sample)[0]
        confidence = max(probabilities)
        
        print("\n" + "="*40)
        print("🎯 PREDICTION RESULTS")
        print("="*40)
        
        print(f"\n⭐ RECOMMENDED FERTILIZER:")
        print(f"   {predicted_fertilizer}")
        print(f"   Confidence: {confidence:.2%}")
        
        # Show top 5 recommendations
        print(f"\n🏆 TOP 5 RECOMMENDATIONS:")
        top_5_idx = probabilities.argsort()[-5:][::-1]
        for rank, idx in enumerate(top_5_idx, 1):
            fertilizer = fert_target_encoder.classes_[idx]
            prob = probabilities[idx]
            if rank == 1:
                print(f"   {rank}. {fertilizer:40s} ⭐ ({prob:.2%})")
            else:
                print(f"   {rank}. {fertilizer:40s} ({prob:.2%})")
        
        # Show feature importance for this specific prediction
        print(f"\n🔍 DECISION FACTORS (Feature Importance):")
        feature_importance = rf_model.feature_importances_
        
        for i, (feature, importance) in enumerate(zip(rf_features, feature_importance)):
            if importance > 0.05:  # Only show important features
                # Get the actual value for this feature
                if feature in test_sample:
                    value = test_sample[feature]
                    print(f"   • {feature:25s}: {value:15s} (importance: {importance:.2%})")
                else:
                    print(f"   • {feature:25s}: (importance: {importance:.2%})")
        
        return {
            'success': True,
            'input': test_sample,
            'recommended_fertilizer': predicted_fertilizer,
            'confidence': confidence,
            'top_recommendations': [
                (fert_target_encoder.classes_[idx], probabilities[idx])
                for idx in top_5_idx
            ]
        }
        
    except Exception as e:
        print(f"\n❌ Error during prediction: {e}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}

if __name__ == "__main__":
    result = test_random_forest_model()
    if result and result.get('success'):
        print(f"\n✅ Test completed successfully!")
        print(f"\n📋 QUICK SUMMARY:")
        print(f"   Crop: {result['input']['crop_type']}")
        print(f"   Growth Stage: {result['input']['growth_stage']}")
        print(f"   Recommended Fertilizer: {result['recommended_fertilizer']}")
        print(f"   Confidence: {result['confidence']:.2%}")
    else:
        print(f"\n❌ Test failed!")