(function () {
  var cfg = window.SAPIENS_CAMPUS || {};
  var stats = cfg.stats || {};

  document.querySelectorAll("[data-stat]").forEach(function (node) {
    var key = node.getAttribute("data-stat");
    if (stats[key]) node.textContent = stats[key];
  });

  if (cfg.statsNote) {
    document.querySelectorAll("[data-stat-note]").forEach(function (node) {
      node.textContent = cfg.statsNote;
    });
  }

  var deck = cfg.deck;
  if (deck && deck.when && deck.students && deck.colleges) {
    var sentence = "Sponsorship deck (" + deck.when + ") listed " + deck.students +
      " students / " + deck.colleges +
      " colleges — live public home shows the higher figures above; both kept honest.";
    document.querySelectorAll("[data-deck-note]").forEach(function (node) {
      node.textContent = sentence;
    });
  }

  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".nav");
  var menu = document.getElementById("site-menu");
  if (!toggle || !nav || !menu) return;

  function setOpen(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    var label = toggle.querySelector(".sr-only");
    if (label) label.textContent = open ? "Close menu" : "Open menu";
  }

  toggle.addEventListener("click", function () {
    setOpen(!nav.classList.contains("is-open"));
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  menu.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });
})();
