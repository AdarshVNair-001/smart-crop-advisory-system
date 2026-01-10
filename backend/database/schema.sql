-- Complete database schema with pre-loaded agricultural data

-- Crops Master Table
CREATE TABLE IF NOT EXISTS crops_master (
    crop_id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_name VARCHAR(50) UNIQUE NOT NULL,
    scientific_name VARCHAR(100),
    season VARCHAR(20) CHECK(season IN ('Summer', 'Winter', 'Monsoon', 'All Season')),
    growth_duration_days INTEGER NOT NULL,
    ideal_temp_min REAL,
    ideal_temp_max REAL,
    ideal_soil_ph_min REAL,
    ideal_soil_ph_max REAL,
    water_needs VARCHAR(20) CHECK(water_needs IN ('Low', 'Medium', 'High')),
    spacing_cm VARCHAR(50),
    yield_per_hectare_kg INTEGER,
    description TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-loaded with 12 major crops
INSERT OR IGNORE INTO crops_master VALUES 
(1, 'Tomato', 'Solanum lycopersicum', 'Summer', 110, 20, 30, 5.5, 6.8, 'Medium', '60×90 cm', 25000, 'Warm season crop, needs support', 'tomato.jpg'),
(2, 'Rice', 'Oryza sativa', 'Monsoon', 150, 20, 35, 5.0, 6.5, 'High', '20×20 cm', 4000, 'Staple food crop, needs flooding', 'rice.jpg'),
(3, 'Wheat', 'Triticum aestivum', 'Winter', 140, 15, 25, 6.0, 7.0, 'Medium', '22×22 cm', 3500, 'Winter cereal crop', 'wheat.jpg'),
(4, 'Maize', 'Zea mays', 'Summer', 120, 20, 32, 5.8, 7.0, 'Medium', '75×25 cm', 6000, 'Warm season grain crop', 'maize.jpg'),
(5, 'Potato', 'Solanum tuberosum', 'Winter', 90, 15, 20, 5.0, 6.0, 'Medium', '30×75 cm', 20000, 'Tuber crop, needs hilling', 'potato.jpg'),
(6, 'Soybean', 'Glycine max', 'Monsoon', 85, 20, 30, 6.0, 6.8, 'Medium', '45×5 cm', 2500, 'Oilseed and protein crop', 'soybean.jpg'),
(7, 'Cotton', 'Gossypium hirsutum', 'Summer', 180, 25, 35, 6.0, 7.5, 'Medium', '90×45 cm', 1500, 'Fiber crop', 'cotton.jpg'),
(8, 'Sugarcane', 'Saccharum officinarum', 'All Season', 365, 25, 32, 6.0, 7.5, 'High', '90×90 cm', 70000, 'Perennial grass for sugar', 'sugarcane.jpg'),
(9, 'Groundnut', 'Arachis hypogaea', 'Summer', 120, 25, 35, 5.5, 7.0, 'Low', '30×10 cm', 2000, 'Oilseed crop, grows underground', 'groundnut.jpg'),
(10, 'Chili', 'Capsicum annuum', 'Summer', 100, 20, 30, 6.0, 7.0, 'Medium', '45×30 cm', 8000, 'Spice crop', 'chili.jpg'),
(11, 'Onion', 'Allium cepa', 'Winter', 130, 13, 24, 6.0, 7.0, 'Medium', '15×10 cm', 15000, 'Bulb crop', 'onion.jpg'),
(12, 'Cabbage', 'Brassica oleracea', 'Winter', 90, 15, 20, 6.0, 6.8, 'High', '45×45 cm', 30000, 'Leafy vegetable', 'cabbage.jpg');

-- Fertilizers Master Table
CREATE TABLE IF NOT EXISTS fertilizers_master (
    fertilizer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    fertilizer_name VARCHAR(100) NOT NULL,
    fertilizer_type VARCHAR(50) CHECK(fertilizer_type IN ('Nitrogen', 'Phosphorus', 'Potassium', 'Complex', 'Organic', 'Micronutrient')),
    npk_ratio VARCHAR(20),
    composition TEXT,
    application_method TEXT,
    dosage_per_hectare_kg REAL,
    best_for_crops TEXT,
    precautions TEXT,
    price_per_kg REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-loaded with 20 common fertilizers
INSERT OR IGNORE INTO fertilizers_master VALUES
(1, 'Urea', 'Nitrogen', '46-0-0', 'Nitrogen 46%', 'Broadcast or side dressing', 100, 'Rice, Wheat, Maize', 'Split application to reduce losses', 30),
(2, 'DAP (Diammonium Phosphate)', 'Phosphorus', '18-46-0', 'N 18%, P2O5 46%', 'Basal application at sowing', 150, 'All crops', 'Avoid contact with seeds', 45),
(3, 'MOP (Muriate of Potash)', 'Potassium', '0-0-60', 'K2O 60%', 'Basal or top dressing', 60, 'Potato, Tomato, Banana', 'Not for chloride-sensitive crops', 40),
(4, 'SSP (Single Super Phosphate)', 'Phosphorus', '0-16-0', 'P2O5 16%, S 11%', 'Basal application', 200, 'Groundnut, Pulses', 'Good source of sulfur', 25),
(5, 'NPK 10-26-26', 'Complex', '10-26-26', 'N 10%, P2O5 26%, K2O 26%', 'Basal application', 200, 'Wheat, Cotton', 'Balanced for most crops', 50),
(6, 'NPK 20-20-0', 'Complex', '20-20-0', 'N 20%, P2O5 20%', 'Basal or top dressing', 150, 'Rice, Wheat', 'No potassium', 40),
(7, 'Ammonium Sulphate', 'Nitrogen', '21-0-0', 'N 21%, S 24%', 'Top dressing', 120, 'Rice, Tea', 'Good for sulfur-deficient soils', 35),
(8, 'Calcium Nitrate', 'Nitrogen', '15.5-0-0', 'N 15.5%, Ca 19%', 'Fertigation or foliar', 50, 'Tomato, Capsicum', 'Prevents blossom end rot', 80),
(9, 'Zinc Sulphate', 'Micronutrient', '0-0-0', 'Zn 21%, S 10%', 'Soil/foliar application', 25, 'Rice, Maize', 'Essential for enzyme systems', 120),
(10, 'Boron', 'Micronutrient', '0-0-0', 'B 20%', 'Soil/foliar application', 5, 'Cotton, Pulses', 'Required in small amounts', 200),
(11, 'Farm Yard Manure', 'Organic', '0.5-0.2-0.5', 'Organic matter 30%', 'Basal application', 5000, 'All crops', 'Improves soil structure', 2),
(12, 'Vermicompost', 'Organic', '1.5-0.7-1.2', 'Organic matter 60%', 'Basal or top dressing', 2000, 'Vegetables, Flowers', 'Rich in microbes', 8),
(13, 'Neem Cake', 'Organic', '4-1-2', 'N 4%, P 1%, K 2%', 'Basal application', 500, 'All crops', 'Also acts as pesticide', 15),
(14, 'Rock Phosphate', 'Phosphorus', '0-20-0', 'P2O5 20-30%', 'Basal for acidic soils', 400, 'Acidic soils', 'Slow release', 20),
(15, 'Gypsum', 'Organic', '0-0-0', 'Ca 23%, S 18%', 'Soil amendment', 1000, 'Alkaline soils', 'Improves soil structure', 10),
(16, 'Biofertilizer (Rhizobium)', 'Organic', 'Variable', 'Nitrogen fixing bacteria', 'Seed treatment', 5, 'Pulses, Soybean', 'Store in cool place', 100),
(17, 'Potassium Nitrate', 'Potassium', '13-0-46', 'N 13%, K2O 46%', 'Fertigation/foliar', 50, 'Fruits, Vegetables', 'Chloride-free', 150),
(18, 'Magnesium Sulphate', 'Micronutrient', '0-0-0', 'Mg 9.8%, S 13%', 'Soil/foliar application', 25, 'All crops', 'Corrects magnesium deficiency', 40),
(19, 'Ferrous Sulphate', 'Micronutrient', '0-0-0', 'Fe 19%, S 11%', 'Soil/foliar application', 25, 'All crops', 'Corrects iron chlorosis', 50),
(20, 'NPK 15-15-15', 'Complex', '15-15-15', 'Balanced nutrients', 'Basal or top dressing', 200, 'All crops', 'General purpose', 45);

-- Crop-Fertilizer Recommendations Table (AI training data)
CREATE TABLE IF NOT EXISTS crop_fertilizer_recommendations (
    recommendation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_id INTEGER NOT NULL,
    soil_type VARCHAR(50) CHECK(soil_type IN ('Red', 'Black', 'Alluvial', 'Laterite', 'Sandy', 'Clay', 'Loamy', 'Peaty')),
    growth_stage VARCHAR(50) CHECK(growth_stage IN ('Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Maturity')),
    fertilizer_id INTEGER NOT NULL,
    dosage_kg_per_hectare REAL,
    application_method VARCHAR(100),
    frequency_days INTEGER,
    reasoning TEXT,
    success_rate REAL DEFAULT 0.8,
    FOREIGN KEY (crop_id) REFERENCES crops_master(crop_id),
    FOREIGN KEY (fertilizer_id) REFERENCES fertilizers_master(fertilizer_id)
);

-- Pre-loaded recommendations
INSERT OR IGNORE INTO crop_fertilizer_recommendations VALUES
(1, 1, 'Loamy', 'Seedling', 2, 50, 'Basal application', 0, 'DAP provides phosphorus for root development', 0.85),
(2, 1, 'Loamy', 'Vegetative', 1, 100, 'Split application', 15, 'Urea for vegetative growth', 0.9),
(3, 1, 'Loamy', 'Flowering', 5, 150, 'Side dressing', 0, 'NPK 10-26-26 for flowering and fruiting', 0.88),
(4, 2, 'Clay', 'Seedling', 2, 60, 'Basal application', 0, 'DAP for early growth', 0.87),
(5, 2, 'Clay', 'Vegetative', 1, 120, 'Split into 3 applications', 25, 'Urea for tillering', 0.92),
(6, 2, 'Clay', 'Flowering', 7, 100, 'Top dressing', 0, 'Ammonium sulphate provides nitrogen and sulfur', 0.85),
(7, 3, 'Loamy', 'Seedling', 2, 80, 'Drilled with seed', 0, 'DAP for root development', 0.89),
(8, 3, 'Loamy', 'Vegetative', 1, 100, 'Top dressing at tillering', 30, 'Urea for winter growth', 0.91),
(9, 3, 'Loamy', 'Flowering', 20, 100, 'Foliar spray', 0, 'NPK 15-15-15 for grain filling', 0.86),
(10, 4, 'Sandy', 'Seedling', 4, 200, 'Basal application', 0, 'SSP for phosphorus in sandy soil', 0.82),
(11, 4, 'Sandy', 'Vegetative', 1, 150, 'Side dressing', 20, 'Urea for rapid growth', 0.88),
(12, 4, 'Sandy', 'Flowering', 3, 80, 'Top dressing', 0, 'MOP for cob development', 0.9);

-- Growth Stage Advice Table
CREATE TABLE IF NOT EXISTS growth_stage_advice (
    advice_id INTEGER PRIMARY KEY AUTOINCREMENT,
    crop_id INTEGER NOT NULL,
    growth_stage VARCHAR(50) NOT NULL,
    stage_duration_days INTEGER,
    water_requirement VARCHAR(50),
    irrigation_frequency_days INTEGER,
    irrigation_amount_mm REAL,
    key_tasks TEXT,
    common_pests TEXT,
    disease_prevention TEXT,
    monitoring_parameters TEXT,
    harvest_indicators TEXT,
    FOREIGN KEY (crop_id) REFERENCES crops_master(crop_id)
);

-- Pre-loaded growth stage advice
INSERT OR IGNORE INTO growth_stage_advice VALUES
(1, 1, 'Seedling', 15, 'Light, frequent', 2, 10, 'Transplant when 15-20cm tall; Thin to 1 plant per spot; Protect from strong sun', 'Cutworms, Aphids', 'Use Trichoderma treatment; Avoid waterlogging', 'Height, Leaf count, Color', 'N/A'),
(2, 1, 'Vegetative', 40, 'Moderate', 4, 25, 'Stake plants; Remove suckers; Mulch to conserve moisture; First side dressing fertilizer', 'Whiteflies, Fruit borer', 'Spray neem oil weekly; Remove infected leaves', 'Height, Stem thickness, Leaf health', 'N/A'),
(3, 1, 'Flowering', 20, 'Consistent', 3, 20, 'Support flower clusters; Hand pollinate if needed; Second side dressing; Watch for blossom drop', 'Thrips, Mites', 'Spray fungicide if humid; Ensure good air circulation', 'Flower count, Fruit set', 'N/A'),
(4, 1, 'Fruiting', 35, 'Moderate, reduce near harvest', 5, 15, 'Support heavy fruit clusters; Harvest mature green fruits; Reduce nitrogen; Increase potassium', 'Fruit borer, Birds', 'Bag fruits; Use pheromone traps; Harvest regularly', 'Fruit size, Color change', 'Firm, full color, easy separation'),
(5, 2, 'Seedling', 25, 'Keep flooded 2-5cm', 1, 15, 'Maintain shallow water; Control weeds; Thin if overcrowded', 'Stem borer, Leaf folder', 'Use resistant varieties; Drain field periodically', 'Plant height, Tillering', 'N/A'),
(6, 2, 'Tillering', 35, 'Alternate wet-dry', 3, 20, 'Apply tillering fertilizer; Maintain weed-free field; Drain for 2-3 days', 'Brown plant hopper, Gall midge', 'Release natural enemies; Avoid excess nitrogen', 'Tiller count, Leaf color', 'N/A'),
(7, 2, 'Panicle Initiation', 25, 'Keep flooded', 2, 25, 'Apply panicle fertilizer; Ensure good water depth; Check for nutrient deficiency', 'Stem borer, Rice bug', 'Monitor field edges; Use light traps', 'Panicle emergence', 'N/A'),
(8, 2, 'Grain Filling', 40, 'Gradual drying', 4, 10, 'Stop irrigation 2 weeks before harvest; Watch for lodging; Bird control', 'Birds, Rodents', 'Use scare devices; Harvest at proper moisture', 'Grain hardness, Color', 'Grains hard, 20-25% moisture');

-- User Plantings Table
CREATE TABLE IF NOT EXISTS user_plantings (
    planting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    crop_id INTEGER NOT NULL,
    planting_date DATE NOT NULL,
    location VARCHAR(100),
    soil_type VARCHAR(50),
    area_hectares REAL DEFAULT 0.1,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    status VARCHAR(20) CHECK(status IN ('Active', 'Harvested', 'Failed', 'Abandoned')) DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (crop_id) REFERENCES crops_master(crop_id)
);

-- Weather History Table (for LSTM training)
CREATE TABLE IF NOT EXISTS weather_history (
    weather_id INTEGER PRIMARY KEY AUTOINCREMENT,
    location VARCHAR(100),
    date DATE NOT NULL,
    temperature_max REAL,
    temperature_min REAL,
    humidity_max REAL,
    humidity_min REAL,
    rainfall_mm REAL,
    wind_speed_kmh REAL,
    sunshine_hours REAL,
    weather_condition VARCHAR(50),
    crop_growth_impact VARCHAR(20) CHECK(crop_growth_impact IN ('Excellent', 'Good', 'Average', 'Poor', 'Bad')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Model Results Storage
CREATE TABLE IF NOT EXISTS ai_model_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    planting_id INTEGER NOT NULL,
    model_type VARCHAR(50) CHECK(model_type IN ('DecisionTree', 'SVM', 'RandomForest', 'LSTM')),
    prediction_date DATE NOT NULL,
    prediction_type VARCHAR(50),
    prediction_value TEXT,
    confidence_score REAL,
    action_recommended TEXT,
    implementation_status VARCHAR(20) DEFAULT 'Pending',
    notes TEXT,
    FOREIGN KEY (planting_id) REFERENCES user_plantings(planting_id)
);

-- Daily Tasks & Reminders
CREATE TABLE IF NOT EXISTS daily_tasks (
    task_id INTEGER PRIMARY KEY AUTOINCREMENT,
    planting_id INTEGER NOT NULL,
    task_date DATE NOT NULL,
    task_type VARCHAR(50) CHECK(task_type IN ('Watering', 'Fertilizing', 'Pest Control', 'Weeding', 'Pruning', 'Monitoring', 'Harvesting')),
    task_description TEXT,
    priority VARCHAR(10) CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
    status VARCHAR(20) CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Skipped')) DEFAULT 'Pending',
    completed_at TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (planting_id) REFERENCES user_plantings(planting_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_plantings_user ON user_plantings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plantings_crop ON user_plantings(crop_id);
CREATE INDEX IF NOT EXISTS idx_user_plantings_date ON user_plantings(planting_date);

-- User Actions / Activity Log
CREATE TABLE IF NOT EXISTS user_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    planting_id INTEGER,
    action_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (planting_id) REFERENCES user_plantings(planting_id)
);
CREATE INDEX IF NOT EXISTS idx_user_actions_user ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_actions_planting ON user_actions(planting_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_recommendations ON crop_fertilizer_recommendations(crop_id, soil_type);
CREATE INDEX IF NOT EXISTS idx_weather_history ON weather_history(location, date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks ON daily_tasks(planting_id, task_date);
CREATE INDEX IF NOT EXISTS idx_ai_results ON ai_model_results(planting_id, prediction_date);