// nav.js (FINAL)
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (!btn || !nav) return;

  const openMenu = () => {
    nav.classList.add("nav-open");
    btn.classList.add("open");
    btn.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    nav.classList.remove("nav-open");
    btn.classList.remove("open");
    btn.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    if (nav.classList.contains("nav-open")) closeMenu();
    else openMenu();
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  // 点击菜单链接后收起
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => closeMenu());
  });

  // 点击页面空白处收起
  document.addEventListener("click", (e) => {
    if (!nav.classList.contains("nav-open")) return;
    const inNav = nav.contains(e.target);
    const inBtn = btn.contains(e.target);
    if (!inNav && !inBtn) closeMenu();
  });

  // 窗口变大（回到桌面）自动清状态
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeMenu();
  });
});
