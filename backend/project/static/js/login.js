/* login.js – switches between "Log in" and "Sign up" and handles the form */
let mode = "login";

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
    const request = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    let result = await request.json();
    if (request.ok) {
      window.location.href = ROUTES.dashboard;
    } else if (request.status == 404) {
      showAlert(result.message, "error", "error");
      setMode("signup");
    } else {
      let error_container = $("error-container");
      error_container.textContent = result.message;
      error_container.style.color = "red";
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
