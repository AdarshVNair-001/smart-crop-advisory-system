# =========================
# 1️⃣ IMPORT LIBRARIES
# =========================
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator, load_img, img_to_array
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D
from sklearn.utils.class_weight import compute_class_weight

# =========================
# 2️⃣ PARAMETERS & PATHS
# =========================
IMG_HEIGHT, IMG_WIDTH = 224, 224
BATCH_SIZE = 32
EPOCHS = 2

# Dataset directory (both PlantVillage + pest_detection)
DATASET_DIR = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\dataset'

# Model save path
MODEL_DIR = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\models'
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, 'crop_disease_pest_model.h5')

# Test image path
TEST_IMAGE = r'D:\Users\Adarsh V Nair\Documents\projects\final yr\smart-crop-advisory-system\test_images\test_image.jpg'

# =========================
# 3️⃣ DATA AUGMENTATION & LOADING
# =========================
datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.2,
    height_shift_range=0.2,
    horizontal_flip=True,
    validation_split=0.2
)

train_gen = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_HEIGHT, IMG_WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training',
    shuffle=True
)

val_gen = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_HEIGHT, IMG_WIDTH),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation'
)

# Class mapping
class_labels = list(train_gen.class_indices.keys())
num_classes = len(class_labels)
print("Class labels:", class_labels)

# =========================
# 4️⃣ CLASS WEIGHTS
# =========================
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.arange(num_classes),
    y=train_gen.classes
)
class_weights = dict(enumerate(class_weights))
print("Class weights:", class_weights)

# =========================
# 5️⃣ BUILD CNN MODEL (TRANSFER LEARNING)
# =========================
base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(IMG_HEIGHT, IMG_WIDTH, 3))
x = GlobalAveragePooling2D()(base_model.output)
x = Dense(256, activation='relu')(x)
predictions = Dense(num_classes, activation='softmax')(x)
model = Model(inputs=base_model.input, outputs=predictions)

# Freeze base model initially
for layer in base_model.layers:
    layer.trainable = False

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# =========================
# 6️⃣ INITIAL TRAINING
# =========================
model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS//2,
    class_weight=class_weights
)

# =========================
# 7️⃣ FINE-TUNE TOP LAYERS
# =========================
for layer in base_model.layers[-30:]:  # unfreeze last 30 layers
    layer.trainable = True

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-5),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=EPOCHS//2,
    class_weight=class_weights
)

# =========================
# 8️⃣ SAVE MODEL
# =========================
model.save(MODEL_PATH)
print(f'✅ Model saved at: {MODEL_PATH}')

# =========================
# 9️⃣ VALIDATION EVALUATION
# =========================
val_loss, val_acc = model.evaluate(val_gen)
print(f'📊 Validation Accuracy: {val_acc*100:.2f}%')

# =========================
# 🔟 PREDICTION FUNCTION
# =========================
def predict_image(image_path):
    img = load_img(image_path, target_size=(IMG_HEIGHT, IMG_WIDTH))
    img_array = img_to_array(img)/255.0
    img_array = np.expand_dims(img_array, axis=0)

    pred = model.predict(img_array)
    pred_index = np.argmax(pred)
    pred_label = class_labels[pred_index]

    # Debug: show raw probabilities
    print("Raw model output:", pred)
    return pred_label

# Example prediction
pred_class = predict_image(TEST_IMAGE)
print(f'🌾 Predicted class: {pred_class}')



