import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.preprocessing import MinMaxScaler
import requests
from datetime import datetime, timedelta
import json

class WeatherPredictor:
    def __init__(self):
        self.model = None
        self.scaler = MinMaxScaler()
        self.sequence_length = 10
        
    def fetch_historical_weather(self, lat, lon, days=30):
        """
        Fetch historical weather data from OpenWeatherMap API
        You'll need to get a free API key from https://openweathermap.org/api
        """
        API_KEY = "your_openweather_api_key_here"  # Replace with your API key
        
        # Calculate dates
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        historical_data = []
        
        # OpenWeatherMap Historical API (you might need to use OneCall 2.5 or 3.0)
        try:
            url = f"https://api.openweathermap.org/data/2.5/onecall/timemachine"
            for i in range(days):
                date = start_date + timedelta(days=i)
                timestamp = int(date.timestamp())
                
                response = requests.get(
                    f"{url}?lat={lat}&lon={lon}&dt={timestamp}&appid={API_KEY}&units=metric"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if 'current' in data:
                        historical_data.append({
                            'date': date.strftime('%Y-%m-%d'),
                            'temperature': data['current']['temp'],
                            'humidity': data['current']['humidity'],
                            'pressure': data['current']['pressure'],
                            'wind_speed': data['current']['wind_speed'],
                            'description': data['current']['weather'][0]['description']
                        })
        except Exception as e:
            print(f"Error fetching historical data: {e}")
            # Return mock data for demonstration
            return self.generate_mock_data(days)
        
        return historical_data
    
    def generate_mock_data(self, days=30):
        """Generate realistic mock weather data for demonstration"""
        base_temp = 25
        data = []
        current_date = datetime.now() - timedelta(days=days)
        
        for i in range(days):
            date = current_date + timedelta(days=i)
            # Simulate seasonal variation
            temp_variation = np.sin(i * 0.2) * 8
            temperature = base_temp + temp_variation + np.random.normal(0, 2)
            
            data.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': max(-10, min(45, temperature)),  # Reasonable range
                'humidity': max(20, min(95, 60 + np.random.normal(0, 15))),
                'pressure': 1013 + np.random.normal(0, 10),
                'wind_speed': max(0, np.random.normal(3, 2)),
                'description': np.random.choice(['clear', 'cloudy', 'rainy'])
            })
        
        return data
    
    def prepare_data(self, weather_data):
        """Prepare data for LSTM training"""
        df = pd.DataFrame(weather_data)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        
        # Use temperature as primary feature
        temperatures = df['temperature'].values.reshape(-1, 1)
        
        # Normalize the data
        scaled_data = self.scaler.fit_transform(temperatures)
        
        # Create sequences
        X, y = [], []
        for i in range(self.sequence_length, len(scaled_data)):
            X.append(scaled_data[i-self.sequence_length:i, 0])
            y.append(scaled_data[i, 0])
        
        return np.array(X), np.array(y), df
    
    def build_model(self, input_shape):
        """Build LSTM model"""
        self.model = Sequential([
            LSTM(50, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(50, return_sequences=True),
            Dropout(0.2),
            LSTM(50),
            Dropout(0.2),
            Dense(25),
            Dense(1)
        ])
        
        self.model.compile(
            optimizer='adam',
            loss='mean_squared_error',
            metrics=['mae']
        )
    
    def train_model(self, weather_data):
        """Train the LSTM model on weather data"""
        X, y, df = self.prepare_data(weather_data)
        
        if len(X) == 0:
            print("Not enough data for training")
            return False
        
        # Reshape X for LSTM [samples, time steps, features]
        X = X.reshape((X.shape[0], X.shape[1], 1))
        
        if self.model is None:
            self.build_model((X.shape[1], 1))
        
        # Train the model
        history = self.model.fit(
            X, y,
            epochs=100,
            batch_size=32,
            validation_split=0.2,
            verbose=0
        )
        
        return True
    
    def predict_weather(self, weather_data, future_days=5):
        """Predict future weather"""
        if not self.train_model(weather_data):
            return self.generate_future_predictions(weather_data, future_days)
        
        # Get the last sequence for prediction
        df = pd.DataFrame(weather_data)
        temperatures = df['temperature'].values.reshape(-1, 1)
        scaled_data = self.scaler.transform(temperatures)
        
        last_sequence = scaled_data[-self.sequence_length:].reshape(1, self.sequence_length, 1)
        
        # Generate predictions
        predictions = []
        current_sequence = last_sequence.copy()
        
        for _ in range(future_days):
            next_pred = self.model.predict(current_sequence, verbose=0)
            predictions.append(next_pred[0, 0])
            
            # Update sequence for next prediction
            current_sequence = np.roll(current_sequence, -1, axis=1)
            current_sequence[0, -1, 0] = next_pred[0, 0]
        
        # Convert back to original scale
        predictions = np.array(predictions).reshape(-1, 1)
        predictions = self.scaler.inverse_transform(predictions)
        
        # Generate future dates
        last_date = datetime.strptime(weather_data[-1]['date'], '%Y-%m-%d')
        future_dates = [last_date + timedelta(days=i+1) for i in range(future_days)]
        
        future_weather = []
        for i, date in enumerate(future_dates):
            future_weather.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': float(predictions[i, 0]),
                'humidity': np.random.normal(65, 10),  # Placeholder
                'pressure': 1013 + np.random.normal(0, 5),
                'wind_speed': np.random.normal(3, 1),
                'description': self.predict_condition(float(predictions[i, 0]))
            })
        
        return future_weather
    
    def predict_condition(self, temperature):
        """Predict weather condition based on temperature"""
        if temperature > 30:
            return 'sunny'
        elif temperature > 20:
            return 'partly cloudy'
        elif temperature > 10:
            return 'cloudy'
        else:
            return 'rainy'
    
    def generate_future_predictions(self, weather_data, future_days):
        """Generate simple predictions if model training fails"""
        last_temp = weather_data[-1]['temperature']
        future_weather = []
        
        last_date = datetime.strptime(weather_data[-1]['date'], '%Y-%m-%d')
        
        for i in range(future_days):
            date = last_date + timedelta(days=i+1)
            # Simple trend-based prediction
            predicted_temp = last_temp + np.random.normal(0, 2)
            predicted_temp = max(-10, min(45, predicted_temp))
            
            future_weather.append({
                'date': date.strftime('%Y-%m-%d'),
                'temperature': predicted_temp,
                'humidity': 65 + np.random.normal(0, 10),
                'pressure': 1013 + np.random.normal(0, 5),
                'wind_speed': 3 + np.random.normal(0, 1),
                'description': self.predict_condition(predicted_temp)
            })
        
        return future_weather

# Global instance
weather_predictor = WeatherPredictor()