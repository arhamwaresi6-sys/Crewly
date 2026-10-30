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
