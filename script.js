document.addEventListener("DOMContentLoaded", function() {
    const submitButton = document.querySelector(".submit");
    const errorMsg = document.getElementById("error_msg");
    const usernameField = document.querySelector(".uname");
    const passwordField = document.querySelector(".pword");

    function login() {
        const username = usernameField.value.trim();
        const password = passwordField.value.trim();

        if (username === "Crop005" && password === "Project@005") {
            window.location.href = "home.html";
        } else {
            errorMsg.textContent = "Incorrect Username or Password. Please try again.";
            errorMsg.style.display = "block";
        }
    }

    // Click on submit button
    submitButton.addEventListener("click", login);

    // Press Enter in username or password field
    [usernameField, passwordField].forEach(field => {
        field.addEventListener("keypress", function(event) {
            if (event.key === "Enter") {
                login();
            }
        });
    });
});


// ---------------

