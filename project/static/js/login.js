/* login.js – switches between "Log in" and "Sign up" and handles the form */
let mode = "login";

// Keep protected-page redirects local and fall back to the dashboard.
function loginDestination() {
  const next = new URLSearchParams(location.search).get("next");
  if (!next) return ROUTES.dashboard;

  try {
    const destination = new URL(next, location.origin);
    return destination.origin === location.origin
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : ROUTES.dashboard;
  } catch {
    return ROUTES.dashboard;
  }
}

function setMode(m) {
  mode = m;
  //   true → Add the class if it isn't present.
  // false → Remove the class if it is present.
  $("tabLogin").classList.toggle("active", m === "login");
  $("tabSignup").classList.toggle("active", m === "signup");
  $("nameField").classList.toggle("hide", m === "login");
  $("title").textContent =
    m === "login" ? "Welcome back" : "Create your account";
  $("submitBtn").textContent = m === "login" ? "Log in" : "Create account";
}
if (new URLSearchParams(location.search).get("mode") === "signup")
  setMode("signup");

$("authForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const data = {
    email: $("email").value,
    password: $("password").value,
    name: $("fullName").value,
  };
  if (mode === "login") {
    try {
      // Include Flask-Login's next query when submitting the JSON login form.
      const request = await fetch(location.pathname + location.search, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const result = await request.json();
      if (request.ok) {
        window.location.href = loginDestination();
      } else if (request.status === 404) {
        showAlert(result.message, "error", "error");
        setMode("signup");
      } else {
        const errorContainer = $("error-container");
        errorContainer.textContent = result.message;
        errorContainer.style.color = "red";
      }
    } catch (error) {
      console.error("Login request failed:", error);
      $("error-container").textContent =
        "Could not connect. Please try again.";
      $("error-container").style.color = "red";
    }
  } else if (mode === "signup") {
    const request = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    let result = await request.json();
    if (request.ok) {
      localStorage.removeItem("users");
      showAlert(result.message, "success", "success");
      setMode("login");
    } else {
      showAlert(result.message, "error", "error");
    }
  }
});
