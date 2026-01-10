import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model

# Load dataset again (same preprocessing as training)
df = pd.read_csv("smart_crop_dataset.csv")
data = df["air_temperature_c"].values

# Prepare test input (last 10 values from dataset)
test_input = data[-10:]   # last 10 timesteps
test_input = test_input.reshape((1, 10, 1))  # reshape for LSTM

# Load the trained model
model = load_model("lstm_model.h5")

# Predict the next temperature
predicted_temp = model.predict(test_input)
print("🌡️ Predicted next temperature:", predicted_temp[0][0])