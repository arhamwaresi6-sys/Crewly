/* ========================================
   SPLITWISE+ ADMIN PANEL
======================================== */

document.addEventListener("DOMContentLoaded", () => {
  initializeTabs();
  initializeUserSearch();
  initializeUserActions();
  initializeEventActions();
  initializeAnnouncementForm();
});

/* ========================================
   HELPERS
======================================== */

function showAlert(message, type = "success") {
  const container = document.getElementById("adminToastContainer");

  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `admin-toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

async function sendRequest(url, method, body = null) {
  const headers = {
    "Content-Type": "application/json",
  };

  const options = {
    method,
    headers,
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

/* ========================================
   TAB SWITCHING
======================================== */

function initializeTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  const sections = document.querySelectorAll(".admin-section");

  function openTab(tabName) {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    sections.forEach((section) => {
      section.classList.toggle("hidden", section.id !== `section-${tabName}`);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      openTab(tab.dataset.tab);
    });
  });

  document.querySelectorAll("[data-open-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      openTab(button.dataset.openTab);
    });
  });
}

/* ========================================
   USER SEARCH
======================================== */

function initializeUserSearch() {
  const searchInput = document.getElementById("userSearch");

  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const searchValue = searchInput.value.toLowerCase().trim();

    document.querySelectorAll("[data-user-row]").forEach((row) => {
      const rowText = row.textContent.toLowerCase();

      row.style.display = rowText.includes(searchValue) ? "" : "none";
    });
  });
}

/* ========================================
   USER ACTIONS
======================================== */

function initializeUserActions() {
  // Ban or activate a user.
  document.querySelectorAll("[data-user-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.userStatus;
      const nextStatus = button.dataset.nextStatus;

      const action = nextStatus === "banned" ? "ban" : "activate";

      if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
      }

      button.disabled = true;

      try {
        const data = await sendRequest(`/api/update_user_status`, "PATCH", {
          status: nextStatus,
          userId,
        });

        showAlert(data.message || "User updated successfully.");
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
    });
  });

  // Delete a user.
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.deleteUser;

      if (
        !confirm(
          "Are you sure you want to delete this user? This action cannot be undone.",
        )
      ) {
        return;
      }

      button.disabled = true;

      try {
        const data = await sendRequest(`/api/delete_user/${userId}`, "DELETE");

        showAlert(data.message || "User deleted successfully.");
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
    });
  });
  //promote user
  document.querySelectorAll("[data-change-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.changeRole;
      const nextRole = button.dataset.nextRole;

      const action = nextRole === "admin" ? "promote" : "demote";

      if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
      }

      button.disabled = true;

      try {
        const data = await sendRequest(`/api/update_user_role`, "PATCH", {
          role: nextRole,
          userId,
        });

        showAlert(data.message || "User role updated successfully.");
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

/* ========================================
   EVENT ACTIONS
======================================== */

function initializeEventActions() {
  document.querySelectorAll("[data-delete-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      const eventId = button.dataset.deleteEvent;

      if (
        !confirm(
          "Are you sure you want to delete this event and its related data?",
        )
      ) {
        return;
      }

      button.disabled = true;

      try {
        const data = await sendRequest(
          `/api/delete_event/${eventId}`,
          "DELETE",
        );

        showAlert(data.message || "Event deleted successfully.");
        localStorage.removeItem("users");
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

/* ========================================
   ANNOUNCEMENTS
======================================== */

function initializeAnnouncementForm() {
  const form = document.getElementById("announcementForm");

  if (!form) return;

  const textarea = document.getElementById("announcementText");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = textarea.value.trim();

    if (!message) {
      showAlert("Please write an announcement first.", "error");
      return;
    }

    if (message.length > 2000) {
      showAlert("Announcement is too long.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
      const data = await sendRequest("/api/announcement", "POST", {
        text: message,
      });

      showAlert(
        data.message || `Announcement sent to ${data.recipients} users.`,
      );

      form.reset();
      localStorage.removeItem("notifications");
      window.location.reload();
    } catch (error) {
      showAlert(error.message, "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Send announcement →";
    }
  });
}

// Keep user actions working for rows created from app.js's shared USERS list.
function clearUsersCache() {
  localStorage.removeItem("users");
}

function escapeAdminHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

function draw() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody || typeof USERS === "undefined" || !Array.isArray(USERS)) return;
  // Preserve the server-rendered first paint if the shared cache is still empty.
  if (!USERS.length && tbody.querySelector("[data-user-row]")) return;
  const currentUser = window.CURRENT_USER || {};
  const rows = USERS.slice().sort((a, b) =>
    String(b.joined || "").localeCompare(String(a.joined || "")),
  );
  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="6"><div class="admin-empty">No users available.</div></td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map((user) => {
      const id = escapeAdminHTML(user.id);
      const name = escapeAdminHTML(user.name || "Unknown user");
      const email = escapeAdminHTML(user.email || "");
      const role = String(user.role || "user").toLowerCase();
      const status = String(user.status || "active").toLowerCase();
      const joined = escapeAdminHTML(user.joined || "—");
      const statusClass =
        status === "banned" ? "badge-danger" : "badge-success";
      const protectedUser =
        role === "root" || String(user.id) === String(currentUser.id);
      let actions = '<span class="admin-muted">Protected</span>';
      if (!protectedUser) {
        const roleAction =
          currentUser.role === "root"
            ? `<button class="admin-btn admin-btn-small admin-btn-primary" data-change-role="${id}" data-next-role="${role === "admin" ? "user" : "admin"}">${role === "admin" ? "Demote" : "Promote"}</button>`
            : "";
        const statusAction =
          status === "banned"
            ? `<button class="admin-btn admin-btn-small admin-btn-success" data-user-status="${id}" data-next-status="active">Activate</button>`
            : `<button class="admin-btn admin-btn-small admin-btn-warning" data-user-status="${id}" data-next-status="banned">Ban</button>`;
        actions = `<div class="admin-actions">${roleAction}${statusAction}<button class="admin-btn admin-btn-small admin-btn-danger" data-delete-user="${id}">Delete</button></div>`;
      }
      const initial = escapeAdminHTML(
        String(user.name || "?")
          .trim()
          .charAt(0)
          .toUpperCase(),
      );
      return `<tr data-user-row>
      <td><div class="admin-user-cell"><span class="admin-avatar small">${initial}</span><div><strong>${name}</strong><small class="admin-cell-sub">#${id}</small></div></div></td>
      <td>${email}</td><td><span class="admin-badge role-${escapeAdminHTML(role)}">${escapeAdminHTML(role)}</span></td>
      <td><span class="admin-badge ${statusClass}">${escapeAdminHTML(status)}</span></td>
      <td>${joined}</td><td>${actions}</td>
    </tr>`;
    })
    .join("");
}

function initializeUserActions() {
  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(
      "[data-user-status], [data-delete-user], [data-change-role]",
    );
    if (!button || button.disabled) return;
    const userId =
      button.dataset.userStatus ||
      button.dataset.deleteUser ||
      button.dataset.changeRole;

    if (button.hasAttribute("data-user-status")) {
      const nextStatus = button.dataset.nextStatus;
      const action = nextStatus === "banned" ? "ban" : "activate";
      if (!confirm(`Are you sure you want to ${action} this user?`)) return;
      button.disabled = true;
      try {
        const data = await sendRequest("/api/update_user_status", "PATCH", {
          status: nextStatus,
          userId,
        });
        showAlert(data.message || "User updated successfully.");
        clearUsersCache();
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
      return;
    }

    if (button.hasAttribute("data-change-role")) {
      const nextRole = button.dataset.nextRole;
      const action = nextRole === "admin" ? "promote" : "demote";
      if (!confirm(`Are you sure you want to ${action} this user?`)) return;
      button.disabled = true;
      try {
        const data = await sendRequest("/api/update_user_role", "PATCH", {
          role: nextRole,
          userId,
        });
        showAlert(data.message || "User role updated successfully.");
        clearUsersCache();
        window.location.reload();
      } catch (error) {
        showAlert(error.message, "error");
        button.disabled = false;
      }
      return;
    }

    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    )
      return;
    button.disabled = true;
    try {
      const data = await sendRequest(`/api/delete_user/${userId}`, "DELETE");
      showAlert(data.message || "User deleted successfully.");
      clearUsersCache();
      window.location.reload();
    } catch (error) {
      showAlert(error.message, "error");
      button.disabled = false;
    }
  });
}

// app.js calls draw() after loading USERS; this covers cached data on page entry.
document.addEventListener("DOMContentLoaded", () => {
  if (typeof USERS !== "undefined" && Array.isArray(USERS) && USERS.length)
    draw();
});
