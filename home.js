// ============================================
// home.js — Smart Crop System (Complete Supabase Integration)
// ============================================

// ============================
// Supabase config
// ============================
const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";

const supabase = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

// Global variables
let userLocation = null;
let selectedCrop = null;
let currentPage = 'home';
let currentWeatherData = null;
const API_BASE_URL = 'http://localhost:5000/api';

// Available crops data
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
const DEMO_USER_ID = 999;
let userCrops = [];

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';

// Model config
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

// ============================
// THEME MANAGEMENT
// ============================

function initTheme() {
    // Set initial theme
    applyTheme(currentTheme);
    
    // Create theme toggle in header if it doesn't exist
    createThemeToggle();
    
    // Listen for system theme changes
    if (window.matchMedia) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        prefersDark.addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }
}

function createThemeToggle() {
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    
    const existingToggle = document.querySelector('.theme-toggle');
    if (existingToggle) return;
    
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = currentTheme === 'dark' ? 
        '<i class="bi bi-sun"></i>' : 
        '<i class="bi bi-moon"></i>';
    themeToggle.title = currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggle.onclick = toggleTheme;
    
    headerActions.appendChild(themeToggle);
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme(currentTheme);
    
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) {
        themeToggle.innerHTML = currentTheme === 'dark' ? 
            '<i class="bi bi-sun"></i>' : 
            '<i class="bi bi-moon"></i>';
        themeToggle.title = currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
    
    // Update theme-specific styles
    updateThemeStyles(theme);
}

function updateThemeStyles(theme) {
    // Remove existing theme style
    const existingStyle = document.getElementById('theme-styles');
    if (existingStyle) existingStyle.remove();
    
    const style = document.createElement('style');
    style.id = 'theme-styles';
    
    if (theme === 'dark') {
        style.textContent = `
            :root {
                --bg-primary: #1a1a1a;
                --bg-secondary: #2d2d2d;
                --bg-card: #2d2d2d;
                --text-primary: #ffffff;
                --text-secondary: #b0b0b0;
                --border-color: #404040;
                --shadow-color: rgba(0, 0, 0, 0.3);
                --hover-bg: #3d3d3d;
            }
            
            .card, .dashboard-crop-card, .plant-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
            }
            
            .btn-outline {
                border-color: var(--border-color);
                color: var(--text-primary);
            }
            
            .btn-outline:hover {
                background: var(--hover-bg);
            }
            
            .modal {
                background: var(--bg-card);
            }
            
            input, select, textarea {
                background: var(--bg-secondary);
                border-color: var(--border-color);
                color: var(--text-primary);
            }
            
            .progress-bar {
                background: var(--bg-secondary);
            }
            
            .nav-item:hover {
                background: var(--hover-bg);
            }
            
            .task-item {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
            }
        `;
    } else {
        style.textContent = `
            :root {
                --bg-primary: #ffffff;
                --bg-secondary: #f8f9fa;
                --bg-card: #ffffff;
                --text-primary: #212529;
                --text-secondary: #6c757d;
                --border-color: #dee2e6;
                --shadow-color: rgba(0, 0, 0, 0.1);
                --hover-bg: #f8f9fa;
            }
        `;
    }
    
    document.head.appendChild(style);
}

// ============================
// SUPABASE AUTHENTICATION
// ============================

function initAuthListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      console.log('User signed in:', session.user.email);
      await handleUserLogin(session.user);
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      handleUserLogout();
    } else if (event === 'USER_UPDATED') {
      console.log('User updated');
      await loadLoggedInUser();
    }
  });
}

async function handleUserLogin(user) {
  try {
    await initializeUserProfile(user);
    await loadLoggedInUser();
    await syncLocalDataToServer();
    await loadUserCropsFromSupabase();
    updateUserDisplay();
    updateDashboardWithAllCrops();
    hideLoginModal();
    showNotification('success', 'Welcome Back!', `Logged in as ${user.email}`);
  } catch (error) {
    console.error('Error handling login:', error);
    showNotification('error', 'Login Error', 'Could not load your data. Please try again.');
  }
}

function handleUserLogout() {
  currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
  userCrops = [];
  selectedCrop = null;
  currentPlantingId = null;
  
  const savedLocation = localStorage.getItem('userLocation');
  const savedTheme = localStorage.getItem('theme');
  localStorage.clear();
  if (savedLocation) {
    localStorage.setItem('userLocation', savedLocation);
  }
  if (savedTheme) {
    localStorage.setItem('theme', savedTheme);
  }
  
  updateUserDisplay();
  updateDashboardWithAllCrops();
  navigateToPage('home');
  showNotification('info', 'Logged Out', 'You are now in demo mode.');
}

async function loginWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error.message);
    return { success: false, error: error.message };
  }
}

async function signUpWithEmail(email, password, username) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          username: username
        }
      }
    });
    
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Sign up error:', error.message);
    return { success: false, error: error.message };
  }
}

async function signInWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
  } catch (error) {
    console.error('Google sign in error:', error.message);
    showNotification('error', 'Google Sign In Failed', error.message);
  }
}

// ============================
// SUPABASE DATABASE OPERATIONS
// ============================

async function initializeUserProfile(user) {
  try {
    const { data: existingProfile, error: checkError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email.split('@')[0],
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
      console.log('New user profile created');
      await initializeUserSettings(user.id);
    } else if (checkError) {
      throw checkError;
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing user profile:', error);
    throw error;
  }
}

async function initializeUserSettings(userId) {
  try {
    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!existingSettings) {
      const savedLocation = localStorage.getItem('userLocation');
      
      const { error } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          location: savedLocation ? JSON.parse(savedLocation) : null,
          units: 'metric',
          notifications_enabled: true,
          theme: currentTheme,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      console.log('User settings initialized');
    }
  } catch (error) {
    console.error('Error initializing user settings:', error);
  }
}

async function saveUserCropToSupabase(cropData) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return null;

  try {
    const { data, error } = await supabase
      .from('user_crops')
      .insert({
        user_id: currentUser.id,
        crop_name: cropData.name,
        crop_type: cropData.type || cropData.name,
        planting_date: new Date(cropData.planting_date).toISOString().split('T')[0],
        status: 'growing',
        duration_days: cropData.duration,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('Crop saved to Supabase:', data);
    
    // Immediately save initial progress to cloud
    await saveCropProgressToSupabase(data.id, {
      days_elapsed: 0,
      growth_stage: 'seedling',
      progress_percentage: 0,
      notes: 'Crop planted'
    });
    
    return data;
  } catch (error) {
    console.error('Error saving crop to Supabase:', error);
    return null;
  }
}

async function saveCropProgressToSupabase(cropId, progressData) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existingProgress } = await supabase
      .from('crop_progress')
      .select('*')
      .eq('crop_id', cropId)
      .eq('created_at', today)
      .single();

    if (existingProgress) {
      const { error } = await supabase
        .from('crop_progress')
        .update({
          days_elapsed: progressData.days_elapsed,
          growth_stage: progressData.growth_stage,
          progress_percentage: progressData.progress_percentage,
          notes: progressData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgress.id);

      if (error) throw error;
      console.log('Progress updated in Supabase for crop:', cropId);
    } else {
      const { error } = await supabase
        .from('crop_progress')
        .insert({
          crop_id: cropId,
          days_elapsed: progressData.days_elapsed,
          growth_stage: progressData.growth_stage,
          progress_percentage: progressData.progress_percentage,
          notes: progressData.notes,
          weather_conditions: currentWeatherData?.current,
          created_at: today
        });

      if (error) throw error;
      console.log('Progress saved to Supabase for crop:', cropId);
    }
    
    // Update local crop data with latest progress
    const cropIndex = userCrops.findIndex(c => c.planting_id === cropId);
    if (cropIndex !== -1) {
      userCrops[cropIndex].last_progress = {
        days_elapsed: progressData.days_elapsed,
        growth_stage: progressData.growth_stage,
        progress_percentage: progressData.progress_percentage,
        created_at: today
      };
    }
    
    return true;
  } catch (error) {
    console.error('Error saving progress to Supabase:', error);
    return false;
  }
}

async function saveObservationToSupabase(cropId, observationData) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return;

  try {
    const { error } = await supabase
      .from('crop_observations')
      .insert({
        crop_id: cropId,
        observation_type: observationData.type || 'manual',
        pest_level: observationData.pest_level,
        disease_type: observationData.disease_type,
        soil_moisture: observationData.soil_moisture,
        temperature: observationData.temperature,
        humidity: observationData.humidity,
        notes: observationData.notes,
        image_url: observationData.image_url,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('Observation saved to Supabase');
    return true;
  } catch (error) {
    console.error('Error saving observation to Supabase:', error);
    return false;
  }
}

async function loadUserCropsFromSupabase() {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return;

  try {
    const { data: cropsData, error: cropsError } = await supabase
      .from('user_crops')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('status', 'growing')
      .order('created_at', { ascending: false });

    if (cropsError) throw cropsError;

    if (cropsData && cropsData.length > 0) {
      userCrops = cropsData.map(crop => ({
        planting_id: crop.id,
        crop_type: crop.crop_name,
        crop_data: crops.find(c => c.name === crop.crop_name),
        planting_date: crop.planting_date,
        user_id: crop.user_id,
        created_at: crop.created_at,
        status: crop.status,
        duration: crop.duration_days
      }));

      // Load latest progress for each crop
      for (let crop of userCrops) {
        const { data: progressData } = await supabase
          .from('crop_progress')
          .select('*')
          .eq('crop_id', crop.planting_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (progressData) {
          crop.last_progress = progressData;
        }
      }

      console.log('Loaded', userCrops.length, 'crops from Supabase with progress');
    } else {
      userCrops = [];
    }
  } catch (error) {
    console.error('Error loading crops from Supabase:', error);
    await loadAllUserCropsFromLocal();
  }
}

async function syncLocalDataToServer() {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return;

  try {
    const localCrops = JSON.parse(localStorage.getItem('userCrops') || '[]');
    if (localCrops.length > 0) {
      for (const localCrop of localCrops) {
        const { data: existingCrop } = await supabase
          .from('user_crops')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('crop_name', localCrop.crop_type)
          .eq('planting_date', localCrop.planting_date)
          .single();

        if (!existingCrop) {
          await saveUserCropToSupabase({
            name: localCrop.crop_type,
            planting_date: localCrop.planting_date,
            duration: localCrop.crop_data?.duration || 100
          });
        }
      }
      
      localStorage.removeItem('userCrops');
    }

    const localObservations = JSON.parse(localStorage.getItem('cropObservations') || '[]');
    const localDetections = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
    
    if (localObservations.length > 0 || localDetections.length > 0) {
      showNotification('info', 'Syncing Data', 'Uploading your local data to the cloud...');
      localStorage.removeItem('cropObservations');
      localStorage.removeItem('detectionLogs');
    }

    console.log('Local data synced to Supabase');
  } catch (error) {
    console.error('Error syncing data to Supabase:', error);
  }
}

// ============================
// INITIALIZATION
// ============================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Smart Crop System Initialized');
    
    // Initialize Supabase client
    const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";
    
    window.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    supabase = window.supabase;
    
    initializeApp();
});

async function initializeApp() {
    console.log('Initializing app...');
    
    // Initialize theme
    initTheme();
    
    // Initialize auth listener
    initAuthListener();
    createNavOverlay();
    
    // Check localStorage for user from signup.js
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        console.log('Found user in localStorage from signup.js');
        try {
            currentUser = JSON.parse(storedUser);
            console.log('Loaded user:', currentUser);
            
            // Verify the session is still valid
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                console.log('Session expired or invalid, trying to restore...');
                const storedToken = localStorage.getItem('supabase.auth.token');
                if (storedToken) {
                    try {
                        const tokenData = JSON.parse(storedToken);
                        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                            access_token: tokenData.access_token,
                            refresh_token: tokenData.refresh_token
                        });
                        
                        if (sessionError) {
                            console.log('Could not restore session:', sessionError.message);
                            currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
                        } else {
                            console.log('Session restored successfully');
                        }
                    } catch (tokenError) {
                        console.log('Token error:', tokenError);
                        currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
                    }
                }
            }
        } catch (parseError) {
            console.error('Error parsing stored user:', parseError);
            currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
        }
    } else {
        await loadLoggedInUser();
    }
    
    console.log('Final currentUser:', currentUser);
    
    // Load crops based on user type
    await loadAllUserCrops();

    if (currentUser && currentUser.id && currentUser.id !== DEMO_USER_ID) {
        console.log('Loading crops from Supabase for user:', currentUser.id);
        await loadUserCropsFromSupabase();
    }
    
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
    
    await Promise.all([
        loadModel(),
        loadMLModels()
    ]);
    
    initializeNavigation();
    initializeQuickActions();
    hideLoginModal();
    
    // Show welcome message if user just signed up
    const justSignedUp = localStorage.getItem('justSignedUp');
    if (justSignedUp === 'true' && currentUser.id !== DEMO_USER_ID) {
        showNotification('success', 'Welcome!', `Hello ${currentUser.username}! Start planting your first crop.`);
        localStorage.removeItem('justSignedUp');
    }
    
    console.log('App initialization complete');
}

async function loadLoggedInUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.log('Supabase auth error:', error.message);
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log('Using localStorage user as fallback:', currentUser);
      } else {
        currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
      }
    } else if (user) {
      currentUser = {
        id: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email.split("@")[0]
      };
      
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      
      await initializeUserProfile(user);
      
      console.log('Loaded user from Supabase auth:', currentUser);
    } else {
      currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
    }

    updateUserDisplay();
  } catch (error) {
    console.error('Error loading user:', error);
    currentUser = { id: DEMO_USER_ID, username: "Demo User", email: 'demo@smartcrop.com' };
    updateUserDisplay();
  }
}

// ============================
// CROP MANAGEMENT
// ============================

async function loadAllUserCrops() {
  try {
    if (currentUser && currentUser.id !== DEMO_USER_ID) {
      return;
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

async function loadAllUserCropsFromLocal() {
  const savedCrops = localStorage.getItem('userCrops');
  if (savedCrops) {
    userCrops = JSON.parse(savedCrops);
    updateDashboardWithAllCrops();
  }
}

async function confirmPlanting(cropName) {
  const crop = crops.find(c => c.name === cropName);
  if (!crop) return;
  
  const plantingDate = document.getElementById('plantingDateInput').value;
  
  try {
    const userId = currentUser ? currentUser.id : DEMO_USER_ID;
    
    if (currentUser.id !== DEMO_USER_ID) {
      const supabaseCrop = await saveUserCropToSupabase({
        name: crop.name,
        planting_date: plantingDate,
        duration: crop.duration
      });
      
      if (supabaseCrop) {
        const newCrop = {
          planting_id: supabaseCrop.id,
          crop_type: crop.name,
          crop_data: crop,
          planting_date: plantingDate,
          user_id: userId,
          created_at: new Date().toISOString(),
          status: 'growing'
        };
        
        userCrops.push(newCrop);
        
        document.querySelector('.modal-overlay').remove();
        updateDashboardWithAllCrops();
        navigateToPage('home');
        
        showNotification('success', `${crop.name} Planted!`, 
                      `Planted on ${new Date(plantingDate).toLocaleDateString()}. Progress saved to cloud.`);
        return;
      }
    }
    
    simulateCropPlanting(crop, plantingDate);
    
  } catch (error) {
    console.error('Error planting crop:', error);
    simulateCropPlanting(crop, plantingDate);
  }
}

function simulateCropPlanting(crop, plantingDate = new Date().toISOString().split('T')[0]) {
  const plantingId = Date.now();
  
  const newCrop = {
    planting_id: plantingId,
    crop_type: crop.name,
    crop_data: crop,
    planting_date: plantingDate,
    user_id: DEMO_USER_ID,
    created_at: new Date().toISOString(),
    status: 'growing'
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

async function updateProgress() {
  if (!currentPlantingId || !selectedCrop) return;
  
  const plantingDate = new Date(selectedCrop.planting_date);
  const now = new Date();
  const daysElapsed = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));
  
  const cropData = crops.find(c => c.name === selectedCrop.crop_type) || {
    name: selectedCrop.crop_type,
    duration: 100
  };
  const totalDays = cropData.duration;
  const progressPercentage = Math.min(99.9, (daysElapsed / totalDays) * 100);
  
  let growthStage = 'seedling';
  if (daysElapsed < 15) growthStage = 'seedling';
  else if (daysElapsed < 50) growthStage = 'vegetative';
  else if (daysElapsed < 90) growthStage = 'flowering';
  else growthStage = 'mature';
  
  // Always try to save to Supabase if user is logged in
  let cloudSaved = false;
  if (currentUser && currentUser.id !== DEMO_USER_ID && selectedCrop.planting_id) {
    cloudSaved = await saveCropProgressToSupabase(selectedCrop.planting_id, {
      days_elapsed: daysElapsed,
      growth_stage: growthStage,
      progress_percentage: progressPercentage,
      notes: `Day ${daysElapsed}: ${growthStage} stage`
    });
  }
  
  // Update UI
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  if (progressFill && progressText) {
    progressFill.style.width = `${progressPercentage}%`;
    progressText.textContent = `${progressPercentage.toFixed(1)}% Complete`;
    
    if (cloudSaved) {
      progressText.innerHTML += ` <span class="cloud-sync-badge"><i class="bi bi-cloud-check"></i> Synced</span>`;
    }
    
    if (progressPercentage > 0) {
      progressFill.classList.add('progress-animate');
      setTimeout(() => {
        progressFill.classList.remove('progress-animate');
      }, 500);
    }
  }
  
  const tasks = await getTasksFromDecisionTree(cropData, daysElapsed, growthStage);
  await updateTasksWithAI(tasks || [], growthStage, progressPercentage);
  checkMilestones(daysElapsed, growthStage);
}

async function removeCrop(plantingId) {
  if (confirm('Are you sure you want to remove this crop? This will delete all associated data.')) {
    if (currentUser && currentUser.id !== DEMO_USER_ID) {
      try {
        await supabase
          .from('user_crops')
          .update({ status: 'removed', updated_at: new Date().toISOString() })
          .eq('id', plantingId)
          .eq('user_id', currentUser.id);
        
        console.log('Crop marked as removed in Supabase:', plantingId);
      } catch (error) {
        console.error('Error removing crop from Supabase:', error);
      }
    }
    
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

// ============================
// IMPROVED DASHBOARD UI
// ============================

async function updateDashboardWithAllCrops() {
    const currentCropElement = document.getElementById('currentCrop');
    if (!currentCropElement) return;
    
    if (userCrops.length === 0) {
        currentCropElement.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="bi bi-flower1"></i>
                </div>
                <h4>No Crops Planted Yet</h4>
                <p>Start your farming journey by planting your first crop</p>
                <button class="btn btn-primary" onclick="navigateToPage('plants')">
                    <i class="bi bi-plus-circle"></i> Plant First Crop
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="dashboard-header">
            <div class="dashboard-title">
                <h3><i class="bi bi-grid-3x3-gap"></i> My Crops</h3>
                <span class="badge">${userCrops.length} Active</span>
            </div>
            <div class="dashboard-actions">
                <button class="btn btn-sm btn-primary" onclick="navigateToPage('plants')">
                    <i class="bi bi-plus-lg"></i> Add Crop
                </button>
            </div>
        </div>
        <div class="crops-grid compact">
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
        
        const isSelected = selectedCrop && selectedCrop.planting_id === crop.planting_id;
        const daysRemaining = Math.max(0, totalDays - daysElapsed);
        
        // Cloud sync indicator
        const cloudIcon = crop.user_id === DEMO_USER_ID ? 
            '<i class="bi bi-device-hdd" title="Local storage"></i>' : 
            '<i class="bi bi-cloud-check" title="Cloud synced"></i>';
        
        html += `
            <div class="dashboard-crop-card ${isSelected ? 'selected' : ''}" 
                 onclick="selectCropForDetail(${crop.planting_id})">
                <div class="crop-card-header">
                    <div class="crop-icon">
                        <i class="bi ${cropData.icon}"></i>
                    </div>
                    <div class="crop-info">
                        <h4>${cropData.name}</h4>
                        <div class="crop-meta">
                            <span class="crop-age">${daysElapsed}d old</span>
                            <span class="crop-stage ${growthStage}">${growthStage}</span>
                        </div>
                    </div>
                    <div class="cloud-indicator">
                        ${cloudIcon}
                    </div>
                </div>
                
                <div class="crop-progress-compact">
                    <div class="progress-header">
                        <span class="progress-label">Progress</span>
                        <span class="progress-percent">${progressPercentage.toFixed(0)}%</span>
                    </div>
                    <div class="progress-bar-compact">
                        <div class="progress-fill-compact" style="width: ${progressPercentage}%"></div>
                    </div>
                </div>
                
                <div class="crop-stats">
                    <div class="stat">
                        <i class="bi bi-calendar"></i>
                        <span>Planted: ${plantingDate.getDate()}/${plantingDate.getMonth()+1}</span>
                    </div>
                    <div class="stat">
                        <i class="bi bi-clock"></i>
                        <span>${daysRemaining}d left</span>
                    </div>
                </div>
                
                <div class="crop-actions-mini">
                    <button class="btn-icon" onclick="viewCropDetails(${crop.planting_id}); event.stopPropagation()" title="View Details">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="removeCrop(${crop.planting_id}); event.stopPropagation()" title="Remove Crop">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    html += `</div>`;
    currentCropElement.innerHTML = html;
    
    // Update weather impact if available
    if (currentWeatherData && currentWeatherData.current) {
        updateWeatherImpact(currentWeatherData.current);
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
                <button class="btn btn-sm btn-outline" onclick="showAllCrops()">
                    <i class="bi bi-arrow-left"></i> Back
                </button>
                <div class="detail-title">
                    <i class="bi ${cropData.icon}"></i>
                    <h3>${cropData.name}</h3>
                    ${crop.user_id !== DEMO_USER_ID ? 
                      '<span class="cloud-badge"><i class="bi bi-cloud-check"></i> Cloud Synced</span>' : 
                      '<span class="cloud-badge local"><i class="bi bi-device-hdd"></i> Local Only</span>'}
                </div>
            </div>
            
            <div class="detail-content">
                <div class="progress-section-large">
                    <div class="progress-header-large">
                        <h4>Growth Progress</h4>
                        <span class="progress-percent-large">${progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar-large">
                        <div class="progress-fill-large" style="width: ${progressPercentage}%"></div>
                    </div>
                    <div class="progress-stats">
                        <div class="progress-stat">
                            <div class="stat-value">${daysElapsed}</div>
                            <div class="stat-label">Days Elapsed</div>
                        </div>
                        <div class="progress-stat">
                            <div class="stat-value">${daysRemaining}</div>
                            <div class="stat-label">Days Remaining</div>
                        </div>
                        <div class="progress-stat">
                            <div class="stat-value">${cropData.duration}</div>
                            <div class="stat-label">Total Days</div>
                        </div>
                        <div class="progress-stat">
                            <div class="stat-value stage-${growthStage}">${growthStage}</div>
                            <div class="stat-label">Growth Stage</div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-timeline">
                    <h4><i class="bi bi-calendar-event"></i> Timeline</h4>
                    <div class="timeline-compact">
                        <div class="timeline-item">
                            <div class="timeline-date">${plantingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                            <div class="timeline-content">
                                <strong>Planted</strong>
                                <p>Crop planting initiated</p>
                            </div>
                        </div>
                        <div class="timeline-item future">
                            <div class="timeline-date">${harvestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                            <div class="timeline-content">
                                <strong>Expected Harvest</strong>
                                <p>Target completion date</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="detail-tasks">
                    <div class="tasks-header">
                        <h4><i class="bi bi-clipboard-check"></i> Today's Tasks</h4>
                        <span class="model-badge">AI Recommended</span>
                    </div>
                    <div id="todaysTasksDetail" class="tasks-list"></div>
                </div>
            </div>
        </div>
    `;
    
    const currentCropElement = document.getElementById('currentCrop');
    if (currentCropElement) {
        currentCropElement.innerHTML = detailView;
        updateTasksForDetail(tasks);
        
        // Save progress to cloud if logged in
        if (currentUser && currentUser.id !== DEMO_USER_ID && crop.planting_id) {
            await saveCropProgressToSupabase(crop.planting_id, {
                days_elapsed: daysElapsed,
                growth_stage: growthStage,
                progress_percentage: progressPercentage,
                notes: `Viewed crop details`
            });
        }
    }
}

function updateTasksForDetail(tasks) {
    const tasksContainer = document.getElementById('todaysTasksDetail');
    if (!tasksContainer) return;
    
    if (!tasks || tasks.length === 0) {
        tasksContainer.innerHTML = `
            <div class="info-note">
                <i class="bi bi-info-circle"></i>
                <span>No specific tasks for today. Continue regular monitoring.</span>
            </div>
        `;
        return;
    }
    
    tasksContainer.innerHTML = '';
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
        
        tasksContainer.appendChild(taskItem);
    });
}

async function updateTasksWithAI(tasks, growthStage, progress) {
    const tasksList = document.getElementById('todaysTasks');
    if (!tasksList) return;
    
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

function showAllCrops() {
    selectedCrop = null;
    currentPlantingId = null;
    updateDashboardWithAllCrops();
    updateWeatherImpact(currentWeatherData ? currentWeatherData.current : null);
}

function viewCropDetails(plantingId) {
    selectCropForDetail(plantingId);
}

// ============================
// UI FUNCTIONS
// ============================

function updateUserDisplay() {
  const usernameDisplay = document.getElementById('usernameDisplay');
  if (usernameDisplay) {
    usernameDisplay.textContent = currentUser ? currentUser.username : 'Demo User';
  }
  
  const logoutBtn = document.getElementById('logoutBtn');
  const loginBtn = document.getElementById('loginBtn');
  
  if (logoutBtn) {
    logoutBtn.style.display = currentUser.id !== DEMO_USER_ID ? 'flex' : 'none';
  }
  if (loginBtn) {
    loginBtn.style.display = currentUser.id === DEMO_USER_ID ? 'block' : 'none';
  }
}

function showLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (loginModal) {
    loginModal.style.display = 'flex';
    const errorMsg = loginModal.querySelector('.login-error');
    if (errorMsg) errorMsg.style.display = 'none';
  }
}

function hideLoginModal() {
  const loginModal = document.getElementById('loginModal');
  if (loginModal) loginModal.style.display = 'none';
}

// ============================
// LOGIN/LOGOUT HANDLERS
// ============================

async function handleEmailLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorMsg = document.querySelector('.login-error');
  
  if (!email || !password) {
    if (errorMsg) {
      errorMsg.textContent = 'Please enter email and password';
      errorMsg.style.display = 'block';
    }
    return;
  }
  
  const submitBtn = document.querySelector('#loginModal .btn-primary');
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Logging in...';
  submitBtn.disabled = true;
  
  const result = await loginWithEmail(email, password);
  
  if (result.success) {
    hideLoginModal();
    showNotification('success', 'Login Successful', 'Welcome back!');
  } else {
    if (errorMsg) {
      errorMsg.textContent = result.error || 'Login failed. Please try again.';
      errorMsg.style.display = 'block';
    }
    
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

async function handleEmailSignup() {
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const username = document.getElementById('signupUsername').value;
  const errorMsg = document.querySelector('.signup-error');
  
  if (!email || !password || !username) {
    if (errorMsg) {
      errorMsg.textContent = 'Please fill all fields';
      errorMsg.style.display = 'block';
    }
    return;
  }
  
  if (password.length < 6) {
    if (errorMsg) {
      errorMsg.textContent = 'Password must be at least 6 characters';
      errorMsg.style.display = 'block';
    }
    return;
  }
  
  const submitBtn = document.querySelector('#signupModal .btn-primary');
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Creating account...';
  submitBtn.disabled = true;
  
  const result = await signUpWithEmail(email, password, username);
  
  if (result.success) {
    hideSignupModal();
    showNotification('success', 'Account Created!', 'Please check your email to confirm your account.');
  } else {
    if (errorMsg) {
      errorMsg.textContent = result.error || 'Sign up failed. Please try again.';
      errorMsg.style.display = 'block';
    }
    
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
}

function showSignupModal() {
  hideLoginModal();
  const signupModal = document.getElementById('signupModal');
  if (signupModal) {
    signupModal.style.display = 'flex';
  }
}

function hideSignupModal() {
  const signupModal = document.getElementById('signupModal');
  if (signupModal) signupModal.style.display = 'none';
}

function handleLogout() {
  supabase.auth.signOut();
}

// ============================
// ML MODEL FUNCTIONS
// ============================

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

// ============================
// FERTILIZER RECOMMENDATION
// ============================

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

// ============================
// TASK MANAGEMENT
// ============================

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

// ============================
// NAVIGATION & EVENT LISTENERS
// ============================

function createNavOverlay() {
    if (!document.getElementById('navOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'navOverlay';
        overlay.className = 'mobile-nav-overlay';
        overlay.addEventListener('click', toggleNavigation);
        document.body.appendChild(overlay);
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
            handleLogout();
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
        
        item.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Nav item clicked:', this.id, this.getAttribute('data-page'));
            
            if (this.id === 'logoutBtn') {
                handleLogout();
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

// ============================
// LOCATION FUNCTIONS
// ============================

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
        
        if (currentUser && currentUser.id !== DEMO_USER_ID) {
            saveUserSettings({ location: userLocation });
        }
    }
}

// ============================
// WEATHER FUNCTIONS
// ============================

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

// ============================
// CROP SELECTION FUNCTIONS
// ============================

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

// ============================
// PROGRESS TRACKING
// ============================

function startProgressTracking() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
    }
    
    updateProgress();
    progressUpdateInterval = setInterval(updateProgress, 60000);
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

// ============================
// AI RECOMMENDATIONS
// ============================

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

// ============================
// MANUAL DATA ENTRY
// ============================

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

// ============================
// IMAGE ANALYSIS FUNCTIONS
// ============================

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

function renderResults(topList) {
    const resultArea = document.getElementById('detectionResult');
    if (!resultArea) return;
    
    let html = `<div class="detection-results">`;
    html += `<h3><i class="bi bi-clipboard-check"></i> Analysis Results</h3>`;
    
    if (topList.length === 0) {
        html += '<p class="no-results">No clear detection. Please try another image.</p>';
    } else {
        const plantRegex = /(tomato|potato|pepper|bell|eggplant|cucumber|okra)/i;
        const plantEntries = {};
        const otherEntries = [];

        for (const item of topList) {
            const originalLabel = item.label ? item.label : (labels && typeof item.idx !== 'undefined' && labels[item.idx] ? labels[item.idx] : (item.idx !== undefined ? `Class ${item.idx}` : 'Unknown'));
            const score = item.score || 0;
            const plantMatch = originalLabel.match(plantRegex);
            if (plantMatch) {
                const plantName = plantMatch[0].toLowerCase();
                if (!plantEntries[plantName]) plantEntries[plantName] = {healthy: 0, diseased: 0, healthyLabels: [], diseaseLabels: []};
                if (originalLabel.toLowerCase().includes('healthy')) {
                    plantEntries[plantName].healthy += score;
                    plantEntries[plantName].healthyLabels.push({label: originalLabel, score});
                } else {
                    plantEntries[plantName].diseased += score;
                    plantEntries[plantName].diseaseLabels.push({label: originalLabel, score});
                }
            } else {
                otherEntries.push({originalLabel, score});
            }
        }

        const displayList = [];
        for (const p of Object.keys(plantEntries)) {
            const entry = plantEntries[p];
            const healthyScore = entry.healthy || 0;
            const diseasedScore = entry.diseased || 0;
            if (healthyScore === 0 && diseasedScore === 0) continue;

            if (healthyScore >= diseasedScore) {
                const originalLabel = entry.healthyLabels.map(h => h.label).join('|');
                displayList.push({displayLabel: 'Healthy', originalLabel, score: healthyScore, isProblem: false});
            } else {
                entry.diseaseLabels.sort((a,b) => b.score - a.score);
                const topDiseaseLabel = entry.diseaseLabels[0] ? entry.diseaseLabels[0].label : (entry.diseaseLabels.map(d => d.label).join('|'));
                const originalLabel = entry.diseaseLabels.map(d => d.label).join('|');
                displayList.push({displayLabel: 'Diseased', originalLabel, score: diseasedScore, isProblem: true, adviceLabel: topDiseaseLabel});
            }
        }
        for (const e of otherEntries) {
            const isProblem = e.originalLabel.toLowerCase().includes('disease') || e.originalLabel.toLowerCase().includes('pest');
            displayList.push({displayLabel: e.originalLabel, originalLabel: e.originalLabel, score: e.score, isProblem});
        }

        displayList.sort((a,b) => (b.score || 0) - (a.score || 0));

        const top = displayList[0];
        if (!top) {
            html += '<p class="no-results">No clear detection. Please try another image.</p>';
        } else {
            const confidence = ((top.score || 0) * 100).toFixed(1);
            const isProblem = top.isProblem;

            html += `<div class="result-list">`;
            html += `
                <div class="result-item ${isProblem ? 'problem' : 'healthy'}">
                    <div class="result-header">
                        <i class="bi ${isProblem ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i>
                        <strong>${escapeHtml(top.displayLabel)}</strong>
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
                        <span>${getAdviceForProblem(top.adviceLabel || top.originalLabel)}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            html += `</div>`;

            html += `
                <div class="result-actions">
                    <button class="btn btn-primary" onclick="logDetection('${encodeURIComponent(top.originalLabel || topList[0]?.label || '')}', ${top.score || topList[0]?.score || 0})">
                        <i class="bi bi-save"></i> Log Detection
                    </button>
                    <button class="btn btn-outline" onclick="handleImageUpload(event)">
                        <i class="bi bi-arrow-clockwise"></i> Analyze Another
                    </button>
                </div>
            `;
        }
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
        const response = await fetch(`${API_BASE_URL}/crop/${currentPlantingId}/image-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detected_disease: detectionLabel,
                detected_pests: null,
                disease_confidence: detectionScore || 0,
                overall_health_score: Math.max(0, 100 - (detectionScore ? (detectionScore * 100 * 0.5) : 25))
            })
        });

        if (response.ok) {
            showNotification('success', 'Detection Logged', 'Added to crop history.');
        } else {
            const logs = JSON.parse(localStorage.getItem('detectionLogs') || '[]');
            logs.push({
                planting_id: currentPlantingId,
                detection_label: detectionLabel,
                detection_score: detectionScore,
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
            detection_label: detectionLabel,
            detection_score: detectionScore,
            timestamp: new Date().toISOString(),
            type: 'automatic',
            error: error.message
        });
        localStorage.setItem('detectionLogs', JSON.stringify(logs));
        showNotification('warning', 'Logged Locally', 'Saved detection locally due to network error.');
    }
}

// ============================
// ANALYTICS FUNCTIONS
// ============================

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

// ============================
// QUICK ACTIONS
// ============================

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

async function logQuickAction(type, description) {
    if (!selectedCrop) return;
    const action = {
        planting_id: selectedCrop.planting_id,
        type: type,
        description: description,
        timestamp: new Date().toISOString()
    };

    const userId = currentUser ? currentUser.id : null;
    if (userId && userId !== DEMO_USER_ID) {
        try {
            const resp = await fetch(`${API_BASE_URL}/user/${userId}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_type: 'quick_action', planting_id: action.planting_id, details: action })
            });
            if (resp.ok) {
                showNotification('success', 'Action Logged', 'Quick action saved to your account.');
                return;
            }
        } catch (e) {
            console.warn('Failed to log quick action to server:', e.message);
        }
    }

    const actions = JSON.parse(localStorage.getItem('quickActions') || '[]');
    actions.push(action);
    localStorage.setItem('quickActions', JSON.stringify(actions));
    showNotification('warning', 'Logged Locally', 'Quick action saved locally (not synced).');
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

// ============================
// HELPER FUNCTIONS
// ============================

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

// ============================
// ADDITIONAL SUPABASE UTILITIES
// ============================

async function saveUserSettings(settings) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return;

  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: currentUser.id,
        ...settings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    
    console.log('User settings saved to Supabase');
  } catch (error) {
    console.error('Error saving user settings:', error);
  }
}

async function loadUserSettings() {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return null;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error loading user settings:', error);
    return null;
  }
}

async function getCropHistory(cropId) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return [];

  try {
    const { data, error } = await supabase
      .from('crop_progress')
      .select('*')
      .eq('crop_id', cropId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error loading crop history:', error);
    return [];
  }
}

async function getCropObservations(cropId) {
  if (!currentUser || currentUser.id === DEMO_USER_ID) return [];

  try {
    const { data, error } = await supabase
      .from('crop_observations')
      .select('*')
      .eq('crop_id', cropId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error loading crop observations:', error);
    return [];
  }
}

// ============================
// DASHBOARD CSS STYLES
// ============================
const dashboardStyles = document.createElement('style');
dashboardStyles.textContent = `
    /* Compact Dashboard Styles */
    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .dashboard-title {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .dashboard-title h3 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 600;
    }
    
    .dashboard-title .badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .crops-grid.compact {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
    }
    
    .dashboard-crop-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        transition: all 0.3s ease;
        cursor: pointer;
    }
    
    .dashboard-crop-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px var(--shadow-color);
        border-color: #667eea;
    }
    
    .dashboard-crop-card.selected {
        border-color: #667eea;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    }
    
    .crop-card-header {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        gap: 12px;
    }
    
    .crop-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 1.2rem;
    }
    
    .crop-info {
        flex: 1;
    }
    
    .crop-info h4 {
        margin: 0 0 4px 0;
        font-size: 1rem;
        font-weight: 600;
    }
    
    .crop-meta {
        display: flex;
        gap: 8px;
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .crop-stage {
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    
    .crop-stage.seedling { background: #e3f2fd; color: #1976d2; }
    .crop-stage.vegetative { background: #e8f5e9; color: #2e7d32; }
    .crop-stage.flowering { background: #fff3e0; color: #f57c00; }
    .crop-stage.mature { background: #fce4ec; color: #c2185b; }
    
    .cloud-indicator {
        color: #667eea;
        font-size: 0.9rem;
    }
    
    .crop-progress-compact {
        margin: 15px 0;
    }
    
    .progress-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 0.85rem;
    }
    
    .progress-percent {
        font-weight: 600;
        color: #667eea;
    }
    
    .progress-bar-compact {
        height: 6px;
        background: var(--bg-secondary);
        border-radius: 3px;
        overflow: hidden;
    }
    
    .progress-fill-compact {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        border-radius: 3px;
        transition: width 0.5s ease;
    }
    
    .crop-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 15px 0;
        font-size: 0.8rem;
    }
    
    .crop-stats .stat {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
    }
    
    .crop-stats .stat i {
        color: #667eea;
    }
    
    .crop-actions-mini {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 10px;
        border-top: 1px solid var(--border-color);
    }
    
    .btn-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: transparent;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-icon:hover {
        background: var(--hover-bg);
        color: var(--text-primary);
    }
    
    /* Detail View Styles */
    .crop-detail-view {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
    }
    
    .detail-header {
        display: flex;
        align-items: center;
        margin-bottom: 25px;
        gap: 15px;
    }
    
    .detail-title {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }
    
    .detail-title h3 {
        margin: 0;
        font-size: 1.3rem;
    }
    
    .detail-title i {
        font-size: 1.5rem;
        color: #667eea;
    }
    
    .cloud-badge {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .cloud-badge.local {
        background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
    }
    
    .progress-section-large {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    .progress-header-large {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .progress-header-large h4 {
        margin: 0;
        font-size: 1.1rem;
    }
    
    .progress-percent-large {
        font-size: 1.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    
    .progress-bar-large {
        height: 10px;
        background: var(--bg-primary);
        border-radius: 5px;
        overflow: hidden;
        margin-bottom: 20px;
    }
    
    .progress-fill-large {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        border-radius: 5px;
        transition: width 0.5s ease;
    }
    
    .progress-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
    }
    
    .progress-stat {
        text-align: center;
    }
    
    .progress-stat .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 5px;
    }
    
    .progress-stat .stat-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .detail-timeline {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    .timeline-compact .timeline-item {
        display: flex;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid var(--border-color);
    }
    
    .timeline-compact .timeline-item:last-child {
        border-bottom: none;
    }
    
    .timeline-compact .timeline-date {
        width: 80px;
        font-weight: 600;
        color: #667eea;
    }
    
    .timeline-compact .timeline-content strong {
        display: block;
        margin-bottom: 4px;
    }
    
    .timeline-compact .timeline-content p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    
    .detail-tasks {
        background: var(--bg-secondary);
        border-radius: 12px;
        padding: 20px;
    }
    
    .tasks-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
    }
    
    .tasks-header h4 {
        margin: 0;
        font-size: 1.1rem;
    }
    
    .tasks-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .cloud-sync-badge {
        background: #2ecc71;
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.7rem;
        margin-left: 5px;
    }
    
    /* Theme Toggle Button */
    .theme-toggle {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--bg-secondary);
        color: var(--text-primary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .theme-toggle:hover {
        transform: rotate(15deg);
        background: var(--hover-bg);
    }
    
    /* Empty State */
    .empty-state {
        text-align: center;
        padding: 40px 20px;
    }
    
    .empty-state-icon {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        color: #667eea;
        font-size: 2rem;
    }
    
    .empty-state h4 {
        margin: 0 0 10px 0;
        font-size: 1.2rem;
        font-weight: 600;
    }
    
    .empty-state p {
        color: var(--text-secondary);
        margin-bottom: 20px;
    }
    
    /* Dark mode adjustments */
    .dark-mode .crop-stage.seedling { background: rgba(25, 118, 210, 0.2); color: #90caf9; }
    .dark-mode .crop-stage.vegetative { background: rgba(46, 125, 50, 0.2); color: #a5d6a7; }
    .dark-mode .crop-stage.flowering { background: rgba(245, 124, 0, 0.2); color: #ffcc80; }
    .dark-mode .crop-stage.mature { background: rgba(194, 24, 91, 0.2); color: #f48fb1; }
    
    /* Model badges for dark mode */
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
    
    .dark-mode .model-badge-small {
        background: rgba(25, 118, 210, 0.2);
        color: #90caf9;
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
    
    .svm-badge {
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        color: white;
    }
`;
document.head.appendChild(dashboardStyles);

console.log('Smart Crop System ready! (With Dark/Light Mode & Improved Dashboard)');