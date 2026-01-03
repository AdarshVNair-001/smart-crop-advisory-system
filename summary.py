import os
import sys
import traceback
from datetime import datetime

# Try to import optional heavy deps
try:
    import tensorflow as tf
except Exception:
    tf = None

try:
    import joblib
except Exception:
    joblib = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")
SUMMARY_FILE = os.path.join(SCRIPT_DIR, "combined_model_summary_lim.txt")


# Header
header = "SMART CROP ADVISORY SYSTEM – MODEL SUMMARY"

with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
    f.write(header + "\n")
    f.write(("=" * 60) + "\n\n")
    f.write(f"Generated: {datetime.utcnow().isoformat()} UTC\n\n")

    # Only include requested models: LSTM, SVM, Random Forest, Decision Tree, and any .h5 models
    keywords = ('lstm', 'svm', 'rf', 'random', 'dt', 'decision', 'crop')
    files = []

    # check models directory
    try:
        for fname in sorted(os.listdir(MODELS_DIR)):
            if any(kw in fname.lower() for kw in keywords) or fname.lower().endswith(('.h5', '.hdf5')):
                files.append(os.path.join(MODELS_DIR, fname))
    except Exception as e:
        f.write(f"Error listing models directory '{MODELS_DIR}': {e}\n")

    # also check project root for matching files (e.g., lstm_model.h5)
    try:
        for fname in sorted(os.listdir(SCRIPT_DIR)):
            if any(kw in fname.lower() for kw in keywords) or fname.lower().endswith(('.h5', '.hdf5')):
                full = os.path.join(SCRIPT_DIR, fname)
                if full not in files and os.path.isfile(full):
                    files.append(full)
    except Exception as e:
        f.write(f"Error listing script directory '{SCRIPT_DIR}': {e}\n")

    if not files:
        f.write("No matching model files found for the requested types (lstm, svm, random forest, decision tree, h5).\n")

    # Build performance table for requested models
    # We'll try to load saved training summaries where available and compute LSTM metrics if possible.

# ===============================
# LOAD MODELS
# ===============================
models = [
    ("Decision Tree", "models/dt_task.pkl", "clf"),
    ("SVM", "models/svm_decision.pkl", "clf"),
    ("Random Forest", "models/rf_fertilizer.pkl", "clf"),
    ("Crop Disease/Pest (Keras)", "models/crop_disease_pest_model.h5", "h5"),
    ("LSTM", "lstm_model.h5", "h5")
]

table = []

# Quick status table — accurate metrics will be computed below when possible
for name, path, model_type in models:
    # check both provided path and models directory basename
    provided = os.path.join(SCRIPT_DIR, path) if not os.path.isabs(path) else path
    alt = os.path.join(MODELS_DIR, os.path.basename(path))
    exists = os.path.exists(provided) or os.path.exists(alt)
    status = 'found' if exists else 'missing'
    table.append([
        name,
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        status
    ])

# ===============================
# PRINT QUICK STATUS TABLE
# ===============================
headers = [
    "Model",
    "Accuracy (%)",
    "Precision",
    "Recall",
    "F1-Score",
    "Status"
]

print("\n" + "="*70)
print("MODEL FILE STATUS")
print("="*70)
try:
    print(tabulate(table, headers=headers, tablefmt="github"))
except Exception:
    # tabulate may not be installed; fallback to plain print
    for row in table:
        print(row)


    try:
        from sklearn.metrics import r2_score, mean_squared_error
    except Exception:
        r2_score = None
        mean_squared_error = None

    # helper to format values
    def pct(val):
        if val is None:
            return "N/A"
        try:
            v = float(val)
            if v <= 1:
                v = v * 100
            return f"{v:.2f}%"
        except Exception:
            return str(val)

    rows = []  # list of dicts: name, accuracy, precision, recall, f1, extra

    # Decision Tree summary
    dt_summary_path = os.path.join(MODELS_DIR, "task_training_summary.pkl")
    if os.path.exists(dt_summary_path) and joblib is not None:
        try:
            s = joblib.load(dt_summary_path)
            rows.append({
                'Model': 'Decision Tree',
                'Accuracy': s.get('accuracy'),
                'Precision': None,
                'Recall': None,
                'F1': None,
                'Extra': f"Samples={s.get('n_samples', 'N/A')}"
            })
        except Exception:
            rows.append({'Model': 'Decision Tree', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'Could not load summary'})
    else:
        rows.append({'Model': 'Decision Tree', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'No summary file'})

    # SVM summary
    svm_summary_path = os.path.join(MODELS_DIR, "svm_training_summary.pkl")
    if os.path.exists(svm_summary_path) and joblib is not None:
        try:
            s = joblib.load(svm_summary_path)
            acc = s.get('test_accuracy') or s.get('test_accuracy') or s.get('test_accuracy')
            rows.append({'Model': 'SVM', 'Accuracy': acc or s.get('train_accuracy'), 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'binary (Delay/Proceed)'})
        except Exception:
            rows.append({'Model': 'SVM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'Could not load summary'})
    else:
        # Try to infer existence of SVM model file
        svm_file = None
        for p in files:
            if 'svm' in os.path.basename(p).lower():
                svm_file = p
                break
        if svm_file:
            rows.append({'Model': 'SVM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': f'Found model file: {os.path.basename(svm_file)}'})
        else:
            rows.append({'Model': 'SVM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'No model found'})

    # Random Forest summary
    rf_summary_path = os.path.join(MODELS_DIR, "training_summary.pkl")
    if os.path.exists(rf_summary_path) and joblib is not None:
        try:
            s = joblib.load(rf_summary_path)
            rows.append({'Model': 'Random Forest', 'Accuracy': s.get('accuracy'), 'Precision': None, 'Recall': None, 'F1': None, 'Extra': f"Fertilizers={s.get('n_fertilizers', 'N/A') or 'N/A'}"})
        except Exception:
            rows.append({'Model': 'Random Forest', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'Could not load summary'})
    else:
        rows.append({'Model': 'Random Forest', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'No summary file'})

    # LSTM: compute regression metrics if possible
    lstm_paths = [p for p in files if 'lstm' in os.path.basename(p).lower() and p.lower().endswith('.h5')]
    if lstm_paths:
        lstm_path = lstm_paths[0]
        if tf is not None:
            try:
                import pandas as pd
                df = pd.read_csv(os.path.join(SCRIPT_DIR, 'smart_crop_dataset.csv'))
                data = df['air_temperature_c'].values
                # build sliding windows
                X, y = [], []
                window = 10
                for i in range(window, len(data)):
                    X.append(data[i-window:i])
                    y.append(data[i])
                import numpy as np
                X = np.array(X)
                y = np.array(y)
                X = X.reshape((X.shape[0], X.shape[1], 1))
                # use last 20% for test
                split = int(len(X)*0.8)
                X_test = X[split:]
                y_test = y[split:]
                model = tf.keras.models.load_model(lstm_path)
                preds = model.predict(X_test).flatten()
                r2 = None
                mse = None
                if r2_score is not None:
                    r2 = r2_score(y_test, preds)
                    mse = mean_squared_error(y_test, preds) if mean_squared_error is not None else None
                rows.append({'Model': 'LSTM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': f"R2={r2 if r2 is not None else 'N/A'}, RMSE={((mse or 0)**0.5):.4f}"})
            except Exception:
                rows.append({'Model': 'LSTM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'Error evaluating LSTM'})
        else:
            rows.append({'Model': 'LSTM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'TensorFlow not available'})
    else:
        rows.append({'Model': 'LSTM', 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'No LSTM .h5 found'})

    # Include other .h5 models (e.g., crop disease) as a general entry
    other_h5 = [p for p in files if p.lower().endswith('.h5') and 'lstm' not in os.path.basename(p).lower()]
    for p in other_h5:
        rows.append({'Model': os.path.basename(p).replace('.h5',''), 'Accuracy': None, 'Precision': None, 'Recall': None, 'F1': None, 'Extra': 'Keras model — metrics N/A'})

    # Write the performance table
    f.write("\n" + "="*70 + "\n")
    f.write("MODEL PERFORMANCE SUMMARY TABLE\n")
    f.write("="*70 + "\n")

    hdr = f"{'Model':30} {'Accuracy (%)':12} {'Precision':10} {'Recall':10} {'F1-Score':10} {'Additional Metric':20}\n"
    f.write(hdr)
    f.write("-"*70 + "\n")

    for r in rows:
        acc = pct(r.get('Accuracy'))
        prec = pct(r.get('Precision')) if r.get('Precision') is not None else 'N/A'
        rec = pct(r.get('Recall')) if r.get('Recall') is not None else 'N/A'
        f1 = pct(r.get('F1')) if r.get('F1') is not None else 'N/A'
        extra = r.get('Extra') or ''
        line = f"{r['Model'][:30]:30} {acc:12} {prec:10} {rec:10} {f1:10} {extra:20}\n"
        f.write(line)

    f.write("\nProcess completed.\n")

    f.write("\n\nProcess completed.\n")

print(f"✅ Combined summary saved to {SUMMARY_FILE}")
