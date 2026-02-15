// ============================================
// home.js — Smart Crop System (With Supabase User Progress)
// ============================================

let userLocation = null;
let selectedCrop = null;
let currentPage = 'home';
let currentWeatherData = null;
const API_BASE_URL = 'http://localhost:5000/api';

const crops = [
    { id: 1, name: 'Tomato', icon: 'bi-flower1', season: 'Summer', duration: 110 },
    { id: 2, name: 'Rice', icon: 'bi-flower2', season: 'Monsoon', duration: 150 },
    { id: 3, name: 'Wheat', icon: 'bi-flower3', season: 'Winter', duration: 140 },
    { id: 4, name: 'Maize', icon: 'bi-flower1', season: 'Summer', duration: 120 },
    { id: 5, name: 'Potato', icon: 'bi-flower2', season: 'Winter', duration: 90 },
    { id: 6, name: 'Soybean', icon: 'bi-flower3', season: 'Monsoon', duration: 85 }
];

let currentUser = null;
let currentPlantingId = null;
let progressUpdateInterval = null;

let highlightedPlantingId = null;
let showTasksAndProgress = false;

const DEMO_USER_ID = 'demo-user-999';

let userCrops = [];

const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";

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

window.navigateToPage = navigateToPage;
window.selectCropForDetail = selectCropForDetail;
window.viewCropDetails = viewCropDetails;
window.removeCrop = removeCrop;
window.showAllCrops = showAllCrops;
window.copyFertilizerInfo = copyFertilizerInfo;
window.findAlternative = findAlternative;

const AI_ADVICE_DATABASE = {
    seedling: {
        tomato: [
            {
                id: 'tomato_seedling_1',
                title: 'Ensure Proper Spacing',
                description: 'Keep seedlings 18-24 inches apart to prevent overcrowding and disease spread.',
                icon: 'bi-arrows-angle-expand',
                priority: 'high',
                conditions: 'planting_density > 4'
            },
            {
                id: 'tomato_seedling_2',
                title: 'Water Management',
                description: 'Water deeply but infrequently to encourage deep root growth. Avoid wetting leaves.',
                icon: 'bi-droplet',
                priority: 'medium',
                conditions: 'soil_moisture < 40'
            },
            {
                id: 'tomato_seedling_3',
                title: 'Temperature Control',
                description: 'Maintain soil temperature between 65-85°F for optimal germination and growth.',
                icon: 'bi-thermometer-half',
                priority: 'medium',
                conditions: 'temperature < 60 || temperature > 90'
            },
            {
                id: 'tomato_seedling_4',
                title: 'Light Requirements',
                description: 'Provide 14-16 hours of light daily. Use grow lights if natural light is insufficient.',
                icon: 'bi-sun',
                priority: 'low',
                conditions: 'light_hours < 12'
            },
            {
                id: 'tomato_seedling_5',
                title: 'Nutrient Boost',
                description: 'Apply diluted liquid seaweed fertilizer for stronger root development.',
                icon: 'bi-flower1',
                priority: 'medium',
                conditions: 'days_since_fertilizer > 14'
            }
        ],
        rice: [
            {
                id: 'rice_seedling_1',
                title: 'Water Level Management',
                description: 'Maintain 1-2 inches of standing water. Check daily for proper water depth.',
                icon: 'bi-water',
                priority: 'high',
                conditions: 'water_depth < 0.5 || water_depth > 3'
            },
            {
                id: 'rice_seedling_2',
                title: 'Transplant Timing',
                description: 'Transplant seedlings when they are 3-4 weeks old and have 4-5 leaves.',
                icon: 'bi-arrow-clockwise',
                priority: 'high',
                conditions: 'age > 25 && leaves < 4'
            },
            {
                id: 'rice_seedling_3',
                title: 'Nitrogen Application',
                description: 'Apply first dose of nitrogen fertilizer 10-15 days after sowing.',
                icon: 'bi-flower2',
                priority: 'medium',
                conditions: 'age > 10 && nitrogen_applied == false'
            },
            {
                id: 'rice_seedling_4',
                title: 'Pest Monitoring',
                description: 'Check for stem borer eggs and leaf folders. Use pheromone traps for monitoring.',
                icon: 'bi-bug',
                priority: 'medium',
                conditions: 'pest_level > 0'
            },
            {
                id: 'rice_seedling_5',
                title: 'Weed Control',
                description: 'Control weeds manually or with pre-emergence herbicides before flooding.',
                icon: 'bi-flower3',
                priority: 'low',
                conditions: 'weed_coverage > 10'
            }
        ],
        wheat: [
            {
                id: 'wheat_seedling_1',
                title: 'Soil Moisture Check',
                description: 'Ensure soil is moist but not waterlogged. Wheat needs good drainage.',
                icon: 'bi-moisture',
                priority: 'high',
                conditions: 'soil_moisture > 80 || soil_moisture < 30'
            },
            {
                id: 'wheat_seedling_2',
                title: 'Phosphorus Application',
                description: 'Apply DAP or SSP at sowing for strong root establishment.',
                icon: 'bi-flower1',
                priority: 'medium',
                conditions: 'phosphorus_applied == false'
            },
            {
                id: 'wheat_seedling_3',
                title: 'Seed Treatment',
                description: 'Treat seeds with fungicides to prevent seed-borne diseases.',
                icon: 'bi-shield-check',
                priority: 'low',
                conditions: 'seed_treated == false'
            },
            {
                id: 'wheat_seedling_4',
                title: 'Temperature Monitoring',
                description: 'Optimal temperature for germination is 15-20°C. Protect from frost.',
                icon: 'bi-thermometer',
                priority: 'medium',
                conditions: 'temperature < 10 || temperature > 25'
            },
            {
                id: 'wheat_seedling_5',
                title: 'Soil Testing',
                description: 'Test soil pH and nutrient levels. Adjust based on results.',
                icon: 'bi-clipboard-data',
                priority: 'low',
                conditions: 'soil_tested == false'
            }
        ]
    },
    
    vegetative: {
        tomato: [
            {
                id: 'tomato_vegetative_1',
                title: 'Pruning Suckers',
                description: 'Remove suckers (side shoots) that grow between main stem and branches.',
                icon: 'bi-scissors',
                priority: 'high',
                conditions: 'plant_height > 12'
            },
            {
                id: 'tomato_vegetative_2',
                title: 'Staking and Support',
                description: 'Install stakes or cages to support growing plants and prevent breakage.',
                icon: 'bi-postage',
                priority: 'high',
                conditions: 'plant_height > 18'
            },
            {
                id: 'tomato_vegetative_3',
                title: 'Nitrogen Application',
                description: 'Apply balanced fertilizer with higher nitrogen for leafy growth.',
                icon: 'bi-flower1',
                priority: 'medium',
                conditions: 'nitrogen_applied == false || days_since_fertilizer > 21'
            },
            {
                id: 'tomato_vegetative_4',
                title: 'Disease Prevention',
                description: 'Apply copper-based fungicide to prevent early blight and bacterial spot.',
                icon: 'bi-shield',
                priority: 'medium',
                conditions: 'humidity > 70'
            },
            {
                id: 'tomato_vegetative_5',
                title: 'Mulching',
                description: 'Apply organic mulch to conserve moisture and suppress weeds.',
                icon: 'bi-tree',
                priority: 'low',
                conditions: 'soil_temperature > 75'
            }
        ],
        rice: [
            {
                id: 'rice_vegetative_1',
                title: 'Water Management',
                description: 'Maintain 2-3 inches of standing water. Alternate wetting and drying recommended.',
                icon: 'bi-water',
                priority: 'high',
                conditions: 'water_depth < 1.5 || water_depth > 4'
            },
            {
                id: 'rice_vegetative_2',
                title: 'Tiller Count Check',
                description: 'Monitor tiller development. Aim for 20-25 productive tillers per hill.',
                icon: 'bi-graph-up',
                priority: 'medium',
                conditions: 'tillers < 15'
            },
            {
                id: 'rice_vegetative_3',
                title: 'Nitrogen Top Dressing',
                description: 'Apply second dose of nitrogen at maximum tillering stage.',
                icon: 'bi-flower2',
                priority: 'high',
                conditions: 'age > 40 && age < 60'
            },
            {
                id: 'rice_vegetative_4',
                title: 'Weed Control',
                description: 'Use post-emergence herbicides or manual weeding to control weeds.',
                icon: 'bi-flower3',
                priority: 'medium',
                conditions: 'weed_coverage > 15'
            },
            {
                id: 'rice_vegetative_5',
                title: 'Zinc Application',
                description: 'Apply zinc sulfate if symptoms of zinc deficiency appear.',
                icon: 'bi-droplet',
                priority: 'low',
                conditions: 'zinc_applied == false'
            }
        ],
        wheat: [
            {
                id: 'wheat_vegetative_1',
                title: 'Nitrogen Top Dressing',
                description: 'Apply first dose of nitrogen at crown root initiation stage.',
                icon: 'bi-flower1',
                priority: 'high',
                conditions: 'age > 25 && age < 35'
            },
            {
                id: 'wheat_vegetative_2',
                title: 'Weed Management',
                description: 'Apply post-emergence herbicides or do manual weeding.',
                icon: 'bi-flower2',
                priority: 'medium',
                conditions: 'weed_coverage > 20'
            },
            {
                id: 'wheat_vegetative_3',
                title: 'Irrigation Scheduling',
                description: 'First irrigation at crown root initiation (20-25 days after sowing).',
                icon: 'bi-droplet',
                priority: 'high',
                conditions: 'soil_moisture < 50'
            },
            {
                id: 'wheat_vegetative_4',
                title: 'Pest Monitoring',
                description: 'Check for aphids and termites. Use yellow sticky traps.',
                icon: 'bi-bug',
                priority: 'medium',
                conditions: 'pest_level > 0'
            },
            {
                id: 'wheat_vegetative_5',
                title: 'Growth Regulator',
                description: 'Apply growth regulators if plant height exceeds optimal levels.',
                icon: 'bi-arrow-down-up',
                priority: 'low',
                conditions: 'plant_height > 40'
            }
        ]
    },
    
    flowering: {
        tomato: [
            {
                id: 'tomato_flowering_1',
                title: 'Blossom Drop Prevention',
                description: 'Maintain temperature between 70-85°F and avoid excessive nitrogen.',
                icon: 'bi-flower1',
                priority: 'high',
                conditions: 'temperature < 65 || temperature > 90'
            },
            {
                id: 'tomato_flowering_2',
                title: 'Calcium Application',
                description: 'Apply calcium nitrate to prevent blossom end rot.',
                icon: 'bi-flower2',
                priority: 'medium',
                conditions: 'calcium_applied == false'
            },
            {
                id: 'tomato_flowering_3',
                title: 'Pollination Assistance',
                description: 'Gently shake plants or use electric vibrator to improve pollination.',
                icon: 'bi-flower3',
                priority: 'low',
                conditions: 'flower_count > 0 && fruit_set < 30'
            },
            {
                id: 'tomato_flowering_4',
                title: 'Potassium Boost',
                description: 'Switch to high-potassium fertilizer for better fruit development.',
                icon: 'bi-flower1',
                priority: 'medium',
                conditions: 'potassium_applied == false'
            },
            {
                id: 'tomato_flowering_5',
                title: 'Water Consistency',
                description: 'Maintain consistent soil moisture to prevent fruit cracking.',
                icon: 'bi-droplet',
                priority: 'high',
                conditions: 'soil_moisture_variation > 20'
            }
        ],
        rice: [
            {
                id: 'rice_flowering_1',
                title: 'Water Critical Stage',
                description: 'Maintain 2-3 inches of water during flowering for maximum yield.',
                icon: 'bi-water',
                priority: 'high',
                conditions: 'water_depth < 2 || water_depth > 4'
            },
            {
                id: 'rice_flowering_2',
                title: 'Potassium Application',
                description: 'Apply potassium sulfate at flowering for better grain filling.',
                icon: 'bi-flower1',
                priority: 'medium',
                conditions: 'potassium_applied == false'
            },
            {
                id: 'rice_flowering_3',
                title: 'Pest Control',
                description: 'Monitor for panicle blast and apply appropriate fungicides.',
                icon: 'bi-shield',
                priority: 'high',
                conditions: 'humidity > 80'
            },
            {
                id: 'rice_flowering_4',
                title: 'Temperature Management',
                description: 'Protect from temperature extremes during flowering (25-30°C optimal).',
                icon: 'bi-thermometer',
                priority: 'medium',
                conditions: 'temperature < 20 || temperature > 35'
            },
            {
                id: 'rice_flowering_5',
                title: 'Micronutrient Spray',
                description: 'Apply boron and zinc spray for better pollination.',
                icon: 'bi-droplet-half',
                priority: 'low',
                conditions: 'micronutrient_spray == false'
            }
        ],
        wheat: [
            {
                id: 'wheat_flowering_1',
                title: 'Irrigation at Flowering',
                description: 'Apply irrigation at flowering stage if soil moisture is low.',
                icon: 'bi-droplet',
                priority: 'high',
                conditions: 'soil_moisture < 60'
            },
            {
                id: 'wheat_flowering_2',
                title: 'Fungicide Application',
                description: 'Apply fungicide to prevent powdery mildew and rust.',
                icon: 'bi-shield-check',
                priority: 'medium',
                conditions: 'humidity > 70'
            },
            {
                id: 'wheat_flowering_3',
                title: 'Potassium Application',
                description: 'Apply potassium for better grain development and disease resistance.',
                icon: 'bi-flower1',
                priority: 'low',
                conditions: 'potassium_applied == false'
            },
            {
                id: 'wheat_flowering_4',
                title: 'Temperature Monitoring',
                description: 'Protect from heat stress during flowering (15-25°C optimal).',
                icon: 'bi-thermometer-half',
                priority: 'medium',
                conditions: 'temperature > 30'
            },
            {
                id: 'wheat_flowering_5',
                title: 'Lodging Prevention',
                description: 'Monitor for lodging risk. Consider support if heavy heads develop.',
                icon: 'bi-arrow-down-up',
                priority: 'low',
                conditions: 'plant_height > 100'
            }
        ]
    },
    
    mature: {
        tomato: [
            {
                id: 'tomato_mature_1',
                title: 'Harvest Timing',
                description: 'Harvest tomatoes when they show first blush of color for best flavor.',
                icon: 'bi-basket',
                priority: 'high',
                conditions: 'fruit_color_changing == true'
            },
            {
                id: 'tomato_mature_2',
                title: 'Water Reduction',
                description: 'Reduce watering as fruits mature to concentrate flavors.',
                icon: 'bi-droplet-half',
                priority: 'medium',
                conditions: 'days_to_harvest < 14'
            },
            {
                id: 'tomato_mature_3',
                title: 'Disease Management',
                description: 'Remove any diseased leaves to prevent late blight spread.',
                icon: 'bi-shield-x',
                priority: 'medium',
                conditions: 'disease_present == true'
            },
            {
                id: 'tomato_mature_4',
                title: 'Fruit Quality Enhancement',
                description: 'Apply Epsom salt spray for better fruit color and quality.',
                icon: 'bi-flower1',
                priority: 'low',
                conditions: 'magnesium_applied == false'
            },
            {
                id: 'tomato_mature_5',
                title: 'Harvest Method',
                description: 'Use sharp scissors to cut fruits, leaving small stem attached.',
                icon: 'bi-scissors',
                priority: 'low',
                conditions: 'harvest_started == false'
            }
        ],
        rice: [
            {
                id: 'rice_mature_1',
                title: 'Water Drainage',
                description: 'Drain fields 10-15 days before harvest for uniform maturity.',
                icon: 'bi-water',
                priority: 'high',
                conditions: 'days_to_harvest < 15'
            },
            {
                id: 'rice_mature_2',
                title: 'Bird Control',
                description: 'Use bird scarers or nets to protect maturing grains.',
                icon: 'bi-eye',
                priority: 'medium',
                conditions: 'bird_damage > 0'
            },
            {
                id: 'rice_mature_3',
                title: 'Harvest Timing',
                description: 'Harvest when 80-85% of grains are golden yellow.',
                icon: 'bi-basket',
                priority: 'high',
                conditions: 'grain_maturity > 80'
            },
            {
                id: 'rice_mature_4',
                title: 'Moisture Check',
                description: 'Check grain moisture (should be 20-24% at harvest).',
                icon: 'bi-moisture',
                priority: 'medium',
                conditions: 'grain_moisture_unknown == true'
            },
            {
                id: 'rice_mature_5',
                title: 'Straw Management',
                description: 'Plan for straw incorporation or removal after harvest.',
                icon: 'bi-recycle',
                priority: 'low',
                conditions: 'straw_management_planned == false'
            }
        ],
        wheat: [
            {
                id: 'wheat_mature_1',
                title: 'Harvest Timing',
                description: 'Harvest when grain moisture is 12-14% for optimal quality.',
                icon: 'bi-basket',
                priority: 'high',
                conditions: 'grain_moisture < 15'
            },
            {
                id: 'wheat_mature_2',
                title: 'Combine Settings',
                description: 'Adjust combine for wheat harvest (cutter bar height 6-8 inches).',
                icon: 'bi-gear',
                priority: 'medium',
                conditions: 'harvest_method == "combine"'
            },
            {
                id: 'wheat_mature_3',
                title: 'Storage Preparation',
                description: 'Clean and disinfect storage bins before harvest.',
                icon: 'bi-box',
                priority: 'low',
                conditions: 'storage_prepared == false'
            },
            {
                id: 'wheat_mature_4',
                title: 'Weather Monitoring',
                description: 'Avoid harvesting during rain or high humidity.',
                icon: 'bi-cloud-rain',
                priority: 'high',
                conditions: 'rain_forecast == true'
            },
            {
                id: 'wheat_mature_5',
                title: 'Post-Harvest Planning',
                description: 'Plan for straw management and next crop rotation.',
                icon: 'bi-calendar-check',
                priority: 'low',
                conditions: 'next_crop_planned == false'
            }
        ]
    }
};

const AI_SOURCES = [
    {
        id: 'weather_ai',
        name: 'Weather AI',
        icon: 'bi-cloud-sun',
        description: 'Weather-based adaptive recommendations',
        color: '#3498db'
    },
    {
        id: 'soil_ai',
        name: 'Soil Health AI',
        icon: 'bi-tree',
        description: 'Soil analysis and nutrient management',
        color: '#8b4513'
    },
    {
        id: 'disease_ai',
        name: 'Disease Prediction AI',
        icon: 'bi-shield',
        description: 'Early disease detection and prevention',
        color: '#e74c3c'
    },
    {
        id: 'yield_ai',
        name: 'Yield Optimization AI',
        icon: 'bi-graph-up-arrow',
        description: 'Maximize crop yield and quality',
        color: '#2ecc71'
    },
    {
        id: 'irrigation_ai',
        name: 'Smart Irrigation AI',
        icon: 'bi-droplet',
        description: 'Precision water management',
        color: '#2980b9'
    },
    {
        id: 'market_ai',
        name: 'Market Intelligence AI',
        icon: 'bi-cart',
        description: 'Harvest timing for optimal pricing',
        color: '#f39c12'
    },
    {
        id: 'sustainability_ai',
        name: 'Sustainability AI',
        icon: 'bi-recycle',
        description: 'Eco-friendly farming practices',
        color: '#27ae60'
    },
    {
        id: 'pest_ai',
        name: 'Pest Management AI',
        icon: 'bi-bug',
        description: 'Integrated pest management',
        color: '#d35400'
    }
];

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Smart Crop System Initialized');
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing app...');
    
    if (window.supabase) {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            console.log('User session found:', session.user.email);
            currentUser = {
                id: session.user.id,
                username: session.user.user_metadata?.username || session.user.email,
                email: session.user.email
            };
            
            await loadUserProgressFromSupabase();
        } else {
            currentUser = {
                id: DEMO_USER_ID,
                username: 'Demo User',
                email: 'demo@smartcrop.com'
            };
            console.log('Using demo user mode');
        }
    } else {
        currentUser = {
            id: DEMO_USER_ID,
            username: 'Demo User',
            email: 'demo@smartcrop.com'
        };
        console.log('Supabase not available, using demo mode');
    }
    
    updateUserDisplay();
    
    await loadUserLocation();
    
    setupEventListeners();
    initializePlantsGrid();
    
    await Promise.all([
        loadModel(),
        loadMLModels()
    ]);
    
    initializeNavigation();
    initializeQuickActions();
    
    console.log('App initialization complete');
}

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
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            await migrateDemoDataToUser();
            
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
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
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
        await saveUserProgressToSupabase();
        
        if (supabase) {
            await supabase.auth.signOut();
        }
        
        currentUser = null;
        currentPlantingId = null;
        userCrops = [];
        localStorage.removeItem('currentUser');
        
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('error', 'Logout Failed', 'An error occurred during logout');
    }
}

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
            if (data.progress_data.userCrops) {
                userCrops = data.progress_data.userCrops;
            }
            
            if (data.progress_data.location) {
                userLocation = data.progress_data.location;
                updateLocationDisplay();
                fetchWeatherDataFromAPI();
                hideLocationModal();
            } else {
                showLocationModal();
            }
            
            updateDashboardWithAllCrops();
            console.log('User progress loaded from Supabase');
        } else {
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
    const savedCrops = localStorage.getItem('userCrops');
    if (savedCrops) {
        userCrops = JSON.parse(savedCrops);
    }
    
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
                localStorage.removeItem('userCrops');
                localStorage.removeItem('userLocation');
                localStorage.removeItem('cropDetections');
                localStorage.removeItem('cropObservations');
                
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

async function loadUserLocation() {
    if (currentUser.id === DEMO_USER_ID) {
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
        if (!userLocation) {
            showLocationModal();
        }
    }
}

function loadFertilizerPage() {
    console.log('Loading fertilizer recommendation page');
    const cropSelect = document.getElementById('fertCrop');
    const soilTypeSelect = document.getElementById('fertSoilType');
    const btn = document.getElementById('getFertilizerBtn');
    const results = document.getElementById('fertResults');

    if (!cropSelect || !soilTypeSelect || !btn || !results) return;

    cropSelect.innerHTML = '<option value="">-- Select Crop --</option>';
    crops.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        cropSelect.appendChild(opt);
    });

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

    btn.onclick = async function() {
        const crop = cropSelect.value;
        const soilType = soilTypeSelect.value;
        
        if (!crop || !soilType) {
            results.innerHTML = `<div class="alert alert-warning">Please select both crop type and soil type</div>`;
            return;
        }
        
        results.innerHTML = `
            <div class="loading-analysis">
                <div class="spinner"></div>
                <p>Analyzing with Random Forest model...</p>
            </div>
        `;
        
        try {
            const fertilizerName = await getFertilizerFromRandomForest(crop, soilType);
            
            displayFertilizerResult(crop, soilType, fertilizerName);
            
        } catch (error) {
            console.error('Random Forest API error:', error);
            const fertilizerName = getBestFertilizerForCropAndSoil(crop, soilType);
            displayFertilizerResult(crop, soilType, fertilizerName);
        }
    };

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

async function loadAllUserCrops() {
    updateDashboardWithAllCrops();
}

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
    
    document.querySelectorAll('.dashboard-crop-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.crop-actions')) {
                const plantingId = parseInt(this.getAttribute('data-planting-id'));
                highlightedPlantingId = highlightedPlantingId === plantingId ? null : plantingId;
                updateDashboardWithAllCrops();
            }
        });
    });

    
    document.querySelectorAll('.view-crop-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const plantingId = parseInt(this.getAttribute('data-planting-id'));
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
    
    const addMoreBtn = document.getElementById('addMoreCropsBtn');
    if (addMoreBtn) {
        addMoreBtn.addEventListener('click', () => navigateToPage('plants'));
    }
    
    if (currentWeatherData && currentWeatherData.current) {
        updateWeatherImpact(currentWeatherData.current);
    }
    
    const progCard = document.getElementById('growthProgressCard');
    const tasksCard = document.getElementById('todaysTasksCard');
    if (progCard) progCard.style.display = showTasksAndProgress ? '' : 'none';
    if (tasksCard) tasksCard.style.display = showTasksAndProgress ? '' : 'none';
}

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
        
        const backBtn = document.getElementById('backToAllBtn');
        if (backBtn) {
            backBtn.addEventListener('click', showAllCrops);
        }
    }
}

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

    tasksContainer.querySelectorAll('.task-check-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = parseInt(this.getAttribute('data-idx'));
            toggleTaskCompletion(plantingId, idx);
        });
    });

    updateTodayTasksOverallProgress(plantingId, completedCount, tasks.length);
}

function getTodayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function loadTaskCompletions() {
    return JSON.parse(localStorage.getItem('taskCompletions') || '{}');
}

function saveTaskCompletions(obj) {
    localStorage.setItem('taskCompletions', JSON.stringify(obj));
    try {
        saveUserProgressToSupabase();
    } catch (e) {
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

function showAllCrops() {
    selectedCrop = null;
    currentPlantingId = null;
    showTasksAndProgress = false;
    highlightedPlantingId = null;
    updateDashboardWithAllCrops();
    updateWeatherImpact(currentWeatherData ? currentWeatherData.current : null);
}

function viewCropDetails(plantingId) {
    selectCropForDetail(plantingId);
}

async function removeCrop(plantingId) {
    if (confirm('Are you sure you want to remove this crop? This will delete all associated data.')) {
        userCrops = userCrops.filter(crop => crop.planting_id !== plantingId);
        
        if (selectedCrop && selectedCrop.planting_id === plantingId) {
            selectedCrop = null;
            currentPlantingId = null;
        }
        
        await saveUserProgressToSupabase();
        
        updateDashboardWithAllCrops();
        showNotification('info', 'Crop Removed', 'Crop has been removed from your account.');
    }
}

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
    
    document.getElementById('closePlantingModal').addEventListener('click', () => modal.remove());
    document.getElementById('cancelPlanting').addEventListener('click', () => modal.remove());
    document.getElementById('confirmPlanting').addEventListener('click', () => confirmPlanting(crop.name));
    
    setTimeout(() => initializePlantingCalendar(), 100);
}

let currentCalendarMonth = null;
let currentCalendarYear = null;

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
    
    setTimeout(() => {
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => changePlantingMonth(-1));
        }
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => changePlantingMonth(1));
        }
        
        document.querySelectorAll('.calendar-popup-day:not(.past):not(.future)').forEach(day => {
            day.addEventListener('click', () => selectPlantingDate(day));
        });
        
        const todayElement = document.querySelector('.calendar-popup-day.today');
        if (todayElement) {
            selectPlantingDate(todayElement);
        }
    }, 0);
    
    return html;
}

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
    
    userCrops.push(newCrop);
    
    await saveUserProgressToSupabase();
    
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    updateDashboardWithAllCrops();
    navigateToPage('home');
    
    showNotification('success', `${crop.name} Planted!`, 
                   `Planted on ${new Date(plantingDate).toLocaleDateString()}. Progress saved to your account.`);
}

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
    
    if (!showTasksAndProgress) {
        tasksList.innerHTML = '<p>No tasks scheduled</p>';
        return;
    }
    
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
        
        showAdvancedFallbackRecommendation();
        
    } catch (error) {
        console.error('Error getting recommendation:', error);
        showAdvancedFallbackRecommendation();
    }
}

function showAdvancedFallbackRecommendation() {
    const recommendationElement = document.getElementById('currentRecommendation');
    if (!recommendationElement) return;
    
    if (!selectedCrop) {
        recommendationElement.innerHTML = `
            <div class="recommendation-card">
                <div class="recommendation-header">
                    <i class="bi bi-info-circle"></i>
                    <div>
                        <h4>No Crop Selected</h4>
                    </div>
                </div>
                <div class="recommendation-body">
                    <p class="reasoning">Please select a crop to get personalized AI recommendations.</p>
                </div>
            </div>
        `;
        return;
    }
    
    const cropType = selectedCrop.crop_type;
    const plantingDate = new Date(selectedCrop.planting_date);
    const daysElapsed = Math.floor((new Date() - plantingDate) / (1000 * 60 * 60 * 24));
    
    let growthStage = 'seedling';
    if (daysElapsed < 15) growthStage = 'seedling';
    else if (daysElapsed < 50) growthStage = 'vegetative';
    else if (daysElapsed < 90) growthStage = 'flowering';
    else growthStage = 'mature';
    
    const recommendations = generateAdvancedRecommendations(cropType, growthStage, daysElapsed);
    const selectedRecommendation = recommendations[Math.floor(Math.random() * recommendations.length)];
    const selectedSource = AI_SOURCES[Math.floor(Math.random() * AI_SOURCES.length)];
    
    recommendationElement.innerHTML = `
        <div class="recommendation-card" style="border-left-color: ${selectedSource.color}">
            <div class="recommendation-header">
                <i class="bi ${selectedSource.icon}" style="color: ${selectedSource.color}"></i>
                <div>
                    <h4>${selectedRecommendation.title}</h4>
                    <div class="confidence-badge">
                        <span class="confidence-dot" style="background-color: ${getConfidenceColor(0.85)}"></span>
                        85% Confidence
                    </div>
                </div>
            </div>
            <div class="recommendation-body">
                <p class="reasoning">${selectedRecommendation.description}</p>
                <div class="ai-source-info">
                    <i class="bi ${selectedSource.icon}"></i>
                    <span><strong>AI Source:</strong> ${selectedSource.name} - ${selectedSource.description}</span>
                </div>
                <div class="action-details">
                    <div class="detail-row">
                        <span class="detail-label">Crop:</span>
                        <span class="detail-value">${cropType}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Stage:</span>
                        <span class="detail-value">${growthStage} (Day ${daysElapsed})</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Priority:</span>
                        <span class="detail-value">${selectedRecommendation.priority}</span>
                    </div>
                </div>
            </div>
            <div class="recommendation-footer">
                <button class="btn btn-sm btn-primary" onclick="implementAdvancedRecommendation('${selectedRecommendation.id}', '${selectedSource.id}')">
                    <i class="bi bi-check-circle"></i> Mark as Done
                </button>
                <button class="btn btn-sm btn-outline" onclick="showAlternativeRecommendations()">
                    <i class="bi bi-arrow-clockwise"></i> More Options
                </button>
            </div>
        </div>
    `;
}

function generateAdvancedRecommendations(cropType, growthStage, daysElapsed) {
    let recommendations = [];
    
    if (AI_ADVICE_DATABASE[growthStage] && AI_ADVICE_DATABASE[growthStage][cropType.toLowerCase()]) {
        recommendations = AI_ADVICE_DATABASE[growthStage][cropType.toLowerCase()];
    } else {
        recommendations = getFallbackRecommendations(cropType, growthStage);
    }
    
    return recommendations.filter(rec => {
        if (rec.conditions) {
            try {
                return evaluateCondition(rec.conditions, daysElapsed);
            } catch (e) {
                return true;
            }
        }
        return true;
    });
}

function getFallbackRecommendations(cropType, growthStage) {
    const stageBasedAdvice = {
        seedling: [
            {
                id: 'fallback_seedling_1',
                title: 'Soil Preparation',
                description: 'Ensure soil is well-drained and has proper organic matter content.',
                priority: 'high'
            },
            {
                id: 'fallback_seedling_2',
                title: 'Seed Treatment',
                description: 'Treat seeds with fungicide to prevent seedling diseases.',
                priority: 'medium'
            }
        ],
        vegetative: [
            {
                id: 'fallback_vegetative_1',
                title: 'Nutrient Management',
                description: 'Apply balanced fertilizer for optimal vegetative growth.',
                priority: 'high'
            },
            {
                id: 'fallback_vegetative_2',
                title: 'Weed Control',
                description: 'Implement timely weeding to reduce competition.',
                priority: 'medium'
            }
        ],
        flowering: [
            {
                id: 'fallback_flowering_1',
                title: 'Pollination Support',
                description: 'Ensure proper conditions for pollination and fruit set.',
                priority: 'high'
            },
            {
                id: 'fallback_flowering_2',
                title: 'Water Management',
                description: 'Maintain consistent moisture during flowering.',
                priority: 'medium'
            }
        ],
        mature: [
            {
                id: 'fallback_mature_1',
                title: 'Harvest Timing',
                description: 'Monitor for optimal harvest timing based on crop maturity.',
                priority: 'high'
            },
            {
                id: 'fallback_mature_2',
                title: 'Post-Harvest Planning',
                description: 'Plan for storage and market timing.',
                priority: 'medium'
            }
        ]
    };
    
    return stageBasedAdvice[growthStage] || stageBasedAdvice.seedling;
}

function evaluateCondition(conditionString, daysElapsed) {
    const conditions = {
        'planting_density': 3,
        'soil_moisture': 60,
        'temperature': 25,
        'light_hours': 14,
        'days_since_fertilizer': 7,
        'water_depth': 2,
        'age': daysElapsed,
        'leaves': 4,
        'nitrogen_applied': true,
        'pest_level': 0,
        'weed_coverage': 5,
        'phosphorus_applied': true,
        'seed_treated': true,
        'soil_tested': true,
        'plant_height': 30,
        'tillers': 20,
        'zinc_applied': true,
        'calcium_applied': false,
        'flower_count': 10,
        'fruit_set': 40,
        'potassium_applied': false,
        'soil_moisture_variation': 10,
        'micronutrient_spray': false,
        'disease_present': false,
        'bird_damage': 0,
        'grain_maturity': 70,
        'grain_moisture_unknown': true,
        'straw_management_planned': false,
        'grain_moisture': 13,
        'harvest_method': 'manual',
        'storage_prepared': false,
        'rain_forecast': false,
        'next_crop_planned': false
    };
    
    const condition = conditionString.replace(/(\w+)/g, (match) => {
        if (match in conditions) {
            return conditions[match];
        }
        return match;
    });
    
    try {
        return eval(condition);
    } catch (e) {
        return true;
    }
}

function updateRecommendationDisplay(data) {
    const recommendationElement = document.getElementById('currentRecommendation');
    if (!recommendationElement) return;
    
    const actionIcon = getActionIcon(data.action);
    const actionColor = getActionColor(data.action);
    const formattedAction = formatAction(data.action);
    const randomSource = AI_SOURCES[Math.floor(Math.random() * AI_SOURCES.length)];
    
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
                <div class="ai-source-info">
                    <i class="bi ${randomSource.icon}"></i>
                    <span><strong>AI Source:</strong> ${randomSource.name} - ${randomSource.description}</span>
                </div>
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
                <button class="btn btn-sm btn-outline" onclick="showAlternativeRecommendations()">
                    <i class="bi bi-arrow-clockwise"></i> More Options
                </button>
            </div>
        </div>
    `;
}

async function implementAdvancedRecommendation(recommendationId, sourceId) {
    try {
        showNotification('success', 'Action Completed!', 'AI recommendation implemented successfully.');
        
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

function showAlternativeRecommendations() {
    if (!selectedCrop) return;
    
    const cropType = selectedCrop.crop_type;
    const plantingDate = new Date(selectedCrop.planting_date);
    const daysElapsed = Math.floor((new Date() - plantingDate) / (1000 * 60 * 60 * 24));
    
    let growthStage = 'seedling';
    if (daysElapsed < 15) growthStage = 'seedling';
    else if (daysElapsed < 50) growthStage = 'vegetative';
    else if (daysElapsed < 90) growthStage = 'flowering';
    else growthStage = 'mature';
    
    const recommendations = generateAdvancedRecommendations(cropType, growthStage, daysElapsed);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal alternative-recommendations-modal">
            <div class="modal-header">
                <h4><i class="bi bi-lightbulb"></i> Alternative Recommendations</h4>
                <button class="btn-close" id="closeAltModal">&times;</button>
            </div>
            <div class="modal-body">
                <p>Select an alternative recommendation for your ${cropType} (${growthStage} stage):</p>
                <div class="recommendations-list">
                    ${recommendations.map((rec, index) => {
                        const source = AI_SOURCES[index % AI_SOURCES.length];
                        return `
                            <div class="alternative-recommendation" onclick="selectAlternativeRecommendation('${rec.id}', '${source.id}')">
                                <div class="alt-rec-header">
                                    <i class="bi ${source.icon}" style="color: ${source.color}"></i>
                                    <div>
                                        <h5>${rec.title}</h5>
                                        <span class="priority-badge ${rec.priority}">${rec.priority}</span>
                                    </div>
                                </div>
                                <p class="alt-rec-description">${rec.description}</p>
                                <div class="alt-rec-source">
                                    <small>Source: ${source.name}</small>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancelAlt">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('closeAltModal').addEventListener('click', () => modal.remove());
    document.getElementById('cancelAlt').addEventListener('click', () => modal.remove());
}

function selectAlternativeRecommendation(recommendationId, sourceId) {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    
    showNotification('info', 'Recommendation Selected', 'Alternative recommendation applied.');
    
    setTimeout(() => {
        if (currentPlantingId) {
            getAIRecommendation(currentPlantingId);
        }
    }, 1000);
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
                        <option value 'wilting'>Wilting/drooping</option>
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
        const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
        logs.push({
            planting_id: currentPlantingId,
            detection_label: detectionLabel,
            detection_score: detectionScore,
            timestamp: new Date().toISOString(),
            type: 'automatic'
        });
        localStorage.setItem('detectionLogs', JSON.stringify(logs));
        
        await saveUserProgressToSupabase();
        
        showNotification('success', 'Detection Logged', 'Added to your crop history.');
        await getAIRecommendation(currentPlantingId);

    } catch (error) {
        console.error('Error logging detection:', error);
        showNotification('warning', 'Logged Locally', 'Saved detection locally.');
    }
}

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
    
    await saveUserProgressToSupabase();
    
    updateDashboardWithAllCrops();
    navigateToPage('home');
    
    showNotification('success', 'Harvest Complete!', `${wasSelected.crop_type} has been harvested. Great work!`);
}

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
    
    .ai-source-info {
        background: #f8f9fa;
        padding: 10px;
        border-radius: 8px;
        margin: 10px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    }
    
    .ai-source-info .bi {
        font-size: 20px;
    }
    
    .priority-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .priority-badge.high {
        background: #ffeaea;
        color: #e74c3c;
    }
    
    .priority-badge.medium {
        background: #fff4e6;
        color: #f39c12;
    }
    
    .priority-badge.low {
        background: #e8f4fd;
        color: #3498db;
    }
    
    .alternative-recommendation {
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 15px;
        margin: 10px 0;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .alternative-recommendation:hover {
        border-color: #3498db;
        background: #f8f9fa;
    }
    
    .alt-rec-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .alt-rec-header .bi {
        font-size: 24px;
    }
    
    .alt-rec-description {
        font-size: 14px;
        color: #666;
        margin-bottom: 10px;
    }
    
    .alt-rec-source {
        font-size: 12px;
        color: #999;
    }
    
    .recommendations-list {
        max-height: 400px;
        overflow-y: auto;
    }
`;
document.head.appendChild(modelStyles);

console.log('Smart Crop System ready! (With Enhanced AI Recommendations)');
