document.addEventListener("DOMContentLoaded", () => {

  const supabaseUrl = "https://alezsadxhbqozzfxzios.supabase.co";
  const supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsZXpzYWR4aGJxb3p6Znh6aW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTkyNDMsImV4cCI6MjA4MjQ3NTI0M30.G4fU1jYvZSxuE0fVbAkKe-2WPgBKCe5lwieUyKico0I";

  const supabase = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

  const loginBtn = document.getElementById("loginBtn");
  const errorMsg = document.getElementById("error_msg");

  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    errorMsg.style.display = "none";

    if (!email || !password) {
      errorMsg.textContent = "Please enter email and password";
      errorMsg.style.display = "block";
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorMsg.textContent = error.message;
      errorMsg.style.display = "block";
      return;
    }

    // ✅ Login success
    window.location.href = "home.html";
  });
});
