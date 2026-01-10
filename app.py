from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
import json
import os
from dotenv import load_dotenv

load_dotenv()

# --- Keras model for image-based pest/disease detection (H5) ---
try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.image import img_to_array
    from PIL import Image
    import io
except Exception:
    # If imports fail, we'll handle at runtime when endpoint is called
    load_model = None
    img_to_array = None
    Image = None
    io = None

# Global holder for the Keras model and labels
crop_model = None
class_labels = []

def initialize_keras_model():
    global crop_model, class_labels
    model_path = os.path.join('models', 'crop_disease_pest_model.h5')
    dataset_dir = os.path.join('dataset')
    try:
        if load_model and os.path.exists(model_path):
            crop_model = load_model(model_path)
            print('✅ Keras H5 model loaded from', model_path)
        else:
            print('Keras load_model not available or model file missing:', model_path)

        # Build class labels from dataset folder structure if available
        if os.path.isdir(dataset_dir):
            class_labels = sorted([d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))])
            print('Detected class labels:', class_labels)
        else:
            class_labels = []
    except Exception as e:
        print('Failed to initialize Keras model:', e)
        crop_model = None
        class_labels = []

# Initialize model at startup (best-effort)
initialize_keras_model()

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///smart_crop_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# ============================================
# LOAD ML MODELS FROM PICKLE FILES
# ============================================

class MLModelManager:
    def __init__(self):
        self.random_forest_model = None
        self.rf_features = None
        self.fertilizer_encoder = None
        self.decision_tree_model = None
        self.dt_features = None
        self.dt_task_encoder = None
        self.svm_model = None
        self.svm_features = None
        self.svm_scaler = None
        
        self.load_all_models()
    
    def load_all_models(self):
        """Load all pickle models"""
        try:
            # Load Random Forest fertilizer model
            rf_path = os.path.join('models', 'rf_fertilizer.pkl')
            rf_features_path = os.path.join('models', 'rf_feature_names.pkl')
            fert_encoder_path = os.path.join('models', 'fertilizer_encoder.pkl')
            
            if os.path.exists(rf_path):
                self.random_forest_model = joblib.load(rf_path)
                print("✅ Random Forest fertilizer model loaded")
            if os.path.exists(rf_features_path):
                self.rf_features = joblib.load(rf_features_path)
                print("✅ Random Forest features loaded")
            if os.path.exists(fert_encoder_path):
                self.fertilizer_encoder = joblib.load(fert_encoder_path)
                print("✅ Fertilizer encoder loaded")
            
            # Load Decision Tree task model
            dt_path = os.path.join('models', 'dt_task.pkl')
            dt_features_path = os.path.join('models', 'dt_feature_names.pkl')
            task_encoder_path = os.path.join('models', 'task_encoders.pkl')
            
            if os.path.exists(dt_path):
                self.decision_tree_model = joblib.load(dt_path)
                print("✅ Decision Tree task model loaded")
            if os.path.exists(dt_features_path):
                self.dt_features = joblib.load(dt_features_path)
                print("✅ Decision Tree features loaded")
            if os.path.exists(task_encoder_path):
                self.dt_task_encoder = joblib.load(task_encoder_path)
                print("✅ Task encoder loaded")
            
            # Load SVM model
            svm_path = os.path.join('models', 'svm_decision.pkl')
            svm_features_path = os.path.join('models', 'svm_feature_names.pkl')
            svm_scaler_path = os.path.join('models', 'svm_scaler.pkl')
            
            if os.path.exists(svm_path):
                self.svm_model = joblib.load(svm_path)
                print("✅ SVM model loaded")
            if os.path.exists(svm_features_path):
                self.svm_features = joblib.load(svm_features_path)
                print("✅ SVM features loaded")
            if os.path.exists(svm_scaler_path):
                self.svm_scaler = joblib.load(svm_scaler_path)
                print("✅ SVM scaler loaded")
                
            print("✅ All ML models loaded successfully!")
            
        except Exception as e:
            print(f"❌ Error loading ML models: {e}")

# Initialize ML models
ml_models = MLModelManager()

# ============================================
# DATABASE MODELS (SENSOR-FREE VERSION)
# ============================================

class User(db.Model):
    __tablename__ = 'users'
    user_id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    location_lat = db.Column(db.Float)
    location_lon = db.Column(db.Float)
    location_name = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    crops = db.relationship('UserCrop', backref='user', lazy=True)
    actions = db.relationship('UserAction', backref='user', lazy=True)

class CropMaster(db.Model):
    __tablename__ = 'crops_master'
    crop_id = db.Column(db.Integer, primary_key=True)
    crop_type = db.Column(db.String(50), unique=True, nullable=False)
    ideal_temperature_c = db.Column(db.Float)
    ideal_soil_ph = db.Column(db.Float)
    water_need_l_per_week = db.Column(db.Integer)
    total_growth_days = db.Column(db.Integer)
    min_nitrogen_ppm = db.Column(db.Integer)
    max_nitrogen_ppm = db.Column(db.Integer)
    min_phosphorus_ppm = db.Column(db.Integer)
    max_phosphorus_ppm = db.Column(db.Integer)
    min_potassium_ppm = db.Column(db.Integer)
    max_potassium_ppm = db.Column(db.Integer)
    
    milestones = db.relationship('GrowthMilestone', backref='crop', lazy=True)

class UserCrop(db.Model):
    __tablename__ = 'user_crops'
    planting_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    crop_type = db.Column(db.String(50), nullable=False)
    planting_date = db.Column(db.Date, nullable=False)
    expected_harvest_date = db.Column(db.Date)
    current_growth_stage = db.Column(db.String(50), default='seedling')
    ndvi_value = db.Column(db.Float, default=0.5)
    disease_detected = db.Column(db.Boolean, default=False)
    pest_pressure_level = db.Column(db.Enum('low', 'medium', 'high'), default='low')
    growth_progress = db.Column(db.Float, default=0.0)  # 0-100%
    days_elapsed = db.Column(db.Integer, default=0)
    days_remaining = db.Column(db.Integer)
    is_active = db.Column(db.Boolean, default=True)
    last_observation_date = db.Column(db.Date)
    health_score = db.Column(db.Float, default=100.0)  # 0-100
    
    observations = db.relationship('ManualObservation', backref='crop', lazy=True)
    recommendations = db.relationship('Recommendation', backref='crop', lazy=True)
    image_analyses = db.relationship('ImageAnalysis', backref='crop', lazy=True)
    actions = db.relationship('UserAction', backref='crop', lazy=True)

# MANUAL OBSERVATIONS instead of sensor readings
class ManualObservation(db.Model):
    __tablename__ = 'manual_observations'
    observation_id = db.Column(db.Integer, primary_key=True)
    planting_id = db.Column(db.Integer, db.ForeignKey('user_crops.planting_id'), nullable=False)
    observation_date = db.Column(db.Date, nullable=False)
    observation_type = db.Column(db.Enum('visual', 'measurement', 'image_analysis'))
    
    # Visual observations (no sensors needed)
    visual_health = db.Column(db.Enum('excellent', 'good', 'fair', 'poor'))
    pest_presence = db.Column(db.Enum('none', 'low', 'medium', 'high'))
    disease_symptoms = db.Column(db.String(200))
    leaf_color = db.Column(db.Enum('dark_green', 'green', 'light_green', 'yellow', 'brown'))
    growth_vigor = db.Column(db.Enum('vigorous', 'normal', 'slow', 'stunted'))
    
    # Manual measurements (optional)
    estimated_height_cm = db.Column(db.Float)
    estimated_moisture = db.Column(db.Enum('dry', 'moist', 'wet', 'waterlogged'))
    soil_appearance = db.Column(db.String(100))
    
    notes = db.Column(db.Text)
    image_path = db.Column(db.String(255))

class ImageAnalysis(db.Model):
    __tablename__ = 'image_analyses'
    analysis_id = db.Column(db.Integer, primary_key=True)
    planting_id = db.Column(db.Integer, db.ForeignKey('user_crops.planting_id'), nullable=False)
    analysis_date = db.Column(db.DateTime, default=datetime.utcnow)
    image_path = db.Column(db.String(255))
    
    # ML analysis results
    detected_disease = db.Column(db.String(100))
    disease_confidence = db.Column(db.Float)
    detected_pests = db.Column(db.String(200))
    pest_confidence = db.Column(db.Float)
    nutrient_deficiency = db.Column(db.String(100))
    overall_health_score = db.Column(db.Float)
    
    is_manual_review = db.Column(db.Boolean, default=False)
    review_notes = db.Column(db.Text)

class Recommendation(db.Model):
    __tablename__ = 'recommendations'
    recommendation_id = db.Column(db.Integer, primary_key=True)
    planting_id = db.Column(db.Integer, db.ForeignKey('user_crops.planting_id'), nullable=False)
    recommendation_date = db.Column(db.Date, nullable=False)
    action_type = db.Column(db.Enum('irrigate', 'fertilize', 'pesticide', 'no_action', 'monitor', 'harvest'), nullable=False)
    priority = db.Column(db.Enum('low', 'medium', 'high', 'critical'), default='medium')
    
    # Action details
    watering_amount_l = db.Column(db.Float)
    watering_interval_days = db.Column(db.Integer)
    fertilizer_type = db.Column(db.String(50))
    fertilizer_amount_kg = db.Column(db.Float)
    next_fertilizer_days = db.Column(db.Integer)
    pesticide_type = db.Column(db.String(50))
    pesticide_interval_days = db.Column(db.Integer)
    
    reasoning = db.Column(db.Text)
    confidence_score = db.Column(db.Float)
    source = db.Column(db.Enum('ai_svm', 'rule_based', 'manual', 'weather_based'))
    implemented = db.Column(db.Boolean, default=False)

# -------------------------
# User action / activity log
# -------------------------
class UserAction(db.Model):
    __tablename__ = 'user_actions'
    action_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    planting_id = db.Column(db.Integer, db.ForeignKey('user_crops.planting_id'))
    action_type = db.Column(db.String(50), nullable=False)  # e.g., 'detection','manual_observation','quick_action','recommendation','login'
    details = db.Column(db.Text)  # free-form JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def as_dict(self):
        return {
            'action_id': self.action_id,
            'user_id': self.user_id,
            'planting_id': self.planting_id,
            'action_type': self.action_type,
            'details': json.loads(self.details) if self.details else None,
            'created_at': self.created_at.isoformat()
        }
    implemented_date = db.Column(db.Date)

class DecisionPattern(db.Model):
    __tablename__ = 'decision_patterns'
    pattern_id = db.Column(db.Integer, primary_key=True)
    crop_type = db.Column(db.String(50))
    
    # Observation-based features (no sensors)
    visual_health = db.Column(db.Enum('excellent', 'good', 'fair', 'poor'))
    pest_presence = db.Column(db.Enum('none', 'low', 'medium', 'high'))
    growth_stage = db.Column(db.String(50))
    days_elapsed = db.Column(db.Integer)
    weather_forecast = db.Column(db.Enum('sunny', 'cloudy', 'rainy', 'storm'))
    temperature_category = db.Column(db.Enum('cold', 'cool', 'optimal', 'warm', 'hot'))
    
    recommended_action = db.Column(db.String(50))
    outcome_score = db.Column(db.Float)  # How well it worked (0-1)
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)

class GrowthMilestone(db.Model):
    __tablename__ = 'growth_milestones'
    milestone_id = db.Column(db.Integer, primary_key=True)
    crop_type = db.Column(db.String(50), db.ForeignKey('crops_master.crop_type'))
    growth_stage = db.Column(db.String(50))
    days_from_planting = db.Column(db.Integer)
    min_ndvi = db.Column(db.Float)
    max_ndvi = db.Column(db.Float)
    ideal_temp_min = db.Column(db.Float)
    ideal_temp_max = db.Column(db.Float)
    water_requirement_multiplier = db.Column(db.Float, default=1.0)
    key_tasks = db.Column(db.Text)  # JSON string of tasks

class Notification(db.Model):
    __tablename__ = 'notifications'
    notification_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    planting_id = db.Column(db.Integer, db.ForeignKey('user_crops.planting_id'))
    notification_type = db.Column(db.Enum('action', 'alert', 'reminder', 'progress', 'milestone'))
    title = db.Column(db.String(100))
    message = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    scheduled_for = db.Column(db.DateTime)

# ============================================
# SVM DECISION ENGINE (SENSOR-FREE)
# ============================================

class SmartCropDecisionEngine:
    def __init__(self):
        self.svm_model = None
        self.scaler = StandardScaler()
        self.load_or_train_model()
    
    def load_or_train_model(self):
        """Load trained SVM model or use loaded pickle model"""
        try:
            if ml_models.svm_model:
                self.svm_model = ml_models.svm_model
                self.scaler = ml_models.svm_scaler
                print("✅ SVM model loaded from pickle file")
            else:
                print("⚠️ No SVM model available, using rule-based system")
                
        except Exception as e:
            print(f"Error loading SVM model: {e}")
            self.create_fallback_model()
    
    def create_fallback_model(self):
        """Create a simple rule-based model as fallback"""
        self.svm_model = None
        print("⚠️ Using rule-based fallback model")
    
    # Encoding methods
    def encode_health(self, health_str):
        health_map = {'excellent': 0, 'good': 1, 'fair': 2, 'poor': 3}
        return health_map.get(health_str, 1)
    
    def encode_pressure(self, pressure_str):
        pressure_map = {'none': 0, 'low': 1, 'medium': 2, 'high': 3}
        return pressure_map.get(pressure_str, 0)
    
    def encode_stage(self, stage):
        stage_map = {'seedling': 0, 'vegetative': 1, 'flowering': 2, 'mature': 3}
        if isinstance(stage, str):
            return stage_map.get(stage.lower(), 0)
        return stage
    
    def encode_weather(self, weather):
        weather_map = {'sunny': 0, 'cloudy': 1, 'rainy': 2, 'storm': 3}
        return weather_map.get(weather, 0)
    
    def encode_temp(self, temp_category):
        temp_map = {'cold': 0, 'cool': 1, 'optimal': 2, 'warm': 3, 'hot': 4}
        return temp_map.get(temp_category, 2)
    
    def encode_action(self, action_str):
        if pd.isna(action_str):
            return 0
        action_map = {
            'no_action': 0,
            'irrigate': 1,
            'fertilize': 2,
            'pesticide': 3,
            'monitor': 4,
            'harvest': 5
        }
        if isinstance(action_str, str):
            return action_map.get(action_str.lower(), 0)
        return action_str
    
    def categorize_pressure(self, score):
        if pd.isna(score):
            return 1
        if score < 1.5:
            return 0  # low
        elif score < 3.0:
            return 1  # medium
        else:
            return 2  # high
    
    def predict_action(self, features_dict):
        """
        Predict optimal action using SVM
        Returns: (action, confidence, reasoning)
        """
        try:
            if not self.svm_model:
                return self.rule_based_decision(features_dict)
            
            # Prepare feature vector from observations
            feature_vector = np.array([
                features_dict.get('visual_health', 1),  # 0-3
                features_dict.get('pest_pressure', 0),  # 0-3
                features_dict.get('growth_stage', 1),   # 0-3
                min(features_dict.get('days_elapsed', 30) / 100, 1),  # normalized
                features_dict.get('weather', 0),        # 0-3
                features_dict.get('temperature', 2)     # 0-4
            ]).reshape(1, -1)
            
            # Scale and predict
            feature_vector_scaled = self.scaler.transform(feature_vector)
            action_pred = self.svm_model.predict(feature_vector_scaled)[0]
            probabilities = self.svm_model.predict_proba(feature_vector_scaled)[0]
            confidence = max(probabilities)
            
            # Map back to action
            action_map_reverse = {
                0: 'no_action',
                1: 'irrigate',
                2: 'fertilize',
                3: 'pesticide',
                4: 'monitor',
                5: 'harvest'
            }
            
            action = action_map_reverse.get(action_pred, 'no_action')
            reasoning = self.generate_reasoning(action, features_dict, confidence)
            
            return action, confidence, reasoning
            
        except Exception as e:
            print(f"SVM prediction error: {e}")
            return self.rule_based_decision(features_dict)
    
    def rule_based_decision(self, features):
        """Rule-based decision system (no sensors needed)"""
        visual_health = features.get('visual_health', 1)  # 1 = good
        pest_pressure = features.get('pest_pressure', 0)
        growth_stage = features.get('growth_stage', 'vegetative')
        days_elapsed = features.get('days_elapsed', 30)
        weather = features.get('weather_forecast', 'sunny')
        temp = features.get('temperature_category', 'optimal')
        
        # Rule 1: High pest pressure or poor health
        if pest_pressure == 3 or visual_health == 3:
            return 'pesticide', 0.85, "High pest pressure or poor plant health detected"
        
        # Rule 2: Flowering stage + optimal conditions = fertilize
        if growth_stage == 'flowering' and visual_health <= 1:
            return 'fertilize', 0.8, "Flowering stage requires nutrients"
        
        # Rule 3: Hot weather + no rain forecast
        if temp in ['warm', 'hot'] and weather in ['sunny', 'cloudy']:
            return 'irrigate', 0.75, "Hot dry weather requires watering"
        
        # Rule 4: Rain forecast + moist soil = no action
        if weather == 'rainy':
            return 'no_action', 0.9, "Rain forecasted, conserve resources"
        
        # Rule 5: Mature crop + good health = harvest check
        if growth_stage == 'mature' and days_elapsed > 100:
            return 'monitor', 0.7, "Crop is mature, monitor for harvest"
        
        # Default: Monitor
        return 'monitor', 0.6, "Conditions normal, continue monitoring"
    
    def generate_reasoning(self, action, features, confidence):
        """Generate human-readable reasoning"""
        reasons = []
        
        if action == 'irrigate':
            if features.get('weather_forecast') in ['sunny', 'cloudy']:
                reasons.append("Dry weather conditions")
            if features.get('temperature_category') in ['warm', 'hot']:
                reasons.append("High temperature")
            if features.get('estimated_moisture') == 'dry':
                reasons.append("Soil appears dry")
                
        elif action == 'fertilize':
            if features.get('growth_stage') == 'flowering':
                reasons.append("Critical flowering stage")
            if features.get('visual_health') == 2:  # fair
                reasons.append("Plants showing signs of nutrient need")
            if features.get('leaf_color') in ['light_green', 'yellow']:
                reasons.append("Leaf color indicates nutrient deficiency")
                
        elif action == 'pesticide':
            if features.get('pest_pressure', 0) >= 2:
                reasons.append("Significant pest presence observed")
            if features.get('disease_symptoms'):
                reasons.append(f"Disease symptoms: {features.get('disease_symptoms')}")
                
        elif action == 'harvest':
            if features.get('growth_stage') == 'mature':
                reasons.append("Crop has reached maturity")
            if features.get('days_elapsed', 0) > 100:
                reasons.append("Expected harvest time reached")
                
        elif action == 'monitor':
            reasons.append("Conditions within normal range")
            if confidence < 0.7:
                reasons.append("Low confidence, requires monitoring")
                
        else:  # no_action
            reasons.append("All parameters optimal")
            if features.get('weather_forecast') == 'rainy':
                reasons.append("Rain expected soon")
        
        return ". ".join(reasons) if reasons else "System recommendation"

# Initialize decision engine
decision_engine = SmartCropDecisionEngine()

# ============================================
# WEATHER SERVICE
# ============================================

class WeatherService:
    def __init__(self):
        self.api_key = os.getenv('OPENWEATHER_API_KEY', 'your_api_key_here')
        self.base_url = "http://api.openweathermap.org/data/2.5"
    
    def get_weather(self, lat, lon):
        """Get current weather from API"""
        try:
            url = f"{self.base_url}/weather?lat={lat}&lon={lon}&appid={self.api_key}&units=metric"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if response.status_code == 200:
                main = data['main']
                weather = data['weather'][0]
                
                # Categorize temperature
                temp = main['temp']
                if temp < 10:
                    temp_category = 'cold'
                elif temp < 18:
                    temp_category = 'cool'
                elif temp < 28:
                    temp_category = 'optimal'
                elif temp < 35:
                    temp_category = 'warm'
                else:
                    temp_category = 'hot'
                
                # Categorize weather
                description = weather['description'].lower()
                if 'rain' in description or 'drizzle' in description:
                    weather_category = 'rainy'
                elif 'storm' in description or 'thunder' in description:
                    weather_category = 'storm'
                elif 'cloud' in description:
                    weather_category = 'cloudy'
                else:
                    weather_category = 'sunny'
                
                return {
                    'temperature': temp,
                    'temperature_category': temp_category,
                    'humidity': main['humidity'],
                    'description': weather['description'],
                    'weather_category': weather_category,
                    'wind_speed': data['wind']['speed']
                }
            else:
                return self.get_mock_weather()
                
        except Exception as e:
            print(f"Weather API error: {e}")
            return self.get_mock_weather()
    
    def get_forecast(self, lat, lon):
        """Get 5-day forecast"""
        try:
            url = f"{self.base_url}/forecast?lat={lat}&lon={lon}&appid={self.api_key}&units=metric"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if response.status_code == 200:
                forecasts = []
                for item in data['list'][:8:2]:  # Next 4 days, every 12 hours
                    date = datetime.fromtimestamp(item['dt'])
                    main = item['main']
                    weather = item['weather'][0]
                    
                    forecasts.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'time': date.strftime('%H:%M'),
                        'temperature': main['temp'],
                        'humidity': main['humidity'],
                        'description': weather['description'],
                        'precipitation': item.get('rain', {}).get('3h', 0)
                    })
                return forecasts
            else:
                return self.get_mock_forecast()
                
        except Exception as e:
            print(f"Forecast API error: {e}")
            return self.get_mock_forecast()
    
    def get_mock_weather(self):
        """Mock weather for testing"""
        temp = 25 + np.random.randn() * 5
        categories = ['sunny', 'cloudy', 'partly cloudy']
        desc = categories[np.random.randint(0, 3)]
        
        return {
            'temperature': temp,
            'temperature_category': 'optimal',
            'humidity': 60 + np.random.randn() * 10,
            'description': desc,
            'weather_category': 'sunny' if 'sunny' in desc else 'cloudy',
            'wind_speed': 5 + np.random.rand() * 10
        }
    
    def get_mock_forecast(self):
        """Mock forecast for testing"""
        forecasts = []
        for i in range(1, 5):
            date = datetime.now() + timedelta(days=i)
            forecasts.append({
                'date': date.strftime('%Y-%m-%d'),
                'time': '12:00',
                'temperature': 25 + np.random.randn() * 5,
                'humidity': 60 + np.random.randn() * 10,
                'description': ['sunny', 'cloudy', 'rainy'][np.random.randint(0, 3)],
                'precipitation': np.random.rand() * 10
            })
        return forecasts

weather_service = WeatherService()

# ============================================
# PROGRESS CALCULATOR
# ============================================

def calculate_growth_progress(planting_date, total_days):
    """Calculate crop growth progress percentage"""
    if not planting_date:
        return 0.0
    
    days_elapsed = (datetime.now().date() - planting_date).days
    days_elapsed = max(0, days_elapsed)
    
    if total_days <= 0:
        return 0.0
    
    progress = min(99.9, (days_elapsed / total_days) * 100)
    return round(progress, 2)

def determine_growth_stage(days_elapsed, crop_type):
    """Determine current growth stage based on days elapsed"""
    if not crop_type:
        return 'seedling'
    
    milestones = GrowthMilestone.query.filter_by(crop_type=crop_type).order_by('days_from_planting').all()
    
    if not milestones:
        # Default stages based on days
        if days_elapsed < 15:
            return 'seedling'
        elif days_elapsed < 50:
            return 'vegetative'
        elif days_elapsed < 90:
            return 'flowering'
        else:
            return 'mature'
    
    current_stage = 'seedling'
    for milestone in milestones:
        if days_elapsed >= milestone.days_from_planting:
            current_stage = milestone.growth_stage
    
    return current_stage

def calculate_health_score(crop):
    """Calculate crop health score based on observations"""
    base_score = 100.0
    
    # Deduct for disease
    if crop.disease_detected:
        base_score -= 20
    
    # Deduct for pest pressure
    pest_deductions = {'low': -5, 'medium': -15, 'high': -30}
    base_score += pest_deductions.get(crop.pest_pressure_level, 0)
    
    # Adjust based on last observation date
    if crop.last_observation_date:
        days_since_obs = (datetime.now().date() - crop.last_observation_date).days
        if days_since_obs > 7:
            base_score -= 10  # Penalty for lack of recent observation
    
    # Ensure score is within bounds
    return max(0, min(100, base_score))

# ============================================
# API ROUTES - NEW FOR ML MODELS
# ============================================

@app.route('/api/test-models', methods=['GET'])
def test_models():
    """Test if ML models are loaded"""
    return jsonify({
        'status': 'success',
        'message': 'ML models test endpoint',
        'models_loaded': {
            'random_forest': ml_models.random_forest_model is not None,
            'decision_tree': ml_models.decision_tree_model is not None,
            'svm': ml_models.svm_model is not None,
            'keras_h5': crop_model is not None
        }
    })

@app.route('/api/predict-fertilizer', methods=['POST'])
def predict_fertilizer():
    """Predict fertilizer using Random Forest model"""
    try:
        data = request.json
        crop_type = data.get('crop_type')
        soil_type = data.get('soil_type')
        
        if not crop_type or not soil_type:
            return jsonify({'error': 'Crop type and soil type required'}), 400
        
        # Use Random Forest model if available
        if ml_models.random_forest_model and ml_models.rf_features:
            try:
                # Prepare features for prediction
                # This depends on how your Random Forest model was trained
                # Assuming it expects crop_type and soil_type as encoded features
                
                # Create a simple feature vector based on your CSV data
                # You'll need to adapt this based on your actual model training
                
                # For now, return a placeholder
                fertilizer = get_fertilizer_from_random_forest(crop_type, soil_type)
                
                return jsonify({
                    'fertilizer': fertilizer,
                    'model': 'Random Forest',
                    'confidence': 0.85,
                    'recommendation': f'Recommended for {crop_type} in {soil_type} soil'
                })
                
            except Exception as e:
                print(f"Random Forest prediction error: {e}")
                # Fallback to rule-based
                fertilizer = get_fertilizer_fallback(crop_type, soil_type)
                return jsonify({
                    'fertilizer': fertilizer,
                    'model': 'Rule-based (fallback)',
                    'confidence': 0.7,
                    'recommendation': f'Recommended for {crop_type} in {soil_type} soil'
                })
        else:
            # Use rule-based system
            fertilizer = get_fertilizer_fallback(crop_type, soil_type)
            return jsonify({
                'fertilizer': fertilizer,
                'model': 'Rule-based',
                'confidence': 0.7,
                'recommendation': f'Recommended for {crop_type} in {soil_type} soil'
            })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_fertilizer_from_random_forest(crop_type, soil_type):
    """Get fertilizer recommendation from Random Forest model"""
    # This is a placeholder - you need to implement based on your model
    # The actual implementation depends on how your model was trained
    
    fertilizer_map = {
        'Wheat': {
            'red': 'Diammonium Phosphate (DAP 18-46-0)',
            'black': 'Urea (46% N)',
            'alluvial': 'NPK Complex (20-20-0 or local blends)'
        },
        'Rice': {
            'red': 'Ammonium Sulfate',
            'black': 'Urea (46% N)',
            'alluvial': 'NPK 12-32-16 (or local blend)'
        },
        'Tomato': {
            'red': 'Calcium Nitrate (Ca(NO3)2)',
            'black': 'Potassium Sulfate (K2SO4)',
            'alluvial': 'NPK 10-52-10 (high P starter)'
        },
        'Maize': {
            'red': 'Zinc Sulfate',
            'black': 'Urea (46% N)',
            'alluvial': 'Compound NPK (e.g., 16-16-16)'
        },
        'Potato': {
            'red': 'NPK 14-35-14 (high P)',
            'black': 'Muriate of Potash (KCl)',
            'alluvial': 'Calcium Nitrate'
        },
        'Soybean': {
            'red': 'Rhizobium Inoculant (biofertilizer)',
            'black': 'DAP (18-46-0)',
            'alluvial': 'Gypsum'
        }
    }
    
    return fertilizer_map.get(crop_type, {}).get(soil_type, 'Urea (46% N)')

def get_fertilizer_fallback(crop_type, soil_type):
    """Fallback fertilizer recommendation"""
    return get_fertilizer_from_random_forest(crop_type, soil_type)

@app.route('/api/predict-tasks', methods=['POST'])
def predict_tasks():
    """Get recommended tasks using Decision Tree model"""
    try:
        data = request.json
        crop_type = data.get('crop_type')
        days_elapsed = data.get('days_elapsed', 0)
        growth_stage = data.get('growth_stage', 'seedling')
        
        if not crop_type:
            return jsonify({'error': 'Crop type required'}), 400
        
        # Use Decision Tree model if available
        tasks = get_tasks_from_decision_tree(crop_type, days_elapsed, growth_stage)
        
        return jsonify({
            'tasks': tasks,
            'model': 'Decision Tree',
            'crop_type': crop_type,
            'days_elapsed': days_elapsed,
            'growth_stage': growth_stage
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_tasks_from_decision_tree(crop_type, days_elapsed, growth_stage):
    """Get tasks from Decision Tree model"""
    # This depends on how your Decision Tree model was trained
    # For now, return default tasks based on growth stage
    
    tasks = []
    
    # Always include visual inspection
    tasks.append({
        'task': 'Visual inspection',
        'icon': 'bi-eye',
        'description': 'Check for visible pests, diseases, or abnormalities',
        'priority': 'medium',
        'model': 'Decision Tree'
    })
    
    if growth_stage == 'seedling':
        tasks.append({
            'task': 'Water seedlings',
            'icon': 'bi-droplet',
            'description': 'Light watering - keep soil moist but not soggy',
            'priority': 'high',
            'model': 'Decision Tree'
        })
        tasks.append({
            'task': 'Thin if needed',
            'icon': 'bi-scissors',
            'description': 'Remove weak seedlings to give others space',
            'priority': 'medium',
            'model': 'Decision Tree'
        })
    elif growth_stage == 'vegetative':
        tasks.append({
            'task': 'Regular watering',
            'icon': 'bi-droplet',
            'description': 'Water deeply to encourage root growth',
            'priority': 'high',
            'model': 'Decision Tree'
        })
        tasks.append({
            'task': 'Weed control',
            'icon': 'bi-flower1',
            'description': 'Remove weeds around plants',
            'priority': 'medium',
            'model': 'Decision Tree'
        })
    elif growth_stage == 'flowering':
        tasks.append({
            'task': 'Monitor pollination',
            'icon': 'bi-flower2',
            'description': 'Check flower development and pollination',
            'priority': 'high',
            'model': 'Decision Tree'
        })
        tasks.append({
            'task': 'Reduce nitrogen',
            'icon': 'bi-flower3',
            'description': 'Switch to potassium-rich fertilizer',
            'priority': 'medium',
            'model': 'Decision Tree'
        })
    elif growth_stage == 'mature':
        tasks.append({
            'task': 'Harvest preparation',
            'icon': 'bi-basket',
            'description': 'Prepare for harvest in coming days',
            'priority': 'high',
            'model': 'Decision Tree'
        })
        tasks.append({
            'task': 'Reduce watering',
            'icon': 'bi-droplet-half',
            'description': 'Gradually reduce water before harvest',
            'priority': 'medium',
            'model': 'Decision Tree'
        })
    
    return tasks

# ============================================
# EXISTING API ROUTES (UPDATED)
# ============================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'svm_model': 'loaded' if decision_engine.svm_model else 'rule_based',
        'ml_models': {
            'random_forest': ml_models.random_forest_model is not None,
            'decision_tree': ml_models.decision_tree_model is not None,
            'svm': ml_models.svm_model is not None
        }
    })

@app.route('/api/predict', methods=['POST'])
def api_predict():
    """Accepts an image file (multipart/form-data) and returns predictions using the H5 model."""
    global crop_model, class_labels

    # Support a simple health check from the frontend
    if request.is_json:
        body = request.get_json()
        if body.get('test'):
            return jsonify({'ok': bool(crop_model), 'labels_count': len(class_labels)})

    # Ensure model is loaded
    if crop_model is None:
        return jsonify({'error': 'Model not loaded on server'}), 500

    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    try:
        img = Image.open(file.stream).convert('RGB')
        img = img.resize((224, 224))
        arr = img_to_array(img) / 255.0
        arr = np.expand_dims(arr, axis=0)

        preds = crop_model.predict(arr)
        probs = preds[0].tolist()

        # Build top-3 list
        indexed = list(enumerate(probs))
        indexed.sort(key=lambda x: x[1], reverse=True)
        topk = indexed[:3]
        results = []
        for idx, score in topk:
            label = class_labels[idx] if idx < len(class_labels) else f'Class {idx}'
            results.append({'label': label, 'score': float(score)})

        return jsonify({'predictions': results, 'raw': probs})
    except Exception as e:
        print('Prediction error:', e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather', methods=['POST'])
def get_weather():
    """Get weather data for location"""
    try:
        data = request.json
        lat = data.get('lat')
        lon = data.get('lon')
        
        if not lat or not lon:
            return jsonify({'error': 'Location required'}), 400
        
        # Get current weather
        current = weather_service.get_weather(lat, lon)
        
        # Get forecast
        forecast = weather_service.get_forecast(lat, lon)
        
        # Generate past 10 days data
        past_days = []
        for i in range(10, 0, -1):
            date = datetime.now() - timedelta(days=i)
            past_days.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': 25 + np.random.randn() * 5,
                'description': ['sunny', 'cloudy', 'rainy'][np.random.randint(0, 3)]
            })
        
        # Generate next 5 days forecast
        next_days = []
        for i in range(1, 6):
            date = datetime.now() + timedelta(days=i)
            next_days.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': 25 + np.random.randn() * 5,
                'description': ['sunny', 'cloudy', 'rainy'][np.random.randint(0, 3)]
            })
        
        return jsonify({
            'current': current,
            'past_10_days': past_days,
            'next_5_days': next_days,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/select-crop', methods=['POST'])
def select_crop():
    """User selects a crop to plant"""
    try:
        data = request.json
        user_id = data.get('user_id')
        crop_type = data.get('crop_type')
        planting_date = data.get('planting_date', datetime.now().date().isoformat())
        
        if not user_id or not crop_type:
            return jsonify({'error': 'User ID and crop type required'}), 400
        
        # Parse planting date
        try:
            planting_date_obj = datetime.strptime(planting_date, '%Y-%m-%d').date()
        except:
            planting_date_obj = datetime.now().date()
        
        # Get crop details
        crop = CropMaster.query.filter_by(crop_type=crop_type).first()
        if not crop:
            # Create crop if not in database
            crop = CropMaster(
                crop_type=crop_type,
                total_growth_days=100,
                ideal_temperature_c=25,
                ideal_soil_ph=6.5,
                water_need_l_per_week=30
            )
            db.session.add(crop)
            db.session.commit()
        
        total_days = crop.total_growth_days if crop else 100
        harvest_date = planting_date_obj + timedelta(days=total_days)
        
        # Create new crop planting
        new_crop = UserCrop(
            user_id=user_id,
            crop_type=crop_type,
            planting_date=planting_date_obj,
            expected_harvest_date=harvest_date,
            current_growth_stage='seedling',
            growth_progress=0.0,
            days_elapsed=0,
            days_remaining=total_days,
            is_active=True,
            health_score=100.0
        )
        
        db.session.add(new_crop)
        db.session.commit()
        
        # Create initial observation
        initial_obs = ManualObservation(
            planting_id=new_crop.planting_id,
            observation_date=planting_date_obj,
            observation_type='visual',
            visual_health='excellent',
            pest_presence='none',
            growth_vigor='vigorous',
            leaf_color='green',
            notes=f"Initial planting of {crop_type}"
        )
        
        db.session.add(initial_obs)
        
        # Create initial recommendations
        create_initial_recommendations(new_crop.planting_id, crop_type)
        
        # Create notification
        notification = Notification(
            user_id=user_id,
            planting_id=new_crop.planting_id,
            notification_type='milestone',
            title=f'{crop_type} Planted!',
            message=f'You have successfully planted {crop_type}. Expected harvest in {total_days} days.',
            is_read=False
        )
        
        db.session.add(notification)
        db.session.commit()
        
        # Log planting creation as user action
        try:
            user_action = UserAction(
                user_id=user_id,
                planting_id=new_crop.planting_id,
                action_type='planting_created',
                details=json.dumps({'crop_type': crop_type, 'expected_harvest': harvest_date.isoformat()})
            )
            db.session.add(user_action)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({
            'success': True,
            'planting_id': new_crop.planting_id,
            'crop_type': crop_type,
            'planting_date': planting_date_obj.isoformat(),
            'expected_harvest': harvest_date.isoformat(),
            'total_days': total_days,
            'message': f'{crop_type} planted successfully!'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/crops', methods=['GET'])
def get_user_crops(user_id):
    """Get all crops for a user"""
    try:
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            # For demo users, return crops from localStorage
            return jsonify({
                'crops': [],
                'error': 'User not found, using demo mode'
            })
        
        # Get active crops
        crops = UserCrop.query.filter_by(user_id=user_id, is_active=True).all()
        
        crops_data = []
        for crop in crops:
            # Calculate progress
            crop_master = CropMaster.query.filter_by(crop_type=crop.crop_type).first()
            total_days = crop_master.total_growth_days if crop_master else 100
            
            days_elapsed = (datetime.now().date() - crop.planting_date).days
            days_elapsed = max(0, days_elapsed)
            
            progress = calculate_growth_progress(crop.planting_date, total_days)
            growth_stage = determine_growth_stage(days_elapsed, crop.crop_type)
            
            crops_data.append({
                'planting_id': crop.planting_id,
                'crop_type': crop.crop_type,
                'planting_date': crop.planting_date.isoformat(),
                'expected_harvest_date': crop.expected_harvest_date.isoformat() if crop.expected_harvest_date else None,
                'current_growth_stage': growth_stage,
                'growth_progress': progress,
                'days_elapsed': days_elapsed,
                'days_remaining': max(0, total_days - days_elapsed),
                'health_score': crop.health_score,
                'pest_pressure_level': crop.pest_pressure_level,
                'disease_detected': crop.disease_detected,
                'is_active': crop.is_active
            })
        
        return jsonify({
            'crops': crops_data,
            'count': len(crops_data)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/crop/<int:planting_id>/progress', methods=['GET'])
def get_crop_progress(planting_id):
    """Get current progress and update if needed"""
    try:
        crop = UserCrop.query.get(planting_id)
        if not crop:
            return jsonify({'error': 'Crop not found'}), 404
        
        # Get crop details for total days
        crop_master = CropMaster.query.filter_by(crop_type=crop.crop_type).first()
        total_days = crop_master.total_growth_days if crop_master else 120
        
        # Calculate current progress
        days_elapsed = (datetime.now().date() - crop.planting_date).days
        days_elapsed = max(0, days_elapsed)
        progress = calculate_growth_progress(crop.planting_date, total_days)
        
        # Determine growth stage
        growth_stage = determine_growth_stage(days_elapsed, crop.crop_type)
        
        # Calculate health score
        health_score = calculate_health_score(crop)
        
        # Update crop record
        crop.days_elapsed = days_elapsed
        crop.days_remaining = max(0, total_days - days_elapsed)
        crop.growth_progress = progress
        crop.current_growth_stage = growth_stage
        crop.health_score = health_score
        
        # Get latest observation
        latest_obs = ManualObservation.query.filter_by(
            planting_id=planting_id
        ).order_by(ManualObservation.observation_date.desc()).first()
        
        # Get latest recommendation
        latest_rec = Recommendation.query.filter_by(
            planting_id=planting_id,
            implemented=False
        ).order_by(Recommendation.recommendation_date.desc()).first()
        
        # Get weather data if user has location
        user = User.query.get(crop.user_id)
        weather_info = None
        if user and user.location_lat and user.location_lon:
            weather = weather_service.get_weather(user.location_lat, user.location_lon)
            weather_info = {
                'temperature': weather['temperature'],
                'description': weather['description'],
                'category': weather['weather_category']
            }
        
        db.session.commit()
        
        return jsonify({
            'planting_id': planting_id,
            'crop_type': crop.crop_type,
            'planting_date': crop.planting_date.isoformat(),
            'days_elapsed': days_elapsed,
            'days_remaining': crop.days_remaining,
            'progress_percentage': progress,
            'growth_stage': growth_stage,
            'health_score': health_score,
            'current_recommendation': latest_rec.action_type if latest_rec else 'monitor',
            'last_observation': {
                'date': latest_obs.observation_date.isoformat() if latest_obs else None,
                'health': latest_obs.visual_health if latest_obs else None,
                'pests': latest_obs.pest_presence if latest_obs else None
            } if latest_obs else None,
            'weather': weather_info,
            'next_milestone': get_next_milestone(crop.crop_type, days_elapsed)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/crop/<int:planting_id>/observation', methods=['POST'])
def add_observation(planting_id):
    """Add a manual observation (no sensors needed)"""
    try:
        data = request.json
        crop = UserCrop.query.get(planting_id)
        if not crop:
            return jsonify({'error': 'Crop not found'}), 404
        
        # Create observation
        observation = ManualObservation(
            planting_id=planting_id,
            observation_date=datetime.now().date(),
            observation_type=data.get('observation_type', 'visual'),
            visual_health=data.get('visual_health'),
            pest_presence=data.get('pest_presence'),
            disease_symptoms=data.get('disease_symptoms'),
            leaf_color=data.get('leaf_color'),
            growth_vigor=data.get('growth_vigor'),
            estimated_height_cm=data.get('estimated_height_cm'),
            estimated_moisture=data.get('estimated_moisture'),
            soil_appearance=data.get('soil_appearance'),
            notes=data.get('notes'),
            image_path=data.get('image_path')
        )
        
        # Update crop based on observation
        if data.get('pest_presence'):
            crop.pest_pressure_level = data['pest_presence']
        if data.get('disease_symptoms'):
            crop.disease_detected = bool(data['disease_symptoms'])
        
        crop.last_observation_date = datetime.now().date()
        crop.health_score = calculate_health_score(crop)
        
        db.session.add(observation)
        db.session.commit()
        
        # Record user action for manual observation
        try:
            action_details = {
                'visual_health': data.get('visual_health'),
                'pest_presence': data.get('pest_presence'),
                'disease_symptoms': data.get('disease_symptoms'),
                'notes': data.get('notes')
            }
            user_action = UserAction(
                user_id=crop.user_id,
                planting_id=planting_id,
                action_type='manual_observation',
                details=json.dumps(action_details)
            )
            db.session.add(user_action)
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Create notification for significant findings
        if data.get('pest_presence') in ['medium', 'high'] or data.get('disease_symptoms'):
            notification = Notification(
                user_id=crop.user_id,
                planting_id=planting_id,
                notification_type='alert',
                title='Crop Issue Detected',
                message=f'Observation recorded for {crop.crop_type}: {data.get("disease_symptoms", "Pest issue")}',
                is_read=False
            )
            db.session.add(notification)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'observation_id': observation.observation_id,
            'message': 'Observation recorded successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/crop/<int:planting_id>/recommend', methods=['POST'])
def get_recommendation(planting_id):
    """Get AI-powered recommendation for crop"""
    try:
        crop = UserCrop.query.get(planting_id)
        if not crop:
            return jsonify({'error': 'Crop not found'}), 404
        
        # Get latest observation
        latest_obs = ManualObservation.query.filter_by(
            planting_id=planting_id
        ).order_by(ManualObservation.observation_date.desc()).first()
        
        # Get weather forecast
        user = User.query.get(crop.user_id)
        if user and user.location_lat and user.location_lon:
            weather = weather_service.get_weather(user.location_lat, user.location_lon)
            weather_category = weather['weather_category']
            temp_category = weather['temperature_category']
        else:
            weather_category = 'sunny'
            temp_category = 'optimal'
        
        # Prepare features for SVM (no sensor data)
        features = {
            'visual_health': decision_engine.encode_health(latest_obs.visual_health if latest_obs else 'good'),
            'pest_pressure': decision_engine.encode_pressure(latest_obs.pest_presence if latest_obs else 'none'),
            'growth_stage': decision_engine.encode_stage(crop.current_growth_stage),
            'days_elapsed': crop.days_elapsed,
            'weather_forecast': weather_category,
            'temperature_category': temp_category,
            'estimated_moisture': latest_obs.estimated_moisture if latest_obs else None,
            'leaf_color': latest_obs.leaf_color if latest_obs else None,
            'disease_symptoms': latest_obs.disease_symptoms if latest_obs else None
        }
        
        # Get SVM recommendation
        action, confidence, reasoning = decision_engine.predict_action(features)
        
        # Create recommendation record
        recommendation = Recommendation(
            planting_id=planting_id,
            recommendation_date=datetime.now().date(),
            action_type=action,
            priority='high' if confidence > 0.8 else 'medium',
            reasoning=reasoning,
            confidence_score=confidence,
            source='ai_svm' if decision_engine.svm_model else 'rule_based'
        )
        
        # Add specific recommendations based on action
        if action == 'irrigate':
            recommendation.watering_amount_l = calculate_water_amount(
                crop.crop_type, crop.current_growth_stage, features
            )
            recommendation.watering_interval_days = 3  # Default
            
        elif action == 'fertilize':
            recommendation.fertilizer_type = recommend_fertilizer_type(crop.crop_type, crop.current_growth_stage)
            recommendation.fertilizer_amount_kg = recommend_fertilizer_amount(crop.crop_type)
            recommendation.next_fertilizer_days = 30
            
        elif action == 'pesticide':
            recommendation.pesticide_type = 'Organic Neem Oil' if features['pest_pressure'] < 2 else 'Chemical Pesticide'
            recommendation.pesticide_interval_days = 14
        
        db.session.add(recommendation)
        
        # Store decision pattern for learning
        store_decision_pattern(crop.crop_type, features, action, weather_category, temp_category)
        
        db.session.commit()
        
        # Log generated recommendation as user action
        try:
            user_action = UserAction(
                user_id=crop.user_id,
                planting_id=planting_id,
                action_type='recommendation_generated',
                details=json.dumps({'recommendation_id': recommendation.recommendation_id, 'action': action, 'confidence': confidence})
            )
            db.session.add(user_action)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({
            'action': action,
            'confidence': confidence,
            'reasoning': reasoning,
            'details': get_action_details(recommendation),
            'recommendation_id': recommendation.recommendation_id,
            'source': recommendation.source,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/crop/<int:planting_id>/image-analysis', methods=['POST'])
def add_image_analysis(planting_id):
    """Add image analysis results from ML model"""
    try:
        data = request.json
        crop = UserCrop.query.get(planting_id)
        if not crop:
            return jsonify({'error': 'Crop not found'}), 404
        
        # Create image analysis record
        analysis = ImageAnalysis(
            planting_id=planting_id,
            image_path=data.get('image_path'),
            detected_disease=data.get('detected_disease'),
            disease_confidence=data.get('disease_confidence'),
            detected_pests=data.get('detected_pests'),
            pest_confidence=data.get('pest_confidence'),
            nutrient_deficiency=data.get('nutrient_deficiency'),
            overall_health_score=data.get('overall_health_score'),
            is_manual_review=data.get('is_manual_review', False),
            review_notes=data.get('review_notes')
        )
        
        # Update crop if disease or pests detected
        if data.get('detected_disease'):
            crop.disease_detected = True
            crop.health_score = max(0, crop.health_score - 20)
        
        if data.get('detected_pests'):
            # Estimate pest pressure from confidence
            pest_conf = data.get('pest_confidence', 0)
            if pest_conf > 0.7:
                crop.pest_pressure_level = 'high'
            elif pest_conf > 0.4:
                crop.pest_pressure_level = 'medium'
            else:
                crop.pest_pressure_level = 'low'
        
        db.session.add(analysis)
        db.session.commit()
        
        # Record user action for automatic detection
        try:
            action_details = {
                'detected_disease': data.get('detected_disease'),
                'disease_confidence': data.get('disease_confidence'),
                'detected_pests': data.get('detected_pests'),
                'pest_confidence': data.get('pest_confidence')
            }
            user_action = UserAction(
                user_id=crop.user_id,
                planting_id=planting_id,
                action_type='automatic_detection',
                details=json.dumps(action_details)
            )
            db.session.add(user_action)
            db.session.commit()
        except Exception:
            db.session.rollback()
        
        # Create alert if issues found
        if data.get('detected_disease') or data.get('detected_pests'):
            notification = Notification(
                user_id=crop.user_id,
                planting_id=planting_id,
                notification_type='alert',
                title='Image Analysis Results',
                message=f'Analysis detected: {data.get("detected_disease", "Pests")} in {crop.crop_type}',
                is_read=False
            )
            db.session.add(notification)
            db.session.commit()
        
        return jsonify({
            'success': True,
            'analysis_id': analysis.analysis_id,
            'message': 'Image analysis recorded'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# -----------------------------
# User data sync endpoints
# -----------------------------
@app.route('/api/user/<int:user_id>/sync', methods=['POST'])
def user_sync(user_id):
    """Accept local client data (detections, observations, quick actions, plantings) and merge into server DB."""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        payload = request.json or {}
        stats = {'image_analyses': 0, 'manual_observations': 0, 'user_actions': 0, 'user_crops': 0, 'skipped': 0}

        # Process automatic detection logs
        for d in payload.get('detectionLogs', []):
            planting_id = d.get('planting_id')
            if not planting_id:
                stats['skipped'] += 1
                continue

            crop = UserCrop.query.get(planting_id)
            if not crop or crop.user_id != user_id:
                stats['skipped'] += 1
                continue

            # Parse timestamp if provided
            ts = None
            try:
                ts = datetime.fromisoformat(d.get('timestamp')) if d.get('timestamp') else datetime.utcnow()
            except Exception:
                ts = datetime.utcnow()

            # Simple duplicate protection: look for same planting_id + disease + similar timestamp
            dup = ImageAnalysis.query.filter_by(planting_id=planting_id, detected_disease=d.get('detection_label')).filter(
                ImageAnalysis.analysis_date.between(ts - timedelta(seconds=5), ts + timedelta(seconds=5))
            ).first()
            if dup:
                stats['skipped'] += 1
                continue

            analysis = ImageAnalysis(
                planting_id=planting_id,
                image_path=d.get('image_path'),
                detected_disease=d.get('detection_label'),
                disease_confidence=d.get('detection_score', 0),
                overall_health_score=d.get('overall_health_score'),
                analysis_date=ts
            )
            db.session.add(analysis)

            user_action = UserAction(
                user_id=user_id,
                planting_id=planting_id,
                action_type='automatic_detection',
                details=json.dumps(d)
            )
            db.session.add(user_action)
            stats['image_analyses'] += 1
            stats['user_actions'] += 1

        # Process manual detections / crop observations
        for m in payload.get('cropDetections', []):
            planting_id = m.get('planting_id')
            if not planting_id:
                stats['skipped'] += 1
                continue

            crop = UserCrop.query.get(planting_id)
            if not crop or crop.user_id != user_id:
                stats['skipped'] += 1
                continue

            try:
                obs_date = datetime.fromisoformat(m.get('timestamp')).date() if m.get('timestamp') else datetime.utcnow().date()
            except Exception:
                obs_date = datetime.utcnow().date()

            observation = ManualObservation(
                planting_id=planting_id,
                observation_date=obs_date,
                observation_type='visual',
                pest_presence=m.get('pest_level'),
                disease_symptoms=m.get('disease'),
                notes=m.get('notes'),
                image_path=m.get('image_path')
            )
            db.session.add(observation)

            user_action = UserAction(
                user_id=user_id,
                planting_id=planting_id,
                action_type='manual_observation',
                details=json.dumps(m)
            )
            db.session.add(user_action)
            stats['manual_observations'] += 1
            stats['user_actions'] += 1

        # Process quick actions
        for q in payload.get('quickActions', []):
            planting_id = q.get('planting_id')
            ua = UserAction(
                user_id=user_id,
                planting_id=planting_id,
                action_type=q.get('type', 'quick_action'),
                details=json.dumps(q)
            )
            db.session.add(ua)
            stats['user_actions'] += 1

        # Process user crops (plantings) if provided
        for c in payload.get('userCrops', []):
            # If planting_id is provided and exists, skip to avoid collision
            planting_id = c.get('planting_id')
            if planting_id and UserCrop.query.get(planting_id):
                stats['skipped'] += 1
                continue

            # Create a minimal record tied to the user
            try:
                planting_date = datetime.fromisoformat(c.get('planting_date')).date() if c.get('planting_date') else datetime.utcnow().date()
            except Exception:
                planting_date = datetime.utcnow().date()

            new_crop = UserCrop(
                user_id=user_id,
                crop_type=c.get('crop_type', 'Unknown'),
                planting_date=planting_date,
                expected_harvest_date=c.get('expected_harvest_date')
            )
            db.session.add(new_crop)
            stats['user_crops'] += 1

        db.session.commit()
        return jsonify({'success': True, 'imported': stats})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/<int:user_id>/sync', methods=['GET'])
def get_user_sync(user_id):
    """Return recent user-side data so the frontend can populate local storage on login."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Recent user actions
    actions = UserAction.query.filter_by(user_id=user_id).order_by(UserAction.created_at.desc()).limit(200).all()
    actions_out = [a.as_dict() for a in actions]

    # Recent image analyses across user's crops
    analyses = []
    observations = []
    for crop in UserCrop.query.filter_by(user_id=user_id).all():
        imgs = ImageAnalysis.query.filter_by(planting_id=crop.planting_id).order_by(ImageAnalysis.analysis_date.desc()).limit(200).all()
        obs = ManualObservation.query.filter_by(planting_id=crop.planting_id).order_by(ManualObservation.observation_date.desc()).limit(200).all()
        analyses.extend([{
            'analysis_id': i.analysis_id,
            'planting_id': i.planting_id,
            'image_path': i.image_path,
            'detected_disease': i.detected_disease,
            'disease_confidence': i.disease_confidence,
            'overall_health_score': i.overall_health_score,
            'analysis_date': i.analysis_date.isoformat()
        } for i in imgs])
        observations.extend([{
            'observation_id': o.observation_id,
            'planting_id': o.planting_id,
            'observation_date': o.observation_date.isoformat(),
            'pest_presence': o.pest_presence,
            'disease_symptoms': o.disease_symptoms,
            'notes': o.notes,
            'image_path': o.image_path
        } for o in obs])

    return jsonify({
        'user_actions': actions_out,
        'image_analyses': analyses,
        'manual_observations': observations
    })

@app.route('/api/crop/<int:planting_id>/implement-recommendation/<int:recommendation_id>', methods=['POST'])
def implement_recommendation(planting_id, recommendation_id):
    """Mark a recommendation as implemented"""
    try:
        recommendation = Recommendation.query.filter_by(
            recommendation_id=recommendation_id,
            planting_id=planting_id
        ).first()
        
        if not recommendation:
            return jsonify({'error': 'Recommendation not found'}), 404
        
        recommendation.implemented = True
        recommendation.implemented_date = datetime.now().date()
        
        # Create observation for the implementation
        observation = ManualObservation(
            planting_id=planting_id,
            observation_date=datetime.now().date(),
            observation_type='measurement',
            notes=f'Implemented recommendation: {recommendation.action_type}. {recommendation.reasoning}'
        )
        
        db.session.add(observation)
        db.session.commit()

        # Log user action for implementation
        try:
            crop = UserCrop.query.get(planting_id)
            if crop:
                user_action = UserAction(
                    user_id=crop.user_id,
                    planting_id=planting_id,
                    action_type='recommendation_implemented',
                    details=json.dumps({'recommendation_id': recommendation.recommendation_id, 'action': recommendation.action_type})
                )
                db.session.add(user_action)
                db.session.commit()
        except Exception:
            db.session.rollback()
        
        return jsonify({
            'success': True,
            'message': f'Recommendation marked as implemented'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/actions', methods=['POST'])
def add_user_action_endpoint(user_id):
    """Record a user action (client-facing endpoint)"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        data = request.get_json() or {}
        action_type = data.get('action_type')
        planting_id = data.get('planting_id')
        details = data.get('details')
        if not action_type:
            return jsonify({'error': 'action_type is required'}), 400
        action = UserAction(
            user_id=user.user_id,
            planting_id=planting_id,
            action_type=action_type,
            details=json.dumps(details) if details is not None else None
        )
        db.session.add(action)
        db.session.commit()
        return jsonify({'success': True, 'action_id': action.action_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/<int:user_id>/actions', methods=['GET'])
def get_user_actions(user_id):
    """Return user actions (with optional limit or since parameter)"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        limit = int(request.args.get('limit', 100))
        since = request.args.get('since')
        q = UserAction.query.filter_by(user_id=user_id).order_by(UserAction.created_at.desc())
        if since:
            try:
                since_dt = datetime.fromisoformat(since)
                q = q.filter(UserAction.created_at >= since_dt)
            except Exception:
                pass
        actions = q.limit(limit).all()
        return jsonify({'actions': [a.as_dict() for a in actions]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/<int:user_id>/dashboard', methods=['GET'])
def get_user_dashboard(user_id):
    """Get complete dashboard data for user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get active crops
        active_crops = UserCrop.query.filter_by(
            user_id=user_id, is_active=True
        ).all()
        
        crops_data = []
        for crop in active_crops:
            # Calculate progress
            crop_master = CropMaster.query.filter_by(crop_type=crop.crop_type).first()
            total_days = crop_master.total_growth_days if crop_master else 120
            progress = calculate_growth_progress(crop.planting_date, total_days)
            
            # Get latest recommendation
            latest_rec = Recommendation.query.filter_by(
                planting_id=crop.planting_id,
                implemented=False
            ).order_by(Recommendation.recommendation_date.desc()).first()
            
            crops_data.append({
                'planting_id': crop.planting_id,
                'crop_type': crop.crop_type,
                'planting_date': crop.planting_date.isoformat(),
                'progress': progress,
                'growth_stage': crop.current_growth_stage,
                'days_remaining': crop.days_remaining,
                'health_score': crop.health_score,
                'latest_action': latest_rec.action_type if latest_rec else 'monitor',
                'pest_level': crop.pest_pressure_level,
                'disease': crop.disease_detected
            })
        
        # Get weather data
        weather_data = {}
        if user.location_lat and user.location_lon:
            current = weather_service.get_weather(user.location_lat, user.location_lon)
            forecast = weather_service.get_forecast(user.location_lat, user.location_lon)
            weather_data = {
                'current': current,
                'forecast': forecast[:3]
            }
        
        # Get notifications
        notifications = Notification.query.filter_by(
            user_id=user_id, is_read=False
        ).order_by(Notification.created_at.desc()).limit(10).all()
        
        # Get pending recommendations
        pending_recs = []
        for crop in active_crops:
            recs = Recommendation.query.filter_by(
                planting_id=crop.planting_id,
                implemented=False
            ).order_by(Recommendation.recommendation_date.desc()).limit(2).all()
            
            for rec in recs:
                pending_recs.append({
                    'planting_id': crop.planting_id,
                    'crop_type': crop.crop_type,
                    'action': rec.action_type,
                    'reasoning': rec.reasoning,
                    'priority': rec.priority,
                    'date': rec.recommendation_date.isoformat()
                })
        
        # Sort by priority
        priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        pending_recs.sort(key=lambda x: priority_order.get(x['priority'], 4))
        
        return jsonify({
            'user': {
                'username': user.username,
                'location': user.location_name,
                'joined': user.created_at.isoformat()
            },
            'active_crops': crops_data,
            'weather': weather_data,
            'pending_recommendations': pending_recs[:5],
            'notifications': [{
                'id': n.notification_id,
                'type': n.notification_type,
                'title': n.title,
                'message': n.message,
                'time': n.created_at.isoformat()
            } for n in notifications],
            'summary': {
                'total_crops': len(active_crops),
                'avg_progress': np.mean([c['progress'] for c in crops_data]) if crops_data else 0,
                'avg_health': np.mean([c['health_score'] for c in crops_data]) if crops_data else 100,
                'alerts': len([c for c in crops_data if c['pest_level'] in ['medium', 'high'] or c['disease']])
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================
# HELPER FUNCTIONS
# ============================================

def create_initial_recommendations(planting_id, crop_type):
    """Create initial recommendations for new crop"""
    crop = CropMaster.query.filter_by(crop_type=crop_type).first()
    
    # Initial watering recommendation
    water_rec = Recommendation(
        planting_id=planting_id,
        recommendation_date=datetime.now().date(),
        action_type='irrigate',
        priority='medium',
        watering_amount_l=crop.water_need_l_per_week * 0.3 if crop else 10,
        watering_interval_days=3,
        reasoning="Initial watering for seedling establishment",
        confidence_score=0.9,
        source='system'
    )
    
    # First observation reminder (3 days later)
    obs_rec = Recommendation(
        planting_id=planting_id,
        recommendation_date=(datetime.now() + timedelta(days=3)).date(),
        action_type='monitor',
        priority='low',
        reasoning="Schedule first visual inspection of seedlings",
        confidence_score=0.7,
        source='system'
    )
    
    db.session.add(water_rec)
    db.session.add(obs_rec)

def calculate_water_amount(crop_type, growth_stage, features):
    """Calculate optimal water amount"""
    crop = CropMaster.query.filter_by(crop_type=crop_type).first()
    if not crop:
        return 10.0
    
    base_water = crop.water_need_l_per_week
    
    # Adjust for growth stage
    milestone = GrowthMilestone.query.filter_by(
        crop_type=crop_type, growth_stage=growth_stage
    ).first()
    multiplier = milestone.water_requirement_multiplier if milestone else 1.0
    
    # Adjust for weather/temperature
    temp_factor = 1.0
    if features.get('temperature_category') in ['warm', 'hot']:
        temp_factor = 1.3
    elif features.get('temperature_category') in ['cold', 'cool']:
        temp_factor = 0.7
    
    # Adjust for estimated moisture
    moisture_factor = 1.0
    if features.get('estimated_moisture') == 'dry':
        moisture_factor = 1.5
    elif features.get('estimated_moisture') == 'wet':
        moisture_factor = 0.5
    
    water_amount = base_water * multiplier * temp_factor * moisture_factor * 0.15  # Daily amount
    return round(water_amount, 2)

def recommend_fertilizer_type(crop_type, growth_stage):
    """Recommend fertilizer type based on crop and stage"""
    if growth_stage == 'vegetative':
        return 'Nitrogen-rich (NPK 20-10-10)'
    elif growth_stage == 'flowering':
        return 'Potassium-rich (NPK 10-20-20)'
    else:
        return 'Balanced (NPK 15-15-15)'

def recommend_fertilizer_amount(crop_type):
    """Recommend fertilizer amount"""
    amounts = {
        'Tomato': 100,
        'Rice': 120,
        'Wheat': 130,
        'Maize': 150,
        'Potato': 140,
        'Soybean': 110
    }
    return amounts.get(crop_type, 120)

def get_action_details(recommendation):
    """Get detailed action information"""
    details = {}
    if recommendation.action_type == 'irrigate':
        details = {
            'water_amount_l': recommendation.watering_amount_l,
            'interval_days': recommendation.watering_interval_days,
            'best_time': 'Early morning or late evening',
            'method': 'Water at base of plants'
        }
    elif recommendation.action_type == 'fertilize':
        details = {
            'fertilizer_type': recommendation.fertilizer_type,
            'amount_kg': recommendation.fertilizer_amount_kg,
            'next_application': recommendation.next_fertilizer_days,
            'application_method': 'Spread evenly around base, water well'
        }
    elif recommendation.action_type == 'pesticide':
        details = {
            'pesticide_type': recommendation.pesticide_type,
            'interval_days': recommendation.pesticide_interval_days,
            'safety': 'Wear gloves and mask. Apply in calm weather.',
            'reentry_period': '24 hours'
        }
    elif recommendation.action_type == 'monitor':
        details = {
            'frequency': 'Daily visual inspection',
            'focus': 'Check for pests, diseases, growth abnormalities',
            'documentation': 'Take photos and notes'
        }
    elif recommendation.action_type == 'harvest':
        details = {
            'timing': 'Early morning when plants are hydrated',
            'method': 'Use clean, sharp tools',
            'storage': 'Store in cool, dry place',
            'next_steps': 'Prepare soil for next crop'
        }
    
    return details

def store_decision_pattern(crop_type, features, action, weather, temp_category):
    """Store decision pattern for SVM training"""
    try:
        # Convert numerical health back to categorical
        health_map = {0: 'excellent', 1: 'good', 2: 'fair', 3: 'poor'}
        health_cat = health_map.get(features.get('visual_health', 1), 'good')
        
        # Convert numerical pest back to categorical
        pest_map = {0: 'none', 1: 'low', 2: 'medium', 3: 'high'}
        pest_cat = pest_map.get(features.get('pest_pressure', 0), 'none')
        
        # Convert numerical stage back to categorical
        stage_map = {0: 'seedling', 1: 'vegetative', 2: 'flowering', 3: 'mature'}
        stage_cat = stage_map.get(features.get('growth_stage', 1), 'vegetative')
        
        pattern = DecisionPattern(
            crop_type=crop_type,
            visual_health=health_cat,
            pest_presence=pest_cat,
            growth_stage=stage_cat,
            days_elapsed=features.get('days_elapsed', 30),
            weather_forecast=weather,
            temperature_category=temp_category,
            recommended_action=action,
            outcome_score=0.8  # Default good outcome
        )
        
        db.session.add(pattern)
        db.session.commit()
        
    except Exception as e:
        print(f"Error storing pattern: {e}")
        db.session.rollback()

def determine_weather_impact(current_weather):
    """Determine weather impact on crops"""
    impact = {
        'status': 'Normal',
        'recommendations': [],
        'risks': []
    }
    
    temp_cat = current_weather.get('temperature_category', 'optimal')
    weather_cat = current_weather.get('weather_category', 'sunny')
    
    # Temperature checks
    if temp_cat == 'hot':
        impact['status'] = 'Heat Stress'
        impact['recommendations'].append('Water in early morning or evening')
        impact['recommendations'].append('Provide shade if possible')
        impact['risks'].append('Heat stress can reduce yields')
    
    elif temp_cat == 'cold':
        impact['status'] = 'Cold Stress'
        impact['recommendations'].append('Reduce watering frequency')
        impact['recommendations'].append('Use covers for frost protection')
        impact['risks'].append('Frost damage possible')
    
    # Weather checks
    if weather_cat == 'rainy':
        impact['status'] = 'Rain Expected'
        impact['recommendations'].append('Delay watering and fertilizer applications')
        impact['recommendations'].append('Ensure proper drainage')
        impact['risks'].append('Waterlogging and disease risk')
    
    elif weather_cat == 'storm':
        impact['status'] = 'Storm Warning'
        impact['recommendations'].append('Secure plants and structures')
        impact['recommendations'].append('Harvest ripe crops if possible')
        impact['risks'].append('Physical damage to crops')
    
    return impact

def get_next_milestone(crop_type, days_elapsed):
    """Get next growth milestone"""
    milestones = GrowthMilestone.query.filter_by(
        crop_type=crop_type
    ).order_by('days_from_planting').all()
    
    if not milestones:
        return None
    
    for milestone in milestones:
        if milestone.days_from_planting > days_elapsed:
            return {
                'stage': milestone.growth_stage,
                'days_until': milestone.days_from_planting - days_elapsed,
                'ideal_temp': f"{milestone.ideal_temp_min}-{milestone.ideal_temp_max}°C",
                'key_tasks': milestone.key_tasks or 'Monitor growth and health'
            }
    
    return {'stage': 'harvest', 'days_until': 0, 'key_tasks': 'Prepare for harvest'}

def get_crop_season(crop_type):
    """Get season for crop"""
    season_map = {
        'Tomato': 'Summer',
        'Rice': 'Monsoon',
        'Wheat': 'Winter',
        'Maize': 'Summer',
        'Potato': 'Winter',
        'Soybean': 'Monsoon'
    }
    return season_map.get(crop_type, 'All season')

# ============================================
# DATABASE INITIALIZATION
# ============================================

def initialize_database():
    """Initialize database with sample data"""
    with app.app_context():
        # Create tables
        db.create_all()
        
        # Check if crops already exist
        if CropMaster.query.count() == 0:
            print("Initializing database with crop data...")
            
            # Add crops from CSV
            crops_data = [
                ('Tomato', 25.0, 6.2, 35, 110),
                ('Rice', 28.0, 6.0, 50, 150),
                ('Wheat', 20.0, 6.5, 25, 140),
                ('Maize', 26.0, 6.8, 30, 120),
                ('Potato', 18.0, 5.5, 20, 90),
                ('Soybean', 24.0, 6.5, 30, 85)
            ]
            
            for crop_type, temp, ph, water, days in crops_data:
                crop = CropMaster(
                    crop_type=crop_type,
                    ideal_temperature_c=temp,
                    ideal_soil_ph=ph,
                    water_need_l_per_week=water,
                    total_growth_days=days,
                    min_nitrogen_ppm=40,
                    max_nitrogen_ppm=80,
                    min_phosphorus_ppm=15,
                    max_phosphorus_ppm=35,
                    min_potassium_ppm=80,
                    max_potassium_ppm=140
                )
                db.session.add(crop)
            
            # Add growth milestones for Tomato as example
            tomato_milestones = [
                ('Tomato', 'seedling', 1, 0.1, 0.3, 20, 30, 0.7, 'Keep soil moist, provide light'),
                ('Tomato', 'vegetative', 15, 0.3, 0.7, 22, 32, 1.0, 'Support stems, monitor growth'),
                ('Tomato', 'flowering', 50, 0.6, 0.9, 24, 30, 1.2, 'Pollination support, reduce nitrogen'),
                ('Tomato', 'mature', 90, 0.5, 0.8, 20, 28, 0.8, 'Harvest ripe fruits, reduce watering')
            ]
            
            for crop_type, stage, days, min_ndvi, max_ndvi, min_temp, max_temp, water_mult, tasks in tomato_milestones:
                milestone = GrowthMilestone(
                    crop_type=crop_type,
                    growth_stage=stage,
                    days_from_planting=days,
                    min_ndvi=min_ndvi,
                    max_ndvi=max_ndvi,
                    ideal_temp_min=min_temp,
                    ideal_temp_max=max_temp,
                    water_requirement_multiplier=water_mult,
                    key_tasks=tasks
                )
                db.session.add(milestone)
            
            db.session.commit()
            print("Database initialized successfully!")

# -------------------------
# Authentication Endpoints
# -------------------------
@app.route('/api/register', methods=['POST'])
def register_user():
    try:
        data = request.json or {}
        username = (data.get('username') or '').strip()
        email = (data.get('email') or '').strip().lower()
        password = data.get('password') or ''

        if not username or not email or not password:
            return jsonify({'error': 'username, email and password are required'}), 400
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # Check unique username and email
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already exists'}), 409
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409

        pw_hash = generate_password_hash(password)
        user = User(username=username, email=email, password_hash=pw_hash)
        db.session.add(user)
        db.session.commit()

        # Record registration action
        ua = UserAction(user_id=user.user_id, action_type='register', details=json.dumps({'username': username}))
        db.session.add(ua)
        db.session.commit()

        return jsonify({'success': True, 'user': {'user_id': user.user_id, 'username': user.username, 'email': user.email}}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login_user():
    try:
        data = request.json or {}
        identifier = (data.get('username') or data.get('email') or '').strip()
        password = data.get('password') or ''

        if not identifier or not password:
            return jsonify({'error': 'username/email and password required'}), 400

        user = User.query.filter((User.username == identifier) | (User.email == identifier)).first()
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401

        if not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Record login action
        try:
            ua = UserAction(user_id=user.user_id, action_type='login', details=json.dumps({'ip': request.remote_addr}))
            db.session.add(ua)
            db.session.commit()
        except Exception:
            db.session.rollback()

        return jsonify({'success': True, 'user': {'user_id': user.user_id, 'username': user.username, 'email': user.email, 'location_lat': user.location_lat, 'location_lon': user.location_lon, 'location_name': user.location_name}})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================
# RUN APPLICATION
# ============================================

if __name__ == '__main__':
    # Initialize database
    initialize_database()
    
    print("=" * 50)
    print("🌱 Smart Crop System Backend ")
    print("=" * 50)
    print(f"SVM Model: {'✅ Loaded' if ml_models.svm_model else '⚠️ Rule-based'}")
    print(f"Random Forest Model: {'✅ Loaded' if ml_models.random_forest_model else '❌ Not loaded'}")
    print(f"Decision Tree Model: {'✅ Loaded' if ml_models.decision_tree_model else '❌ Not loaded'}")
    print(f"Keras H5 Model: {'✅ Loaded' if crop_model else '❌ Not loaded'}")
    print(f"Database: ✅ Connected")
    print(f"Weather Service: ✅ Ready")
    print("=" * 50)
    print("🌾 Available API Endpoints:")
    print("  GET  /api/health - Health check")
    print("  POST /api/predict - Image analysis (H5 model)")
    print("  POST /api/predict-fertilizer - Fertilizer recommendation (Random Forest)")
    print("  POST /api/predict-tasks - Task recommendation (Decision Tree)")
    print("  POST /api/weather - Weather data")
    print("  POST /api/select-crop - Plant a new crop")
    print("  GET  /api/user/<id>/crops - Get user crops")
    print("  GET  /api/crop/<id>/progress - Get crop progress")
    print("  POST /api/register - Create a new user account")
    print("  POST /api/login - Authenticate and return user info")
    print("=" * 50)
    print(f"📡 API Base URL: http://localhost:5000")
    print("=" * 50)
    
    app.run(debug=True, port=5000)