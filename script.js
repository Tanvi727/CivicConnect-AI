// =====================================================
// CIVICCONNECT AI — COMPLETE SCRIPT.JS
// =====================================================


// =====================================================
// 1. LOCAL STORAGE HELPERS
// =====================================================

function getStoredJSON(key, fallback = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch (error) {
        console.error("Could not read:", key, error);
        return fallback;
    }
}

function saveJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("Could not save:", key, error);
        return false;
    }
}

function getCurrentUser() {
    const user = getStoredJSON("civicCurrentUser");

    // A saved profile only counts while a login token exists too.
    if (typeof CivicAPI !== "undefined" && !CivicAPI.getToken()) return null;

    return user && user.email ? user : null;
}

function getReports() {
    const reports = getStoredJSON("civicReports", []);
    return Array.isArray(reports) ? reports : [];
}

function showMessage(element, message, success = false) {
    if (!element) return;

    element.textContent = message;
    element.style.display = "block";
    element.style.color = success ? "#16845b" : "#d93025";
}


// =====================================================
// 2. PROTECT PAGES THAT REQUIRE LOGIN
// =====================================================

const protectedPages = [
    "report.html",
    "my-reports.html",
    "profile.html",
    "citizen-dashboard.html",
    "report-details.html",
    "thankyou.html"
];

const currentPage = window.location.pathname
    .split("/")
    .pop()
    .toLowerCase();

const currentUser = getCurrentUser();

if (protectedPages.includes(currentPage) && !currentUser) {
    sessionStorage.setItem("civicReturnAfterLogin", currentPage);
    window.location.replace("login.html");
}


// =====================================================
// 3. LOGOUT
// =====================================================

function initializeLogout() {
    const logoutButtons = document.querySelectorAll("#logoutButton");

    logoutButtons.forEach(function (button) {
        button.addEventListener("click", function (event) {
            event.preventDefault();

            if (typeof CivicAPI !== "undefined") {
                CivicAPI.clearSession();
            } else {
                localStorage.removeItem("civicCurrentUser");
                localStorage.removeItem("civicToken");
            }

            sessionStorage.removeItem("civicReturnAfterLogin");

            window.location.replace("index.html");
        });
    });
}


// =====================================================
// 4. NAVIGATION AND LOGIN LINKS
// =====================================================

function initializeNavigation() {
    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutButton = document.getElementById("logoutButton");

    const user = getCurrentUser();

    if (loginLink) {
        loginLink.style.display = user ? "none" : "inline-block";
    }

    if (registerLink) {
        registerLink.style.display = user ? "none" : "inline-block";
    }

    if (logoutButton) {
        logoutButton.style.display = user ? "inline-block" : "none";
    }

    document.querySelectorAll("a[href]").forEach(function (link) {
        const href = link.getAttribute("href");

        if (!href) return;

        const targetPage = href
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop()
            .toLowerCase();

        if (!protectedPages.includes(targetPage)) return;

        link.addEventListener("click", function (event) {
            if (!getCurrentUser()) {
                event.preventDefault();

                sessionStorage.setItem(
                    "civicReturnAfterLogin",
                    targetPage
                );

                window.location.href = "login.html";
            }
        });
    });
}


// =====================================================
// 5. REPORT ISSUE FORM
// =====================================================

function initializeReportForm() {
    const reportForm = document.getElementById("reportForm");

    if (!reportForm) return;

    const photoInput = document.getElementById("photo");
    const photoPreview = document.getElementById("photoPreview");
    const locationButton = document.getElementById("locationButton");
    const locationInput = document.getElementById("location");
    const reportMessage = document.getElementById("reportMessage");

    let photoData = "";

    // Photo validation and preview
    if (photoInput) {
        photoInput.addEventListener("change", function () {
            const file = photoInput.files[0];

            photoData = "";

            if (photoPreview) {
                photoPreview.style.display = "none";
                photoPreview.removeAttribute("src");
            }

            if (!file) return;

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (!allowedTypes.includes(file.type)) {
                showMessage(
                    reportMessage,
                    "Please upload a JPG, PNG, or WEBP image."
                );

                photoInput.value = "";
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showMessage(
                    reportMessage,
                    "Please upload an image smaller than 2 MB."
                );

                photoInput.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onload = function () {
                photoData = reader.result;

                if (photoPreview) {
                    photoPreview.src = photoData;
                    photoPreview.style.display = "block";
                }

                if (reportMessage) {
                    reportMessage.style.display = "none";
                }
            };

            reader.onerror = function () {
                showMessage(
                    reportMessage,
                    "Could not read the selected image."
                );
            };

            reader.readAsDataURL(file);
        });
    }

    // Detect location
    if (locationButton && locationInput) {
        locationButton.addEventListener("click", function () {
            if (!navigator.geolocation) {
                showMessage(
                    reportMessage,
                    "Location detection is not supported. Enter the location manually."
                );
                return;
            }

            locationButton.disabled = true;
            locationButton.textContent = "Getting location...";

            navigator.geolocation.getCurrentPosition(
                function (position) {
                    locationInput.value =
                        position.coords.latitude.toFixed(6) +
                        ", " +
                        position.coords.longitude.toFixed(6);

                    locationButton.disabled = false;
                    locationButton.textContent = "Use My Location";
                },

                function () {
                    showMessage(
                        reportMessage,
                        "Unable to get location. Please enter it manually."
                    );

                    locationButton.disabled = false;
                    locationButton.textContent = "Use My Location";
                },

                {
                    enableHighAccuracy: true,
                    timeout: 10000
                }
            );
        });
    }

    // Submit complaint
    reportForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const user = getCurrentUser();

        if (!user) {
            sessionStorage.setItem(
                "civicReturnAfterLogin",
                "report.html"
            );

            window.location.replace("login.html");
            return;
        }

        const category = document.getElementById("category");
        const title = document.getElementById("title");
        const description = document.getElementById("description");
        const additionalDetails =
            document.getElementById("additionalDetails");
        const declaration = document.getElementById("declaration");

        if (
            !category ||
            !title ||
            !description ||
            !locationInput ||
            !photoInput
        ) {
            showMessage(
                reportMessage,
                "Some form fields are missing. Please check report.html."
            );
            return;
        }

        if (
            !category.value ||
            !title.value.trim() ||
            !description.value.trim() ||
            !locationInput.value.trim()
        ) {
            showMessage(
                reportMessage,
                "Please complete all required fields."
            );
            return;
        }

        if (!photoData) {
            showMessage(
                reportMessage,
                "Please upload a photo of the issue."
            );
            return;
        }

        if (declaration && !declaration.checked) {
            showMessage(
                reportMessage,
                "Please confirm that the information is accurate."
            );
            return;
        }

        const submitButton = reportForm.querySelector("[type='submit']");

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.dataset.label = submitButton.textContent;
            submitButton.textContent = "Submitting...";
        }

        function unlock() {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = submitButton.dataset.label || "Submit Report";
            }
        }

        CivicAPI.createReport({
            category: category.value,
            title: title.value.trim(),
            description: description.value.trim(),
            location: locationInput.value.trim(),
            additionalDetails: additionalDetails
                ? additionalDetails.value.trim()
                : "",
            photo: photoData
        }).then(function (report) {
            window.location.href =
                "thankyou.html?id=" + encodeURIComponent(report.id);
        }).catch(function (error) {
            if (error.sessionExpired) {
                sessionStorage.setItem("civicReturnAfterLogin", "report.html");
                window.location.replace("login.html");
                return;
            }

            const fields = error.fields || {};
            const first = Object.keys(fields)[0];

            showMessage(reportMessage, first ? fields[first] : error.message);
            unlock();
        });
    });
}


// =====================================================
// 6. MY REPORTS PAGE
// =====================================================

function initializeMyReports() {
    const reportsContainer =
        document.getElementById("reportsContainer");

    if (!reportsContainer) return;

    const user = getCurrentUser();

    if (!user) return;

    let userReports = [];

    const totalElement = document.getElementById("totalReports");
    const reviewElement =
        document.getElementById("underReviewReports");
    const progressElement =
        document.getElementById("inProgressReports");
    const resolvedElement =
        document.getElementById("resolvedReports");
    const countText = document.getElementById("reportCountText");

    function updateStats() {
        const count = function (status) {
            return userReports.filter(function (report) {
                return report.status === status;
            }).length;
        };

        if (totalElement) totalElement.textContent = userReports.length;
        if (reviewElement) reviewElement.textContent = count("Under Review");
        if (progressElement) progressElement.textContent = count("In Progress");
        if (resolvedElement) resolvedElement.textContent = count("Resolved");
    }

    function showEmpty(text) {
        reportsContainer.replaceChildren();

        const emptyMessage = document.createElement("div");

        emptyMessage.className = "empty-state";
        emptyMessage.textContent = text;

        reportsContainer.appendChild(emptyMessage);
    }

    function addLine(card, tag, text, className) {
        const element = document.createElement(tag);

        if (className) element.className = className;

        element.textContent = text;
        card.appendChild(element);

        return element;
    }

    function renderReports(list, emptyText) {
        if (list.length === 0) {
            showEmpty(emptyText);
            return;
        }

        reportsContainer.replaceChildren();

        list.forEach(function (report) {
            const card = document.createElement("article");
            card.className = "report-card";

            if (report.photo) {
                const image = document.createElement("img");

                image.src = report.photo;
                image.alt = "Photo attached to report";
                image.className = "report-photo";
                image.loading = "lazy";

                card.appendChild(image);
            }

            addLine(card, "h3", report.title || "Untitled report");
            addLine(card, "p", "Category: " + (report.category || "Not specified"));
            addLine(card, "p", report.description || "");
            addLine(card, "p", "Location: " + (report.location || "Not specified"));
            addLine(card, "p", "Status: " + (report.status || "Submitted"), "report-status");
            addLine(card, "small", "Report ID: " + report.id);

            const submittedDate = addLine(
                card, "small",
                report.submittedAt
                    ? "Submitted: " + new Date(report.submittedAt).toLocaleString()
                    : ""
            );

            submittedDate.style.display = "block";

            const link = document.createElement("a");

            link.href = "report-details.html?id=" + encodeURIComponent(report.id);
            link.className = "view-details-link";
            link.textContent = "View details & tracking →";
            link.style.cssText =
                "display:inline-block;margin-top:10px;font-weight:600;";

            card.appendChild(link);
            reportsContainer.appendChild(card);
        });
    }

    const searchInput = document.getElementById("reportSearch");
    const statusFilter = document.getElementById("statusFilter");

    // The dropdown uses lowercase values; reports use capitalised statuses.
    const STATUS_BY_VALUE = {
        "submitted": "Submitted",
        "under review": "Under Review",
        "in progress": "In Progress",
        "resolved": "Resolved"
    };

    function applyFilters() {
        const query = searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

        const selectedStatus = statusFilter
            ? STATUS_BY_VALUE[statusFilter.value.toLowerCase()] || ""
            : "";

        const filtered = userReports.filter(function (report) {
            const matchesSearch =
                (report.title || "").toLowerCase().includes(query) ||
                (report.category || "").toLowerCase().includes(query) ||
                (report.location || "").toLowerCase().includes(query) ||
                (report.id || "").toLowerCase().includes(query);

            return matchesSearch &&
                (!selectedStatus || report.status === selectedStatus);
        });

        renderReports(
            filtered,
            userReports.length === 0
                ? "You haven't submitted any reports yet."
                : "No reports match your search."
        );

        if (countText) {
            countText.textContent = filtered.length + " report(s) found";
        }
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (statusFilter) statusFilter.addEventListener("change", applyFilters);

    showEmpty("Loading your reports...");

    CivicAPI.myReports().then(function (result) {
        userReports = result.items;
        updateStats();
        applyFilters();
    }).catch(function (error) {
        if (error.sessionExpired) {
            window.location.replace("login.html");
            return;
        }

        showEmpty(error.message);

        if (countText) countText.textContent = "";
    });
}


// =====================================================
// 7. PROFILE PAGE
// =====================================================

function initializeProfile() {
    const profileForm = document.getElementById("profileForm");

    if (!profileForm) return;

    const user = getCurrentUser();

    if (!user) return;

    const profileName = document.getElementById("profileName");
    const profileNameDetail =
        document.getElementById("profileNameDetail");
    const profileEmail = document.getElementById("profileEmail");
    const profileEmailDetail =
        document.getElementById("profileEmailDetail");
    const profileMobile = document.getElementById("profileMobile");
    const profileDOB = document.getElementById("profileDOB");
    const profileRole = document.getElementById("profileRole");
    const profileAvatar = document.getElementById("profileAvatar");

    const editName = document.getElementById("editName");
    const editMobile = document.getElementById("editMobile");
    const editDOB = document.getElementById("editDOB");
    const profileMessage = document.getElementById("profileMessage");

    function formatDate(value) {
        if (!value) return "Not provided";

        const date = new Date(value + "T00:00:00");

        if (isNaN(date.getTime())) return value;

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function updateCompleteness(person) {
        const bar = document.getElementById("profileCompleteBar");
        const text = document.getElementById("profileCompleteText");

        if (!bar && !text) return;

        const checks = [
            Boolean(person.name),
            Boolean(person.email),
            Boolean(person.mobile),
            Boolean(person.dateOfBirth)
        ];

        const done = checks.filter(Boolean).length;
        const percent = Math.round((done / checks.length) * 100);

        if (bar) bar.style.width = percent + "%";

        if (text) {
            text.textContent = percent === 100
                ? "Profile complete"
                : "Profile " + percent + "% complete. Add your " +
                  [
                      !person.mobile ? "mobile number" : "",
                      !person.dateOfBirth ? "date of birth" : ""
                  ].filter(Boolean).join(" and ") + ".";
        }
    }

    function displayUser(updatedUser) {
        if (profileName) {
            profileName.textContent = updatedUser.name || "Citizen";
        }

        if (profileNameDetail) {
            profileNameDetail.textContent = updatedUser.name || "Citizen";
        }

        if (profileEmail) {
            profileEmail.textContent = updatedUser.email || "";
        }

        if (profileEmailDetail) {
            profileEmailDetail.textContent = updatedUser.email || "";
        }

        if (profileMobile) {
            profileMobile.textContent =
                updatedUser.mobile || "Not provided";
        }

        if (profileDOB) {
            profileDOB.textContent = formatDate(updatedUser.dateOfBirth);
        }

        if (profileRole) {
            const role = updatedUser.role || "citizen";
            profileRole.textContent =
                role.charAt(0).toUpperCase() + role.slice(1);
        }

        updateCompleteness(updatedUser);

        if (profileAvatar) {
            profileAvatar.textContent =
                (updatedUser.name || "C").charAt(0).toUpperCase();
        }
    }

    displayUser(user);

    // Refresh from the database so changes made elsewhere show up.
    CivicAPI.me().then(function (fresh) {
        displayUser(fresh);
        if (editName) editName.value = fresh.name || "";
        if (editMobile) editMobile.value = fresh.mobile || "";
        if (editDOB) editDOB.value = fresh.dateOfBirth || "";
    }).catch(function (error) {
        if (error.sessionExpired) window.location.replace("login.html");
    });

    const editEmail = document.getElementById("editEmail");

    // The email is the account ID, so it is shown but locked.
    if (editEmail) editEmail.value = user.email || "";

    if (editName) editName.value = user.name || "";
    if (editMobile) editMobile.value = user.mobile || "";
    if (editDOB) editDOB.value = user.dateOfBirth || "";

    profileForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const saveButton = profileForm.querySelector("[type='submit']");

        if (saveButton) saveButton.disabled = true;

        CivicAPI.updateProfile({
            name: editName ? editName.value.trim() : user.name,
            mobile: editMobile ? editMobile.value.trim() : user.mobile,
            dateOfBirth: editDOB ? editDOB.value : user.dateOfBirth
        }).then(function (updatedUser) {
            displayUser(updatedUser);

            showMessage(
                profileMessage,
                "Profile updated successfully.",
                true
            );
        }).catch(function (error) {
            const fields = error.fields || {};
            const first = Object.keys(fields)[0];

            showMessage(
                profileMessage,
                first ? fields[first] : error.message
            );
        }).then(function () {
            if (saveButton) saveButton.disabled = false;
        });
    });
}


// =====================================================
// 8. START THE PAGE
// =====================================================
// The functions above only run when they are called.

document.addEventListener("DOMContentLoaded", function () {
    initializeLogout();
    initializeNavigation();
    initializeReportForm();
    initializeMyReports();
    initializeProfile();
});
