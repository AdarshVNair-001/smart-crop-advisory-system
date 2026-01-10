// ============================================
// home.js — Smart Crop System (With Supabase User Progress)
// ============================================

// Global variables
let userLocation = null;
let selectedCrop = null;
let currentPage = 'home';
let currentWeatherData = null;
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

// Current user and planting
let currentUser = null;
let currentPlantingId = null;
let progressUpdateInterval = null;

// UI control flags
let highlightedPlantingId = null; // for clicking card highlight only (does not open detail)
let showTasksAndProgress = false; // main dashboard tasks/progress hidden by default


// Demo user ID (for when not logged in)
const DEMO_USER_ID = 'demo-user-999';

// Global variables for multiple crops
let userCrops = [];

// Supabase configuration
const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";

// MODEL CONFIG & GLOBALS
const MODEL_CONFIG = {
  tfjsModelUrl: './models/tfjs/model.json',
  onnxModelUrl: './models/model.onnx',
  labelsUrl: './models/labels.json',
  inputSize: 224,
  backendPreference: ['tfjs', 'onnx']
};

const ML_MODELS = {
  svm: './models/svm_decision.pkl',
  svm_features: './models/svm_feature_names.pkl',
  svm_scaler: './models/svm_scaler.pkl',
  decision_tree: './models/dt_task.pkl',
  dt_features: './models/dt_feature_names.pkl',
  dt_task_encoder: './models/task_encoders.pkl',
  random_forest: './models/rf_fertilizer.pkl',
  rf_features: './models/rf_feature_names.pkl',
  fertilizer_encoder: './models/fertilizer_encoder.pkl'
};

let tfModel = null;
let onnxSession = null;
let labels = null;
let modelLoaded = false;

// ML Models
let svmModel = null;
let svmScaler = null;
let svmFeatures = null;
let decisionTreeModel = null;
let dtFeatures = null;
let dtTaskEncoder = null;
let randomForestModel = null;
let rfFeatures = null;
let fertilizerEncoder = null;

const previewCanvas = document.createElement('canvas');
previewCanvas.id = 'previewCanvas';
previewCanvas.width = MODEL_CONFIG.inputSize;
previewCanvas.height = MODEL_CONFIG.inputSize;
previewCanvas.style = 'display:none;';
document.body.appendChild(previewCanvas);
const previewCtx = previewCanvas.getContext('2d');

// Expose functions to global scope
window.navigateToPage = navigateToPage;
window.selectCropForDetail = selectCropForDetail;
window.viewCropDetails = viewCropDetails;
window.removeCrop = removeCrop;
window.showAllCrops = showAllCrops;
window.copyFertilizerInfo = copyFertilizerInfo;
window.findAlternative = findAlternative;

// ---------------------
// INITIALIZATION
// ---------------------
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Smart Crop System Initialized');
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing app...');
    
    // Initialize Supabase
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            console.log('User session found:', session.user.email);
            currentUser = {
                id: session.user.id,
                username: session.user.user_metadata?.username || session.user.email,
                email: session.user.email
            };
            
            // Load user progress from Supabase
            await loadUserProgressFromSupabase();
        } else {
            // No session, use demo mode
            currentUser = {
                id: DEMO_USER_ID,
                username: 'Demo User',
                email: 'demo@smartcrop.com'
            };
            console.log('Using demo user mode');
        }
    } else {
        // Supabase not available, use demo mode
        currentUser = {
            id: DEMO_USER_ID,
            username: 'Demo User',
            email: 'demo@smartcrop.com'
        };
        console.log('Supabase not available, using demo mode');
    }
    
    updateUserDisplay();
    
    // Check location
    await loadUserLocation();
    
    setupEventListeners();
    initializePlantsGrid();
    
    // Load models
    await Promise.all([
        loadModel(),
        loadMLModels()
    ]);
    
    // Initialize navigation state
    initializeNavigation();
    
    // Initialize quick actions
    initializeQuickActions();
    
    console.log('App initialization complete');
}

// ---------------------
// LOAD ML MODELS
// ---------------------
async function loadMLModels() {
    console.log('Loading ML models...');
    
    try {
        console.log('ML models will be loaded via API endpoints');
        await testMLModelEndpoints();
    } catch (error) {
        console.error('Error initializing ML models:', error);
        console.log('ML models will be used via API calls');
    }
}

async function testMLModelEndpoints() {
    try {
        const fertResponse = await fetch(`${API_BASE_URL}/test-models`, {
            method: 'GET'
        });
        
        if (fertResponse.ok) {
            const data = await fertResponse.json();
            console.log('ML models API test:', data.message || 'Ready');
        }
    } catch (error) {
        console.log('ML models API not available, using fallback methods');
    }
}

// ---------------------
// AUTHENTICATION FUNCTIONS
// ---------------------
async function loginUser(email, password) {
    try {
        if (!supabase) {
            showNotification('error', 'Login Error', 'Authentication service not available');
            return false;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            showNotification('error', 'Login Failed', error.message);
            return false;
        }
        
        if (data.user) {
            currentUser = {
                id: data.user.id,
                username: data.user.user_metadata?.username || data.user.email,
                email: data.user.email
            };
            
            // Save user to localStorage for persistence
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Migrate demo data to user account
            await migrateDemoDataToUser();
            
            // Load user progress from Supabase
            await loadUserProgressFromSupabase();
            
            updateUserDisplay();
            showNotification('success', 'Login Successful', `Welcome back, ${currentUser.username}!`);
            return true;
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('error', 'Login Error', 'An unexpected error occurred');
    }
    
    return false;
}

async function signupUser(name, email, password) {
    try {
        if (!supabase) {
            showNotification('error', 'Signup Error', 'Authentication service not available');
            return false;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: name
                }
            }
        });
        
        if (error) {
            showNotification('error', 'Signup Failed', error.message);
            return false;
        }
        
        if (data.user) {
            currentUser = {
                id: data.user.id,
                username: name,
                email: data.user.email
            };
            
            // Save user to localStorage
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Create user progress record in Supabase
            await createUserProgressRecord();
            
            updateUserDisplay();
            showNotification('success', 'Signup Successful', `Welcome ${name}!`);
            return true;
        }
    } catch (error) {
        console.error('Signup error:', error);
        showNotification('error', 'Signup Error', 'An unexpected error occurred');
    }
    
    return false;
}

async function logoutUser() {
    try {
        // Save current progress before logging out
        await saveUserProgressToSupabase();
        
        // Sign out from Supabase
        if (supabase) {
            await supabase.auth.signOut();
        }
        
        // Clear user data
        currentUser = null;
        currentPlantingId = null;
        userCrops = [];
        localStorage.removeItem('currentUser');
        
        // Redirect to landing page
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('error', 'Logout Failed', 'An error occurred during logout');
    }
}

// ---------------------
// USER PROGRESS MANAGEMENT
// ---------------------
async function createUserProgressRecord() {
    if (!supabase || !currentUser || currentUser.id === DEMO_USER_ID) return;
    
    try {
        const { error } = await supabase
            .from('user_progress')
            .upsert({
                user_id: currentUser.id,
                progress_data: {
                    userCrops: [],
                    location: null,
                    detections: [],
                    observations: [],
                    created_at: new Date().toISOString()
                },
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });
        
        if (error) {
            console.error('Error creating user progress record:', error);
        }
    } catch (error) {
        console.error('Error creating progress record:', error);
    }
}

async function loadUserProgressFromSupabase() {
    if (!supabase || !currentUser || currentUser.id === DEMO_USER_ID) return;
    
    try {
        const { data, error } = await supabase
            .from('user_progress')
            .select('progress_data')
            .eq('user_id', currentUser.id)
            .single();
        
        if (!error && data && data.progress_data) {
            // Load crops
            if (data.progress_data.userCrops) {
                userCrops = data.progress_data.userCrops;
            }
            
            // Load location
            if (data.progress_data.location) {
                userLocation = data.progress_data.location;
                updateLocationDisplay();
                fetchWeatherDataFromAPI();
                hideLocationModal();
            } else {
                showLocationModal();
            }
            
            // Update dashboard
            updateDashboardWithAllCrops();
            console.log('User progress loaded from Supabase');
        } else {
            // No progress found, load from localStorage as fallback
            await loadUserProgressFromLocalStorage();
        }
    } catch (error) {
        console.error('Error loading user progress:', error);
        await loadUserProgressFromLocalStorage();
    }
}

async function saveUserProgressToSupabase() {
    if (!supabase || !currentUser || currentUser.id === DEMO_USER_ID) return;
    
    try {
        const progressData = {
            userCrops: userCrops,
            location: userLocation,
            detections: JSON.parse(localStorage.getItem('cropDetections') || '[]'),
            observations: JSON.parse(localStorage.getItem('cropObservations') || '[]'),
            task_completions: JSON.parse(localStorage.getItem('taskCompletions') || '{}'),
            updated_at: new Date().toISOString()
        };
        
        const { error } = await supabase
            .from('user_progress')
            .upsert({
                user_id: currentUser.id,
                progress_data: progressData,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });
        
        if (error) {
            console.error('Error saving user progress:', error);
            // Fallback to localStorage
            await saveUserProgressToLocalStorage();
        } else {
            console.log('User progress saved to Supabase');
        }
    } catch (error) {
        console.error('Error saving progress:', error);
        await saveUserProgressToLocalStorage();
    }
}

async function loadUserProgressFromLocalStorage() {
    // Load crops
    const savedCrops = localStorage.getItem('userCrops');
    if (savedCrops) {
        userCrops = JSON.parse(savedCrops);
    }
    
    // Load location
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        userLocation = JSON.parse(savedLocation);
        updateLocationDisplay();
        fetchWeatherDataFromAPI();
        hideLocationModal();
    } else {
        showLocationModal();
    }
    
    updateDashboardWithAllCrops();
    console.log('User progress loaded from localStorage');
}

async function saveUserProgressToLocalStorage() {
    localStorage.setItem('userCrops', JSON.stringify(userCrops));
    if (userLocation) {
        localStorage.setItem('userLocation', JSON.stringify(userLocation));
    }
}

async function migrateDemoDataToUser() {
    if (!supabase || !currentUser || currentUser.id === DEMO_USER_ID) return;
    
    // Get demo data from localStorage
    const demoCrops = localStorage.getItem('userCrops');
    const demoLocation = localStorage.getItem('userLocation');
    const demoDetections = localStorage.getItem('cropDetections');
    const demoObservations = localStorage.getItem('cropObservations');
    
    if (demoCrops || demoLocation || demoDetections || demoObservations) {
        try {
            const progressData = {
                userCrops: demoCrops ? JSON.parse(demoCrops) : [],
                location: demoLocation ? JSON.parse(demoLocation) : null,
                detections: demoDetections ? JSON.parse(demoDetections) : [],
                observations: demoObservations ? JSON.parse(demoObservations) : [],
                migrated_at: new Date().toISOString()
            };
            
            // Save to Supabase
            const { error } = await supabase
                .from('user_progress')
                .upsert({
                    user_id: currentUser.id,
                    progress_data: progressData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });
            
            if (!error) {
                // Clear demo data from localStorage
                localStorage.removeItem('userCrops');
                localStorage.removeItem('userLocation');
                localStorage.removeItem('cropDetections');
                localStorage.removeItem('cropObservations');
                
                // Update local variables
                userCrops = progressData.userCrops;
                userLocation = progressData.location;
                
                console.log('Demo data migrated to user account');
                showNotification('success', 'Data Migrated', 'Your demo data has been transferred to your account.');
            }
        } catch (error) {
            console.error('Error migrating demo data:', error);
        }
    }
}

// ---------------------
// LOAD USER LOCATION
// ---------------------
async function loadUserLocation() {
    if (currentUser.id === DEMO_USER_ID) {
        // For demo user, check localStorage
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
    } else {
        // For logged-in users, location is loaded with progress
        if (!userLocation) {
            showLocationModal();
        }
    }
}

// ---------------------
// FERTILIZER RECOMMENDATION WITH RANDOM FOREST
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

    // Button action - Use Random Forest model via API
    btn.onclick = async function() {
        const crop = cropSelect.value;
        const soilType = soilTypeSelect.value;
        
        if (!crop || !soilType) {
            results.innerHTML = `<div class="alert alert-warning">Please select both crop type and soil type</div>`;
            return;
        }
        
        // Show loading state
        results.innerHTML = `
            <div class="loading-analysis">
                <div class="spinner"></div>
                <p>Analyzing with Random Forest model...</p>
            </div>
        `;
        
        try {
            // Try to get recommendation from Random Forest model via API
            const fertilizerName = await getFertilizerFromRandomForest(crop, soilType);
            
            // Display the result
            displayFertilizerResult(crop, soilType, fertilizerName);
            
        } catch (error) {
            console.error('Random Forest API error:', error);
            // Fallback to rule-based system
            const fertilizerName = getBestFertilizerForCropAndSoil(crop, soilType);
            displayFertilizerResult(crop, soilType, fertilizerName);
        }
    };

    // Clear previous results
    results.innerHTML = '<p>Select crop type and soil type to get the best fertilizer recommendation (using Random Forest model).</p>';
}

async function getFertilizerFromRandomForest(cropType, soilType) {
    try {
        const response = await fetch(`${API_BASE_URL}/predict-fertilizer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                crop_type: cropType,
                soil_type: soilType,
                temperature: currentWeatherData?.current?.temperature || 25,
                humidity: currentWeatherData?.current?.humidity || 60,
                rainfall: currentWeatherData?.current?.rainfall || 0,
                ph_level: 6.5,
                nitrogen: 50,
                phosphorus: 30,
                potassium: 40
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.fertilizer) {
                console.log('Random Forest prediction:', data);
                return data.fertilizer;
            }
        }
        
        return getBestFertilizerForCropAndSoil(cropType, soilType);
        
    } catch (error) {
        console.error('Random Forest API call failed:', error);
        return getBestFertilizerForCropAndSoil(cropType, soilType);
    }
}

function getBestFertilizerForCropAndSoil(cropType, soilType) {
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
    
    if (fertilizerMatrix[cropType] && fertilizerMatrix[cropType][soilType]) {
        return fertilizerMatrix[cropType][soilType];
    }
    
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
                    <span class="context-item"><i class="bi bi-diagram-3"></i> Random Forest Model</span>
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
        'Compound NPK (e.g., 16-16-16)': {
            form: 'Granular',
            targetNutrient: 'Balanced NPK',
            applicationRate: '150-300 kg/ha',
            stage: 'Basal',
            frequency: '1 application',
            remarks: 'Use based on soil test recommendations.',
            recommendation: 'Balanced nutrition for maize in alluvial soils'
        },
        'NPK 14-35-14 (high P)': {
            form: 'Granular',
            targetNutrient: 'Higher Phosphorus for tuber initiation',
            applicationRate: '150-300 kg/ha',
            stage: 'Basal / at planting',
            frequency: '1 application',
            remarks: 'Promotes tuber development.',
            recommendation: 'High phosphorus formula ideal for potato in red soils'
        },
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
        recommendation: `Recommended for ${cropType} in ${soilType} soils based on Random Forest prediction.`
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
// GET TASKS FROM DECISION TREE
// ---------------------
async function getTasksFromDecisionTree(crop, daysElapsed, growthStage) {
    if (!crop || !selectedCrop) return null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/predict-tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                crop_type: crop.name || selectedCrop.crop_type,
                days_elapsed: daysElapsed,
                growth_stage: growthStage,
                temperature: currentWeatherData?.current?.temperature || 25,
                humidity: currentWeatherData?.current?.humidity || 60,
                rainfall: currentWeatherData?.current?.rainfall || 0,
                soil_moisture: 50,
                pest_level: 'low',
                disease_present: 0
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.tasks && Array.isArray(data.tasks)) {
                console.log('Decision Tree tasks:', data.tasks);
                return data.tasks;
            }
        }
        
        return getDefaultTasks(crop, daysElapsed, growthStage);
        
    } catch (error) {
        console.error('Decision Tree API call failed:', error);
        return getDefaultTasks(crop, daysElapsed, growthStage);
    }
}

function getDefaultTasks(crop, daysElapsed, growthStage) {
    let tasks = [];
    
    tasks.push({
        task: 'Visual inspection',
        icon: 'bi-eye',
        description: 'Check for visible pests, diseases, or abnormalities',
        priority: 'medium',
        model: 'Default'
    });
    
    if (growthStage === 'seedling') {
        tasks.push({
            task: 'Water seedlings',
            icon: 'bi-droplet',
            description: 'Light watering - keep soil moist but not soggy',
            priority: 'high',
            model: 'Default'
        });
        tasks.push({
            task: 'Thin if needed',
            icon: 'bi-scissors',
            description: 'Remove weak seedlings to give others space',
            priority: 'medium',
            model: 'Default'
        });
    } else if (growthStage === 'vegetative') {
        tasks.push({
            task: 'Regular watering',
            icon: 'bi-droplet',
            description: 'Water deeply to encourage root growth',
            priority: 'high',
            model: 'Default'
        });
        tasks.push({
            task: 'Weed control',
            icon: 'bi-flower1',
            description: 'Remove weeds around plants',
            priority: 'medium',
            model: 'Default'
        });
    } else if (growthStage === 'flowering') {
        tasks.push({
            task: 'Monitor pollination',
            icon: 'bi-flower2',
            description: 'Check flower development and pollination',
            priority: 'high',
            model: 'Default'
        });
        tasks.push({
            task: 'Reduce nitrogen',
            icon: 'bi-flower3',
            description: 'Switch to potassium-rich fertilizer',
            priority: 'medium',
            model: 'Default'
        });
    } else if (growthStage === 'mature') {
        tasks.push({
            task: 'Harvest preparation',
            icon: 'bi-basket',
            description: 'Prepare for harvest in coming days',
            priority: 'high',
            model: 'Default'
        });
        tasks.push({
            task: 'Reduce watering',
            icon: 'bi-droplet-half',
            description: 'Gradually reduce water before harvest',
            priority: 'medium',
            model: 'Default'
        });
    }
    
    return tasks;
}

// ---------------------
// LOAD ALL USER CROPS
// ---------------------
async function loadAllUserCrops() {
    // This function is now handled by loadUserProgressFromSupabase
    // Keeping for compatibility
    updateDashboardWithAllCrops();
}

// ---------------------
// UPDATE DASHBOARD WITH ALL CROPS
// ---------------------
async function updateDashboardWithAllCrops() {
    const currentCropElement = document.getElementById('currentCrop');
    if (!currentCropElement) return;
    
    if (userCrops.length === 0) {
        currentCropElement.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-flower1"></i>
                <h4>No Crops Planted Yet</h4>
                <p>Select a crop to start your farming journey</p>
                <button class="btn btn-primary" id="browseCropsBtn">
                    <i class="bi bi-arrow-right"></i> Browse Crops
                </button>
            </div>
        `;
        
        // Add event listener to the button
        const browseBtn = document.getElementById('browseCropsBtn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => navigateToPage('plants'));
        }
        return;
    }
    
    let html = `
        <div class="dashboard-header">
            <h3><i class="bi bi-flower2"></i> Your Crops (${userCrops.length})</h3>
            <button class="btn btn-sm btn-outline" id="addMoreCropsBtn">
                <i class="bi bi-plus"></i> Add More
            </button>
        </div>
        <div class="crops-grid">
    `;
    
    for (const crop of userCrops) {
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
        
        const isSelected = highlightedPlantingId && highlightedPlantingId === crop.planting_id;
        
        html += `
            <div class="dashboard-crop-card ${isSelected ? 'selected' : ''}" 
                 data-planting-id="${crop.planting_id}">
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
                    <button class="btn btn-sm btn-outline view-crop-btn" data-planting-id="${crop.planting_id}">
                        <i class="bi bi-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-outline remove-crop-btn" data-planting-id="${crop.planting_id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    currentCropElement.innerHTML = html;
    
    // Add event listeners
    document.querySelectorAll('.dashboard-crop-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Clicking the card should only highlight it (do not open the detail view).
            if (!e.target.closest('.crop-actions')) {
                const plantingId = parseInt(this.getAttribute('data-planting-id'));
                highlightedPlantingId = highlightedPlantingId === plantingId ? null : plantingId;
                // Re-render to update selected styling
                updateDashboardWithAllCrops();
            }
        });
    });

    
    document.querySelectorAll('.view-crop-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const plantingId = parseInt(this.getAttribute('data-planting-id'));
            // When user explicitly chooses to view details, open the detail page/view
            viewCropDetails(plantingId);
        });
    });
    
    document.querySelectorAll('.remove-crop-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const plantingId = parseInt(this.getAttribute('data-planting-id'));
            removeCrop(plantingId);
        });
    });
    
    // Add event listener to "Add More" button
    const addMoreBtn = document.getElementById('addMoreCropsBtn');
    if (addMoreBtn) {
        addMoreBtn.addEventListener('click', () => navigateToPage('plants'));
    }
    
    if (currentWeatherData && currentWeatherData.current) {
        updateWeatherImpact(currentWeatherData.current);
    }
    // Show/hide main progress and today's tasks cards based on UI flag
    const progCard = document.getElementById('growthProgressCard');
    const tasksCard = document.getElementById('todaysTasksCard');
    if (progCard) progCard.style.display = showTasksAndProgress ? '' : 'none';
    if (tasksCard) tasksCard.style.display = showTasksAndProgress ? '' : 'none';
}

// ---------------------
// SELECT CROP FOR DETAIL VIEW
// ---------------------
async function selectCropForDetail(plantingId) {
    const crop = userCrops.find(c => c.planting_id === plantingId);
    if (crop) {
        selectedCrop = crop;
        currentPlantingId = plantingId;
        await showCropDetailView(crop);
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
async function showCropDetailView(crop) {
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
    
    let growthStage = 'seedling';
    if (daysElapsed < 15) growthStage = 'seedling';
    else if (daysElapsed < 50) growthStage = 'vegetative';
    else if (daysElapsed < 90) growthStage = 'flowering';
    else growthStage = 'mature';
    
    // Get tasks from Decision Tree model
    const tasks = await getTasksFromDecisionTree(cropData, daysElapsed, growthStage);
    
    const detailView = `
        <div class="crop-detail-view">
            <div class="detail-header">
                <button class="btn btn-sm btn-outline" id="backToAllBtn">
                    <i class="bi bi-arrow-left"></i> Back to All
                </button>
                <h3><i class="bi ${cropData.icon}"></i> ${cropData.name} Details</h3>
                <span class="model-badge">Decision Tree Tasks</span>
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
                    <div class="stat-box">
                        <div class="stat-value">${growthStage}</div>
                        <div class="stat-label">Growth Stage</div>
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
                    <h4><i class="bi bi-clipboard-check"></i> Today's Tasks (AI Recommended)</h4>
                    <div class="today-tasks-header">
                        <div class="day-progress-label">Today's Completion</div>
                        <div class="day-progress-bar">
                            <div id="todayTasksOverallFill" class="day-progress-fill" style="width: 0%"></div>
                        </div>
                    </div>
                    <div id="todaysTasksDetail"></div>
                </div>
            </div>
        </div>
    `;
    
    const currentCropElement = document.getElementById('currentCrop');
    if (currentCropElement) {
        currentCropElement.innerHTML = detailView;
        updateTasksForDetail(tasks);
        
        // Add event listener to back button
        const backBtn = document.getElementById('backToAllBtn');
        if (backBtn) {
            backBtn.addEventListener('click', showAllCrops);
        }
    }
}

// ---------------------
// UPDATE TASKS FOR DETAIL VIEW (with per-task check & progress)
// ---------------------
function updateTasksForDetail(tasks) {
    const tasksContainer = document.getElementById('todaysTasksDetail');
    if (!tasksContainer) return;
    const plantingId = selectedCrop ? selectedCrop.planting_id : currentPlantingId;
    const today = getTodayStr();

    if (!tasks || tasks.length === 0) {
        tasksContainer.innerHTML = `
            <div class="info-note">
                <i class="bi bi-info-circle"></i>
                <span>No specific tasks for today. Continue regular monitoring.</span>
            </div>
        `;
        updateTodayTasksOverallProgress(plantingId, 0, 0);
        return;
    }

    const completions = loadTaskCompletionsForPlanting(plantingId);
    const todays = (completions && completions[today]) ? completions[today] : {};

    tasksContainer.innerHTML = '';
    let completedCount = 0;

    tasks.forEach((task, idx) => {
        const done = todays[idx] && todays[idx].completed;
        if (done) completedCount++;
        const modelBadge = task.model ? `<span class="model-badge-small">${task.model}</span>` : '';

        const html = `
            <div class="task-item ${task.priority || 'medium'}" data-task-idx="${idx}">
                <i class="bi ${task.icon || 'bi-check-circle'}"></i>
                <div class="task-content">
                    <div class="task-title">${task.task}</div>
                    <div class="task-description">${task.description}</div>
                    ${modelBadge}
                </div>
                <div class="task-controls">
                    <button class="btn task-check-btn ${done ? 'done' : ''}" data-idx="${idx}" title="${done ? 'Mark as not done' : 'Mark as done'}">
                        <i class="bi ${done ? 'bi-check-lg' : 'bi-circle'}"></i>
                    </button>
                    <div class="task-progress">
                        <div class="task-progress-fill" style="width: ${done ? 100 : 0}%"></div>
                    </div>
                </div>
            </div>
        `;

        tasksContainer.insertAdjacentHTML('beforeend', html);
    });

    // Attach listeners to check buttons
    tasksContainer.querySelectorAll('.task-check-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = parseInt(this.getAttribute('data-idx'));
            toggleTaskCompletion(plantingId, idx);
        });
    });

    updateTodayTasksOverallProgress(plantingId, completedCount, tasks.length);
}

// ---------------------
// TASK COMPLETION STORAGE & HELPERS
// ---------------------
function getTodayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function loadTaskCompletions() {
    return JSON.parse(localStorage.getItem('taskCompletions') || '{}');
}

function saveTaskCompletions(obj) {
    localStorage.setItem('taskCompletions', JSON.stringify(obj));
    // Persist user progress so server can later be extended to include tasks
    try {
        saveUserProgressToSupabase();
    } catch (e) {
        // ignore if not available
    }
}

function loadTaskCompletionsForPlanting(plantingId) {
    const all = loadTaskCompletions();
    return all[plantingId] || {};
}

function toggleTaskCompletion(plantingId, idx) {
    const date = getTodayStr();
    const all = loadTaskCompletions();
    if (!all[plantingId]) all[plantingId] = {};
    if (!all[plantingId][date]) all[plantingId][date] = {};

    const current = all[plantingId][date][idx] ? all[plantingId][date][idx].completed : false;
    all[plantingId][date][idx] = { completed: !current, timestamp: new Date().toISOString() };

    saveTaskCompletions(all);

    // Update UI for the specific task
    const tasksContainer = document.getElementById('todaysTasksDetail');
    const item = tasksContainer ? tasksContainer.querySelector(`.task-item[data-task-idx="${idx}"]`) : null;
    if (item) {
        const btn = item.querySelector('.task-check-btn');
        const fill = item.querySelector('.task-progress-fill');
        if (all[plantingId][date][idx].completed) {
            btn.classList.add('done');
            btn.innerHTML = '<i class="bi bi-check-lg"></i>';
            fill.style.width = '100%';
        } else {
            btn.classList.remove('done');
            btn.innerHTML = '<i class="bi bi-circle"></i>';
            fill.style.width = '0%';
        }
    }

    // Recalculate overall
    const tasksElems = tasksContainer ? tasksContainer.querySelectorAll('.task-item') : [];
    let doneCount = 0;
    tasksElems.forEach(el => {
        const idxAttr = parseInt(el.getAttribute('data-task-idx'));
        const done = all[plantingId][date] && all[plantingId][date][idxAttr] && all[plantingId][date][idxAttr].completed;
        if (done) doneCount++;
    });
    updateTodayTasksOverallProgress(plantingId, doneCount, tasksElems.length);

    showNotification('success', 'Task updated', all[plantingId][date][idx].completed ? 'Marked done for today' : 'Marked not done');
}

function updateTodayTasksOverallProgress(plantingId, completedCount, total) {
    const fill = document.getElementById('todayTasksOverallFill');
    const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);
    if (fill) fill.style.width = `${percent}%`;
    const label = document.querySelector('.day-progress-label');
    if (label) label.textContent = `Today's Completion — ${percent}% (${completedCount}/${total})`;
}

// ---------------------
// SHOW ALL CROPS (Return to dashboard)
// ---------------------
function showAllCrops() {
    selectedCrop = null;
    currentPlantingId = null;
    // Reset UI flags so main dashboard doesn't show tasks/progress
    showTasksAndProgress = false;
    highlightedPlantingId = null;
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
async function removeCrop(plantingId) {
    if (confirm('Are you sure you want to remove this crop? This will delete all associated data.')) {
        userCrops = userCrops.filter(crop => crop.planting_id !== plantingId);
        
        if (selectedCrop && selectedCrop.planting_id === plantingId) {
            selectedCrop = null;
            currentPlantingId = null;
        }
        
        // Save progress after removal
        await saveUserProgressToSupabase();
        
        updateDashboardWithAllCrops();
        showNotification('info', 'Crop Removed', 'Crop has been removed from your account.');
    }
}

// ---------------------
// EVENT LISTENERS SETUP
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

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
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
    
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`Found ${navItems.length} nav items to set up listeners`);
    
    navItems.forEach(item => {
        const page = item.getAttribute('data-page');
        if (page === 'calendar') {
            item.style.display = 'none';
            return;
        }
        
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Nav item clicked:', this.id, this.getAttribute('data-page'));
            
            if (this.id === 'logoutBtn') {
                logoutUser();
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
    
    if (!sideNav) {
        console.error('Side navigation not found!');
        return;
    }
    
    const isOpening = !sideNav.classList.contains('active');
    sideNav.classList.toggle('active');
    
    if (menuToggle) {
        let iconEl = null;

        if (menuToggle.tagName && menuToggle.tagName.toLowerCase() === 'i') {
            iconEl = menuToggle;
        } else if (menuToggle.classList && menuToggle.classList.contains('bi')) {
            iconEl = menuToggle;
        } else {
            iconEl = menuToggle.querySelector('i');
            if (!iconEl) {
                iconEl = document.createElement('i');
                menuToggle.appendChild(iconEl);
            }
        }

        iconEl.className = isOpening ? 'bi bi-x-lg' : 'bi bi-list';
        document.body.style.overflow = isOpening ? 'hidden' : '';
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
    
    // Always close the navbar when navigating to a page
    const sideNav = document.getElementById('side_nav');
    if (sideNav && sideNav.classList.contains('active')) {
        toggleNavigation();
    }

    if (pageName === 'plants') {
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
// USER FUNCTIONS
// ---------------------
function updateUserDisplay() {
    const loginBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) {
        if (currentUser.id === DEMO_USER_ID) {
            loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
            loginBtn.id = 'loginBtn';
        } else {
            loginBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i> Logout';
            loginBtn.id = 'logoutBtn';
        }
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

async function detectLocation() {
    const autoDetectBtn = document.getElementById('autoDetectBtn');
    
    if (navigator.geolocation) {
        if (autoDetectBtn) {
            autoDetectBtn.innerHTML = '<i class="bi bi-geo-alt"></i> Detecting...';
            autoDetectBtn.disabled = true;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
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
                await saveUserProgressToSupabase();
                
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

async function setManualLocation() {
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
        await saveUserProgressToSupabase();
        
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
            <button class="btn-plant" data-crop="${crop.name}">
                <i class="bi bi-seed"></i> Plant Now
            </button>
        `;
        
        const plantBtn = plantCard.querySelector('.btn-plant');
        if (plantBtn) {
            plantBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Plant Now button clicked for:', crop.name);
                showPlantingCalendar(crop);
            });
        }
        
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
                <button class="btn-close" id="closePlantingModal">&times;</button>
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
                <button class="btn btn-outline" id="cancelPlanting">Cancel</button>
                <button class="btn btn-primary" id="confirmPlanting">Confirm Planting</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('closePlantingModal').addEventListener('click', () => modal.remove());
    document.getElementById('cancelPlanting').addEventListener('click', () => modal.remove());
    document.getElementById('confirmPlanting').addEventListener('click', () => confirmPlanting(crop.name));
    
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
            <button class="btn-calendar-nav" id="prevMonth">
                <i class="bi bi-chevron-left"></i>
            </button>
            <h5>${firstDay.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h5>
            <button class="btn-calendar-nav" id="nextMonth">
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
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    
    const todayStr = String(today.getFullYear()) + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    for (let day = 1; day <= daysInMonth; day++) {
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
                 data-date="${dateStr}">
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
    
    // Add event listeners after the HTML is inserted
    setTimeout(() => {
        // Month navigation
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => changePlantingMonth(-1));
        }
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => changePlantingMonth(1));
        }
        
        // Day selection
        document.querySelectorAll('.calendar-popup-day:not(.past):not(.future)').forEach(day => {
            day.addEventListener('click', () => selectPlantingDate(day));
        });
        
        // Select today by default
        const todayElement = document.querySelector('.calendar-popup-day.today');
        if (todayElement) {
            selectPlantingDate(todayElement);
        }
    }, 0);
    
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
    const plantingId = Date.now();
    
    const newCrop = {
        planting_id: plantingId,
        crop_type: crop.name,
        planting_date: plantingDate,
        user_id: currentUser.id,
        created_at: new Date().toISOString()
    };
    
    // Add to local array
    userCrops.push(newCrop);
    
    // Save to Supabase
    await saveUserProgressToSupabase();
    
    // Close modal and update UI
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    updateDashboardWithAllCrops();
    navigateToPage('home');
    
    showNotification('success', `${crop.name} Planted!`, 
                   `Planted on ${new Date(plantingDate).toLocaleDateString()}. Progress saved to your account.`);
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

async function updateProgressLocally() {
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
    
    // Update tasks using Decision Tree model
    const cropDataObj = crops.find(c => c.name === selectedCrop.crop_type) || {
        name: selectedCrop.crop_type,
        duration: 100
    };
    const tasks = await getTasksFromDecisionTree(cropDataObj, daysElapsed, growthStage);
    await updateTasksWithAI(tasks || [], growthStage, progressPercentage);
    
    checkMilestones(daysElapsed, growthStage);
}

async function updateTasksWithAI(tasks, growthStage, progress) {
    const tasksList = document.getElementById('todaysTasks');
    if (!tasksList) return;
    
    // If the UI flag says don't show tasks on the main dashboard, keep it minimal.
    if (!showTasksAndProgress) {
        tasksList.innerHTML = '<p>No tasks scheduled</p>';
        return;
    }
    
    // If no tasks from Decision Tree, use default tasks
    if (!tasks || tasks.length === 0) {
        tasks = getDefaultTasks(
            crops.find(c => c.name === selectedCrop.crop_type),
            Math.floor((new Date() - new Date(selectedCrop.planting_date)) / (1000 * 60 * 60 * 24)),
            growthStage
        );
    }
    
    tasksList.innerHTML = '';
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = `task-item ${task.priority || 'medium'}`;
        
        let modelBadge = '';
        if (task.model) {
            modelBadge = `<span class="model-badge-small">${task.model}</span>`;
        }
        
        taskItem.innerHTML = `
            <i class="bi ${task.icon || 'bi-check-circle'}"></i>
            <div class="task-content">
                <div class="task-title">${task.task}</div>
                <div class="task-description">${task.description}</div>
                ${modelBadge}
            </div>
            <i class="bi bi-check-circle task-check"></i>
        `;
        
        taskItem.addEventListener('click', function() {
            this.classList.toggle('completed');
        });
        
        tasksList.appendChild(taskItem);
    });
}

function updateTasks(growthStage, progress) {
    // This function is kept for compatibility
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
// ML MODEL FUNCTIONS
// ---------------------
async function loadModel() {
    try {
        const resp = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
        });
        if (resp.ok) {
            const j = await resp.json();
            if (j.ok) {
                modelLoaded = true;
                showNotification('info', 'ML Model Loaded', 'Server-side H5 model is ready.');
                return;
            }
        }
        console.warn('Backend predict endpoint did not return ok');
    } catch (e) {
        console.warn('Could not reach backend predict endpoint:', e.message);
    }
    console.warn('No ML model available (frontend will show manual analysis).');
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

    const formData = new FormData();
    formData.append('image', file);

    try {
        const resp = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            body: formData
        });
        if (!resp.ok) throw new Error('Server error ' + resp.status);
        const data = await resp.json();
        if (data.predictions && data.predictions.length) {
            renderResults(data.predictions);
        } else {
            showManualAnalysisForm(URL.createObjectURL(file));
        }
    } catch (err) {
        console.error('Prediction failed:', err);
        showManualAnalysisForm(URL.createObjectURL(file));
    }
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
            const label = item.label ? item.label : (labels && typeof item.idx !== 'undefined' && labels[item.idx] ? labels[item.idx] : (item.idx !== undefined ? `Class ${item.idx}` : 'Unknown'));
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
                <button class="btn btn-primary" onclick="logDetection('${encodeURIComponent(topList[0]?.label || topList[0]?.idx || '')}', ${topList[0]?.score || 0})">
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
    
    // Save detection
    const detections = JSON.parse(localStorage.getItem('cropDetections') || '[]');
    detections.push(detection);
    localStorage.setItem('cropDetections', JSON.stringify(detections));
    
    // Save progress to Supabase
    await saveUserProgressToSupabase();
    
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
                <button class="btn btn-outline" onclick="navigateToPage('home')">
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

async function logDetection(detectionLabelEncoded, detectionScore = 0) {
    if (!currentPlantingId) {
        showNotification('warning', 'No Active Crop', 'Please select a crop first.');
        return;
    }

    const detectionLabel = detectionLabelEncoded ? decodeURIComponent(detectionLabelEncoded) : 'Unknown';
    
    try {
        // Save detection to localStorage
        const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
        logs.push({
            planting_id: currentPlantingId,
            detection_label: detectionLabel,
            detection_score: detectionScore,
            timestamp: new Date().toISOString(),
            type: 'automatic'
        });
        localStorage.setItem('detectionLogs', JSON.stringify(logs));
        
        // Save progress to Supabase
        await saveUserProgressToSupabase();
        
        showNotification('success', 'Detection Logged', 'Added to your crop history.');
        await getAIRecommendation(currentPlantingId);

    } catch (error) {
        console.error('Error logging detection:', error);
        showNotification('warning', 'Logged Locally', 'Saved detection locally.');
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
            <div class="quick-action-card water" id="quickWater">
                <i class="bi bi-droplet"></i>
                <div class="action-title">Water</div>
                <div class="action-desc">Log watering activity</div>
            </div>
            <div class="quick-action-card fertilize" id="quickFertilize">
                <i class="bi bi-flower1"></i>
                <div class="action-title">Fertilize</div>
                <div class="action-desc">Record fertilization</div>
            </div>
            <div class="quick-action-card inspect" id="quickInspect">
                <i class="bi bi-camera"></i>
                <div class="action-title">Inspect</div>
                <div class="action-desc">Upload crop image</div>
            </div>
            <div class="quick-action-card note" id="quickNote">
                <i class="bi bi-journal-text"></i>
                <div class="action-title">Note</div>
                <div class="action-desc">Add observation</div>
            </div>
            <div class="quick-action-card harvest" id="quickHarvest">
                <i class="bi bi-basket"></i>
                <div class="action-title">Harvest</div>
                <div class="action-desc">Mark as harvested</div>
            </div>
        </div>
    `;
    
    // Add event listeners
    document.getElementById('quickWater').addEventListener('click', () => handleQuickAction('water'));
    document.getElementById('quickFertilize').addEventListener('click', () => handleQuickAction('fertilize'));
    document.getElementById('quickInspect').addEventListener('click', () => handleQuickAction('inspect'));
    document.getElementById('quickNote').addEventListener('click', () => handleQuickAction('note'));
    document.getElementById('quickHarvest').addEventListener('click', () => handleQuickAction('harvest'));
}

async function handleQuickAction(action) {
    if (!selectedCrop && action !== 'inspect') {
        showNotification('warning', 'No Crop Selected', 'Please select a crop first.');
        return;
    }
    
    switch(action) {
        case 'water':
            await logQuickAction('water', 'Watered crop as per schedule');
            showNotification('success', 'Watering Logged', 'Watering activity recorded.');
            break;
            
        case 'fertilize':
            await logQuickAction('fertilize', 'Applied fertilizer');
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
                await markAsHarvested();
            }
            break;
    }
}

async function logQuickAction(type, description) {
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
    
    // Save progress to Supabase
    await saveUserProgressToSupabase();
}

function showQuickNoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal quick-note-modal">
            <div class="modal-header">
                <h4><i class="bi bi-journal-text"></i> Add Quick Note</h4>
                <button class="btn-close" id="closeNoteModal">&times;</button>
            </div>
            <div class="modal-body">
                <textarea id="quickNoteText" class="form-textarea" 
                          placeholder="Enter your observation note here..." rows="4"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancelNote">Cancel</button>
                <button class="btn btn-primary" id="saveNote">Save Note</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('closeNoteModal').addEventListener('click', () => modal.remove());
    document.getElementById('cancelNote').addEventListener('click', () => modal.remove());
    document.getElementById('saveNote').addEventListener('click', saveQuickNote);
}

async function saveQuickNote() {
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
    
    // Save progress to Supabase
    await saveUserProgressToSupabase();
    
    document.querySelector('.modal-overlay').remove();
    showNotification('success', 'Note Saved', 'Observation note added to your account.');
}

async function markAsHarvested() {
    if (!selectedCrop) return;
    
    const cropIndex = userCrops.findIndex(c => c.planting_id === selectedCrop.planting_id);
    if (cropIndex !== -1) {
        userCrops[cropIndex].harvested = true;
        userCrops[cropIndex].harvest_date = new Date().toISOString();
    }
    
    userCrops = userCrops.filter(c => c.planting_id !== selectedCrop.planting_id);
    
    const wasSelected = selectedCrop;
    selectedCrop = null;
    currentPlantingId = null;
    
    // Save progress to Supabase
    await saveUserProgressToSupabase();
    
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
        <button class="notification-close">&times;</button>
    `;
    
    const container = document.getElementById('notificationContainer') || createNotificationContainer();
    container.appendChild(notification);
    
    // Add event listener to close button
    notification.querySelector('.notification-close').addEventListener('click', () => notification.remove());
    
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
// ADD CSS FOR MODEL BADGES
// ---------------------
const modelStyles = document.createElement('style');
modelStyles.textContent = `
    .model-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 10px;
    }
    
    .model-badge-small {
        background: #e3f2fd;
        color: #1976d2;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        display: inline-block;
        margin-top: 4px;
    }
    
    .model-badge .bi {
        font-size: 10px;
    }
    
    .model-badge-small .bi {
        font-size: 8px;
        margin-right: 2px;
    }
    
    .context-item:last-child {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
    }
    
    .detail-header .model-badge {
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
`;
document.head.appendChild(modelStyles);

console.log('Smart Crop System ready! (With Supabase User Progress)');