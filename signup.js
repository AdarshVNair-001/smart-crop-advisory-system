// signup.js — Signup page logic
// Replaces CSS that was accidentally saved in this JS file

// Supabase config (match values used in `home.js`)
const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

function showMessage(el, message, color = 'red') {
  el.style.display = 'block';
  el.style.color = color;
  el.textContent = message;
}

function hideMessage(el) {
  el.style.display = 'none';
  el.textContent = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const fullNameEl = document.getElementById('fullName');
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const signupBtn = document.getElementById('signupBtn');
  const errorMsg = document.getElementById('error_msg');

  if (!fullNameEl || !emailEl || !passwordEl || !signupBtn) {
    console.error('Signup elements not found. Are you on the signup page?');
    return;
  }

  signupBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    hideMessage(errorMsg);
    signupBtn.disabled = true;

    const name = fullNameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;

    if (!name || !email || !password) {
      showMessage(errorMsg, 'Please fill in all fields', 'red');
      signupBtn.disabled = false;
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { username: name } }
      });

      if (error) {
        showMessage(errorMsg, error.message || JSON.stringify(error), 'red');
        signupBtn.disabled = false;
        return;
      }

      // Success — inform user and redirect to login
      showMessage(errorMsg, 'Signup successful! Check your email (if required) — redirecting to login...', 'green');
      setTimeout(() => { window.location.href = 'index.html'; }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      showMessage(errorMsg, err.message || String(err), 'red');
      signupBtn.disabled = false;
    }
  });

  // allow Enter key on password to submit
  passwordEl.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') signupBtn.click();
  });
});
