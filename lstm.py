import numpy as np
import pandas as pd
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense

# Example weather dataset
df = pd.read_csv("smart_crop_dataset.csv")
data = df["air_temperature_c"].values

X, y = [], []
for i in range(10, len(data)):
    X.append(data[i-10:i])
    y.append(data[i])

X = np.array(X)
y = np.array(y)

X = X.reshape((X.shape[0], X.shape[1], 1))

model = Sequential([
    LSTM(50, return_sequences=False, input_shape=(10,1)),
    Dense(1)
])

model.compile(optimizer="adam", loss="mse")
model.fit(X, y, epochs=20, batch_size=16)

model.save("lstm_model.h5")
print("✅ LSTM trained and saved")
