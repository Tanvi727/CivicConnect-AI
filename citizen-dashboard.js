document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // ==========================================
    // 1. GET DATA FROM LOCAL STORAGE
    // ==========================================

    function getStoredData(key, fallback) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (error) {
            console.error("Error reading " + key, error);
            return fallback;
        }
    }

    function getCurrentUser() {
        const user = getStoredData("civicCurrentUser", null);

        if (user && user.email && CivicAPI.getToken()) {
            return user;
        }

        return null;
    }

    function getReports() {
        const reports = getStoredData("civicReports", []);
        return Array.isArray(reports) ? reports : [];
    }


    // ==========================================
    // 2. CHECK LOGIN
    // ==========================================

    const user = getCurrentUser();

    if (!user) {
        sessionStorage.setItem(
            "civicReturnAfterLogin",
            "citizen-dashboard.html"
        );

        window.location.replace("login.html");
        return;
    }


    // ==========================================
    // 3. DISPLAY USER INFORMATION
    // ==========================================

    const welcomeMessage = document.getElementById("cdWelcomeName");
    const dashboardUserName = document.getElementById("dashboardUserName");
    const dashboardUserEmail = document.getElementById("dashboardUserEmail");
    const dashboardUserPhone = document.getElementById("dashboardUserPhone");

    const name = user.name || user.fullName || "Citizen";

    if (welcomeMessage) {
        welcomeMessage.textContent = "Welcome back, " + name + "!";
    }

    if (dashboardUserName) {
        dashboardUserName.textContent = name;
    }

    if (dashboardUserEmail) {
        dashboardUserEmail.textContent = user.email || "Not available";
    }

    if (dashboardUserPhone) {
        dashboardUserPhone.textContent =
            user.mobile || user.phone || "Not provided";
    }


    // ==========================================
    // 4. GET CURRENT USER'S REPORTS
    // ==========================================

    let loadedReports = [];

    function getMyReports() {
        return loadedReports;
    }


    // ==========================================
    // 5. UPDATE REPORT STATISTICS
    // ==========================================

    function updateStatistics() {
        const reports = getMyReports();

        const totalReports = document.getElementById("cdTotalReports");
        const underReviewReports =
            document.getElementById("cdReviewReports");
        const inProgressReports =
            document.getElementById("cdProgressReports");
        const resolvedReports =
            document.getElementById("cdResolvedReports");

        let underReview = 0;
        let inProgress = 0;
        let resolved = 0;

        reports.forEach(function (report) {
            const status = String(report.status || "")
                .trim()
                .toLowerCase();

            if (
                status === "under review" ||
                status === "submitted" ||
                status === "pending"
            ) {
                underReview++;
            } else if (
                status === "in progress" ||
                status === "in-progress"
            ) {
                inProgress++;
            } else if (
                status === "resolved" ||
                status === "completed"
            ) {
                resolved++;
            }
        });

        if (totalReports) totalReports.textContent = reports.length;

        if (underReviewReports) {
            underReviewReports.textContent = underReview;
        }

        if (inProgressReports) {
            inProgressReports.textContent = inProgress;
        }

        if (resolvedReports) {
            resolvedReports.textContent = resolved;
        }
    }


    // ==========================================
    // 6. DISPLAY RECENT REPORTS
    // ==========================================

    function displayRecentReports() {
        const recentReportsContainer =
            document.getElementById("cdRecentReports");

        if (!recentReportsContainer) return;

        const reports = getMyReports();

        recentReportsContainer.replaceChildren();

        if (reports.length === 0) {
            const message = document.createElement("div");
            message.className = "cd-empty-state";
            message.textContent =
                "You haven't submitted any reports yet.";

            recentReportsContainer.appendChild(message);
            return;
        }

        const recentReports = reports.slice().sort(function (a, b) {
            return new Date(b.submittedAt || 0) -
                new Date(a.submittedAt || 0);
        }).slice(0, 5);

        recentReports.forEach(function (report) {
            const item = document.createElement("div");
            item.className = "cd-report-item";

            const icon = document.createElement("span");
            icon.className = "cd-report-icon";
            icon.textContent = "📍";

            const info = document.createElement("div");
            info.className = "cd-report-info";

            const title = document.createElement("h3");
            title.textContent =
                report.title || report.category || "Civic Issue";

            const category = document.createElement("p");
            category.textContent = report.category || "Not specified";

            const meta = document.createElement("small");
            meta.textContent =
                (report.id || "") +
                (report.submittedAt
                    ? " · " + new Date(report.submittedAt)
                        .toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                        })
                    : "");

            info.appendChild(title);
            info.appendChild(category);
            info.appendChild(meta);

            const statusText = report.status || "Submitted";
            const statusKey = statusText.trim().toLowerCase();

            const badge = document.createElement("span");
            badge.className = "cd-status";

            if (statusKey === "in progress") {
                badge.classList.add("progress");
            } else if (statusKey === "resolved") {
                badge.classList.add("resolved");
            } else if (statusKey === "submitted") {
                badge.classList.add("submitted");
            }

            badge.textContent = statusText;

            item.appendChild(icon);
            item.appendChild(info);
            item.appendChild(badge);

            recentReportsContainer.appendChild(item);
        });
    }

// ==========================================
// LOGOUT BUTTON
// ==========================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", function (event) {
        event.preventDefault();

        CivicAPI.clearSession();

        window.location.href = "index.html";
    });
}


    // ==========================================
    // 8. INITIALIZE DASHBOARD
    // ==========================================

    const recentBox = document.getElementById("cdRecentReports");

    if (recentBox) {
        recentBox.textContent = "Loading your reports...";
    }

    CivicAPI.myReports().then(function (result) {
        loadedReports = result.items;
        updateStatistics();
        displayRecentReports();
    }).catch(function (error) {
        if (error.sessionExpired) {
            window.location.replace("login.html");
            return;
        }

        if (recentBox) recentBox.textContent = error.message;
    });

    // Keep the saved profile current (phone number, birth date, etc.).
    CivicAPI.me().then(function (fresh) {
        if (dashboardUserPhone) {
            dashboardUserPhone.textContent = fresh.mobile || "Not provided";
        }

        if (dashboardUserName) dashboardUserName.textContent = fresh.name;

        if (welcomeMessage) {
            welcomeMessage.textContent = "Welcome back, " + fresh.name + "!";
        }
    }).catch(function () { /* the reports call handles expired logins */ });

});
