// =====================================================
// REPORT VIEW — fills the report details layout
// Used by report-details.html and admin-report-details.html
// =====================================================

(function () {
    "use strict";

    var FLOW = ["Submitted", "Under Review", "In Progress", "Resolved"];

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        var element = byId(id);

        if (element) element.textContent = value;
    }

    function formatDate(value, withTime) {
        var date = new Date(value);

        if (isNaN(date.getTime())) return "";

        var options = { day: "2-digit", month: "short", year: "numeric" };

        if (withTime) {
            options.hour = "2-digit";
            options.minute = "2-digit";
        }

        return date.toLocaleString("en-IN", options);
    }

    function statusClass(status) {
        if (status === "Resolved") return "resolved-status";
        if (status === "In Progress") return "progress-status";

        return "submitted-status";
    }

    function element(tag, className, text) {
        var node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    function buildTimeline(report) {
        var timeline = byId("rvTimeline");

        if (!timeline) return;

        timeline.replaceChildren();

        var history = report.history || [];
        var reached = FLOW.indexOf(report.status);

        history.forEach(function (entry, index) {
            var isLast = index === history.length - 1;
            var done = !isLast || report.status === "Resolved";

            var item = element(
                "div", "timeline-item " + (done ? "completed" : "current")
            );

            item.appendChild(element("div", "timeline-dot", done ? "✓" : "🔧"));

            var content = element("div", "timeline-content");

            content.appendChild(element("strong", "", entry.status));
            content.appendChild(element("span", "", formatDate(entry.at, true)));

            if (entry.note) content.appendChild(element("p", "", entry.note));

            if (entry.by && entry.by !== "System" && entry.by !== report.reportedByName) {
                content.appendChild(element("p", "", "Updated by " + entry.by));
            }

            item.appendChild(content);
            timeline.appendChild(item);
        });

        // Steps that have not happened yet.
        FLOW.forEach(function (step, index) {
            if (index <= reached) return;

            var item = element("div", "timeline-item");

            item.appendChild(element("div", "timeline-dot", "○"));

            var content = element("div", "timeline-content");

            content.appendChild(element("strong", "", step));
            content.appendChild(element("span", "", "Awaiting"));

            item.appendChild(content);
            timeline.appendChild(item);
        });
    }

    function fill(report) {
        document.title = report.title + " | CivicConnect AI";

        setText("rvTitle", report.title);
        setText("rvId", "Report #" + report.id);
        setText("rvCategory", report.category);
        setText("rvLocation", report.location);
        setText("rvDate", formatDate(report.submittedAt, true));
        setText("rvDescription", report.description);
        setText("rvPriority", report.priority
            ? report.priority.charAt(0).toUpperCase() + report.priority.slice(1)
            : "");
        setText("rvReporter",
            (report.reportedByName || "") +
            (report.reportedBy ? " (" + report.reportedBy + ")" : ""));

        var status = byId("rvStatus");

        if (status) {
            status.textContent = report.status;
            status.className =
                "status-badge details-status " + statusClass(report.status);
        }

        var extra = byId("rvExtraBox");

        if (extra) {
            extra.hidden = !report.additionalDetails;
            setText("rvExtra", report.additionalDetails || "");
        }

        var photo = byId("rvPhoto");
        var placeholder = byId("rvPhotoPlaceholder");

        if (photo) {
            if (report.photo) {
                photo.src = report.photo;
                photo.alt = "Photo of the reported issue";
                photo.hidden = false;
                if (placeholder) placeholder.hidden = true;
            } else {
                photo.hidden = true;
                if (placeholder) placeholder.hidden = false;
            }
        }

        buildTimeline(report);
    }

    window.ReportView = { fill: fill, formatDate: formatDate };
})();
