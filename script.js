const accordionButtons = document.querySelectorAll(".accordion-item");

accordionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const panel = button.nextElementSibling;
    const isOpen = button.getAttribute("aria-expanded") === "true";

    button.setAttribute("aria-expanded", String(!isOpen));
    button.querySelector("small").textContent = isOpen ? "+" : "-";
    panel.classList.toggle("open", !isOpen);
  });
});
