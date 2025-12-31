// nav.js
document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  const header = document.querySelector(".site-header");

  if (!navToggle || !nav) return;

  const openMenu = () => {
    navToggle.classList.add("open");
    nav.classList.add("nav-open");
    navToggle.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    navToggle.classList.remove("open");
    nav.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    const isOpen = nav.classList.contains("nav-open");
    isOpen ? closeMenu() : openMenu();
  };

  navToggle.setAttribute("aria-expanded", "false");

  navToggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  // 点击菜单链接后收起
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => closeMenu());
  });

  // 点空白处关闭
  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("nav-open")) return;
    const clickedInsideNav = nav.contains(e.target);
    const clickedToggle = navToggle.contains(e.target);
    const clickedHeader = header ? header.contains(e.target) : false;

    // header 里但不在 nav/toggle 也算“外部点击”，关掉
    if (!clickedInsideNav && !clickedToggle && clickedHeader) closeMenu();
    if (!clickedInsideNav && !clickedToggle && !clickedHeader) closeMenu();
  });

  // ESC 关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // 窗口变大（桌面端）强制清状态
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMenu();
  });
});
