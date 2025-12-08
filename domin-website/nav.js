// nav.js
document.addEventListener('DOMContentLoaded', function () {
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  if (!navToggle || !nav) return; // 安全兜底

  // 点击汉堡按钮：打开 / 关闭菜单
  navToggle.addEventListener('click', function () {
    nav.classList.toggle('nav-open');
    navToggle.classList.toggle('is-open');
  });

  // 点击菜单里的链接后自动收起菜单
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      navToggle.classList.remove('is-open');
    });
  });
});
