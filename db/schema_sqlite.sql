SET FOREIGN_KEY_CHECKS = 0;

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    location_lat DOUBLE,
    location_lon DOUBLE,
    location_name VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CROP MASTER TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS crops_master (
    crop_id INT AUTO_INCREMENT PRIMARY KEY,
    crop_type VARCHAR(50) UNIQUE NOT NULL,
    ideal_temperature_c FLOAT,
    ideal_soil_ph FLOAT,
    water_need_l_per_week INT,
    total_growth_days INT,
    min_nitrogen_ppm INT,
    max_nitrogen_ppm INT,
    min_phosphorus_ppm INT,
    max_phosphorus_ppm INT,
    min_potassium_ppm INT,
    max_potassium_ppm INT
);

-- ==========================================
-- USER CROPS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS user_crops (
    planting_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    crop_type VARCHAR(50) NOT NULL,
    planting_date DATE NOT NULL,
    expected_harvest_date DATE,
    current_growth_stage VARCHAR(50) DEFAULT 'seedling',
    ndvi_value FLOAT DEFAULT 0.5,
    disease_detected BOOLEAN DEFAULT 0,
    pest_pressure_level ENUM('low','medium','high') DEFAULT 'low',
    growth_progress FLOAT DEFAULT 0.0,
    days_elapsed INT DEFAULT 0,
    days_remaining INT,
    is_active BOOLEAN DEFAULT 1,
    last_observation_date DATE,
    health_score FLOAT DEFAULT 100.0,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (crop_type) REFERENCES crops_master(crop_type) ON DELETE SET NULL
);

-- ==========================================
-- MANUAL OBSERVATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS manual_observations (
    observation_id INT AUTO_INCREMENT PRIMARY KEY,
    planting_id INT NOT NULL,
    observation_date DATE NOT NULL,
    observation_type ENUM('visual','measurement','image_analysis'),

    visual_health ENUM('excellent','good','fair','poor'),
    pest_presence ENUM('none','low','medium','high'),
    disease_symptoms VARCHAR(200),
    leaf_color ENUM('dark_green','green','light_green','yellow','brown'),
    growth_vigor ENUM('vigorous','normal','slow','stunted'),

    estimated_height_cm FLOAT,
    estimated_moisture ENUM('dry','moist','wet','waterlogged'),
    soil_appearance VARCHAR(100),
    notes TEXT,
    image_path VARCHAR(255),

    UNIQUE(planting_id, observation_date),
    FOREIGN KEY (planting_id) REFERENCES user_crops(planting_id) ON DELETE CASCADE
);

-- ==========================================
-- IMAGE ANALYSIS
-- ==========================================
CREATE TABLE IF NOT EXISTS image_analyses (
    analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    planting_id INT NOT NULL,
    analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    image_path VARCHAR(255),
    detected_disease VARCHAR(100),
    disease_confidence FLOAT,
    detected_pests VARCHAR(200),
    pest_confidence FLOAT,
    nutrient_deficiency VARCHAR(100),
    overall_health_score FLOAT,
    is_manual_review BOOLEAN DEFAULT 0,
    review_notes TEXT,

    FOREIGN KEY (planting_id) REFERENCES user_crops(planting_id) ON DELETE CASCADE
);

-- ==========================================
-- RECOMMENDATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
    planting_id INT NOT NULL,
    recommendation_date DATE NOT NULL,
    action_type ENUM('irrigate','fertilize','pesticide','no_action','monitor','harvest') NOT NULL,
    priority ENUM('low','medium','high','critical') DEFAULT 'medium',

    watering_amount_l FLOAT,
    watering_interval_days INT,

    fertilizer_type VARCHAR(50),
    fertilizer_amount_kg FLOAT,
    next_fertilizer_days INT,

    pesticide_type VARCHAR(50),
    pesticide_interval_days INT,

    reasoning TEXT,
    confidence_score FLOAT,
    source ENUM('ai_svm','rule_based','manual','weather_based','system'),
    implemented BOOLEAN DEFAULT 0,
    implemented_date DATE,

    UNIQUE(planting_id, recommendation_date),
    FOREIGN KEY (planting_id) REFERENCES user_crops(planting_id) ON DELETE CASCADE
);

-- ==========================================
-- DECISION PATTERNS (SVM TRAINING)
-- ==========================================
CREATE TABLE IF NOT EXISTS decision_patterns (
    pattern_id INT AUTO_INCREMENT PRIMARY KEY,
    crop_type VARCHAR(50),

    visual_health ENUM('excellent','good','fair','poor'),
    pest_presence ENUM('none','low','medium','high'),
    growth_stage VARCHAR(50),
    days_elapsed INT,
    weather_forecast ENUM('sunny','cloudy','rainy','storm'),
    temperature_category ENUM('cold','cool','optimal','warm','hot'),

    recommended_action ENUM('no_action','irrigate','fertilize','pesticide','monitor','harvest'),
    outcome_score FLOAT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- GROWTH MILESTONES
-- ==========================================
CREATE TABLE IF NOT EXISTS growth_milestones (
    milestone_id INT AUTO_INCREMENT PRIMARY KEY,
    crop_type VARCHAR(50),
    growth_stage VARCHAR(50),
    days_from_planting INT,
    min_ndvi FLOAT,
    max_ndvi FLOAT,
    ideal_temp_min FLOAT,
    ideal_temp_max FLOAT,
    water_requirement_multiplier FLOAT DEFAULT 1.0,
    key_tasks TEXT,

    FOREIGN KEY (crop_type) REFERENCES crops_master(crop_type) ON DELETE CASCADE
);

-- ==========================================
-- NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    planting_id INT,
    notification_type ENUM('action','alert','reminder','progress','milestone'),
    title VARCHAR(100),
    message TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scheduled_for DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (planting_id) REFERENCES user_crops(planting_id) ON DELETE SET NULL
);

SET FOREIGN_KEY_CHECKS = 1;

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_user_crops_user_id ON user_crops(user_id);
CREATE INDEX idx_user_crops_crop_type ON user_crops(crop_type);
CREATE INDEX idx_observation_pid ON manual_observations(planting_id);
CREATE INDEX idx_recommendations_pid ON recommendations(planting_id);
CREATE INDEX idx_image_analysis_pid ON image_analyses(planting_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
