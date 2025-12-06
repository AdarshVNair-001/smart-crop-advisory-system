# smart-crop-advisory-ssytem

Overview

The Smart Agriculture Advisory System is a web-based intelligent platform designed to assist farmers with data-driven, personalized agricultural recommendations. By integrating multiple computational models and real-time environmental data, the system provides stage-specific guidance throughout the crop lifecycle. It addresses challenges such as unpredictable climate conditions, pest infestations, and nutrient deficiencies, while optimizing resource usage.


<img width="1326" height="620" alt="image" src="https://github.com/user-attachments/assets/26194043-0405-4c72-88cc-58db6fc29886" />

Features

1. Crop Input & Lifecycle Scheduling

  🟢. Users enter crop type and planting date.
  🟢. System fetches real-time + historical weather data via APIs.
  🟢. Generates a crop-stage timeline with recommended operations.
<img width="1340" height="534" alt="image" src="https://github.com/user-attachments/assets/46f6bd4f-f54b-4033-aa99-8cbfaba5bb5c" />

<img width="1345" height="622" alt="image" src="https://github.com/user-attachments/assets/09fd7529-6b37-4360-bee2-336ea90ec426" />

<img width="1335" height="609" alt="image" src="https://github.com/user-attachments/assets/6561c648-74e0-4455-9142-49af203e6222" />

<img width="1331" height="571" alt="image" src="https://github.com/user-attachments/assets/026fdc71-c621-469a-9b45-927bd758b351" />


2. Machine Learning–Driven Decisions

  🟢Decision Tree Model → Irrigation & nutrient guidelines under structured conditions.
  🟢Support Vector Machine (SVM) → Resolves ambiguous or overlapping decision cases.
  🟢LSTM Network → Weather pattern prediction for proactive scheduling.
  🟢Random Forest Model → Fertilizer recommendations based on crop & soil conditions.
  🟢CNN Model → Image-based detection of plant pests & diseases.

3. Pest & Disease Image Detection

  🟢Users upload an image of a leaf/plant or pest
  🟢identifies the uploded image based on cnn model
  
  <img width="1344" height="354" alt="image" src="https://github.com/user-attachments/assets/8566f3f4-73b1-4a29-bc14-045e8a329cf0" />
  
  <img width="1281" height="580" alt="image" src="https://github.com/user-attachments/assets/70e126d7-0a13-4711-aa1d-1698f5f15e02" />

4. Fertilizer Recommendation System
   
   🟢Users input plant type and soil type 
   🟢The Random Forest model evaluates the crop–soil combination and predicts the optimal fertilizer needed for healthy growth.
   The output includes:
   🟢Recommended fertilizer
   🟢Reason for recommendation, based on nutrient requirements and soil characteristics.
   🟢Ensures smart nutrient management by matching fertilizers to both crop needs and soil nutrient behavior.
   
<img width="1340" height="599" alt="image" src="https://github.com/user-attachments/assets/6f5c8fcc-7dfc-4100-8830-1b2af09672da" />

<img width="1339" height="496" alt="image" src="https://github.com/user-attachments/assets/ca0d876d-f261-4682-8352-c0a9be2b4ad6" />

Datasets Used

Agricultural Pests Image Dataset
Plant Disease Dataset=https://www.kaggle.com/datasets/emmarex/plantdisease
Technology Stack=https://www.kaggle.com/datasets/vencerlanz09/agricultural-pests-image-dataset

Frontend: Web-based interface (HTML/CSS/JavaScript or framework of choice)
Backend: Python (Flask/Django) for model integration and API handling
Machine Learning Models: Decision Tree, SVM, Random Forest, LSTM, CNN
Data Sources: Real-time weather APIs, historical crop/weather datasets
Deployment: Cloud platforms (AWS/GCP/Azure) and edge computing devices

Benefits

Personalized, stage-specific recommendations for crops
Automated pest and disease detection
Efficient irrigation and nutrient management
Improved productivity and resource optimization
Resilient against environmental variability

Usage

Upload crop images and enter crop type and planting date.
System fetches weather data and processes it using LSTM for predictive analysis.
Machine learning models generate actionable recommendations for irrigation, fertilization, and pest/disease management.
Users receive tailored guidance to optimize crop yield and resource usage.

Steps to Run the Project

1. Clone the Repository
   git clone https://github.com/AdarshVNair-001/smart-crop-advisory-system.git
   cd smart-crop-advisory-system
   
3. Create a virtual environment
   python -m venv venv

4. Install all dependencies
   pip install -r backend/requirements.txt

5. Run the Backend Server
   python app.py

6. Run the Frontend
   frontend/index.html
   
License
This project uses publicly available datasets from Kaggle.
