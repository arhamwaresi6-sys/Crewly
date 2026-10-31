/* users.js – everyone using the website

   BACKEND TODO:  GET /api/users   -> [{ id, name, email, role, status, joined, eventCount }]
   (Optional) add ?search=text so the server does the filtering.
   Privacy tip: only send the full email to admins; normal users get a masked one (showEmail() in app.js). */
function draw() {
  $("count").textContent = USERS.length + " people are using Crewly";
  $("list").innerHTML =
    USERS.map((u) => {
      const n = u.count_event; // BACKEND: eventCount
      return `<div class="card" data-name="${u.name}" data-email="${u.email}">
      <div class="row">${avatar(u)}<div style="flex:1;min-width:0"><b>${esc(u.name)}${u.id === currentUser.id ? ' <span class="badge b-green">You</span>' : ""}</b>
        <div class="muted small" style="overflow:hidden;text-overflow:ellipsis">${esc(showEmail(u))}</div></div></div>
      <div class="row between dash-top">
        <span class="badge ${u.role === "root" ? "b-warn" : u.role === "admin" ? "b-green" : ""}">${u.role.toUpperCase()}</span>
        <span class="badge ${u.status === "banned" ? "b-red" : "b-green"}">${u.status}</span>
      </div>
      <p class="muted small" style="margin-top:10px">${n} events · joined ${u.joined}</p>
    </div>`;
    }).join("") ||
    '<div class="card empty" style="grid-column:1/-1">No users found.</div>';
}
function searchUser() {
  const q = $("q").value.trim().toLowerCase();

  document.querySelectorAll("#list .card[data-name]").forEach((card) => {
    const matches =
      card.dataset.name.includes(q) || card.dataset.email.includes(q);

    card.classList.toggle("hide", !matches);
  });
}
draw();
