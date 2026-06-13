const currentPage = window.location.pathname.split("/").pop() || "index.html";
const sidebarLinks = document.querySelectorAll(".sidebar a");

sidebarLinks.forEach(link => {
    const linkPage = link.getAttribute("href");
    const item = link.closest("li");

    if (!item) {
        return;
    }

    item.classList.toggle("active", linkPage == currentPage);
});
