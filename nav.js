// nav.js
document.addEventListener("DOMContentLoaded", () => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");

  if (!navToggle || !nav) return;

  function setOpen(isOpen) {
    nav.classList.toggle("nav-open", isOpen);
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", String(isOpen));
  }

  navToggle.addEventListener("click", (e) => {
    e.preventDefault();
    setOpen(!nav.classList.contains("nav-open"));
  });

  // 点击菜单链接后收起（移动端）
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("nav-open")) return;
    if (nav.contains(e.target) || navToggle.contains(e.target)) return;
    setOpen(false);
  });
});
