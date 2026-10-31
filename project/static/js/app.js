// Shared by  almost  all  pages
const CURRENCY = "৳";
const $ = (id) => document.getElementById(id); //selects by id
const eventUrl = (id) => ROUTES.event.replace("__ID__", id); // -> /events/1

// Demo browsing uses the seeded account; Flask still treats guests as signed out.
const DEMO_USER = {
  id: 60001,
  name: "Rahim Ahmed",
  email: "rahim.ahmed@example.com",
  role: "user",
  status: "active",
  joined: "2026-10-23",
  count_event: 3,
};
const isDemoUser = window.CURRENT_USER == null;
const currentUser = window.CURRENT_USER || DEMO_USER;

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) || d;
  } catch (e) {
    return d;
  }
};

let USERS = load("users", []);
let NOTIFICATIONS = load("notifications", []);

// loads users if it doesnt exist inside localStorage
async function loadUsers() {
  if (USERS.length > 0) {
    return; // Use cached users
  }

  const response = await fetch("/api/users");

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  USERS = await response.json();

  localStorage.setItem("users", JSON.stringify(USERS));
}
async function loadNotifications(refresh = false) {
  if (!refresh && NOTIFICATIONS.length > 0) {
    return; // Use cached notifications
  }

  const response = await fetch("/api/notifications");

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  NOTIFICATIONS = await response.json();

  localStorage.setItem("notifications", JSON.stringify(NOTIFICATIONS));
}

const slot = $("demo-slot");
if (slot) slot.textContent = currentUser.name.split(" ")[0];
/* =====================================================
   2) HELPERS
   ===================================================== */
const money = (n) =>
  (n < 0 ? "-" : "") +
  CURRENCY +
  Math.abs(Number(Number(n).toFixed(2))).toLocaleString("en-US");
//20000 -> 20,000
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const userById = (id) => USERS.find((u) => String(u.id) === String(id));
const initials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const COLORS = [
  "#c9b6ff",
  "#bfe3ff",
  "#fff0a8",
  "#ffc9e3",
  "#bff0d8",
  "#ffd3b8",
  "#d5c5ff",
  "#a9ddff",
]; // pastel avatars
const avatar = (u, cls = "") =>
  `<div class="avatar ${cls}" style="--c:${COLORS[(u.id || 0) % COLORS.length]}">${initials(u.name)}</div>`;

const isStaff = () => currentUser.role !== "user";

/* Hide the full email from normal users (privacy). Staff and the person themself see it. */
function showEmail(u) {
  if (isStaff() || u.id === currentUser.id) return u.email;
  const [a, b] = u.email.split("@");
  return a[0] + "•••@" + b;
}

/* money maths used on the dashboard + event pages */
const shareOf = (ev) => ev.expense / ev.crews.length; // equal split
const extraOf = (m) => m.adjustments.reduce((s, a) => s + a.amount, 0); // my + / - changes
const finalOf = (ev, m) => shareOf(ev) + extraOf(m); // what I pay
const myMember = (ev) => ev.members.find((m) => m.userId === currentUser.id);

function requireRole(roles) {
  if (!roles.includes(currentUser.role)) {
    document.querySelector(".main").innerHTML =
      `<div class="card empty"><div style="font-size:2.6rem">🔒</div><h2>No access</h2><p>This page is only for admins.</p><a class="btn btn-primary mt" href="${ROUTES.dashboard}">Go to dashboard</a></div>`;
    return false;
  }
  return true;
}

/* =====================================================
   3) NAVBAR BITS  (the navbar HTML itself is in templates/_app_nav.html)
   Fills the demo dropdown, avatar and notifications, and shows the Admin link to staff.
   ===================================================== */
function toggleBell() {
  const bell = $("bell");
  const button = document.querySelector(".bell-wrap > .icon-btn");
  const opening = bell.classList.contains("hide");
  bell.classList.toggle("hide", !opening);
  button?.setAttribute("aria-expanded", String(opening));
  if (opening) {
    loadNotifications(true)
      .then(renderBell)
      .catch((error) => {
        console.error("Failed to refresh notifications:", error);
        toast("Could not refresh notifications.");
      });
  }
}
document.addEventListener("click", (e) => {
  // click outside = close bell
  const bell = $("bell");
  if (
    bell &&
    !bell.classList.contains("hide") &&
    !e.target.closest(".bell-wrap")
  ) {
    bell.classList.add("hide");
    document
      .querySelector(".bell-wrap > .icon-btn")
      ?.setAttribute("aria-expanded", "false");
  }
});

function renderBell() {
  const bell = $("bell");
  if (!bell) return;
  bell.innerHTML =
    '<b class="dd-title">Notifications</b>' +
    (NOTIFICATIONS.length
      ? NOTIFICATIONS.slice(0, 3)
          .map(
            (notification) =>
              `<a class="note" href="${ROUTES.notifications}#notification-${encodeURIComponent(notification.id)}">${esc(notification.message)}</a>`,
          )
          .join("")
      : '<p class="notification-popup-empty">You’re all caught up.</p>') +
    `<a class="notification-all-link" href="${ROUTES.notifications}">See all notifications</a>`;
}

function initShell() {
  const av = $("nav-avatar");
  if (av) av.innerHTML = avatar(currentUser);
  renderBell();
  const notificationList = $("notification-list");
  if (notificationList) {
    notificationList.innerHTML = NOTIFICATIONS.length
      ? NOTIFICATIONS.map((notification) => {
          const date = notification.created_at
            ? new Date(notification.created_at)
            : null;
          const dateText =
            date && !Number.isNaN(date.getTime())
              ? date.toLocaleString()
              : "";
          return `
            <article class="notification-item" id="notification-${encodeURIComponent(notification.id)}">
              <span class="material-symbols-rounded notification-icon" aria-hidden="true">notifications</span>
              <div class="notification-copy">
                <p>${esc(notification.message)}</p>
                ${dateText ? `<time>${esc(dateText)}</time>` : ""}
              </div>
            </article>
          `;
        }).join("")
      : '<div class="notification-empty"><span class="material-symbols-rounded" aria-hidden="true">notifications_none</span><h2>You\'re all caught up</h2><p>New updates will show up here.</p></div>';
    const selectedNotification = document.getElementById(
      window.location.hash.slice(1),
    );
    if (selectedNotification) {
      selectedNotification.scrollIntoView({ block: "center" });
    }
  }
  /* BACKEND: you can also render the Admin link with Jinja:  {% if current_user.role != 'user' %} */
  if (isStaff())
    document
      .querySelectorAll(".staff-only")
      .forEach((el) => el.classList.remove("hide"));
}

/* =====================================================
   4) MODAL + TOAST
   ===================================================== */
const openModal = (id) => $(id).classList.add("open");
const closeModal = (id) => $(id).classList.remove("open");
document.addEventListener("click", (e) => {
  // click the dark area = close
  if (e.target.classList.contains("modal-backdrop"))
    e.target.classList.remove("open");
});

function toast(msg) {
  let t = $("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    t.setAttribute("role", "status");
    t.setAttribute("aria-live", "polite");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2400);
}

/* =====================================================
   5) CARTOON LETTER TILES (landing page title)
   <span data-tiles="SPLIT" data-style="navy"> becomes one chunky tile per letter.
   ===================================================== */
function makeTiles() {
  const GRAD = [
    "#8e4fc0",
    "#7a5ccb",
    "#6870d2",
    "#5a84da",
    "#4f98e2",
    "#55b2ea",
    "#5cc3f0",
  ]; // purple -> cyan
  let tileSequence = 0;
  document.querySelectorAll("[data-tiles]").forEach((line, li) => {
    const letters = [...line.dataset.tiles];
    line.innerHTML = "";
    letters.forEach((ch, i) => {
      const t = document.createElement("span");
      t.className = "tile";
      t.textContent = ch;
      t.setAttribute("aria-hidden", "true");
      const tileIndex = tileSequence++;
      const scatterAngle = tileIndex * 2.4 + li * 0.8;
      const scatterDistance = 24 + ((tileIndex * 17) % 3) * 8;
      t.style.setProperty("--r", ((i * 7 + li * 3) % 9) - 4 + "deg");
      t.style.setProperty("--i", tileIndex);
      t.style.setProperty(
        "--scatter-x",
        `${Math.round(Math.cos(scatterAngle) * scatterDistance)}px`,
      );
      t.style.setProperty(
        "--scatter-y",
        `${Math.round(Math.sin(scatterAngle) * scatterDistance)}px`,
      );
      t.style.setProperty(
        "--scatter-r",
        `${((tileIndex * 37 + 19) % 65) - 32}deg`,
      );
      if (line.dataset.style === "grad")
        t.style.background =
          GRAD[
            Math.round(
              (i / Math.max(1, letters.length - 1)) * (GRAD.length - 1),
            )
          ];
      line.appendChild(t);
    });
  });
}
// alert pop up
function showAlert(message, type = "info", title = "") {
  // Create the popup only once.
  let backdrop = document.getElementById("alert-backdrop");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "alert-backdrop";
    backdrop.className = "alert-backdrop";

    backdrop.innerHTML = `
      <div class="alert-box" role="alertdialog"
           aria-modal="true" aria-labelledby="alert-title"
           aria-describedby="alert-message">
        <div class="alert-icon" id="alert-icon"></div>
        <h2 id="alert-title"></h2>
        <p id="alert-message"></p>
        <button class="btn btn-primary alert-action"
                id="alert-ok">Got it!</button>
      </div>
    `;

    document.body.appendChild(backdrop);
  }

  const icons = {
    success: "🎉",
    error: "😵",
    warning: "⚠️",
    info: "💬",
  };

  const titles = {
    success: "All good!",
    error: "Oops!",
    warning: "Hold on!",
    info: "Heads up!",
  };

  const box = backdrop.querySelector(".alert-box");

  box.className = `alert-box ${icons[type] ? type : "info"}`;

  backdrop.querySelector("#alert-icon").textContent = icons[type] || icons.info;

  backdrop.querySelector("#alert-title").textContent =
    title || titles[type] || titles.info;

  backdrop.querySelector("#alert-message").textContent = message;

  backdrop.classList.add("show");

  const closeButton = backdrop.querySelector("#alert-ok");

  // Replace the old listener so repeated alerts work correctly.
  closeButton.onclick = () => backdrop.classList.remove("show");

  // Close when clicking outside the popup.
  backdrop.onclick = (event) => {
    if (event.target === backdrop) {
      backdrop.classList.remove("show");
    }
  };

  // Close with Escape.
  backdrop.onkeydown = (event) => {
    if (event.key === "Escape") {
      backdrop.classList.remove("show");
    }
  };

  closeButton.focus();
}

async function init() {
  try {
    const cachedUsers = localStorage.getItem("users");
    const cachedNotifications = localStorage.getItem("notifications");
    if (cachedUsers === null) {
      await loadUsers();
    }
    if ($("notification-list")) {
      await loadNotifications(true);
    } else if (cachedNotifications === null) {
      await loadNotifications();
    }

    initShell();

    if (typeof draw === "function") {
      draw();
    }
  } catch (error) {
    console.error("Failed to initialize the app:", error);
  }
}
makeTiles();
init();
