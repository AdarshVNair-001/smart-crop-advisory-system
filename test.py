# =========================
# 1️⃣ IMPORT LIBRARIES
# =========================
import os
import numpy as np
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array

# =========================
# 2️⃣ PARAMETERS & PATHS
# =========================
IMG_HEIGHT, IMG_WIDTH = 224, 224

MODEL_PATH = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\models\crop_disease_pest_model.h5'
TEST_FOLDER = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\test_images'

# =========================
# 3️⃣ AUTOMATIC CLASS LABELS
# =========================
# Read all folders in the dataset directory to get class labels
DATASET_DIR = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\dataset'
class_labels = sorted([d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))])
print("📂 Detected class labels:", class_labels)

# =========================
# 4️⃣ LOAD MODEL
# =========================
print("🔄 Loading model...")
model = load_model(MODEL_PATH)
print("✅ Model loaded successfully!")

# =========================
# 5️⃣ PREDICTION FUNCTION
# =========================
def predict_image(image_path):
    img = load_img(image_path, target_size=(IMG_HEIGHT, IMG_WIDTH))
    img_array = img_to_array(img)/255.0
    img_array = np.expand_dims(img_array, axis=0)

    pred = model.predict(img_array)
    pred_index = np.argmax(pred)
    pred_label = class_labels[pred_index]

    # Show raw probabilities
    print(f"\nImage: {os.path.basename(image_path)}")
    print("Raw model output:", pred)
    print(f"🌾 Predicted class: {pred_label}")

# =========================
# 6️⃣ TEST ALL IMAGES IN TEST FOLDER
# =========================
print("\n🔎 Predicting all images in test folder:")
for img_file in os.listdir(TEST_FOLDER):
    if img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
        predict_image(os.path.join(TEST_FOLDER, img_file))


