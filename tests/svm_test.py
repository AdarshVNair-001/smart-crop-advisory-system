# test_svm_complete.py
import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings('ignore')

def test_svm_model():
    """Test the trained SVM model for ambiguity resolution"""
    
    print("="*60)
    print("🧪 SMART CROP - AMBIGUITY RESOLUTION TEST (SVM)")
    print("="*60)
    
    # Load the trained model and components
    try:
        print("📂 Loading trained models...")
        svm_model = joblib.load("models/svm_decision.pkl")
        svm_scaler = joblib.load("models/svm_scaler.pkl")
        svm_features = joblib.load("models/svm_feature_names.pkl")
        training_summary = joblib.load("models/svm_training_summary.pkl")
        
        print("✅ Models loaded successfully!\n")
        
    except Exception as e:
        print(f"❌ Error loading models: {e}")
        print("\n💡 Please run the training script first:")
        print("   python train_svm_complete.py")
        return
    
    # Display training summary
    print("📊 TRAINING SUMMARY:")
    print(f"   Samples trained on: {training_summary['n_samples']}")
    print(f"   Features used: {training_summary['n_features']}")
    print(f"   Training accuracy: {training_summary['train_accuracy']:.4f}")
    print(f"   Testing accuracy: {training_summary['test_accuracy']:.4f}")
    print(f"   Kernel: {training_summary['svm_params']['kernel']}")
    print(f"   C parameter: {training_summary['svm_params']['C']}")
    
    # Show feature descriptions
    print("\n🔍 FEATURE DESCRIPTIONS:")
    feature_descriptions = {
        'rain_predicted': 'Is rain predicted? (1=Yes, 0=No)',
        'stage_sensitive': 'Is growth stage sensitive? (1=Yes, 0=No)',
        'ph_stress': 'Is there pH stress? (1=Yes, 0=No)',
        'temp_stress': 'Is there temperature stress? (1=Yes, 0=No)',
        'dt_flag': 'Decision Tree confidence flag (1=Confident, 0=Not confident)'
    }
    
    for feature in svm_features:
        desc = feature_descriptions.get(feature, 'No description')
        print(f"   • {feature}: {desc}")
    
    # Test scenarios
    print("\n" + "="*40)
    print("🧪 TESTING AMBIGUITY SCENARIOS")
    print("="*40)
    
    test_scenarios = [
        {
            "name": "Rain predicted during sensitive stage",
            "description": "Worst case - should definitely delay",
            "features": [1, 1, 0, 0, 1],  # Rain + sensitive
            "expected": 0  # Delay
        },
        {
            "name": "Perfect conditions",
            "description": "All clear - should proceed",
            "features": [0, 0, 0, 0, 1],  # All good
            "expected": 1  # Proceed
        },
        {
            "name": "Multiple stress factors",
            "description": "pH and temperature stress",
            "features": [0, 0, 1, 1, 1],  # pH + temp stress
            "expected": 0  # Delay
        },
        {
            "name": "DT not confident",
            "description": "Decision Tree needs more data",
            "features": [0, 0, 0, 0, 0],  # DT flag off
            "expected": 0  # Delay
        },
        {
            "name": "Rain but non-sensitive stage",
            "description": "Moderate risk",
            "features": [1, 0, 0, 0, 1],  # Rain only
            "expected": 1  # Proceed (with caution)
        },
        {
            "name": "Sensitive stage only",
            "description": "Stage requires careful handling",
            "features": [0, 1, 0, 0, 1],  # Sensitive only
            "expected": 0  # Delay
        }
    ]
    
    results = []
    
    for scenario in test_scenarios:
        print(f"\n📋 SCENARIO: {scenario['name']}")
        print("-" * 40)
        
        try:
            # Prepare the sample
            sample_array = np.array([scenario['features']])
            
            # Scale the features
            sample_scaled = svm_scaler.transform(sample_array)
            
            # Make prediction
            prediction = svm_model.predict(sample_scaled)[0]
            decision = "Delay ⚠️" if prediction == 0 else "Proceed ✅"
            
            # Get probabilities
            probabilities = svm_model.predict_proba(sample_scaled)[0]
            delay_prob = probabilities[0]
            proceed_prob = probabilities[1]
            confidence = probabilities[prediction]
            
            # Display feature values
            feature_values = {
                'rain_predicted': 'Yes 🌧️' if scenario['features'][0] == 1 else 'No ☀️',
                'stage_sensitive': 'Yes ⚠️' if scenario['features'][1] == 1 else 'No ✅',
                'ph_stress': 'Yes ⚠️' if scenario['features'][2] == 1 else 'No ✅',
                'temp_stress': 'Yes ⚠️' if scenario['features'][3] == 1 else 'No ✅',
                'dt_flag': 'Confident ✅' if scenario['features'][4] == 1 else 'Not confident ⚠️'
            }
            
            print(f"   Conditions:")
            for feature, value in feature_values.items():
                print(f"   • {feature}: {value}")
            
            print(f"\n   🎯 SVM Decision: {decision}")
            print(f"   📊 Confidence: {confidence:.2%}")
            
            print(f"\n   📈 Probability Breakdown:")
            print(f"      Delay: {delay_prob:.2%}")
            print(f"      Proceed: {proceed_prob:.2%}")
            
            # Check if matches expected
            if 'expected' in scenario:
                expected_text = "Delay" if scenario['expected'] == 0 else "Proceed"
                matches = prediction == scenario['expected']
                status = "✓" if matches else "✗"
                print(f"\n   ✅ Expected: {expected_text}")
                print(f"   📍 Match: {status}")
            
            # Provide reasoning
            print(f"\n   💡 Reasoning:")
            reasons = []
            if scenario['features'][0] == 1:
                reasons.append("Rain predicted")
            if scenario['features'][1] == 1:
                reasons.append("Growth stage is sensitive")
            if scenario['features'][2] == 1:
                reasons.append("pH stress detected")
            if scenario['features'][3] == 1:
                reasons.append("Temperature stress detected")
            if scenario['features'][4] == 0:
                reasons.append("Decision Tree not confident")
            
            if reasons and prediction == 0:
                print(f"      Delay recommended because: {', '.join(reasons)}")
            elif not reasons and prediction == 1:
                print(f"      Proceed - All conditions favorable")
            elif prediction == 1:
                print(f"      Proceed - Risks are manageable")
            
            results.append({
                'scenario': scenario['name'],
                'decision': decision,
                'confidence': confidence,
                'delay_prob': delay_prob,
                'proceed_prob': proceed_prob
            })
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    # Summary
    if results:
        print("\n" + "="*40)
        print("📊 TEST SUMMARY")
        print("="*40)
        
        delays = sum(1 for r in results if "Delay" in r['decision'])
        proceeds = len(results) - delays
        
        print(f"\n   Total scenarios tested: {len(results)}")
        print(f"   Delay decisions: {delays}")
        print(f"   Proceed decisions: {proceeds}")
        
        print(f"\n   Scenario-wise decisions:")
        for result in results:
            print(f"   • {result['scenario']}: {result['decision']} ({result['confidence']:.2%})")
    
    print(f"\n✅ SVM testing completed successfully!")
    return results

if __name__ == "__main__":
    test_svm_model()