/* Crewly event page interactions.
   This file only handles UI behavior. It does not change data or call an API. */
(() => {
  const page = document.getElementById("eventPage");
  if (!page) return;

  const tabs = [...page.querySelectorAll("[data-tab]")];
  const panels = [...page.querySelectorAll("[data-panel]")];
  const toast = document.getElementById("event-toast");
  const EVENT_ID = page.dataset.eventId;
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function activateTab(name) {
    const target = panels.find((panel) => panel.dataset.panel === name);
    if (!target) return;

    tabs.forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1; // tab can reach that btn if 0;
    });
    panels.forEach((panel) => {
      const active = panel === target;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    try {
      history.replaceState(null, "", `#${name}`);
    } catch (_) {}
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      tabs[next].focus();
      activateTab(tabs[next].dataset.tab);
    });
  });

  document.querySelectorAll("[data-go-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.goTab));
  });

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    // Prevents the main page from scrolling while the modal is open.
    document.body.style.overflow = "hidden";
    const focusable = modal.querySelector("input, select, textarea, button");
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector(".event-modal-backdrop:not([hidden])")) {
      document.body.style.overflow = "";
    }
  }

  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.openModal;
      openModal(id);
      if (id === "responsibility-modal" && button.dataset.memberId) {
        const select = document.getElementById("responsibility-member");
        if (select) select.value = button.dataset.memberId;
        const title = document.getElementById("responsibility-title");
        if (title)
          title.textContent = `Plan for ${button.dataset.memberName || "crew member"}`;
      }
      if (id === "budget-modal" && button.dataset.memberId) {
        const memberId = document.getElementById("budget-member-id");
        const memberName = document.getElementById("budget-member-name");
        const amount = document.getElementById("member-budget-amount");
        if (memberId) memberId.value = button.dataset.memberId;
        if (memberName)
          memberName.textContent = button.dataset.memberName || "this member";
        if (amount) amount.value = button.dataset.memberBudget || "0";
      }
      if (id === "crew-expense-modal" && button.dataset.memberId) {
        const memberId = document.getElementById("crew-expense-member-id");
        const memberName = document.getElementById("crew-expense-member-name");
        if (memberId) {
          memberId.value = button.dataset.memberId;
        }
        if (memberName)
          memberName.textContent = button.dataset.memberName || "this member";
      }
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () =>
      closeModal(button.closest(".event-modal-backdrop")),
    );
  });

  document.querySelectorAll(".event-modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document
      .querySelectorAll(".event-modal-backdrop:not([hidden])")
      .forEach(closeModal);
  });

  /*
   * Practice puzzle: these forms are deliberately frontend-only.
   * Implement Flask routes, permission checks, validation, and commits yourself.
   */
  document.querySelectorAll("form[data-integration]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const feature = form.dataset.integration;

      if (feature === "responsibility") {
        let crew_id = document.getElementById("responsibility-member").value;
        let title = document.getElementById("responsibility-text").value;
        let description = document.getElementById(
          "responsibility-description",
        ).value;
        let status = document.getElementById("responsibility-status").value;
        let event_id = EVENT_ID;
        const response = await fetch("/create_responsibility", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            crew_id,
            status,
            description,
            event_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "invite") {
        const email = document.getElementById("invite-user-email").value;

        if (email) {
          const response = await fetch("/create_invitation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, eventId: EVENT_ID }),
          });

          const data = await response.json();

          if (!response.ok) {
            showToast(data.message);
            return;
          }

          showToast(data.message);
        }
      } else if (feature == "spending") {
        let name = document.getElementById("spending-name").value;
        let cost = document.getElementById("spending-cost").value;
        let description = document.getElementById("spending-description").value;
        let event_id = EVENT_ID;
        const response = await fetch("/create_spending", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, cost, description, event_id }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "product") {
        let name = document.getElementById("product-name").value;
        let price = document.getElementById("product-price").value;
        let quantity = document.getElementById("product-quantity").value;
        let category = document.getElementById("product-category").value;
        let event_id = EVENT_ID;
        const response = await fetch("/create_product", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, price, quantity, category, event_id }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "payment") {
        let amount = document.getElementById("payment-amount").value;
        let status = document.getElementById("payment-status").value;
        let sender_id = document.getElementById("payment-sender").value;
        let receiver_id = document.getElementById("payment-receiver").value;
        let event_id = EVENT_ID;
        const response = await fetch("/create_payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            status,
            sender_id,
            receiver_id,
            event_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "comment") {
        let event_id = EVENT_ID;
        let message = document.getElementById("event-comment").value;
        const response = await fetch("/create_comment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            event_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "member-budget") {
        let crew_id = document.getElementById("budget-member-id").value;
        let budget = document.getElementById("member-budget-amount").value;
        let event_id = EVENT_ID;
        const response = await fetch("/create_budget", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            crew_id,
            budget,
            event_id,
            action: document.getElementById("budget-action").value,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "crew-expense") {
        let name = document.getElementById("crew-expense-name").value;
        let cost = document.getElementById("crew-expense-cost").value;
        let type = document.getElementById("crew-expense-type").value;
        let crew_id = document.getElementById("crew-expense-member-id").value;
        const response = await fetch("/create_expense", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            cost,
            type,
            crew_id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "my-expense") {
        let name = document.getElementById("my-expense-name").value;
        let cost = document.getElementById("my-expense-cost").value;
        let type = document.getElementById("my-expense-type").value;
        let eventId = EVENT_ID;
        const response = await fetch("/create_my_expense", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            cost,
            type,
            event_id: eventId,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          showToast(data.message);
          return;
        }
        window.location.reload();
      } else if (feature == "role-change") {
      } else {
        const messages = {
          invite:
            "Frontend ready — connect this form to your invitation route.",
          spending:
            "Frontend ready — connect this form to your Spending route.",
          product:
            "Frontend ready — connect this form to your Product route. Owner and treasurer permissions must be checked on the server.",
          payment: "Frontend ready — connect this form to your Payment route.",
          "member-budget":
            "Budget form ready — update Crew.budget in a protected Flask route.",
          "crew-expense":
            "Expense form ready — find the target Crew row and create Person_Spending.",
          "my-expense":
            "Expense form ready — use current_user to find their Crew row and create Person_Spending.",
          "role-change":
            "Role selector ready — validate the role and update the member's Crew.role in a protected Flask route.",
          comment: "Frontend ready — connect this form to your Comment route.",
          "event-update":
            "Frontend ready — connect this form to your event update route.",
          "transfer-ownership":
            "Frontend ready — connect this form to your ownership-transfer flow.",
        };
        showToast(
          messages[feature] || "Frontend only — backend connection needed.",
        );
      }

      const modal = form.closest(".event-modal-backdrop");
      if (modal) closeModal(modal);
      if (feature !== "responsibility" && feature !== "role-change")
        form.reset();
    });
  });

  const hash = window.location.hash.replace("#", "");
  if (hash && panels.some((panel) => panel.dataset.panel === hash)) {
    activateTab(hash);
  } else {
    activateTab("overview");
  }
})();
