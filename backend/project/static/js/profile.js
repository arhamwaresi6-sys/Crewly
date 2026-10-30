function toggleProfileEdit(editing) {
  document.getElementById("profileView").classList.toggle("hide", editing);
  document.getElementById("profileEdit").classList.toggle("hide", !editing);

  if (editing) {
    document.getElementById("name").focus();
  }
}
