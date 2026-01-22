/**
 * Forgot Password Module for Supabase Auth
 * Handles all password reset functionality including modal management and Supabase integration
 */

document.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements
  const forgotPasswordLink = document.querySelector(".forgot-password");
  
  // Create modal elements if they don't exist
  createForgotPasswordModal();
  
  // Get the newly created modal elements
  const forgotPasswordModal = document.getElementById("forgotPasswordModal");
  const modalClose = document.getElementById("modalClose");
  const modalCancel = document.getElementById("modalCancel");
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const resetEmailInput = document.getElementById("resetEmail");
  const resetSubmitBtn = document.getElementById("resetSubmitBtn");
  const modalMessage = document.getElementById("modalMessage");

  // Initialize Supabase (assuming you have it in script.js)
  // We'll try to use the existing Supabase instance from script.js
  let supabase;
  try {
    // Try to get the existing Supabase client from your script.js
    if (window.supabase) {
      supabase = window.supabase;
    } else {
      // Initialize Supabase if not already done
      const supabaseUrl = 'YOUR_SUPABASE_URL'; // Replace with your actual URL
      const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your actual key
      
      supabase = window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
    }
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
  }

  /**
   * Create the forgot password modal dynamically
   */
  function createForgotPasswordModal() {
    if (document.getElementById("forgotPasswordModal")) {
      return; // Modal already exists
    }
    
    const modalHTML = `
      <div id="forgotPasswordModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Reset Password</h3>
            <button id="modalClose" class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            <form id="forgotPasswordForm" novalidate>
              <div class="form-group">
                <label for="resetEmail">Email Address</label>
                <div class="input-with-icon">
                  <i class="bi bi-envelope"></i>
                  <input type="email" id="resetEmail" class="form-input" placeholder="Enter your email" required>
                </div>
              </div>
              <div id="modalMessage" class="modal-message"></div>
              <div class="modal-actions">
                <button type="button" id="modalCancel" class="btn-secondary">Cancel</button>
                <button type="submit" id="resetSubmitBtn" class="btn-primary">Send Reset Link</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to the page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add modal styles
    addModalStyles();
  }

  /**
   * Add CSS styles for the modal
   */
  function addModalStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* Modal Styles */
      .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .modal.active {
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 1;
      }
      
      .modal-content {
        background: var(--surface);
        border-radius: 20px;
        width: 90%;
        max-width: 450px;
        border: 1px solid var(--border);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        overflow: hidden;
        transform: translateY(-20px);
        transition: transform 0.3s ease;
      }
      
      .modal.active .modal-content {
        transform: translateY(0);
      }
      
      .modal-header {
        padding: 20px 30px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .modal-header h3 {
        font-family: 'Inter', sans-serif;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }
      
      .modal-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        font-size: 2rem;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
      }
      
      .modal-close:hover {
        color: var(--primary);
        background: rgba(16, 185, 129, 0.1);
      }
      
      .modal-body {
        padding: 30px;
      }
      
      .modal-body p {
        color: var(--text-secondary);
        margin-bottom: 25px;
        line-height: 1.6;
      }
      
      .modal-actions {
        display: flex;
        gap: 15px;
        margin-top: 25px;
      }
      
      .btn-primary {
        flex: 1;
        padding: 14px;
        background: var(--gradient-primary);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .btn-primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 30px var(--primary-glow);
      }
      
      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .btn-secondary {
        flex: 1;
        padding: 14px;
        background: var(--surface-light);
        color: var(--text-secondary);
        border: 1px solid var(--border);
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      
      .btn-secondary:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
      }
      
      .modal-message {
        display: none;
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 0.9rem;
        margin: 15px 0;
        text-align: center;
      }
      
      .modal-message.success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: var(--primary);
        display: block;
      }
      
      .modal-message.error {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        display: block;
      }
      
      .modal-message.info {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #3b82f6;
        display: block;
      }
      
      /* Responsive styles */
      @media (max-width: 768px) {
        .modal-content {
          width: 95%;
          margin: 20px;
        }
        
        .modal-header {
          padding: 15px 20px;
        }
        
        .modal-body {
          padding: 20px;
        }
        
        .modal-actions {
          flex-direction: column;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Open the forgot password modal
   */
  function openForgotPasswordModal() {
    if (forgotPasswordModal) {
      forgotPasswordModal.classList.add("active");
      resetEmailInput.value = "";
      modalMessage.style.display = "none";
      modalMessage.className = "modal-message";
      resetSubmitBtn.disabled = false;
      resetSubmitBtn.textContent = "Send Reset Link";
      resetEmailInput.focus();
    }
  }

  /**
   * Close the forgot password modal
   */
  function closeModal() {
    if (forgotPasswordModal) {
      forgotPasswordModal.classList.remove("active");
    }
    if (forgotPasswordForm) {
      forgotPasswordForm.reset();
    }
    modalMessage.style.display = "none";
    modalMessage.className = "modal-message";
  }

  /**
   * Display a message in the modal (success or error)
   * @param {string} message - The message to display
   * @param {string} type - Either 'success' or 'error' or 'info'
   */
  function showModalMessage(message, type) {
    modalMessage.textContent = message;
    modalMessage.className = `modal-message ${type}`;
    modalMessage.style.display = "block";
    
    // Scroll to message
    modalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - Whether email is valid
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send password reset email using Supabase
   * @param {string} email - User's email address
   * @returns {Promise<Object>} - Result of the reset request
   */
  async function sendPasswordResetEmail(email) {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }
    
    try {
      // Use Supabase's built-in password reset function
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`, // Create this page
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error("Supabase password reset error:", error);
      return { 
        success: false, 
        error: error.message || "Failed to send reset email" 
      };
    }
  }

  /**
   * Handle forgot password link click
   */
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", function(e) {
      e.preventDefault();
      openForgotPasswordModal();
    });
  }

  /**
   * Handle modal close button click
   */
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  /**
   * Handle modal cancel button click
   */
  if (modalCancel) {
    modalCancel.addEventListener("click", closeModal);
  }

  /**
   * Close modal when clicking outside of it
   */
  if (forgotPasswordModal) {
    forgotPasswordModal.addEventListener("click", function(e) {
      if (e.target === forgotPasswordModal) {
        closeModal();
      }
    });
  }

  /**
   * Close modal with Escape key
   */
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && forgotPasswordModal && forgotPasswordModal.classList.contains("active")) {
      closeModal();
    }
  });

  /**
   * Handle forgot password form submission
   */
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      const email = resetEmailInput.value.trim();

      // Validate email
      if (!email) {
        showModalMessage("Please enter your email address", "error");
        resetEmailInput.focus();
        return;
      }
      
      if (!isValidEmail(email)) {
        showModalMessage("Please enter a valid email address", "error");
        resetEmailInput.focus();
        return;
      }

      // Disable submit button and show loading state
      resetSubmitBtn.disabled = true;
      const originalText = resetSubmitBtn.textContent;
      resetSubmitBtn.textContent = "Sending...";
      showModalMessage("Sending reset link...", "info");

      try {
        // Send password reset email via Supabase
        const result = await sendPasswordResetEmail(email);

        if (result.success) {
          showModalMessage(`Password reset link has been sent to ${email}! Check your inbox (and spam folder).`, "success");
          
          // Clear form
          forgotPasswordForm.reset();
          
          // Close modal after 4 seconds
          setTimeout(() => {
            closeModal();
          }, 4000);
        } else {
          // Handle specific error messages
          let errorMessage = result.error;
          
          // User-friendly error messages
          if (errorMessage.includes("User not found")) {
            errorMessage = "No account found with this email address.";
          } else if (errorMessage.includes("rate limit")) {
            errorMessage = "Too many attempts. Please try again in a few minutes.";
          } else if (errorMessage.includes("email")) {
            errorMessage = "Please check the email address and try again.";
          }
          
          showModalMessage(errorMessage, "error");
          resetSubmitBtn.disabled = false;
          resetSubmitBtn.textContent = originalText;
        }
      } catch (error) {
        console.error("Forgot password error:", error);
        showModalMessage("An unexpected error occurred. Please try again.", "error");
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = originalText;
      }
    });
  }

  // Export functions for external use if needed
  window.ForgotPasswordModule = {
    open: openForgotPasswordModal,
    close: closeModal,
    showMessage: showModalMessage,
    sendResetEmail: sendPasswordResetEmail
  };
});