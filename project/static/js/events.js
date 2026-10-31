let filter = "all",
  invited = []; // invited = array of user ids

// filters
function draw() {
  const q = $("q").value.toLowerCase().trim();

  document.querySelectorAll(".event-card").forEach((e) => {
    const name = (e.dataset.name || "").toLowerCase();
    const status = e.dataset.status;

    const matchesSearch = name.includes(q);
    const matchesFilter = filter === "all" || status === filter;

    e.classList.toggle("hide", !(matchesSearch && matchesFilter));
  });
}
// colors the selected btn
function setFilter(btn) {
  document
    .querySelectorAll("[data-f]")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  filter = btn.dataset.f;
  draw();
}

/* ---------- create event popup ---------- */
function openCreate() {
  invited = [];
  drawChips();
  preview();
  const today = new Date().toISOString().split("T")[0];

  $("evStartDate").value = today;
  $("evEndDate").value = today;
  openModal("createModal");
  $("createModal").querySelector(".create-event-fields").scrollTop = 0;
}

/* BACKEND TODO #2: search users by gmail while typing
   GET /api/users/search?email=<text>   -> [{ id, name, email }]  (max ~5, leave out banned users)
   For now we filter the demo USERS array. */
async function searchUsers() {
  const t = $("inviteSearch");
  let searchValue = t.value.trim().toLowerCase();
  const box = $("suggest");
  if (!searchValue) {
    box.classList.add("hide");
    return;
  }
  const response = await fetch("/api/searched_users", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: searchValue }),
  });
  if (response.ok) {
    let data = await response.json();
    box.classList.remove("hide");
    box.innerHTML = data.length
      ? data
          .map(
            (u) =>
              `<div class="item" onclick="invite('${u.id}')">${avatar(u, "sm")}<div><b>${esc(u.name)}</b><div class="muted small">${esc(u.email)}</div></div></div>`,
          )
          .join("")
      : '<div class="item muted">No registered user with that Gmail</div>';
  } else {
    toast("Something seems wrong!");
  }
}
function invite(id) {
  id = String(id);

  if (!invited.some((invitedId) => String(invitedId) === id)) {
    invited.push(id);
  }

  $("inviteSearch").value = "";
  $("suggest").classList.add("hide");

  drawChips();
  preview();
}
function uninvite(id) {
  invited = invited.filter((x) => x !== id);
  drawChips();
  preview();
}
function drawChips() {
  $("invitedChips").innerHTML = invited
    .map(
      (id) =>
        `<span class="chip active">${esc(userById(id).email)} <span class="x" onclick="uninvite('${id}')">×</span></span>`,
    )
    .join("");
}
function preview() {
  // live "each person pays" box
  const n = invited.length + 1,
    total = Number($("evTotal").value) || 0;
  $("pvMembers").textContent = n;
  $("pvShare").textContent = money(total / n);
}

async function submitEvent() {
  console.log("Create event clicked!");
  const name = $("evTitle").value.trim();
  if (!name) {
    toast("Please type an event name");
    // toast() displays a small temporary notification on the screen to give the user feedback. It usually disappears automatically after a few seconds.
    return;
  }
  const start_at = $("evStartDate").value;
  const end_at = $("evEndDate").value;

  if (!start_at || !end_at) {
    toast("Please select both dates");
    return;
  }
  if (end_at < start_at) {
    toast("Ending date cannot be before starting date");
    return;
  }
  const ev = {
    name,
    category: $("evCat").value,
    start_at,
    end_at,
    created_by_id: currentUser.id,
    expense: Number($("evTotal").value) || 0,
    budget: Number($("evBudget").value) || 0,
    crews: [currentUser.id, ...invited].map((id) => ({
      userId: id,
    })),
    activity: {
      message: currentUser.name.split(" ")[0] + " created the event",
    },
  };
  /* BACKEND TODO #3:  POST /api/events
     body: { title, emoji, category, date, total, budget, invitedUserIds: [...] }
     Server should: save the event, add me as owner+member, and create an INVITE for each invited user
     (they appear in that user's "Invitations" box on the dashboard). Return the new event. */

  const response = await fetch("/create_event", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(ev),
  });
  if (response.ok) {
    toast("Event created 🎉");
    window.location.href = ROUTES.events;
  } else {
    toast("Something seems wrong!");
  }
  closeModal("createModal");
}

// IDs of users selected for the event.
const friendSelection = new Set();

// Open the friend popup.
function openFriendModal() {
  renderFriends();
  $("friendSearch").value = "";
  $("friendModal").classList.add("open");
}

// Close the friend popup.
function closeFriendModal() {
  $("friendModal").classList.remove("open");
}

// Render the available friends.
async function renderFriends(query = "") {
  const list = $("friendList");
  const search = query.toLowerCase().trim();
  const response = await fetch("/api/friends");
  if (!response.ok) {
    list.innerHTML = '<div class="empty">Could not load friends.</div>';
    return;
  }
  const FRIENDS = await response.json();
  // Exclude yourself and users already invited.
  const friends = FRIENDS.filter(
    (user) =>
      !invited.some((id) => String(id) === String(user.id)) &&
      `${user.name} ${user.email}`.toLowerCase().includes(search),
  );

  if (!friends.length) {
    list.innerHTML = '<div class="empty">No friends found.</div>';
    updateFriendCount();
    return;
  }

  list.innerHTML = friends
    .map(
      (user) => `
        <label class="friend-option">
          <input
            type="checkbox"
            value="${user.id}"
            ${friendSelection.has(String(user.id)) ? "checked" : ""}
            onchange="toggleFriendSelection(this)"
          />

          <div class="friend-avatar">
            ${esc(user.name.slice(0, 1).toUpperCase())}
          </div>

          <div class="grow">
            <b>${esc(user.name)}</b>
            <div class="muted small">${esc(user.email)}</div>
          </div>
        </label>
      `,
    )
    .join("");

  updateFriendCount();
}

// Search the friend list.
function filterFriends() {
  renderFriends($("friendSearch").value);
}

// Select or deselect a friend.
function toggleFriendSelection(checkbox) {
  const id = String(checkbox.value);

  if (checkbox.checked) {
    friendSelection.add(id);
  } else {
    friendSelection.delete(id);
  }

  updateFriendCount();
}

// Update the selected count.
function updateFriendCount() {
  $("friendSelectedCount").textContent = friendSelection.size;
}

// Add selected friends to the existing invitation list.
function confirmFriends() {
  friendSelection.forEach((id) => {
    const user = userById(id);

    if (user && !invited.some((id) => String(id) === String(user.id))) {
      invited.push(user.id);
    }
  });

  friendSelection.clear();

  // Refresh the existing invitation chips.
  renderInvited();

  closeFriendModal();

  // Update your existing member count and expense preview.
  preview();
}

draw();
if (new URLSearchParams(location.search).get("new")) openCreate(); // the dashboard "New event" button
