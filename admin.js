// =====================================================
// ADMIN HELPERS — login check, logout, small utilities
// Load after api.js on every admin page.
// =====================================================

(function () {
    "use strict";

    if (!CivicAPI.isAdmin()) {
        // Not an admin (logged out, or logged in as a citizen):
        // go to the admin login, which can switch accounts.
        window.location.replace(
            "admin-login.html" + (CivicAPI.isLoggedIn() ? "?citizen=1" : "")
        );
        return;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var logout = document.getElementById("adminLogout");

        if (logout) {
            logout.addEventListener("click", function (event) {
                event.preventDefault();
                CivicAPI.clearSession();
                window.location.replace("index.html");
            });
        }
    });

    function el(tag, className, text) {
        var node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    function cap(value) {
        value = String(value || "");

        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function date(value) {
        var d = new Date(value);

        return isNaN(d.getTime())
            ? ""
            : d.toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric"
            });
    }

    // Builds a report table into `table` (a <table> element).
    // options.editable adds a status dropdown that saves immediately.
    function reportTable(table, reports, options) {
        options = options || {};
        table.replaceChildren();

        var head = el("thead");
        var headRow = el("tr");

        ["Report", "Category", "Reported by", "Priority", "Status", "Date"]
            .forEach(function (title) { headRow.appendChild(el("th", "", title)); });

        head.appendChild(headRow);
        table.appendChild(head);

        var body = el("tbody");

        reports.forEach(function (report) {
            var row = el("tr");

            var first = el("td");
            var link = el("a", "", report.title);

            link.href = "admin-report-details.html?id=" +
                encodeURIComponent(report.id);
            first.appendChild(link);
            first.appendChild(el("div", "", report.id));
            first.lastChild.style.cssText = "font-size:.8rem;color:var(--muted)";
            row.appendChild(first);

            row.appendChild(el("td", "", report.category));
            row.appendChild(el("td", "", report.reportedByName || report.reportedBy));

            var priority = el("td");
            priority.appendChild(el("span", "pill " + report.priority, cap(report.priority)));
            row.appendChild(priority);

            var status = el("td");

            if (options.editable) {
                var select = el("select", "row-status");

                CivicAPI.statuses.forEach(function (name) {
                    var option = el("option", "", name);

                    option.value = name;
                    option.selected = name === report.status;
                    select.appendChild(option);
                });

                select.addEventListener("change", function () {
                    select.disabled = true;

                    CivicAPI.adminUpdateReport(report.id, { status: select.value })
                        .then(function () {
                            report.status = select.value;
                            if (options.onChange) options.onChange();
                        })
                        .catch(function (error) {
                            select.value = report.status;
                            alert(error.message);
                        })
                        .then(function () { select.disabled = false; });
                });

                status.appendChild(select);
            } else {
                status.appendChild(el("span", "pill", report.status));
            }

            row.appendChild(status);
            row.appendChild(el("td", "", date(report.submittedAt)));
            body.appendChild(row);
        });

        table.appendChild(body);
    }

    CivicAPI.statuses = ["Submitted", "Under Review", "In Progress", "Resolved"];

    window.AdminUI = { el: el, cap: cap, date: date, reportTable: reportTable };
})();
