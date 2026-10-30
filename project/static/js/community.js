const community = window.COMMUNITY_DATA;

let users = community.users || [];
const currentUserId = String(community.currentUserId);
const isRoot = community.currentUserRole === "root";

let selectedUser = null;
let toastTimeout;

// Escape values before putting them into HTML.
function escapeHTML(value) {
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

// =====================================
// TOAST
// =====================================

function showToast(message) {
  const toast = $("communityToast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// =====================================
// SEARCH
// =====================================

function searchUsers() {
  if (!isRoot) return;

  const search = $("roleSearch").value.trim().toLowerCase();

  $("clearSearch").classList.toggle("visible", search.length > 0);

  if (!search) {
    $("roleResults").innerHTML = `
            <div class="search-empty">
                <span>⌕</span>
                <p>Search for someone to manage their role.</p>
            </div>
        `;

    $("searchMessage").textContent = "Search for a community member";
    $("resultCount").textContent = "";
    return;
  }

  // Match both name and Gmail.
  const results = users
    .filter((user) => {
      const name = String(user.name || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();

      return (
        (name.includes(search) || email.includes(search)) &&
        String(user.id) !== currentUserId &&
        user.role !== "root"
      );
    })
    .slice(0, 10);

  $("searchMessage").textContent = "Search results";
  $("resultCount").textContent = `${results.length} found`;

  if (!results.length) {
    $("roleResults").innerHTML = `
            <div class="search-empty">
                <span>⌕</span>
                <p>No matching community member found.</p>
            </div>
        `;
    return;
  }

  $("roleResults").innerHTML = results
    .map((user) => {
      const isAdmin = user.role === "admin";

      return `
            <div class="search-result">
                <div class="member-avatar">
                    ${escapeHTML(user.name?.charAt(0)?.toUpperCase() || "?")}
                </div>

                <div class="result-info">
                    <strong>${escapeHTML(user.name)}</strong>
                    <span>${escapeHTML(user.email)}</span>
                </div>

                <div class="result-actions">
                    ${
                      isAdmin
                        ? `
                            <button
                                class="role-action demote-btn"
                                data-user-id="${escapeHTML(user.id)}"
                                data-next-role="user">
                                Demote to user
                            </button>
                        `
                        : `
                            <button
                                class="role-action promote-btn"
                                data-user-id="${escapeHTML(user.id)}"
                                data-next-role="admin">
                                Promote to admin
                            </button>
                        `
                    }
                </div>
            </div>
        `;
    })
    .join("");
}

// =====================================
// CONFIRMATION MODAL
// =====================================

function openRoleModal(userId, role) {
  const user = users.find((item) => String(item.id) === String(userId));

  if (!user) return;

  selectedUser = {
    id: user.id,
    role: role,
  };

  const isPromoting = role === "admin";

  $("modalSymbol").textContent = isPromoting ? "✦" : "↓";
  $("modalTitle").textContent = isPromoting
    ? "Promote member?"
    : "Demote administrator?";

  $("modalMessage").textContent = isPromoting
    ? `Are you sure you want to promote ${user.name} to administrator?`
    : `Are you sure you want to demote ${user.name} to a normal member?`;

  $("confirmRole").textContent = isPromoting ? "Yes, promote" : "Yes, demote";

  $("roleModal").classList.add("show");
}

function closeRoleModal() {
  $("roleModal").classList.remove("show");
  selectedUser = null;
}

// =====================================
// UPDATE ROLE
// =====================================

async function updateUserRole() {
  if (!isRoot || !selectedUser) return;

  const button = $("confirmRole");

  button.disabled = true;
  button.textContent = "Updating...";

  try {
    const response = await fetch("/api/update_user_role", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken":
          document.querySelector('meta[name="csrf-token"]')?.content || "",
      },
      body: JSON.stringify({
        userId: selectedUser.id,
        role: selectedUser.role,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not update role.");
    }

    closeRoleModal();
    localStorage.removeItem("users");
    showToast("Role updated successfully.");

    // Refresh server-rendered role sections and counts.
    setTimeout(() => {
      window.location.reload();
    }, 700);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Confirm";
  }
}

// =====================================
// EVENT LISTENERS
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  if (!isRoot) return;

  $("roleSearch").addEventListener("input", searchUsers);

  $("clearSearch").addEventListener("click", () => {
    $("roleSearch").value = "";
    searchUsers();
    $("roleSearch").focus();
  });

  // Event delegation: works for dynamically created buttons.
  $("roleResults").addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-id]");

    if (!button) return;

    openRoleModal(button.dataset.userId, button.dataset.nextRole);
  });

  $("confirmRole").addEventListener("click", updateUserRole);

  $("cancelRole").addEventListener("click", closeRoleModal);

  $("roleModal").addEventListener("click", (event) => {
    if (event.target.id === "roleModal") {
      closeRoleModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeRoleModal();
    }
  });
});

// app.js calls draw() after its shared USERS list has loaded.
function draw() {
  if (typeof USERS !== "undefined" && Array.isArray(USERS) && USERS.length) {
    users = USERS;
  }
  const roles = ["root", "admin", "user"];
  const total = document.querySelector("[data-community-total]");
  if (total) total.textContent = String(users.length);
  roles.forEach((role) => {
    const members = users
      .filter((user) => String(user.role || "user").toLowerCase() === role)
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const grid = document.querySelector(`[data-role-grid="${role}"]`);
    const count = document.querySelector(`[data-role-count="${role}"]`);
    const summary = document.querySelector(`[data-role-summary="${role}"]`);
    if (count) count.textContent = `${members.length} member(s)`;
    if (summary) summary.textContent = String(members.length);
    if (!grid) return;
    grid.innerHTML = members.length
      ? members
          .map((user) => {
            const roleClass =
              role === "root"
                ? "root-card"
                : role === "admin"
                  ? "admin-card"
                  : "";
            const badgeClass =
              role === "root"
                ? "root-badge"
                : role === "admin"
                  ? "admin-badge"
                  : "user-badge";
            const label =
              role === "root" ? "ROOT" : role === "admin" ? "ADMIN" : "MEMBER";
            const first = String(user.name || "?")
              .trim()
              .charAt(0)
              .toUpperCase();
            const self = String(user.id) === currentUserId ? "is-self" : "";
            return `<article class="member-card ${roleClass} ${self}">
        <div class="member-avatar">${escapeHTML(first)}</div>
        <div class="member-details"><strong>${escapeHTML(user.name || "Unknown member")}</strong>
          <span>${escapeHTML(user.email || "")}</span></div>
        <span class="role-badge ${badgeClass}">${label}</span>
      </article>`;
          })
          .join("")
      : `<p class="empty-section">${role === "root" ? "No root account found." : role === "admin" ? "No administrators yet." : "No members yet."}</p>`;
  });
}

document.addEventListener("DOMContentLoaded", draw);
