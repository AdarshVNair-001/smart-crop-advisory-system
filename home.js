// ============================================
// home.js — Smart Crop System (No Login Required for Plant Selection)
// ============================================

// Global variables
let userLocation = null;
let selectedCrop = null;
let currentPage = 'home';
let currentWeatherData = null; // Store weather data globally
const API_BASE_URL = 'http://localhost:5000/api';

// Available crops data (matching database)
const crops = [
    { id: 1, name: 'Tomato', icon: 'bi-flower1', season: 'Summer', duration: 110 },
    { id: 2, name: 'Rice', icon: 'bi-flower2', season: 'Monsoon', duration: 150 },
    { id: 3, name: 'Wheat', icon: 'bi-flower3', season: 'Winter', duration: 140 },
    { id: 4, name: 'Maize', icon: 'bi-flower1', season: 'Summer', duration: 120 },
    { id: 5, name: 'Potato', icon: 'bi-flower2', season: 'Winter', duration: 90 },
    { id: 6, name: 'Soybean', icon: 'bi-flower3', season: 'Monsoon', duration: 85 }
];

// Current user and planting (optional)
let currentUser = null;
let currentPlantingId = null;
let progressUpdateInterval = null;

// Demo user ID (for when not logged in)
const DEMO_USER_ID = 999;

// Global variables for multiple crops
let userCrops = []; // Array to store multiple crops

// ---------------------
// MODEL CONFIG & GLOBALS
// ---------------------
const MODEL_CONFIG = {
  tfjsModelUrl: './models/tfjs/model.json',
  onnxModelUrl: './models/model.onnx',
  labelsUrl: './models/labels.json',
  inputSize: 224,
  backendPreference: ['tfjs', 'onnx']
};

let tfModel = null;
let onnxSession = null;
let labels = null;

const previewCanvas = document.createElement('canvas');
previewCanvas.id = 'previewCanvas';
previewCanvas.width = MODEL_CONFIG.inputSize;
previewCanvas.height = MODEL_CONFIG.inputSize;
previewCanvas.style = 'display:none;';
document.body.appendChild(previewCanvas);
const previewCtx = previewCanvas.getContext('2d');

// ---------------------
// INITIALIZATION
// ---------------------
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Smart Crop System Initialized');
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing app...');
    
    // Create navigation overlay for mobile
    createNavOverlay();
    
    // Auto-create demo user (no login required)
    currentUser = {
        id: DEMO_USER_ID,
        username: 'Demo User',
        email: 'demo@smartcrop.com'
    };
    
    updateUserDisplay();
    
    // Load ALL previously planted crops from localStorage
    await loadAllUserCrops();
    
    // Check location
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        try {
            userLocation = JSON.parse(savedLocation);
            updateLocationDisplay();
            fetchWeatherDataFromAPI();
            hideLocationModal();
        } catch (error) {
            showLocationModal();
        }
    } else {
        showLocationModal();
    }

    setupEventListeners();
    initializePlantsGrid();
    await loadModel();
    
    // Initialize navigation state
    initializeNavigation();
    
    // Initialize quick actions
    initializeQuickActions();
    
    // Hide login modal on startup
    hideLoginModal();
    
    console.log('App initialization complete');
}

// ---------------------
// FERTILIZER RECOMMENDATION SYSTEM - SIMPLIFIED
// ---------------------
function loadFertilizerPage() {
    console.log('Loading fertilizer recommendation page');
    const cropSelect = document.getElementById('fertCrop');
    const soilTypeSelect = document.getElementById('fertSoilType');
    const btn = document.getElementById('getFertilizerBtn');
    const results = document.getElementById('fertResults');

    if (!cropSelect || !soilTypeSelect || !btn || !results) return;

    // Populate crop options
    cropSelect.innerHTML = '<option value="">-- Select Crop --</option>';
    crops.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        cropSelect.appendChild(opt);
    });

    // Populate soil type options
    const soilTypes = [
        { value: 'red', label: 'Red Soils' },
        { value: 'black', label: 'Black Soils' },
        { value: 'alluvial', label: 'Alluvial Soils' },
        { value: 'laterite', label: 'Laterite Soils' },
        { value: 'forest_mountain', label: 'Forest/Mountain Soils' },
        { value: 'peaty_marshy', label: 'Peaty/Marshy Soils' },
        { value: 'sandy', label: 'Sandy Soil' },
        { value: 'clay', label: 'Clay Soil' },
        { value: 'loamy', label: 'Loamy Soil' }
    ];
    
    soilTypeSelect.innerHTML = '<option value="">-- Select Soil Type --</option>';
    soilTypes.forEach(soil => {
        const opt = document.createElement('option');
        opt.value = soil.value;
        opt.textContent = soil.label;
        soilTypeSelect.appendChild(opt);
    });

    // Button action
    btn.onclick = function() {
        const crop = cropSelect.value;
        const soilType = soilTypeSelect.value;
        
        if (!crop || !soilType) {
            results.innerHTML = `<div class="alert alert-warning">Please select both crop type and soil type</div>`;
            return;
        }
        
        // Get fertilizer recommendation based on crop and soil type
        const fertilizerName = getBestFertilizerForCropAndSoil(crop, soilType);
        
        // Display the result
        displayFertilizerResult(crop, soilType, fertilizerName);
    };

    // Clear previous results
    results.innerHTML = '<p>Select crop type and soil type to get the best fertilizer recommendation.</p>';
}

function getBestFertilizerForCropAndSoil(cropType, soilType) {
    // Map of best fertilizers for each crop-soil combination based on CSV data
    const fertilizerMatrix = {
        'Wheat': {
            'red': 'Diammonium Phosphate (DAP 18-46-0)',
            'black': 'Urea (46% N)',
            'alluvial': 'NPK Complex (20-20-0 or local blends)',
            'laterite': 'Single Super Phosphate (SSP)',
            'forest_mountain': 'Compost / FYM',
            'peaty_marshy': 'Gypsum (Calcium Sulfate)',
            'sandy': 'Urea (46% N)',
            'clay': 'Diammonium Phosphate (DAP 18-46-0)',
            'loamy': 'NPK Complex (20-20-0 or local blends)'
        },
        'Rice': {
            'red': 'Ammonium Sulfate',
            'black': 'Urea (46% N)',
            'alluvial': 'NPK 12-32-16 (or local blend)',
            'laterite': 'Zinc Sulfate (ZnSO4)',
            'forest_mountain': 'Azolla / Green Manure',
            'peaty_marshy': 'Lime (for acidic soils)',
            'sandy': 'Urea (46% N)',
            'clay': 'DAP (18-46-0)',
            'loamy': 'NPK 12-32-16 (or local blend)'
        },
        'Tomato': {
            'red': 'Calcium Nitrate (Ca(NO3)2)',
            'black': 'Potassium Sulfate (K2SO4)',
            'alluvial': 'NPK 10-52-10 (high P starter)',
            'laterite': 'Bone Meal (High P organic)',
            'forest_mountain': 'Compost / Vermicompost',
            'peaty_marshy': 'Calcium Nitrate (Ca(NO3)2)',
            'sandy': 'Seaweed Extract (biostimulant)',
            'clay': 'NPK 10-52-10 (high P starter)',
            'loamy': 'Urea (46% N)'
        },
        'Maize': {
            'red': 'Zinc Sulfate',
            'black': 'Urea (46% N)',
            'alluvial': "Compound NPK (e.g., 16-16-16)",
            'laterite': 'Gypsum',
            'forest_mountain': 'Farm Yard Manure / Compost',
            'peaty_marshy': 'Ammonium Nitrate / CAN',
            'sandy': 'Urea (46% N)',
            'clay': 'DAP (18-46-0)',
            'loamy': "Compound NPK (e.g., 16-16-16)"
        },
        'Potato': {
            'red': 'NPK 14-35-14 (high P)',
            'black': 'Muriate of Potash (KCl)',
            'alluvial': 'Calcium Nitrate',
            'laterite': 'Rock Phosphate (for acidic soils)',
            'forest_mountain': 'Fym / Compost',
            'peaty_marshy': 'Sulphate of Potash (K2SO4)',
            'sandy': 'Urea (46% N)',
            'clay': 'NPK 14-35-14 (high P)',
            'loamy': 'Calcium Nitrate'
        },
        'Soybean': {
            'red': 'Rhizobium Inoculant (biofertilizer)',
            'black': 'DAP (18-46-0)',
            'alluvial': 'Gypsum',
            'laterite': 'Zinc Sulfate',
            'forest_mountain': 'Fym / Compost',
            'peaty_marshy': 'Boron (borax)',
            'sandy': 'DAP (18-46-0)',
            'clay': 'Muriate of Potash (MOP)',
            'loamy': 'Rhizobium Inoculant (biofertilizer)'
        }
    };
    
    // Return the fertilizer name based on crop and soil type
    if (fertilizerMatrix[cropType] && fertilizerMatrix[cropType][soilType]) {
        return fertilizerMatrix[cropType][soilType];
    }
    
    // Fallback: Get first available fertilizer for the crop
    return getFirstFertilizerForCrop(cropType);
}

function getFirstFertilizerForCrop(cropType) {
    const fertilizerMap = {
        'Wheat': 'Urea (46% N)',
        'Rice': 'Urea (46% N)',
        'Tomato': 'Calcium Nitrate (Ca(NO3)2)',
        'Maize': 'Urea (46% N)',
        'Potato': 'NPK 14-35-14 (high P)',
        'Soybean': 'Rhizobium Inoculant (biofertilizer)'
    };
    
    return fertilizerMap[cropType] || 'Urea (46% N)';
}

function displayFertilizerResult(crop, soilType, fertilizerName) {
    const results = document.getElementById('fertResults');
    if (!results) return;
    
    const fertilizerDetails = getFertilizerDetails(crop, fertilizerName);
    
    const soilDisplayNames = {
        'red': 'Red Soils',
        'black': 'Black Soils',
        'alluvial': 'Alluvial Soils',
        'laterite': 'Laterite Soils',
        'forest_mountain': 'Forest/Mountain Soils',
        'peaty_marshy': 'Peaty/Marshy Soils',
        'sandy': 'Sandy Soil',
        'clay': 'Clay Soil',
        'loamy': 'Loamy Soil'
    };
    
    const soilDisplayName = soilDisplayNames[soilType] || soilType;
    
    results.innerHTML = `
        <div class="fert-result-card">
            <div class="result-header">
                <h3><i class="bi bi-trophy"></i> Recommended Fertilizer</h3>
                <div class="result-context">
                    <span class="context-item"><i class="bi bi-flower1"></i> ${crop}</span>
                    <span class="context-item"><i class="bi bi-geo-alt"></i> ${soilDisplayName}</span>
                </div>
            </div>
            
            <div class="fertilizer-main">
                <div class="fertilizer-name-box">
                    <div>
                        <h2>${fertilizerName}</h2>
                        <p class="fertilizer-type">${fertilizerDetails.form || 'Granular'}</p>
                    </div>
                </div>
                
                ${fertilizerDetails.recommendation ? `
                <div class="recommendation-reason">
                    <h4><i class="bi bi-lightbulb"></i> Why this fertilizer?</h4>
                    <p>${fertilizerDetails.recommendation}</p>
                </div>
                ` : ''}
                
                ${fertilizerDetails.applicationRate ? `
                <div class="application-details">
                    <h4><i class="bi bi-speedometer2"></i> Application Details</h4>
                    <div class="details-grid">
                        ${fertilizerDetails.applicationRate ? `
                        <div class="detail-box">
                            <span class="detail-label">Rate:</span>
                            <span class="detail-value">${fertilizerDetails.applicationRate}</span>
                        </div>
                        ` : ''}
                        
                        ${fertilizerDetails.stage ? `
                        <div class="detail-box">
                            <span class="detail-label">Stage:</span>
                            <span class="detail-value">${fertilizerDetails.stage}</span>
                        </div>
                        ` : ''}
                        
                        ${fertilizerDetails.frequency ? `
                        <div class="detail-box">
                            <span class="detail-label">Frequency:</span>
                            <span class="detail-value">${fertilizerDetails.frequency}</span>
                        </div>
                        ` : ''}
                        
                        ${fertilizerDetails.targetNutrient ? `
                        <div class="detail-box">
                            <span class="detail-label">Nutrient:</span>
                            <span class="detail-value">${fertilizerDetails.targetNutrient}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${fertilizerDetails.remarks ? `
                <div class="fertilizer-notes">
                    <h4><i class="bi bi-info-circle"></i> Notes</h4>
                    <p>${fertilizerDetails.remarks}</p>
                </div>
                ` : ''}
            </div>
            
            <div class="result-actions">
                <button class="btn btn-primary" onclick="copyFertilizerInfo('${fertilizerName}')">
                    <i class="bi bi-clipboard"></i> Copy Recommendation
                </button>
                <button class="btn btn-outline" onclick="findAlternative('${crop}', '${soilType}')">
                    <i class="bi bi-arrow-clockwise"></i> Find Alternative
                </button>
            </div>
        </div>
    `;
}

function getFertilizerDetails(cropType, fertilizerName) {
    const fertilizerDetailsMap = {
        // Wheat fertilizers
        'Urea (46% N)': {
            form: 'Granular',
            targetNutrient: 'Nitrogen (N)',
            applicationRate: '80-120 kg/ha',
            stage: 'Basal / Tillering (split applications)',
            frequency: '1-2 applications',
            remarks: 'Common N source; split between basal and top-dress to reduce losses.',
            recommendation: 'Best for nitrogen supply in most soil types'
        },
        'Diammonium Phosphate (DAP 18-46-0)': {
            form: 'Granular',
            targetNutrient: 'Phosphorus (P) & Nitrogen (N)',
            applicationRate: '50-100 kg/ha',
            stage: 'Basal (sowing)',
            frequency: '1 application',
            remarks: 'Provides P at sowing; improves early root development.',
            recommendation: 'Excellent for phosphorus-deficient and acidic soils'
        },
        'Single Super Phosphate (SSP)': {
            form: 'Granular',
            targetNutrient: 'Phosphorus & Sulfur',
            applicationRate: '100-200 kg/ha',
            stage: 'Basal',
            frequency: '1 application',
            remarks: 'Good where S deficiency exists.',
            recommendation: 'Ideal for sulfur-deficient and laterite soils'
        },
        'NPK Complex (20-20-0 or local blends)': {
            form: 'Granular',
            targetNutrient: 'NPK balanced',
            applicationRate: '100-200 kg/ha',
            stage: 'Basal or split',
            frequency: '1-2 applications',
            remarks: 'Use based on soil test recommendations.',
            recommendation: 'Balanced nutrition for alluvial and loamy soils'
        },
        // Rice fertilizers
        'Urea (46% N)': {
            form: 'Granular',
            targetNutrient: 'Nitrogen (N)',
            applicationRate: '80-160 kg/ha',
            stage: 'Split: basal + tillering + panicle initiation',
            frequency: '2-3 applications',
            remarks: 'Top-dress in splits to reduce volatilization in flooded rice.',
            recommendation: 'Standard nitrogen source for flooded rice cultivation'
        },
        'Ammonium Sulfate': {
            form: 'Granular',
            targetNutrient: 'Nitrogen & Sulfur',
            applicationRate: '60-100 kg/ha',
            stage: 'Basal/top-dress',
            frequency: '1-2 applications',
            remarks: 'Useful in S-deficient paddies.',
            recommendation: 'Provides both nitrogen and sulfur for rice'
        },
        'NPK 12-32-16 (or local blend)': {
            form: 'Granular',
            targetNutrient: 'Balanced NPK with higher P',
            applicationRate: '100-200 kg/ha',
            stage: 'Basal',
            frequency: '1 application',
            remarks: 'Use based on soil test to support early growth.',
            recommendation: 'High phosphorus formula ideal for alluvial soils'
        },
        // Tomato fertilizers
        'Calcium Nitrate (Ca(NO3)2)': {
            form: 'Granular / Soluble',
            targetNutrient: 'Calcium & Nitrogen',
            applicationRate: '50-150 kg/ha',
            stage: 'Vegetative / fruit set',
            frequency: '1-3 applications',
            remarks: 'Prevents blossom-end rot; use as foliar or fertigation.',
            recommendation: 'Essential for calcium-deficient acidic soils'
        },
        'Potassium Sulfate (K2SO4)': {
            form: 'Granular',
            targetNutrient: 'Potassium & Sulfur',
            applicationRate: '40-100 kg/ha',
            stage: 'Flowering and fruiting',
            frequency: '1-2 applications',
            remarks: 'Improves fruit quality and shelf life.',
            recommendation: 'Ideal for potassium-deficient black soils'
        },
        // Maize fertilizers
        'Compound NPK (e.g., 16-16-16)': {
            form: 'Granular',
            targetNutrient: 'Balanced NPK',
            applicationRate: '150-300 kg/ha',
            stage: 'Basal',
            frequency: '1 application',
            remarks: 'Use based on soil test recommendations.',
            recommendation: 'Balanced nutrition for maize in alluvial soils'
        },
        // Potato fertilizers
        'NPK 14-35-14 (high P)': {
            form: 'Granular',
            targetNutrient: 'Higher Phosphorus for tuber initiation',
            applicationRate: '150-300 kg/ha',
            stage: 'Basal / at planting',
            frequency: '1 application',
            remarks: 'Promotes tuber development.',
            recommendation: 'High phosphorus formula ideal for potato in red soils'
        },
        // Soybean fertilizers
        'Rhizobium Inoculant (biofertilizer)': {
            form: 'Powder/liquid for seed coating',
            targetNutrient: 'Biological N fixation support',
            applicationRate: 'As per label',
            stage: 'Seed inoculation at sowing',
            frequency: '1 per season',
            remarks: 'Important where soybean hasn\'t been grown recently.',
            recommendation: 'Essential for nitrogen fixation in soybean'
        }
    };
    
    return fertilizerDetailsMap[fertilizerName] || {
        form: 'Granular',
        recommendation: `Recommended for ${cropType} in ${soilType} soils based on local agricultural practices.`
    };
}

function copyFertilizerInfo(fertilizerName) {
    const text = `Recommended fertilizer: ${fertilizerName}`;
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification('success', 'Copied!', 'Fertilizer name copied to clipboard.');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('error', 'Copy Failed', 'Please copy manually: ' + fertilizerName);
    });
}

function findAlternative(crop, soilType) {
    const alternatives = {
        'Wheat': ['Diammonium Phosphate (DAP 18-46-0)', 'Single Super Phosphate (SSP)', 'Urea (46% N)'],
        'Rice': ['Urea (46% N)', 'DAP (18-46-0)', 'Ammonium Sulfate'],
        'Tomato': ['Calcium Nitrate (Ca(NO3)2)', 'Potassium Sulfate (K2SO4)', 'Urea (46% N)'],
        'Maize': ['Urea (46% N)', 'DAP (18-46-0)', 'Compound NPK'],
        'Potato': ['NPK 14-35-14 (high P)', 'Muriate of Potash (KCl)', 'Urea (46% N)'],
        'Soybean': ['Rhizobium Inoculant', 'DAP (18-46-0)', 'Gypsum']
    };
    
    const cropAlternatives = alternatives[crop] || ['Urea (46% N)', 'Compost/FYM'];
    const alternative = cropAlternatives[1];
    
    displayFertilizerResult(crop, soilType, alternative);
    showNotification('info', 'Alternative Found', `Showing alternative: ${alternative}`);
}

// ---------------------
// LOAD ALL USER CROPS
// ---------------------
async function loadAllUserCrops() {
    try {
        const userId = currentUser ? currentUser.id : DEMO_USER_ID;
        
        const response = await fetch(`${API_BASE_URL}/user/${userId}/crops`);
        
        if (response.ok) {
            const data = await response.json();
            if (!data.error) {
                userCrops = data.crops || [];
                localStorage.setItem('userCrops', JSON.stringify(userCrops));
                updateDashboardWithAllCrops();
                return;
            }
        }
        
        const savedCrops = localStorage.getItem('userCrops');
        if (savedCrops) {
            userCrops = JSON.parse(savedCrops);
            updateDashboardWithAllCrops();
        }
        
    } catch (error) {
        console.error('Error loading crops:', error);
        const savedCrops = localStorage.getItem('userCrops');
        if (savedCrops) {
            userCrops = JSON.parse(savedCrops);
            updateDashboardWithAllCrops();
        }
    }
}

// ---------------------
// UPDATE DASHBOARD WITH ALL CROPS
// ---------------------
function updateDashboardWithAllCrops() {
    const currentCropElement = document.getElementById('currentCrop');
    if (!currentCropElement) return;
    
    if (userCrops.length === 0) {
        currentCropElement.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-flower1"></i>
                <h4>No Crops Planted Yet</h4>
                <p>Select a crop to start your farming journey</p>
                <button class="btn btn-primary" onclick="navigateToPage('plants')">
                    <i class="bi bi-arrow-right"></i> Browse Crops
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="dashboard-header">
            <h3><i class="bi bi-flower2"></i> Your Crops (${userCrops.length})</h3>
            <button class="btn btn-sm btn-outline" onclick="navigateToPage('plants')">
                <i class="bi bi-plus"></i> Add More
            </button>
        </div>
        <div class="crops-grid">
    `;
    
    userCrops.forEach(crop => {
        const cropData = crops.find(c => c.name === crop.crop_type) || {
            name: crop.crop_type,
            icon: 'bi-flower1',
            season: 'Various',
            duration: 100
        };
        
        const plantingDate = new Date(crop.planting_date);
        const harvestDate = new Date(plantingDate);
        harvestDate.setDate(harvestDate.getDate() + cropData.duration);
        
        const now = new Date();
        const totalDays = cropData.duration;
        const daysElapsed = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));
        const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
        
        let growthStage = 'seedling';
        if (daysElapsed < 15) growthStage = 'seedling';
        else if (daysElapsed < 50) growthStage = 'vegetative';
        else if (daysElapsed < 90) growthStage = 'flowering';
        else growthStage = 'mature';
        
        const isSelected = selectedCrop && selectedCrop.planting_id === crop.planting_id;
        
        html += `
            <div class="dashboard-crop-card ${isSelected ? 'selected' : ''}" 
                 onclick="selectCropForDetail(${crop.planting_id})">
                <div class="crop-card-header">
                    <i class="bi ${cropData.icon}"></i>
                    <div>
                        <h4>${cropData.name}</h4>
                        <span class="crop-age">${daysElapsed} days old</span>
                    </div>
                </div>
                
                <div class="crop-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <span class="progress-text">${progressPercentage.toFixed(1)}%</span>
                </div>
                
                <div class="crop-details">
                    <div class="detail-row">
                        <span class="detail-label">Planted:</span>
                        <span class="detail-value">${plantingDate.toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Stage:</span>
                        <span class="detail-value growth-stage-${growthStage}">${growthStage}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Harvest:</span>
                        <span class="detail-value">${harvestDate.toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div class="crop-actions">
                    <button class="btn btn-sm btn-outline" onclick="viewCropDetails(${crop.planting_id}); event.stopPropagation()">
                        <i class="bi bi-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="removeCrop(${crop.planting_id}); event.stopPropagation()">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    currentCropElement.innerHTML = html;
    
    if (currentWeatherData && currentWeatherData.current) {
        updateWeatherImpact(currentWeatherData.current);
    }
}

// ---------------------
// SELECT CROP FOR DETAIL VIEW
// ---------------------
function selectCropForDetail(plantingId) {
    const crop = userCrops.find(c => c.planting_id === plantingId);
    if (crop) {
        selectedCrop = crop;
        currentPlantingId = plantingId;
        showCropDetailView(crop);
        startProgressTracking();
        
        if (currentWeatherData && currentWeatherData.current) {
            updateWeatherImpact(currentWeatherData.current);
        }
        getAIRecommendation(plantingId);
    }
}

// ---------------------
// SHOW CROP DETAIL VIEW
// ---------------------
function showCropDetailView(crop) {
    const cropData = crops.find(c => c.name === crop.crop_type) || {
        name: crop.crop_type,
        icon: 'bi-flower1',
        season: 'Various',
        duration: 100
    };
    
    const plantingDate = new Date(crop.planting_date);
    const harvestDate = new Date(plantingDate);
    harvestDate.setDate(harvestDate.getDate() + cropData.duration);
    
    const now = new Date();
    const daysElapsed = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, cropData.duration - daysElapsed);
    const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / cropData.duration) * 100));
    
    const detailView = `
        <div class="crop-detail-view">
            <div class="detail-header">
                <button class="btn btn-sm btn-outline" onclick="showAllCrops()">
                    <i class="bi bi-arrow-left"></i> Back to All
                </button>
                <h3><i class="bi ${cropData.icon}"></i> ${cropData.name} Details</h3>
            </div>
            
            <div class="detail-main">
                <div class="detail-stats">
                    <div class="stat-box">
                        <div class="stat-value">${daysElapsed}</div>
                        <div class="stat-label">Days Elapsed</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${daysRemaining}</div>
                        <div class="stat-label">Days Remaining</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${cropData.duration}</div>
                        <div class="stat-label">Total Duration</div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-label">Growth Progress</div>
                    <div class="progress-bar-large">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="progress-text">${progressPercentage.toFixed(1)}% Complete</div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="bi bi-calendar"></i> Timeline</h4>
                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-date">${plantingDate.toLocaleDateString()}</div>
                            <div class="timeline-dot"></div>
                            <div class="timeline-content">
                                <strong>Planted</strong>
                                <p>Crop planting initiated</p>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-date">${harvestDate.toLocaleDateString()}</div>
                            <div class="timeline-dot harvest"></div>
                            <div class="timeline-content">
                                <strong>Expected Harvest</strong>
                                <p>Target harvest date</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="bi bi-clipboard-check"></i> Today's Tasks</h4>
                    <div id="todaysTasksDetail"></div>
                </div>
            </div>
        </div>
    `;
    
    const currentCropElement = document.getElementById('currentCrop');
    if (currentCropElement) {
        currentCropElement.innerHTML = detailView;
        updateTasksForDetail(crop, daysElapsed);
    }
}

// ---------------------
// UPDATE TASKS FOR DETAIL VIEW
// ---------------------
function updateTasksForDetail(crop, daysElapsed) {
    const tasksContainer = document.getElementById('todaysTasksDetail');
    if (!tasksContainer) return;
    
    const cropData = crops.find(c => c.name === crop.crop_type);
    if (!cropData) return;
    
    let growthStage = 'seedling';
    if (daysElapsed < 15) growthStage = 'seedling';
    else if (daysElapsed < 50) growthStage = 'vegetative';
    else if (daysElapsed < 90) growthStage = 'flowering';
    else growthStage = 'mature';
    
    let tasks = [];
    
    tasks.push({
        task: 'Visual inspection',
        icon: 'bi-eye',
        description: 'Check for visible issues',
        priority: 'medium'
    });
    
    if (growthStage === 'seedling') {
        tasks.push({
            task: 'Water seedlings',
            icon: 'bi-droplet',
            description: 'Light, frequent watering',
            priority: 'high'
        });
    } else if (growthStage === 'vegetative') {
        tasks.push({
            task: 'Regular watering',
            icon: 'bi-droplet',
            description: 'Deep watering to encourage roots',
            priority: 'high'
        });
        tasks.push({
            task: 'Weed control',
            icon: 'bi-flower1',
            description: 'Remove competing weeds',
            priority: 'medium'
        });
    }
    
    tasksContainer.innerHTML = '';
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${task.priority}`;
        taskItem.innerHTML = `
            <i class="bi ${task.icon}"></i>
            <div class="task-content">
                <div class="task-title">${task.task}</div>
                <div class="task-description">${task.description}</div>
            </div>
            <i class="bi bi-check-circle task-check"></i>
        `;
        
        taskItem.addEventListener('click', function() {
            this.classList.toggle('completed');
        });
        
        tasksContainer.appendChild(taskItem);
    });
}

// ---------------------
// SHOW ALL CROPS (Return to dashboard)
// ---------------------
function showAllCrops() {
    selectedCrop = null;
    currentPlantingId = null;
    updateDashboardWithAllCrops();
    updateWeatherImpact(currentWeatherData ? currentWeatherData.current : null);
}

// ---------------------
// VIEW CROP DETAILS (Alternative)
// ---------------------
function viewCropDetails(plantingId) {
    selectCropForDetail(plantingId);
}

// ---------------------
// REMOVE CROP
// ---------------------
function removeCrop(plantingId) {
    if (confirm('Are you sure you want to remove this crop? This will delete all associated data.')) {
        userCrops = userCrops.filter(crop => crop.planting_id !== plantingId);
        
        if (selectedCrop && selectedCrop.planting_id === plantingId) {
            selectedCrop = null;
            currentPlantingId = null;
        }
        
        localStorage.setItem('userCrops', JSON.stringify(userCrops));
        updateDashboardWithAllCrops();
        showNotification('info', 'Crop Removed', 'Crop has been removed from your dashboard.');
    }
}

// ---------------------
// CREATE NAV OVERLAY FOR MOBILE
// ---------------------
function createNavOverlay() {
    if (!document.getElementById('navOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'navOverlay';
        overlay.className = 'mobile-nav-overlay';
        overlay.addEventListener('click', toggleNavigation);
        document.body.appendChild(overlay);
    }
}

// ---------------------
// EVENT LISTENERS
// ---------------------
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const menuToggle = document.getElementById('menuToggle');
    const closeNav = document.getElementById('closeNav');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleNavigation);
    } else {
        console.error('Menu toggle button not found!');
    }
    
    if (closeNav) {
        closeNav.addEventListener('click', toggleNavigation);
    }

    const autoDetectBtn = document.getElementById('autoDetectBtn');
    const manualSubmitBtn = document.getElementById('manualSubmitBtn');
    const changeLocationBtn = document.getElementById('changeLocation');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const manualLocation = document.getElementById('manualLocation');
    const locationModal = document.getElementById('locationModal');

    if (autoDetectBtn) autoDetectBtn.addEventListener('click', detectLocation);
    if (manualSubmitBtn) manualSubmitBtn.addEventListener('click', setManualLocation);
    if (changeLocationBtn) changeLocationBtn.addEventListener('click', showLocationModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideLocationModal);

    if (locationModal) {
        locationModal.addEventListener('click', function(e) {
            if (e.target === locationModal) hideLocationModal();
        });
    }

    if (manualLocation) {
        manualLocation.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') setManualLocation();
        });
    }

    setupNavigationListeners();
    
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) imageUpload.addEventListener('change', handleImageUpload);

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', showLoginModal);
    }

    const manualEntryBtn = document.getElementById('manualEntryBtn');
    if (manualEntryBtn) {
        manualEntryBtn.addEventListener('click', showManualEntryModal);
    }

    document.addEventListener('click', function(e) {
        const sideNav = document.getElementById('side_nav');
        const menuToggle = document.getElementById('menuToggle');
        
        if (sideNav && sideNav.classList.contains('active')) {
            if (!sideNav.contains(e.target) && 
                menuToggle && !menuToggle.contains(e.target) && 
                e.target !== menuToggle) {
                toggleNavigation();
            }
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const sideNav = document.getElementById('side_nav');
            if (sideNav && sideNav.classList.contains('active')) {
                toggleNavigation();
            }
        }
    });
}

// ---------------------
// SETUP NAVIGATION LISTENERS
// ---------------------
function setupNavigationListeners() {
    console.log('Setting up navigation listeners...');
    
    const calendarNavItem = document.querySelector('[data-page="calendar"]');
    if (calendarNavItem) {
        calendarNavItem.style.display = 'none';
    }
    
    const navContainer = document.getElementById('navItems');
    if (!navContainer) {
        setupDirectNavigationListeners();
        return;
    }
    
    navContainer.addEventListener('click', function(e) {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;
        
        e.preventDefault();
        
        if (navItem.id === 'logoutBtn') {
            showLoginModal();
        } else {
            const page = navItem.getAttribute('data-page');
            if (page && page !== 'calendar') {
                navigateToPage(page);
            }
        }
    });
    
    setupDirectNavigationListeners();
}

function setupDirectNavigationListeners() {
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`Found ${navItems.length} nav items to set up listeners`);
    
    navItems.forEach(item => {
        const page = item.getAttribute('data-page');
        if (page === 'calendar') {
            item.style.display = 'none';
            return;
        }
        
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Nav item clicked:', this.id, this.getAttribute('data-page'));
            
            if (this.id === 'logoutBtn') {
                showLoginModal();
            } else {
                const page = this.getAttribute('data-page');
                if (page) {
                    navigateToPage(page);
                }
            }
        });
    });
}

// ---------------------
// NAVIGATION FUNCTIONS
// ---------------------
function toggleNavigation() {
    console.log('Toggling navigation...');
    const sideNav = document.getElementById('side_nav');
    const menuToggle = document.getElementById('menuToggle');
    const navOverlay = document.getElementById('navOverlay');
    
    if (!sideNav) {
        console.error('Side navigation not found!');
        return;
    }
    
    const isOpening = !sideNav.classList.contains('active');
    sideNav.classList.toggle('active');
    
    if (navOverlay) {
        navOverlay.classList.toggle('active');
    }
    
    if (menuToggle) {
        if (isOpening) {
            menuToggle.innerHTML = '<i class="bi bi-x-lg"></i>';
            document.body.style.overflow = 'hidden';
        } else {
            menuToggle.innerHTML = '<i class="bi bi-list"></i>';
            document.body.style.overflow = '';
        }
    }
    
    console.log('Navigation state:', isOpening ? 'open' : 'closed');
}

function navigateToPage(pageName) {
    console.log('Navigating to page:', pageName);
    
    if (pageName === 'calendar') {
        console.log('Calendar page removed from navigation');
        return;
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        if (page.id === `${pageName}Page`) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
    });

    currentPage = pageName;
    
    if (window.innerWidth <= 768) {
        toggleNavigation();
    }

    if (pageName === 'analytics') {
        loadAnalytics();
    } else if (pageName === 'plants') {
        initializePlantsGrid();
    } else if (pageName === 'fertilizer') {
        loadFertilizerPage();
    } else if (pageName === 'home') {
        updateDashboardWithAllCrops();
    }
    
    console.log('Navigation complete to:', pageName);
}

// ---------------------
// INITIALIZE NAVIGATION
// ---------------------
function initializeNavigation() {
    console.log('Initializing navigation...');
    
    const calendarPage = document.getElementById('calendarPage');
    if (calendarPage) {
        calendarPage.style.display = 'none';
    }
    
    const currentPath = window.location.hash.substring(1) || 'home';
    if (currentPath !== 'calendar') {
        navigateToPage(currentPath);
    } else {
        navigateToPage('home');
    }
    
    setTimeout(() => {
        setupDirectNavigationListeners();
    }, 100);
}

// ---------------------
// USER FUNCTIONS (OPTIONAL LOGIN)
// ---------------------
function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'flex';
}

function hideLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) loginModal.style.display = 'none';
}

function updateUserDisplay() {
    const usernameDisplay = document.getElementById('usernameDisplay');
    if (usernameDisplay) {
        usernameDisplay.textContent = currentUser ? currentUser.username : 'Demo User';
    }
}

// ---------------------
// LOCATION FUNCTIONS
// ---------------------
function showLocationModal() {
    const locationModal = document.getElementById('locationModal');
    if (locationModal) locationModal.style.display = 'flex';
}

function hideLocationModal() {
    const locationModal = document.getElementById('locationModal');
    if (locationModal) locationModal.style.display = 'none';
}

function detectLocation() {
    const autoDetectBtn = document.getElementById('autoDetectBtn');
    
    if (navigator.geolocation) {
        if (autoDetectBtn) {
            autoDetectBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Detecting...';
            autoDetectBtn.disabled = true;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                userLocation = {
                    lat: lat,
                    lon: lon,
                    name: `Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`
                };
                
                updateLocationDisplay();
                fetchWeatherDataFromAPI();
                hideLocationModal();
                saveLocation();
                
                if (autoDetectBtn) {
                    autoDetectBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Auto Detect Location';
                    autoDetectBtn.disabled = false;
                }
            },
            (error) => {
                alert('Unable to detect location. Please enter manually.');
                if (autoDetectBtn) {
                    autoDetectBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Auto Detect Location';
                    autoDetectBtn.disabled = false;
                }
            }
        );
    } else {
        alert('Geolocation not supported. Please enter location manually.');
    }
}

function setManualLocation() {
    const manualLocation = document.getElementById('manualLocation');
    const locationName = manualLocation ? manualLocation.value.trim() : '';
    
    if (locationName) {
        userLocation = {
            lat: 8.8932,
            lon: 76.6141,
            name: locationName
        };
        
        updateLocationDisplay();
        fetchWeatherDataFromAPI();
        hideLocationModal();
        saveLocation();
        
        if (manualLocation) manualLocation.value = '';
    } else {
        alert('Please enter a location name.');
    }
}

function updateLocationDisplay() {
    const currentLocation = document.getElementById('currentLocation');
    if (userLocation && currentLocation) {
        currentLocation.textContent = userLocation.name;
    }
}

function saveLocation() {
    if (userLocation) {
        localStorage.setItem('userLocation', JSON.stringify(userLocation));
    }
}

// ---------------------
// WEATHER API FUNCTIONS
// ---------------------
async function fetchWeatherDataFromAPI() {
    if (!userLocation) return;
    
    const weatherInfo = document.getElementById('weatherInfo');
    if (weatherInfo) {
        weatherInfo.innerHTML = '<i class="bi bi-cloud-arrow-down"></i> Loading weather...';
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/weather`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lat: userLocation.lat,
                lon: userLocation.lon,
                location_name: userLocation.name
            })
        });
        
        if (response.ok) {
            const weatherData = await response.json();
            currentWeatherData = weatherData;
            updateWeatherDisplay(weatherData);
            updatePastWeather(weatherData.past_10_days);
            updateFutureWeather(weatherData.next_5_days);
            updateWeatherImpact(weatherData.current);
        } else {
            throw new Error('API request failed');
        }
        
    } catch (error) {
        console.error('Weather API error:', error);
        fetchMockWeatherData();
    }
}

function updateWeatherDisplay(weatherData) {
    const weatherInfo = document.getElementById('weatherInfo');
    if (weatherInfo && weatherData.current) {
        const current = weatherData.current;
        weatherInfo.innerHTML = `
            <i class="bi bi-thermometer-half"></i>
            ${Math.round(current.temperature)}°C | ${current.description}
        `;
    }
}

function updatePastWeather(pastData) {
    const pastWeatherContainer = document.getElementById('pastWeather');
    if (!pastWeatherContainer) return;
    
    pastWeatherContainer.innerHTML = '';
    
    pastData.forEach(day => {
        const date = new Date(day.date);
        const weatherDay = document.createElement('div');
        weatherDay.className = 'weather-day';
        weatherDay.innerHTML = `
            <span>${date.toLocaleDateString()}</span>
            <span>${Math.round(day.temperature)}°C, ${day.description}</span>
        `;
        pastWeatherContainer.appendChild(weatherDay);
    });
}

function updateFutureWeather(futureData) {
    const futureWeatherContainer = document.getElementById('futureWeather');
    if (!futureWeatherContainer) return;
    
    futureWeatherContainer.innerHTML = '';
    
    futureData.forEach(day => {
        const date = new Date(day.date);
        const weatherDay = document.createElement('div');
        weatherDay.className = 'weather-day';
        weatherDay.innerHTML = `
            <span>${date.toLocaleDateString()}</span>
            <span>${Math.round(day.temperature)}°C, ${day.description}</span>
        `;
        futureWeatherContainer.appendChild(weatherDay);
    });
}

function updateWeatherImpact(currentWeather) {
    const weatherImpact = document.getElementById('weatherImpact');
    if (!weatherImpact) return;
    
    if (!currentWeather) {
        weatherImpact.innerHTML = `<p><i class="bi bi-cloud-sun"></i> Loading weather data...</p>`;
        return;
    }
    
    if (selectedCrop) {
        let impactText = "Favorable conditions";
        let recommendation = "Ideal weather for crop growth.";
        let iconClass = 'bi-check-circle';
        
        if (currentWeather.description.toLowerCase().includes('rain')) {
            impactText = "Rain detected";
            recommendation = "Reduce scheduled watering. Ensure proper drainage.";
            iconClass = 'bi-cloud-rain';
        } else if (currentWeather.temperature > 30) {
            impactText = "High temperature";
            recommendation = "Increase watering frequency. Provide shade if possible.";
            iconClass = 'bi-thermometer-high';
        } else if (currentWeather.temperature < 15) {
            impactText = "Low temperature";
            recommendation = "Protect crops from cold stress. Reduce watering.";
            iconClass = 'bi-thermometer-low';
        }
        
        weatherImpact.innerHTML = `
            <div class="impact-status">
                <i class="bi ${iconClass}" style="font-size: 24px; color: #4caf50; margin-bottom: 10px;"></i>
                <h4>${impactText}</h4>
                <p>${recommendation}</p>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
                    <strong>Current:</strong> ${Math.round(currentWeather.temperature)}°C, ${currentWeather.description}
                </div>
            </div>
        `;
    } else {
        weatherImpact.innerHTML = `
            <div class="impact-status">
                <i class="bi bi-cloud-sun" style="font-size: 24px; color: #fdd835; margin-bottom: 10px;"></i>
                <h4>Current Weather</h4>
                <p style="font-size: 14px; margin: 10px 0;"><strong>${Math.round(currentWeather.temperature)}°C</strong></p>
                <p style="font-size: 13px; color: #666; margin: 5px 0;">${currentWeather.description}</p>
                <p style="font-size: 12px; color: #999; margin-top: 10px;">Select a crop to see tailored recommendations</p>
            </div>
        `;
    }
}

function fetchMockWeatherData() {
    const weatherInfo = document.getElementById('weatherInfo');
    if (weatherInfo) {
        weatherInfo.innerHTML = '<i class="bi bi-thermometer-half"></i> 25°C | sunny';
    }

    const mockCurrent = {
        temperature: 25 + Math.random() * 10 - 5,
        description: ['sunny', 'cloudy', 'partly cloudy'][Math.floor(Math.random() * 3)]
    };

    const pastData = [];
    for (let i = 9; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        pastData.push({
            date: date.toISOString().split('T')[0],
            temperature: 25 + Math.random() * 10 - 5,
            description: ['sunny', 'cloudy', 'partly cloudy'][Math.floor(Math.random() * 3)]
        });
    }

    const futureData = [];
    for (let i = 1; i <= 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        futureData.push({
            date: date.toISOString().split('T')[0],
            temperature: 25 + Math.random() * 8 - 4,
            description: ['sunny', 'cloudy', 'partly cloudy'][Math.floor(Math.random() * 3)]
        });
    }

    currentWeatherData = {
        current: mockCurrent,
        past_10_days: pastData,
        next_5_days: futureData
    };

    updatePastWeather(pastData);
    updateFutureWeather(futureData);
    updateWeatherImpact(mockCurrent);
}

// ---------------------
// CROP SELECTION WITH DATE PICKER
// ---------------------
function initializePlantsGrid() {
    const plantsGrid = document.querySelector('.plants-grid');
    if (!plantsGrid) return;
    
    plantsGrid.innerHTML = '';
    
    crops.forEach(crop => {
        const plantCard = document.createElement('div');
        plantCard.className = 'plant-card';
        plantCard.innerHTML = `
            <i class="bi ${crop.icon}"></i>
            <h4>${crop.name}</h4>
            <p>Season: ${crop.season}</p>
            <p>Duration: ${crop.duration} days</p>
            <button class="btn-plant" data-crop="${crop.name}">Plant Now</button>
        `;
        
        const plantBtn = plantCard.querySelector('.btn-plant');
        if (plantBtn) {
            plantBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Plant Now button clicked for:', crop.name);
                showPlantingCalendar(crop);
            });
        }
        
        plantCard.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-plant')) {
                console.log('Plant card clicked for info:', crop.name);
            }
        });
        
        plantsGrid.appendChild(plantCard);
    });
}

// ---------------------
// SHOW PLANTING CALENDAR POPUP
// ---------------------
function showPlantingCalendar(crop) {
    console.log('Showing planting calendar for:', crop.name);
    
    if (!userLocation) {
        showNotification('warning', 'Location Required', 'Please set your location first to get accurate weather data.');
        showLocationModal();
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal planting-calendar-modal">
            <div class="modal-header">
                <h4><i class="bi ${crop.icon}"></i> Plant ${crop.name}</h4>
                <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p>Select your planting date for ${crop.name}</p>
                <div class="calendar-popup" id="plantingCalendar"></div>
                <div class="weather-check">
                    <i class="bi bi-cloud-sun"></i>
                    <span>Weather data will be fetched for the selected date</span>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmPlanting('${crop.name}')">Confirm Planting</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => initializePlantingCalendar(), 100);
}

// Global variables for calendar navigation
let currentCalendarMonth = null;
let currentCalendarYear = null;

// ---------------------
// INITIALIZE PLANTING CALENDAR
// ---------------------
function initializePlantingCalendar() {
    const calendarContainer = document.getElementById('plantingCalendar');
    if (!calendarContainer) return;
    
    // Initialize calendar month/year if not set
    if (currentCalendarMonth === null || currentCalendarYear === null) {
        const today = new Date();
        currentCalendarMonth = today.getMonth();
        currentCalendarYear = today.getFullYear();
    }
    
    calendarContainer.innerHTML = generatePlantingCalendarHTML(currentCalendarMonth, currentCalendarYear);
}

// ---------------------
// GENERATE PLANTING CALENDAR HTML
// ---------------------
function generatePlantingCalendarHTML(month, year) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    let html = `
        <div class="calendar-popup-header">
            <button class="btn-calendar-nav" onclick="changePlantingMonth(-1)">
                <i class="bi bi-chevron-left"></i>
            </button>
            <h5>${firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h5>
            <button class="btn-calendar-nav" onclick="changePlantingMonth(1)">
                <i class="bi bi-chevron-right"></i>
            </button>
        </div>
        <div class="calendar-popup-weekdays">
            <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
        </div>
        <div class="calendar-popup-days">
    `;
    
    for (let i = 0; i < startingDay; i++) {
        html += `<div class="calendar-popup-day empty"></div>`;
    }
    
    const today = new Date();
    // Extend future date limit to ~2 years ahead
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    
    // Get today's date string in YYYY-MM-DD format
    const todayStr = String(today.getFullYear()) + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    for (let day = 1; day <= daysInMonth; day++) {
        // Format date as YYYY-MM-DD string
        const dateStr = String(year) + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        const date = new Date(year, month, day);
        const isToday = dateStr === todayStr;
        const isPast = date < today;
        const isTooFarFuture = date > maxDate;
        
        let dayClass = 'calendar-popup-day';
        if (isToday) dayClass += ' today';
        if (isPast) dayClass += ' past';
        if (isTooFarFuture) dayClass += ' future';
        
        html += `
            <div class="${dayClass}" 
                 data-date="${dateStr}"
                 onclick="${!isPast && !isTooFarFuture ? 'selectPlantingDate(this)' : ''}">
                ${day}
                ${isToday ? '<div class="today-badge">Today</div>' : ''}
            </div>
        `;
    }
    
    html += `</div>`;
    
    html += `
        <div class="selected-date-display">
            <div class="selected-date-label">Selected Date:</div>
            <div class="selected-date-value" id="selectedPlantingDate">${today.toLocaleDateString()}</div>
            <input type="hidden" id="plantingDateInput" value="${todayStr}">
        </div>
    `;
    
    return html;
}

// ---------------------
// SELECT PLANTING DATE
// ---------------------
function selectPlantingDate(element) {
    if (element.classList.contains('past') || element.classList.contains('future')) {
        return;
    }
    
    document.querySelectorAll('.calendar-popup-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    element.classList.add('selected');
    
    const date = element.getAttribute('data-date');
    const dateObj = new Date(date);
    document.getElementById('selectedPlantingDate').textContent = dateObj.toLocaleDateString();
    document.getElementById('plantingDateInput').value = date;
}

// ---------------------
// CHANGE PLANTING MONTH
// ---------------------
function changePlantingMonth(delta) {
    if (currentCalendarMonth === null || currentCalendarYear === null) {
        const today = new Date();
        currentCalendarMonth = today.getMonth();
        currentCalendarYear = today.getFullYear();
    }
    
    currentCalendarMonth += delta;
    
    // Wrap months and adjust year
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear += 1;
    } else if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear -= 1;
    }
    
    initializePlantingCalendar();
}

// ---------------------
// CONFIRM PLANTING
// ---------------------
async function confirmPlanting(cropName) {
    const crop = crops.find(c => c.name === cropName);
    if (!crop) return;
    
    const plantingDate = document.getElementById('plantingDateInput').value;
    
    try {
        const userId = currentUser ? currentUser.id : DEMO_USER_ID;
        
        const response = await fetch(`${API_BASE_URL}/select-crop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                crop_type: crop.name,
                planting_date: plantingDate
            })
        });
        
        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            return simulateCropPlanting(crop, plantingDate);
        }
        
        if (response.ok && data.success) {
            const newCrop = {
                planting_id: data.planting_id,
                crop_type: crop.name,
                planting_date: plantingDate,
                user_id: userId,
                created_at: new Date().toISOString()
            };
            
            userCrops.push(newCrop);
            localStorage.setItem('userCrops', JSON.stringify(userCrops));
            document.querySelector('.modal-overlay').remove();
            updateDashboardWithAllCrops();
            navigateToPage('home');
            
            showNotification('success', `${crop.name} Planted!`, 
                          `Planted on ${new Date(plantingDate).toLocaleDateString()}. Expected harvest in ${crop.duration} days.`);
            
        } else {
            simulateCropPlanting(crop, plantingDate);
        }
    } catch (error) {
        console.error('Error planting crop:', error);
        simulateCropPlanting(crop, plantingDate);
    }
}

// ---------------------
// SIMULATE CROP PLANTING
// ---------------------
function simulateCropPlanting(crop, plantingDate = new Date().toISOString().split('T')[0]) {
    const plantingId = Date.now();
    
    const newCrop = {
        planting_id: plantingId,
        crop_type: crop.name,
        planting_date: plantingDate,
        user_id: DEMO_USER_ID,
        created_at: new Date().toISOString()
    };
    
    userCrops.push(newCrop);
    localStorage.setItem('userCrops', JSON.stringify(userCrops));
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    updateDashboardWithAllCrops();
    navigateToPage('home');
    
    showNotification('success', `${crop.name} Planted!`, 
                   `Planted on ${new Date(plantingDate).toLocaleDateString()}. Working in offline mode.`);
}

// ---------------------
// PROGRESS TRACKING
// ---------------------
function startProgressTracking() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
    }
    
    updateProgress();
    progressUpdateInterval = setInterval(updateProgress, 60000);
}

async function updateProgress() {
    if (!currentPlantingId || !selectedCrop) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/crop/${currentPlantingId}/progress`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (!data.error) {
                updateProgressFromAPI(data);
                return;
            }
        }
        
        updateProgressLocally();
        
    } catch (error) {
        console.error('Error updating progress:', error);
        updateProgressLocally();
    }
}

function updateProgressFromAPI(data) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    if (progressFill && progressText) {
        progressFill.style.width = `${data.progress_percentage}%`;
        progressText.textContent = `${data.progress_percentage.toFixed(1)}% Complete`;
        
        if (parseFloat(data.progress_percentage) > 0) {
            progressFill.classList.add('progress-animate');
            setTimeout(() => {
                progressFill.classList.remove('progress-animate');
            }, 500);
        }
    }
    
    const growthStageElement = document.querySelector('.growth-stage');
    if (growthStageElement) {
        growthStageElement.textContent = data.growth_stage;
        growthStageElement.className = `growth-stage stage-${data.growth_stage.toLowerCase()}`;
    }
    
    const daysElapsedElement = document.querySelector('.days-elapsed');
    const daysRemainingElement = document.querySelector('.days-remaining');
    if (daysElapsedElement) daysElapsedElement.textContent = data.days_elapsed;
    if (daysRemainingElement) daysRemainingElement.textContent = data.days_remaining;
    
    updateTasks(data.growth_stage, data.progress_percentage);
    checkMilestones(data.days_elapsed, data.growth_stage);
}

function updateProgressLocally() {
    if (!selectedCrop) return;
    
    const plantingDate = new Date(selectedCrop.planting_date);
    const now = new Date();
    const daysElapsed = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));
    
    const cropData = crops.find(c => c.name === selectedCrop.crop_type);
    const totalDays = cropData ? cropData.duration : 100;
    const progressPercentage = Math.min(99.9, (daysElapsed / totalDays) * 100);
    
    let growthStage = 'seedling';
    if (daysElapsed < 15) growthStage = 'seedling';
    else if (daysElapsed < 50) growthStage = 'vegetative';
    else if (daysElapsed < 90) growthStage = 'flowering';
    else growthStage = 'mature';
    
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    if (progressFill && progressText) {
        progressFill.style.width = `${progressPercentage}%`;
        progressText.textContent = `${progressPercentage.toFixed(1)}% Complete`;
        
        if (progressPercentage > 0) {
            progressFill.classList.add('progress-animate');
            setTimeout(() => {
                progressFill.classList.remove('progress-animate');
            }, 500);
        }
    }
    
    const growthStageElement = document.querySelector('.growth-stage');
    if (growthStageElement) {
        growthStageElement.textContent = growthStage;
        growthStageElement.className = `growth-stage stage-${growthStage.toLowerCase()}`;
    }
    
    const daysElapsedElement = document.querySelector('.days-elapsed');
    const daysRemainingElement = document.querySelector('.days-remaining');
    if (daysElapsedElement) daysElapsedElement.textContent = daysElapsed;
    if (daysRemainingElement) daysRemainingElement.textContent = Math.max(0, totalDays - daysElapsed);
    
    updateTasks(growthStage, progressPercentage);
    checkMilestones(daysElapsed, growthStage);
}

function updateTasks(growthStage, progress) {
    const tasksList = document.getElementById('todaysTasks');
    if (!tasksList) return;
    
    let tasks = [];
    
    tasks.push({
        task: 'Visual inspection',
        icon: 'bi-eye',
        description: 'Check for visible pests, diseases, or abnormalities',
        priority: 'medium'
    });
    
    if (growthStage === 'seedling') {
        tasks.push({
            task: 'Water seedlings',
            icon: 'bi-droplet',
            description: 'Light watering - keep soil moist but not soggy',
            priority: 'high'
        });
        tasks.push({
            task: 'Thin if needed',
            icon: 'bi-scissors',
            description: 'Remove weak seedlings to give others space',
            priority: 'medium'
        });
    } else if (growthStage === 'vegetative') {
        tasks.push({
            task: 'Regular watering',
            icon: 'bi-droplet',
            description: 'Water deeply to encourage root growth',
            priority: 'high'
        });
        tasks.push({
            task: 'Weed control',
            icon: 'bi-flower1',
            description: 'Remove weeds around plants',
            priority: 'medium'
        });
    } else if (growthStage === 'flowering') {
        tasks.push({
            task: 'Monitor pollination',
            icon: 'bi-flower2',
            description: 'Check flower development and pollination',
            priority: 'high'
        });
        tasks.push({
            task: 'Reduce nitrogen',
            icon: 'bi-flower3',
            description: 'Switch to potassium-rich fertilizer',
            priority: 'medium'
        });
    } else if (growthStage === 'mature') {
        tasks.push({
            task: 'Harvest preparation',
            icon: 'bi-basket',
            description: 'Prepare for harvest in coming days',
            priority: 'high'
        });
        tasks.push({
            task: 'Reduce watering',
            icon: 'bi-droplet-half',
            description: 'Gradually reduce water before harvest',
            priority: 'medium'
        });
    }
    
    if (userLocation) {
        const isHot = true;
        if (isHot) {
            tasks.push({
                task: 'Extra watering',
                icon: 'bi-sun',
                description: 'Hot weather - increase watering frequency',
                priority: 'high'
            });
        }
    }
    
    tasksList.innerHTML = '';
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${task.priority}`;
        taskItem.innerHTML = `
            <i class="bi ${task.icon}"></i>
            <div class="task-content">
                <div class="task-title">${task.task}</div>
                <div class="task-description">${task.description}</div>
            </div>
            <i class="bi bi-check-circle task-check"></i>
        `;
        
        taskItem.addEventListener('click', function() {
            this.classList.toggle('completed');
        });
        
        tasksList.appendChild(taskItem);
    });
}

function checkMilestones(daysElapsed, growthStage) {
    const milestones = {
        7: 'First week complete! Seedlings should be established.',
        30: 'One month milestone! Vegetative growth should be visible.',
        60: 'Two months! Flowering should begin soon.',
        90: 'Three months! Harvest approaching.'
    };
    
    if (milestones[daysElapsed]) {
        showNotification('info', 'Milestone Reached!', milestones[daysElapsed]);
    }
}

// ---------------------
// AI RECOMMENDATIONS
// ---------------------
async function getAIRecommendation(plantingId) {
    try {
        const response = await fetch(`${API_BASE_URL}/crop/${plantingId}/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (!data.error) {
                updateRecommendationDisplay(data);
                return;
            }
        }
        
        showFallbackRecommendation();
        
    } catch (error) {
        console.error('Error getting recommendation:', error);
        showFallbackRecommendation();
    }
}

function updateRecommendationDisplay(data) {
    const recommendationElement = document.getElementById('currentRecommendation');
    if (!recommendationElement) return;
    
    const actionIcon = getActionIcon(data.action);
    const actionColor = getActionColor(data.action);
    const formattedAction = formatAction(data.action);
    
    recommendationElement.innerHTML = `
        <div class="recommendation-card ${data.action}" style="border-left-color: ${actionColor}">
            <div class="recommendation-header">
                <i class="bi ${actionIcon}" style="color: ${actionColor}"></i>
                <div>
                    <h4>${formattedAction}</h4>
                    <div class="confidence-badge">
                        <span class="confidence-dot" style="background-color: ${getConfidenceColor(data.confidence)}"></span>
                        ${(data.confidence * 100).toFixed(0)}% Confidence
                    </div>
                </div>
            </div>
            <div class="recommendation-body">
                <p class="reasoning">${data.reasoning}</p>
                ${data.details ? `
                <div class="action-details">
                    ${Object.entries(data.details).map(([key, value]) => 
                        `<div class="detail-row">
                            <span class="detail-label">${formatKey(key)}:</span>
                            <span class="detail-value">${value}</span>
                        </div>`
                    ).join('')}
                </div>
                ` : ''}
            </div>
            <div class="recommendation-footer">
                <button class="btn btn-sm btn-primary" onclick="implementRecommendation(${data.recommendation_id})">
                    <i class="bi bi-check-circle"></i> Mark as Done
                </button>
                <button class="btn btn-sm btn-outline" onclick="getAIRecommendation(${currentPlantingId})">
                    <i class="bi bi-arrow-clockwise"></i> Get New Advice
                </button>
            </div>
        </div>
    `;
}

function showFallbackRecommendation() {
    const recommendationElement = document.getElementById('currentRecommendation');
    if (!recommendationElement) return;
    
    const now = new Date();
    const hour = now.getHours();
    let action, reasoning, icon;
    
    if (hour < 10 || hour > 16) {
        action = 'irrigate';
        reasoning = 'Best time for watering is early morning or late evening to reduce evaporation.';
        icon = 'bi-droplet';
    } else {
        action = 'no_action';
        reasoning = 'Monitor crop growth. Consider taking photos for disease detection.';
        icon = 'bi-binoculars';
    }
    
    recommendationElement.innerHTML = `
        <div class="recommendation-card ${action}">
            <div class="recommendation-header">
                <i class="bi ${icon}"></i>
                <div>
                    <h4>${formatAction(action)}</h4>
                    <div class="confidence-badge">
                        <span class="confidence-dot" style="background-color: #f39c12"></span>
                        75% Confidence
                    </div>
                </div>
            </div>
            <div class="recommendation-body">
                <p class="reasoning">${reasoning}</p>
                <div class="info-note">
                    <i class="bi bi-info-circle"></i>
                    <span>AI service temporarily unavailable. Showing basic guidance.</span>
                </div>
            </div>
        </div>
    `;
}

async function implementRecommendation(recommendationId) {
    try {
        const response = await fetch(`${API_BASE_URL}/crop/${currentPlantingId}/implement-recommendation/${recommendationId}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('success', 'Action Completed!', 'Recommendation marked as implemented.');
        } else {
            showNotification('success', 'Action Logged!', 'Recommendation logged locally.');
        }
        
        const btn = event.target.closest('button');
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Done ✓';
            btn.disabled = true;
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
        }
        
        setTimeout(() => {
            if (currentPlantingId) {
                getAIRecommendation(currentPlantingId);
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error implementing recommendation:', error);
        showNotification('success', 'Action Logged!', 'Recommendation logged locally.');
        
        const btn = event.target.closest('button');
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle"></i> Done ✓';
            btn.disabled = true;
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-success');
        }
    }
}

// ---------------------
// MANUAL DATA ENTRY
// ---------------------
function showManualEntryModal() {
    const modal = document.getElementById('manualEntryModal');
    if (modal) {
        modal.style.display = 'flex';
        
        if (selectedCrop) {
            const soilPhInput = document.getElementById('manualSoilPh');
            if (soilPhInput) {
                const idealPh = {
                    'Tomato': 6.2,
                    'Rice': 6.0,
                    'Wheat': 6.5,
                    'Maize': 6.8,
                    'Potato': 5.5
                };
                soilPhInput.value = idealPh[selectedCrop.crop_type] || 6.5;
            }
        }
    }
}

function hideManualEntryModal() {
    const modal = document.getElementById('manualEntryModal');
    if (modal) modal.style.display = 'none';
}

async function submitManualData() {
    const form = document.getElementById('manualEntryForm');
    if (!form) return;
    
    const formData = {
        soil_moisture: parseFloat(document.getElementById('manualSoilMoisture').value) || 50,
        temperature: parseFloat(document.getElementById('manualTemperature').value) || 25,
        humidity: parseFloat(document.getElementById('manualHumidity').value) || 60,
        soil_ph: parseFloat(document.getElementById('manualSoilPh').value) || 6.5,
        pest_level: document.getElementById('manualPestLevel').value || 'low',
        disease_observed: document.getElementById('manualDisease').checked ? 1 : 0,
        notes: document.getElementById('manualNotes').value || ''
    };
    
    try {
        if (currentPlantingId) {
            const response = await fetch(`${API_BASE_URL}/crop/${currentPlantingId}/observation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                showNotification('success', 'Data Saved!', 'Manual entry submitted successfully.');
            } else {
                saveObservationLocally(formData);
                showNotification('success', 'Data Saved Locally!', 'Manual entry saved to browser storage.');
            }
            
            hideManualEntryModal();
            form.reset();
            await getAIRecommendation(currentPlantingId);
        } else {
            showNotification('warning', 'No Active Crop', 'Please select a crop first.');
        }
    } catch (error) {
        console.error('Error submitting manual data:', error);
        saveObservationLocally(formData);
        showNotification('success', 'Data Saved Locally!', 'Manual entry saved to browser storage.');
        hideManualEntryModal();
        form.reset();
    }
}

function saveObservationLocally(observation) {
    const observations = JSON.parse(localStorage.getItem('cropObservations') || '[]');
    observations.push({
        ...observation,
        planting_id: currentPlantingId,
        timestamp: new Date().toISOString(),
        crop_type: selectedCrop?.crop_type
    });
    localStorage.setItem('cropObservations', JSON.stringify(observations));
}

// ---------------------
// ML MODEL FUNCTIONS
// ---------------------
async function loadModel() {
    await loadLabels();

    for (const backend of MODEL_CONFIG.backendPreference) {
        if (backend === 'tfjs') {
            if (!window.tf) {
                await injectScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.12.0/dist/tf.min.js');
                await new Promise(r => setTimeout(r, 100));
            }
            const ok = await tryLoadTFJS();
            if (ok) { 
                showNotification('info', 'ML Model Loaded', 'TensorFlow.js model ready for disease detection.');
                return; 
            }
        }
        if (backend === 'onnx') {
            if (!window.ort) {
                await injectScript('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');
                await new Promise(r => setTimeout(r, 100));
            }
            const ok = await tryLoadONNX();
            if (ok) { 
                showNotification('info', 'ML Model Loaded', 'ONNX model ready for disease detection.');
                return; 
            }
        }
    }

    console.warn('No browser model loaded. Image analysis will be limited.');
}

async function loadLabels() {
    try {
        const r = await fetch(MODEL_CONFIG.labelsUrl);
        if (!r.ok) throw new Error('no labels file');
        labels = await r.json();
        console.log('Labels loaded:', labels.length);
    } catch (e) {
        console.warn('Labels not found — will use numeric indices.');
        labels = null;
    }
}

function injectScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = (e) => reject(e);
        document.head.appendChild(s);
    });
}

async function tryLoadTFJS() {
    if (!window.tf) return false;
    try {
        try {
            tfModel = await tf.loadGraphModel(MODEL_CONFIG.tfjsModelUrl);
            console.log('Loaded TF.js GraphModel');
        } catch (e) {
            console.log('GraphModel load failed; trying loadLayersModel...');
            tfModel = await tf.loadLayersModel(MODEL_CONFIG.tfjsModelUrl);
            console.log('Loaded TF.js LayersModel');
        }
        const warm = tf.zeros([1, MODEL_CONFIG.inputSize, MODEL_CONFIG.inputSize, 3]);
        tfModel.predict ? tfModel.predict(warm) : tfModel.execute(warm);
        tf.dispose(warm);
        return true;
    } catch (err) {
        console.warn('TF.js model load failed:', err);
        tfModel = null;
        return false;
    }
}

async function tryLoadONNX() {
    if (!window.ort) return false;
    try {
        onnxSession = await ort.InferenceSession.create(MODEL_CONFIG.onnxModelUrl);
        console.log('Loaded ONNX model');
        return true;
    } catch (err) {
        console.warn('ONNX model load failed:', err);
        onnxSession = null;
        return false;
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const resultArea = document.getElementById('detectionResult');
        if (!resultArea) return;

        resultArea.innerHTML = `
            <div class="loading-analysis">
                <div class="spinner"></div>
                <p>Analyzing image for pests and diseases...</p>
            </div>
        `;

        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.createElement('div');
            preview.className = 'image-preview';
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Uploaded crop image">
                <div class="preview-overlay">Analyzing...</div>
            `;
            resultArea.prepend(preview);
        };
        reader.readAsDataURL(file);

        predictFromFile(file);
    }
}

async function predictFromFile(file) {
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => img.src = ev.target.result;
    reader.readAsDataURL(file);

    img.onload = async () => {
        const [sx, sy, sW, sH] = getCenterCropParams(img.width, img.height, MODEL_CONFIG.inputSize, MODEL_CONFIG.inputSize);
        previewCtx.clearRect(0,0,MODEL_CONFIG.inputSize,MODEL_CONFIG.inputSize);
        previewCtx.drawImage(img, sx, sy, sW, sH, 0, 0, MODEL_CONFIG.inputSize, MODEL_CONFIG.inputSize);

        if (tfModel) {
            await predictTF(previewCanvas);
        } else if (onnxSession) {
            await predictONNX(previewCanvas);
        } else {
            showManualAnalysisForm(img.src);
        }
    };
}

function getCenterCropParams(w, h, targetW, targetH) {
    const srcAspect = w / h;
    const targetAspect = targetW / targetH;
    if (srcAspect > targetAspect) {
        const newW = Math.round(h * targetAspect);
        const sx = Math.round((w - newW) / 2);
        return [sx, 0, newW, h];
    } else {
        const newH = Math.round(w / targetAspect);
        const sy = Math.round((h - newH) / 2);
        return [0, sy, w, newH];
    }
}

async function predictTF(canvas) {
    try {
        let t = tf.browser.fromPixels(canvas).toFloat();
        t = t.div(255.0);
        t = t.expandDims(0);

        const logits = tfModel.predict ? tfModel.predict(t) : tfModel.execute(t);
        const probs = await (logits.data ? logits.data() : logits.array());
        const arr = Array.from(probs);
        const top = getTopK(arr, 3);
        renderResults(top);
        tf.dispose([t, logits]);
    } catch (err) {
        console.error('TF predict error:', err);
        displayNote('Prediction failed (TF.js). See console for details.');
    }
}

async function predictONNX(canvas) {
    try {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const W = canvas.width, H = canvas.height;
        const floatData = new Float32Array(1 * 3 * H * W);
        let idx = 0;
        for (let c = 0; c < 3; c++) {
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const p = (y * W + x) * 4;
                    const val = imageData[p + c];
                    floatData[idx++] = val / 255.0;
                }
            }
        }
        const inputName = onnxSession.inputNames && onnxSession.inputNames.length ? onnxSession.inputNames[0] : 'input';
        const feeds = {};
        feeds[inputName] = new ort.Tensor('float32', floatData, [1,3,H,W]);
        const results = await onnxSession.run(feeds);
        const outName = Object.keys(results)[0];
        const outputData = results[outName].data;
        const arr = Array.from(outputData);
        const top = getTopK(arr, 3);
        renderResults(top);
    } catch (err) {
        console.error('ONNX predict error:', err);
        displayNote('Prediction failed (ONNX). See console for details.');
    }
}

function getTopK(arr, k=3) {
    const indexed = arr.map((v,i) => ({i, v}));
    indexed.sort((a,b) => b.v - a.v);
    return indexed.slice(0,k).map(x => ({idx: x.i, score: x.v}));
}

function renderResults(topList) {
    const resultArea = document.getElementById('detectionResult');
    if (!resultArea) return;
    
    let html = `<div class="detection-results">`;
    html += `<h3><i class="bi bi-clipboard-check"></i> Analysis Results</h3>`;
    
    if (topList.length === 0) {
        html += '<p class="no-results">No clear detection. Please try another image.</p>';
    } else {
        html += `<div class="result-list">`;
        for (const item of topList) {
            const label = labels && labels[item.idx] ? labels[item.idx] : `Class ${item.idx}`;
            const confidence = (item.score * 100).toFixed(1);
            const isProblem = label.toLowerCase().includes('disease') || label.toLowerCase().includes('pest');
            
            html += `
                <div class="result-item ${isProblem ? 'problem' : 'healthy'}">
                    <div class="result-header">
                        <i class="bi ${isProblem ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i>
                        <strong>${escapeHtml(label)}</strong>
                    </div>
                    <div class="result-details">
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${confidence}%"></div>
                        </div>
                        <span class="confidence-text">${confidence}% confidence</span>
                    </div>
                    ${isProblem ? `
                    <div class="result-advice">
                        <i class="bi bi-lightbulb"></i>
                        <span>${getAdviceForProblem(label)}</span>
                    </div>
                    ` : ''}
                </div>
            `;
        }
        html += `</div>`;
        
        html += `
            <div class="result-actions">
                <button class="btn btn-primary" onclick="logDetection('${topList[0]?.idx}')">
                    <i class="bi bi-save"></i> Log Detection
                </button>
                <button class="btn btn-outline" onclick="handleImageUpload(event)">
                    <i class="bi bi-arrow-clockwise"></i> Analyze Another
                </button>
            </div>
        `;
    }
    
    html += `</div>`;
    resultArea.innerHTML = html;
}

function showManualAnalysisForm(imageSrc) {
    const resultArea = document.getElementById('detectionResult');
    if (!resultArea) return;
    
    resultArea.innerHTML = `
        <div class="manual-analysis">
            <h3><i class="bi bi-eye"></i> Manual Analysis Required</h3>
            <div class="image-preview-large">
                <img src="${imageSrc}" alt="Uploaded crop image">
            </div>
            <p>ML model not available. Please describe what you see:</p>
            
            <div class="manual-form">
                <div class="form-group">
                    <label><i class="bi bi-bug"></i> Pest Presence</label>
                    <select id="manualPestSelect" class="form-select">
                        <option value="none">No pests visible</option>
                        <option value="low">Few pests (manageable)</option>
                        <option value="medium">Moderate pest presence</option>
                        <option value="high">Severe infestation</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label><i class="bi bi-droplet"></i> Disease Symptoms</label>
                    <select id="manualDiseaseSelect" class="form-select">
                        <option value="none">No disease symptoms</option>
                        <option value="spots">Leaf spots/discoloration</option>
                        <option value="wilting">Wilting/drooping</option>
                        <option value="mold">Mold/fungal growth</option>
                        <option value="other">Other symptoms</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label><i class="bi bi-chat-left-text"></i> Additional Notes</label>
                    <textarea id="manualNotes" class="form-textarea" 
                              placeholder="Describe any other issues or observations..."></textarea>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="submitManualAnalysis()">
                        <i class="bi bi-check-circle"></i> Submit Analysis
                    </button>
                    <button class="btn btn-outline" onclick="handleImageUpload(event)">
                        <i class="bi bi-arrow-clockwise"></i> Try Another Image
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function submitManualAnalysis() {
    const pestLevel = document.getElementById('manualPestSelect').value;
    const diseaseType = document.getElementById('manualDiseaseSelect').value;
    const notes = document.getElementById('manualNotes').value;
    
    const detection = {
        type: 'manual',
        pest_level: pestLevel,
        disease: diseaseType,
        notes: notes,
        timestamp: new Date().toISOString(),
        planting_id: currentPlantingId
    };
    
    const detections = JSON.parse(localStorage.getItem('cropDetections') || '[]');
    detections.push(detection);
    localStorage.setItem('cropDetections', JSON.stringify(detections));
    
    showManualAnalysisResult(pestLevel, diseaseType);
}

function showManualAnalysisResult(pestLevel, diseaseType) {
    const resultArea = document.getElementById('detectionResult');
    if (!resultArea) return;
    
    let recommendations = [];
    let severity = 'info';
    
    if (pestLevel === 'high' || diseaseType !== 'none') {
        severity = 'warning';
        recommendations.push('Consider applying organic pesticide');
        recommendations.push('Remove severely affected leaves/plants');
        recommendations.push('Increase plant spacing for better airflow');
    } else if (pestLevel === 'medium') {
        severity = 'warning';
        recommendations.push('Monitor closely for pest increase');
        recommendations.push('Consider natural predators or traps');
        recommendations.push('Apply neem oil as preventative');
    } else {
        recommendations.push('Continue regular monitoring');
        recommendations.push('Maintain optimal watering schedule');
        recommendations.push('Ensure adequate sunlight and nutrients');
    }
    
    resultArea.innerHTML = `
        <div class="manual-result ${severity}">
            <div class="result-header">
                <i class="bi ${severity === 'warning' ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i>
                <h3>Analysis Complete</h3>
            </div>
            <div class="result-summary">
                <p><strong>Pest Level:</strong> ${pestLevel}</p>
                <p><strong>Disease:</strong> ${diseaseType}</p>
                <p><strong>Logged:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div class="result-recommendations">
                <h4><i class="bi bi-lightbulb"></i> Recommendations:</h4>
                <ul>
                    ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            <div class="result-actions">
                <button class="btn btn-primary" onclick="getAIRecommendation(${currentPlantingId})">
                    <i class="bi bi-robot"></i> Get AI Advice
                </button>
                <button class="btn btn-outline" onclick="navigateToPage('analytics')">
                    <i class="bi bi-graph-up"></i> View History
                </button>
            </div>
        </div>
    `;
}

function displayNote(msg) {
    const resultEl = document.getElementById('detectionResult');
    if (!resultEl) return;
    resultEl.innerHTML = `<div class="info-note">${msg}</div>`;
}

function escapeHtml(unsafe) {
    return unsafe.replace(/[&<"'>]/g, function(m){ 
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]; 
    });
}

function getAdviceForProblem(problem) {
    const adviceMap = {
        'disease': 'Isolate affected plants. Apply fungicide if severe.',
        'pest': 'Use organic pesticides. Remove heavily infested leaves.',
        'fungal': 'Improve air circulation. Reduce watering frequency.',
        'bacterial': 'Remove affected areas. Avoid overhead watering.',
        'viral': 'Remove entire plant. Control insect vectors.',
        'nutrition': 'Test soil nutrients. Apply balanced fertilizer.',
        'water': 'Adjust watering schedule. Check drainage.'
    };
    
    for (const [key, advice] of Object.entries(adviceMap)) {
        if (problem.toLowerCase().includes(key)) {
            return advice;
        }
    }
    
    return 'Monitor closely and adjust care practices.';
}

async function logDetection(detectionId) {
    if (!currentPlantingId) {
        showNotification('warning', 'No Active Crop', 'Please select a crop first.');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/crop/${currentPlantingId}/image-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detected_disease: 'Unknown',
                detected_pests: 'Unknown',
                pest_confidence: 0.5,
                overall_health_score: 75
            })
        });
        
        if (response.ok) {
            showNotification('success', 'Detection Logged', 'Added to crop history.');
        } else {
            const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
            logs.push({
                planting_id: currentPlantingId,
                detection_id: detectionId,
                timestamp: new Date().toISOString(),
                type: 'automatic'
            });
            localStorage.setItem('detectionLogs', JSON.stringify(logs));
            showNotification('success', 'Detection Saved Locally', 'Added to local history.');
        }
        
        await getAIRecommendation(currentPlantingId);
        
    } catch (error) {
        console.error('Error logging detection:', error);
        const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
        logs.push({
            planting_id: currentPlantingId,
            detection_id: detectionId,
            timestamp: new Date().toISOString(),
            type: 'automatic'
        });
        localStorage.setItem('detectionLogs', JSON.stringify(logs));
        showNotification('success', 'Detection Saved Locally', 'Added to local history.');
    }
}

// ---------------------
// ANALYTICS FUNCTIONS
// ---------------------
async function loadAnalytics() {
    const analyticsContainer = document.getElementById('analytics');
    if (!analyticsContainer) return;
    
    if (userCrops.length === 0) {
        analyticsContainer.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-graph-up"></i>
                <h4>No Data Available</h4>
                <p>Plant a crop and add observations to see analytics</p>
                <button class="btn btn-primary" onclick="navigateToPage('plants')">
                    <i class="bi bi-flower1"></i> Plant a Crop
                </button>
            </div>
        `;
        return;
    }
    
    analyticsContainer.innerHTML = `
        <div class="loading-analytics">
            <div class="spinner"></div>
            <p>Loading analytics data...</p>
        </div>
    `;
    
    try {
        const detections = JSON.parse(localStorage.getItem('cropDetections') || '[]');
        const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
        const observations = JSON.parse(localStorage.getItem('cropObservations') || '[]');
        
        let currentCropDetections, currentCropObservations;
        if (selectedCrop) {
            currentCropDetections = detections.filter(d => d.planting_id === selectedCrop.planting_id);
            currentCropObservations = observations.filter(o => o.planting_id === selectedCrop.planting_id);
        } else {
            currentCropDetections = detections;
            currentCropObservations = observations;
        }
        
        analyticsContainer.innerHTML = generateAnalyticsHTML(currentCropDetections, logs, currentCropObservations);
        
        if (window.Chart) {
            renderAnalyticsCharts(currentCropDetections, logs, currentCropObservations);
        }
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        analyticsContainer.innerHTML = `
            <div class="error-state">
                <i class="bi bi-exclamation-triangle"></i>
                <h4>Error Loading Analytics</h4>
                <p>Could not load data. Please try again.</p>
                <button class="btn btn-outline" onclick="loadAnalytics()">
                    <i class="bi bi-arrow-clockwise"></i> Retry
                </button>
            </div>
        `;
    }
}

function generateAnalyticsHTML(detections, logs, observations) {
    const totalDetections = detections.length + logs.length + observations.length;
    const pestDetections = detections.filter(d => d.pest_level !== 'none').length + 
                          observations.filter(o => o.pest_level && o.pest_level !== 'low').length;
    const diseaseDetections = detections.filter(d => d.disease !== 'none').length + 
                             observations.filter(o => o.disease_observed).length;
    const healthyDays = 30 - Math.min(totalDetections, 30);
    
    const cropName = selectedCrop ? selectedCrop.crop_type : 'All Crops';
    
    return `
        <div class="analytics-container">
            <div class="analytics-header">
                <h3><i class="bi bi-graph-up"></i> Crop Analytics</h3>
                <p>Insights for ${cropName}</p>
                ${!selectedCrop ? '<p class="text-muted"><small>Showing data for all crops</small></p>' : ''}
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background-color: #3498db">
                        <i class="bi bi-clipboard-data"></i>
                    </div>
                    <div class="stat-content">
                        <h4>${totalDetections}</h4>
                        <p>Total Observations</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background-color: #e74c3c">
                        <i class="bi bi-bug"></i>
                    </div>
                    <div class="stat-content">
                        <h4>${pestDetections}</h4>
                        <p>Pest Detections</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background-color: #f39c12">
                        <i class="bi bi-droplet"></i>
                    </div>
                    <div class="stat-content">
                        <h4>${diseaseDetections}</h4>
                        <p>Disease Cases</p>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon" style="background-color: #2ecc71">
                        <i class="bi bi-check-circle"></i>
                    </div>
                    <div class="stat-content">
                        <h4>${healthyDays}</h4>
                        <p>Healthy Days</p>
                    </div>
                </div>
            </div>
            
            <div class="charts-container">
                <div class="chart-wrapper">
                    <h4><i class="bi bi-bar-chart"></i> Detection History</h4>
                    <canvas id="detectionChart" width="400" height="200"></canvas>
                </div>
                
                <div class="chart-wrapper">
                    <h4><i class="bi bi-pie-chart"></i> Problem Distribution</h4>
                    <canvas id="problemChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <div class="recent-activity">
                <h4><i class="bi bi-clock-history"></i> Recent Activity</h4>
                <div class="activity-list">
                    ${generateActivityList(detections, logs, observations)}
                </div>
            </div>
            
            <div class="analytics-actions">
                <button class="btn btn-primary" onclick="exportAnalyticsData()">
                    <i class="bi bi-download"></i> Export Data
                </button>
                <button class="btn btn-outline" onclick="clearAnalyticsData()">
                    <i class="bi bi-trash"></i> Clear History
                </button>
            </div>
        </div>
    `;
}

function generateActivityList(detections, logs, observations) {
    const allActivities = [
        ...detections.map(d => ({ ...d, type: 'manual_detection' })),
        ...logs.map(l => ({ ...l, type: 'automatic_detection' })),
        ...observations.map(o => ({ ...o, type: 'observation' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, 10);
    
    if (allActivities.length === 0) {
        return '<div class="no-activity">No activity recorded yet.</div>';
    }
    
    return allActivities.map(activity => {
        const date = new Date(activity.timestamp);
        const timeAgo = getTimeAgo(date);
        
        let description = '';
        let icon = 'bi-info-circle';
        
        if (activity.type === 'manual_detection') {
            description = `Manual observation: ${activity.pest_level} pests, ${activity.disease} disease`;
            icon = 'bi-eye';
        } else if (activity.type === 'automatic_detection') {
            description = 'Automatic image analysis completed';
            icon = 'bi-camera';
        } else if (activity.type === 'observation') {
            description = `Observation: ${activity.notes?.substring(0, 50) || 'No notes'}`;
            icon = 'bi-journal-text';
        }
        
        return `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="bi ${icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${description}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAnalyticsCharts(detections, logs, observations) {
    const detectionCtx = document.getElementById('detectionChart')?.getContext('2d');
    if (detectionCtx) {
        const last30Days = Array.from({length: 30}, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i));
            return date.toISOString().split('T')[0];
        });
        
        const dailyCounts = last30Days.map(date => {
            return detections.filter(d => 
                d.timestamp && d.timestamp.startsWith(date)
            ).length + observations.filter(o =>
                o.timestamp && o.timestamp.startsWith(date)
            ).length;
        });
        
        new Chart(detectionCtx, {
            type: 'line',
            data: {
                labels: last30Days.map(d => new Date(d).getDate()),
                datasets: [{
                    label: 'Daily Observations',
                    data: dailyCounts,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Observations'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Day of Month'
                        }
                    }
                }
            }
        });
    }
    
    const problemCtx = document.getElementById('problemChart')?.getContext('2d');
    if (problemCtx) {
        const pestCount = detections.filter(d => d.pest_level !== 'none').length + 
                         observations.filter(o => o.pest_level && o.pest_level !== 'low').length;
        const diseaseCount = detections.filter(d => d.disease !== 'none').length + 
                           observations.filter(o => o.disease_observed).length;
        const healthyCount = detections.length + observations.length - (pestCount + diseaseCount);
        
        new Chart(problemCtx, {
            type: 'doughnut',
            data: {
                labels: ['Pest Issues', 'Disease Issues', 'Healthy'],
                datasets: [{
                    data: [pestCount, diseaseCount, healthyCount],
                    backgroundColor: [
                        '#e74c3c',
                        '#f39c12',
                        '#2ecc71'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    
    return Math.floor(seconds) + ' second' + (seconds === 1 ? '' : 's') + ' ago';
}

function exportAnalyticsData() {
    const detections = JSON.parse(localStorage.getItem('cropDetections') || '[]');
    const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
    const observations = JSON.parse(localStorage.getItem('cropObservations') || '[]');
    
    let exportData;
    if (selectedCrop) {
        const currentDetections = detections.filter(d => d.planting_id === selectedCrop.planting_id);
        const currentObservations = observations.filter(o => o.planting_id === selectedCrop.planting_id);
        
        exportData = {
            crop: selectedCrop.crop_type,
            planting_id: selectedCrop.planting_id,
            export_date: new Date().toISOString(),
            detections: currentDetections,
            observations: currentObservations,
            automatic_logs: logs.filter(l => l.planting_id === selectedCrop.planting_id)
        };
    } else {
        exportData = {
            crop: 'All Crops',
            export_date: new Date().toISOString(),
            detections: detections,
            observations: observations,
            automatic_logs: logs,
            user_crops: userCrops
        };
    }
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `crop_analytics_${selectedCrop ? selectedCrop.crop_type : 'all_crops'}_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('success', 'Data Exported', 'Analytics data downloaded as JSON.');
}

function clearAnalyticsData() {
    if (confirm('Are you sure you want to clear analytics data? This cannot be undone.')) {
        if (selectedCrop) {
            const allDetections = JSON.parse(localStorage.getItem('cropDetections') || '[]');
            const allObservations = JSON.parse(localStorage.getItem('cropObservations') || '[]');
            
            const filteredDetections = allDetections.filter(d => d.planting_id !== selectedCrop.planting_id);
            const filteredObservations = allObservations.filter(o => o.planting_id !== selectedCrop.planting_id);
            
            localStorage.setItem('cropDetections', JSON.stringify(filteredDetections));
            localStorage.setItem('cropObservations', JSON.stringify(filteredObservations));
            
            showNotification('info', 'Data Cleared', 'Analytics data has been removed for this crop.');
        } else {
            localStorage.removeItem('cropDetections');
            localStorage.removeItem('cropObservations');
            localStorage.removeItem('detectionLogs');
            
            showNotification('info', 'All Data Cleared', 'All analytics data has been removed.');
        }
        
        loadAnalytics();
    }
}

// ---------------------
// QUICK ACTIONS
// ---------------------
function initializeQuickActions() {
    const quickActionsContainer = document.querySelector('.quick-actions');
    if (!quickActionsContainer) return;
    
    quickActionsContainer.innerHTML = `
        <div class="quick-actions-grid">
            <div class="quick-action-card water" onclick="handleQuickAction('water')">
                <i class="bi bi-droplet"></i>
                <div class="action-title">Water</div>
                <div class="action-desc">Log watering activity</div>
            </div>
            <div class="quick-action-card fertilize" onclick="handleQuickAction('fertilize')">
                <i class="bi bi-flower1"></i>
                <div class="action-title">Fertilize</div>
                <div class="action-desc">Record fertilization</div>
            </div>
            <div class="quick-action-card inspect" onclick="handleQuickAction('inspect')">
                <i class="bi bi-camera"></i>
                <div class="action-title">Inspect</div>
                <div class="action-desc">Upload crop image</div>
            </div>
            <div class="quick-action-card note" onclick="handleQuickAction('note')">
                <i class="bi bi-journal-text"></i>
                <div class="action-title">Note</div>
                <div class="action-desc">Add observation</div>
            </div>
            <div class="quick-action-card harvest" onclick="handleQuickAction('harvest')">
                <i class="bi bi-basket"></i>
                <div class="action-title">Harvest</div>
                <div class="action-desc">Mark as harvested</div>
            </div>
        </div>
    `;
}

function handleQuickAction(action) {
    if (!selectedCrop && action !== 'inspect') {
        showNotification('warning', 'No Crop Selected', 'Please select a crop first.');
        return;
    }
    
    switch(action) {
        case 'water':
            logQuickAction('water', 'Watered crop as per schedule');
            showNotification('success', 'Watering Logged', 'Watering activity recorded.');
            break;
            
        case 'fertilize':
            logQuickAction('fertilize', 'Applied fertilizer');
            showNotification('success', 'Fertilization Logged', 'Fertilizer application recorded.');
            break;
            
        case 'inspect':
            document.getElementById('imageUpload').click();
            break;
            
        case 'note':
            showQuickNoteModal();
            break;
            
        case 'harvest':
            if (confirm('Are you ready to harvest this crop? This will mark it as completed.')) {
                markAsHarvested();
            }
            break;
    }
}

function logQuickAction(type, description) {
    if (!selectedCrop) return;
    
    const action = {
        planting_id: selectedCrop.planting_id,
        type: type,
        description: description,
        timestamp: new Date().toISOString()
    };
    
    const actions = JSON.parse(localStorage.getItem('quickActions') || '[]');
    actions.push(action);
    localStorage.setItem('quickActions', JSON.stringify(actions));
}

function showQuickNoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal quick-note-modal">
            <div class="modal-header">
                <h4><i class="bi bi-journal-text"></i> Add Quick Note</h4>
                <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <textarea id="quickNoteText" class="form-textarea" 
                          placeholder="Enter your observation note here..." rows="4"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn btn-primary" onclick="saveQuickNote()">Save Note</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function saveQuickNote() {
    const noteText = document.getElementById('quickNoteText').value;
    if (!noteText.trim()) {
        alert('Please enter a note');
        return;
    }
    
    const note = {
        planting_id: selectedCrop.planting_id,
        text: noteText,
        timestamp: new Date().toISOString()
    };
    
    const notes = JSON.parse(localStorage.getItem('cropNotes') || '[]');
    notes.push(note);
    localStorage.setItem('cropNotes', JSON.stringify(notes));
    
    document.querySelector('.modal-overlay').remove();
    showNotification('success', 'Note Saved', 'Observation note added successfully.');
}

function markAsHarvested() {
    if (!selectedCrop) return;
    
    const cropIndex = userCrops.findIndex(c => c.planting_id === selectedCrop.planting_id);
    if (cropIndex !== -1) {
        userCrops[cropIndex].harvested = true;
        userCrops[cropIndex].harvest_date = new Date().toISOString();
        localStorage.setItem('userCrops', JSON.stringify(userCrops));
    }
    
    userCrops = userCrops.filter(c => c.planting_id !== selectedCrop.planting_id);
    
    const wasSelected = selectedCrop;
    selectedCrop = null;
    currentPlantingId = null;
    
    updateDashboardWithAllCrops();
    navigateToPage('home');
    
    showNotification('success', 'Harvest Complete!', `${wasSelected.crop_type} has been harvested. Great work!`);
}

// ---------------------
// HELPER FUNCTIONS
// ---------------------
function getActionIcon(action) {
    const iconMap = {
        'irrigate': 'bi-droplet',
        'fertilize': 'bi-flower1',
        'pesticide': 'bi-bug',
        'no_action': 'bi-check-circle',
        'monitor': 'bi-binoculars',
        'harvest': 'bi-basket'
    };
    return iconMap[action] || 'bi-question-circle';
}

function getActionColor(action) {
    const colorMap = {
        'irrigate': '#3498db',
        'fertilize': '#2ecc71',
        'pesticide': '#e74c3c',
        'no_action': '#95a5a6',
        'monitor': '#f39c12',
        'harvest': '#9b59b6'
    };
    return colorMap[action] || '#95a5a6';
}

function getConfidenceColor(confidence) {
    if (confidence >= 0.8) return '#2ecc71';
    if (confidence >= 0.6) return '#f39c12';
    return '#e74c3c';
}

function formatAction(action) {
    const formatMap = {
        'irrigate': 'Irrigation Needed',
        'fertilize': 'Fertilization Needed',
        'pesticide': 'Pest Control Needed',
        'no_action': 'No Action Required',
        'monitor': 'Monitor Crop',
        'harvest': 'Ready for Harvest'
    };
    return formatMap[action] || action;
}

function formatKey(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function showNotification(type, title, message) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="bi ${getNotificationIcon(type)}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    const container = document.getElementById('notificationContainer') || createNotificationContainer();
    container.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const iconMap = {
        'success': 'bi-check-circle',
        'error': 'bi-exclamation-circle',
        'warning': 'bi-exclamation-triangle',
        'info': 'bi-info-circle'
    };
    return iconMap[type] || 'bi-info-circle';
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function getDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateProgress(startDate, totalDays) {
    const daysElapsed = getDaysBetween(startDate, new Date());
    const progress = (daysElapsed / totalDays) * 100;
    return Math.min(100, Math.max(0, progress));
}

// ---------------------
// "LOGOUT" FUNCTION
// ---------------------
function logout() {
    showLoginModal();
}

// ---------------------
// ADD ALL STYLES
// ---------------------
const allStyles = document.createElement('style');
allStyles.textContent = `
    /* Navigation fixes */
    #side_nav {
        transition: transform 0.3s ease-in-out;
        z-index: 1000;
    }
    
    #side_nav.active {
        transform: translateX(0);
    }
    
    /* For mobile navigation */
    @media (max-width: 768px) {
        #side_nav:not(.active) {
            transform: translateX(-100%);
        }
        
        .mobile-nav-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 998;
        }
        
        .mobile-nav-overlay.active {
            display: block;
        }
    }
    
    /* Menu toggle button */
    #menuToggle {
        background: none;
        border: none;
        font-size: 24px;
        color: #333;
        cursor: pointer;
        padding: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    #menuToggle:hover {
        background-color: rgba(0, 0, 0, 0.05);
    }
    
    /* Close nav button */
    #closeNav {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        display: none;
    }
    
    @media (max-width: 768px) {
        #closeNav {
            display: block;
        }
    }
    
    /* Nav items styling */
    .nav-item {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        color: #333;
        text-decoration: none;
        border-radius: 8px;
        margin: 4px 0;
        transition: all 0.2s;
        cursor: pointer;
    }
    
    .nav-item:hover {
        background-color: rgba(52, 152, 219, 0.1);
        color: #3498db;
    }
    
    .nav-item.active {
        background-color: #3498db;
        color: white;
    }
    
    .nav-item i {
        margin-right: 12px;
        font-size: 18px;
    }
    
    /* Ensure pages are hidden by default */
    .page {
        display: none;
    }
    
    .page.active {
        display: block;
    }
    
    /* Progress animation */
    .progress-animate {
        transition: width 1s ease-in-out;
    }
    
    /* Notifications */
    .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
    }
    
    .notification {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 16px;
        margin-bottom: 10px;
        display: flex;
        align-items: flex-start;
        min-width: 300px;
        max-width: 400px;
        border-left: 4px solid;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification-success {
        border-left-color: #2ecc71;
    }
    
    .notification-error {
        border-left-color: #e74c3c;
    }
    
    .notification-warning {
        border-left-color: #f39c12;
    }
    
    .notification-info {
        border-left-color: #3498db;
    }
    
    .notification-icon {
        margin-right: 12px;
        font-size: 20px;
    }
    
    .notification-success .notification-icon {
        color: #2ecc71;
    }
    
    .notification-content {
        flex: 1;
    }
    
    .notification-title {
        font-weight: 600;
        margin-bottom: 4px;
    }
    
    .notification-message {
        color: #666;
        font-size: 14px;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    /* Loading states */
    .loading-analysis, .loading-analytics {
        text-align: center;
        padding: 40px 20px;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Empty states */
    .empty-state {
        text-align: center;
        padding: 60px 20px;
        color: #666;
    }
    
    .empty-state i {
        font-size: 48px;
        color: #ddd;
        margin-bottom: 16px;
    }
    
    /* Image preview */
    .image-preview {
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 20px;
    }
    
    .image-preview img {
        width: 100%;
        height: 200px;
        object-fit: cover;
    }
    
    .preview-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 8px;
        text-align: center;
        font-size: 14px;
    }
    
    /* Manual analysis form */
    .manual-form {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
    }
    
    .form-group {
        margin-bottom: 16px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: 500;
        color: #333;
    }
    
    .form-select, .form-textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
    }
    
    .form-textarea {
        resize: vertical;
        min-height: 80px;
    }
    
    .form-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
    }
    
    /* Detection results */
    .detection-results {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .result-item {
        padding: 12px;
        margin-bottom: 10px;
        border-radius: 6px;
        background: #f8f9fa;
    }
    
    .result-item.problem {
        background: #fff3cd;
        border-left: 4px solid #f39c12;
    }
    
    .result-item.healthy {
        background: #d1ecf1;
        border-left: 4px solid #17a2b8;
    }
    
    .result-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .result-header i {
        margin-right: 8px;
        font-size: 18px;
    }
    
    .confidence-bar {
        height: 6px;
        background: #e9ecef;
        border-radius: 3px;
        overflow: hidden;
        margin: 8px 0;
    }
    
    .confidence-fill {
        height: 100%;
        background: #3498db;
        transition: width 0.3s ease;
    }
    
    .result-actions {
        display: flex;
        gap: 10px;
        margin-top: 20px;
    }
    
    /* Analytics */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin: 24px 0;
    }
    
    .stat-card {
        background: white;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        align-items: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        color: white;
        font-size: 24px;
    }
    
    .stat-content h4 {
        font-size: 24px;
        margin: 0;
        color: #2c3e50;
    }
    
    .stat-content p {
        margin: 4px 0 0;
        color: #7f8c8d;
        font-size: 14px;
    }
    
    .charts-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
        margin: 32px 0;
    }
    
    .chart-wrapper {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .activity-list {
        margin-top: 16px;
    }
    
    .activity-item {
        display: flex;
        align-items: flex-start;
        padding: 12px;
        border-bottom: 1px solid #eee;
    }
    
    .activity-item:last-child {
        border-bottom: none;
    }
    
    .activity-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #f8f9fa;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        color: #3498db;
    }
    
    .activity-title {
        font-weight: 500;
        margin-bottom: 4px;
    }
    
    .activity-time {
        font-size: 12px;
        color: #95a5a6;
    }
    
    /* Dashboard styles */
    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
    }
    
    .crops-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }
    
    .dashboard-crop-card {
        background: white;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border: 2px solid transparent;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .dashboard-crop-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        border-color: #3498db;
    }
    
    .dashboard-crop-card.selected {
        border-color: #2ecc71;
        background: #f8f9fa;
    }
    
    .crop-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }
    
    .crop-card-header i {
        font-size: 24px;
        color: #2ecc71;
    }
    
    .crop-age {
        font-size: 12px;
        color: #7f8c8d;
        background: #f1f2f6;
        padding: 2px 8px;
        border-radius: 10px;
        display: inline-block;
        margin-top: 4px;
    }
    
    .crop-progress {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
    }
    
    .crop-details {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
    }
    
    .detail-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 14px;
    }
    
    .detail-row:last-child {
        margin-bottom: 0;
    }
    
    .crop-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
    }
    
    /* Crop detail view */
    .crop-detail-view {
        background: white;
        border-radius: 12px;
        padding: 20px;
    }
    
    .detail-header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 24px;
    }
    
    .detail-main {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }
    
    .detail-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 15px;
    }
    
    .stat-box {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
    }
    
    .stat-value {
        font-size: 28px;
        font-weight: bold;
        color: #2c3e50;
        margin-bottom: 4px;
    }
    
    .stat-label {
        font-size: 12px;
        color: #7f8c8d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .progress-section {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 16px;
    }
    
    .progress-bar-large {
        height: 20px;
        background: #e9ecef;
        border-radius: 10px;
        overflow: hidden;
        margin: 10px 0;
    }
    
    .detail-section {
        background: #f8f9fa;
        border-radius: 10px;
        padding: 16px;
    }
    
    .detail-section h4 {
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #2c3e50;
    }
    
    /* Timeline */
    .timeline {
        position: relative;
        padding-left: 30px;
    }
    
    .timeline::before {
        content: '';
        position: absolute;
        left: 10px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #3498db;
    }
    
    .timeline-item {
        position: relative;
        margin-bottom: 20px;
    }
    
    .timeline-dot {
        position: absolute;
        left: -25px;
        top: 0;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #3498db;
        border: 2px solid white;
    }
    
    .timeline-dot.harvest {
        background: #2ecc71;
    }
    
    .timeline-date {
        font-size: 12px;
        color: #7f8c8d;
        margin-bottom: 4px;
    }
    
    .timeline-content {
        background: white;
        padding: 10px;
        border-radius: 6px;
        border-left: 3px solid #3498db;
    }
    
    /* Planting calendar popup */
    .planting-calendar-modal {
        max-width: 400px;
    }
    
    .calendar-popup {
        background: white;
        border-radius: 8px;
        padding: 15px;
        margin: 15px 0;
    }
    
    .calendar-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .calendar-popup-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        text-align: center;
        font-size: 12px;
        color: #7f8c8d;
        margin-bottom: 10px;
    }
    
    .calendar-popup-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
    }
    
    .calendar-popup-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        position: relative;
        transition: all 0.2s;
    }
    
    .calendar-popup-day:hover:not(.empty):not(.past):not(.future) {
        background: #e3f2fd;
    }
    
    .calendar-popup-day.selected {
        background: #3498db;
        color: white;
    }
    
    .calendar-popup-day.past {
        color: #ccc;
        cursor: not-allowed;
    }
    
    .calendar-popup-day.future {
        color: #999;
        cursor: not-allowed;
    }
    
    .calendar-popup-day.today {
        background: #f0f7ff;
        color: #3498db;
        font-weight: bold;
    }
    
    .calendar-popup-day.empty {
        visibility: hidden;
    }
    
    .today-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #2ecc71;
        color: white;
        font-size: 8px;
        padding: 1px 4px;
        border-radius: 3px;
    }
    
    .selected-date-display {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .selected-date-label {
        font-weight: 500;
        color: #7f8c8d;
    }
    
    .selected-date-value {
        font-weight: bold;
        color: #2c3e50;
        flex: 1;
    }
    
    .weather-check {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #7f8c8d;
        font-size: 14px;
        margin-top: 10px;
    }
    
    .weather-check i {
        color: #f39c12;
    }
    
    /* Quick actions */
    .quick-actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-top: 20px;
    }
    
    .quick-action-card {
        background: white;
        border-radius: 10px;
        padding: 15px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;
        border: 1px solid #eee;
    }
    
    .quick-action-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border-color: #3498db;
    }
    
    .quick-action-card i {
        font-size: 32px;
        margin-bottom: 10px;
        display: block;
    }
    
    .quick-action-card.water i { color: #3498db; }
    .quick-action-card.fertilize i { color: #2ecc71; }
    .quick-action-card.inspect i { color: #f39c12; }
    .quick-action-card.note i { color: #9b59b6; }
    .quick-action-card.harvest i { color: #e74c3c; }
    
    /* Growth stage indicators */
    .growth-stage-seedling {
        background: #d1ecf1;
        color: #0c5460;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .growth-stage-vegetative {
        background: #d4edda;
        color: #155724;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .growth-stage-flowering {
        background: #fff3cd;
        color: #856404;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    .growth-stage-mature {
        background: #f8d7da;
        color: #721c24;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    
    /* Plant cards */
    .plant-card .btn-plant {
        margin-top: 12px;
        padding: 8px 16px;
        background: #2ecc71;
        color: white;
        border: none;
        border-radius: 6px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .plant-card .btn-plant:hover {
        background: #27ae60;
    }
    
    .plant-card.selected {
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.3);
    }
    
    /* Fertilizer Recommendation Styles */
    .fert-form-container {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin-bottom: 20px;
    }
    
    .fert-result-card {
        background: white;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        margin-top: 20px;
    }
    
    .result-header {
        text-align: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 2px solid #f0f0f0;
    }
    
    .result-header h3 {
        color: #2c3e50;
        margin-bottom: 10px;
    }
    
    .result-context {
        display: flex;
        justify-content: center;
        gap: 20px;
        flex-wrap: wrap;
    }
    
    .context-item {
        background: #f8f9fa;
        padding: 6px 15px;
        border-radius: 20px;
        font-size: 14px;
        color: #495057;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .fertilizer-main {
        margin: 25px 0;
    }
    
    .fertilizer-name-box {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 25px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 25px;
    }
    
    .fertilizer-name-box i {
        font-size: 40px;
    }
    
    .fertilizer-name-box h2 {
        margin: 0;
        font-size: 28px;
        line-height: 1.3;
    }
    
    .fertilizer-type {
        margin: 5px 0 0;
        opacity: 0.9;
        font-size: 16px;
    }
    
    .recommendation-reason,
    .application-details,
    .fertilizer-notes {
        background: #f8f9fa;
        padding: 18px;
        border-radius: 8px;
        margin-bottom: 18px;
        border-left: 4px solid #3498db;
    }
    
    .recommendation-reason h4,
    .application-details h4,
    .fertilizer-notes h4 {
        color: #2c3e50;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
    }
    
    .detail-box {
        background: white;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
    }
    
    .detail-label {
        display: block;
        font-size: 12px;
        color: #7f8c8d;
        text-transform: uppercase;
        margin-bottom: 4px;
    }
    
    .detail-value {
        font-weight: 600;
        color: #2c3e50;
        font-size: 16px;
    }
    
    .result-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 25px;
        padding-top: 20px;
        border-top: 2px solid #f0f0f0;
    }
    
    .alert {
        padding: 12px 16px;
        border-radius: 6px;
        margin: 10px 0;
    }
    
    .alert-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
    }
    
    .alert-error {
        background: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
    }
    
    @media (max-width: 768px) {
        .fertilizer-name-box {
            flex-direction: column;
            text-align: center;
            gap: 10px;
        }
        
        .details-grid {
            grid-template-columns: 1fr;
        }
        
        .result-actions {
            flex-direction: column;
        }
    }
`;
document.head.appendChild(allStyles);

console.log('Smart Crop System ready! (Calendar removed + Simplified Fertilizer System)');