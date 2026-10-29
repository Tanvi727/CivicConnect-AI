"use strict";

// =====================================================
// DATABASE (SQLite) AND QUERIES
// =====================================================

const fs = require("node:fs");
const path = require("node:path");

let DatabaseSync;

try {
    ({ DatabaseSync } = require("node:sqlite"));
} catch (error) {
    console.error(
        "This backend needs Node.js 22.13 or newer (found " +
        process.version + "). Please update Node.js."
    );
    process.exit(1);
}

const STATUSES = ["Submitted", "Under Review", "In Progress", "Resolved"];
const PRIORITIES = ["low", "medium", "high"];

const CATEGORIES = [
    "Road Damage",
    "Streetlight Problem",
    "Garbage/Waste",
    "Water/Sanitation",
    "Drainage",
    "Public Safety",
    "Other"
];

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// Each entry is one migration. Add new entries at the end; never edit
// an old one. PRAGMA user_version remembers how many have been applied.
const MIGRATIONS = [
    `
    CREATE TABLE users (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT NOT NULL,
        email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
        mobile         TEXT NOT NULL DEFAULT '',
        date_of_birth  TEXT NOT NULL DEFAULT '',
        password_hash  TEXT NOT NULL,
        role           TEXT NOT NULL DEFAULT 'citizen'
                       CHECK (role IN ('citizen','admin')),
        created_at     TEXT NOT NULL DEFAULT (${NOW}),
        updated_at     TEXT NOT NULL DEFAULT (${NOW}),
        last_login_at  TEXT
    );

    CREATE TABLE reports (
        id                 TEXT PRIMARY KEY,
        user_id            INTEGER NOT NULL
                           REFERENCES users(id) ON DELETE CASCADE,
        category           TEXT NOT NULL,
        title              TEXT NOT NULL,
        description        TEXT NOT NULL,
        location           TEXT NOT NULL,
        additional_details TEXT NOT NULL DEFAULT '',
        photo_path         TEXT NOT NULL DEFAULT '',
        status             TEXT NOT NULL DEFAULT 'Submitted'
                           CHECK (status IN
                           ('Submitted','Under Review','In Progress','Resolved')),
        priority           TEXT NOT NULL DEFAULT 'low'
                           CHECK (priority IN ('low','medium','high')),
        created_at         TEXT NOT NULL DEFAULT (${NOW}),
        updated_at         TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE TABLE report_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id   TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        status      TEXT NOT NULL,
        note        TEXT NOT NULL DEFAULT '',
        changed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL DEFAULT (${NOW})
    );

    CREATE INDEX idx_reports_user     ON reports (user_id, created_at DESC);
    CREATE INDEX idx_reports_status   ON reports (status, created_at DESC);
    CREATE INDEX idx_reports_category ON reports (category);
    CREATE INDEX idx_reports_priority ON reports (priority, status);
    CREATE INDEX idx_history_report   ON report_history (report_id, id);
    `
];

function openDatabase(file) {
    if (file !== ":memory:") {
        fs.mkdirSync(path.dirname(file), { recursive: true });
    }

    const db = new DatabaseSync(file);

    db.exec(
        "PRAGMA journal_mode = WAL;" +
        "PRAGMA foreign_keys = ON;" +
        "PRAGMA busy_timeout = 5000;" +
        "PRAGMA synchronous = NORMAL;"
    );

    const current = db.prepare("PRAGMA user_version").get().user_version;

    for (let version = current; version < MIGRATIONS.length; version++) {
        db.exec("BEGIN");

        try {
            db.exec(MIGRATIONS[version]);
            db.exec("PRAGMA user_version = " + (version + 1));
            db.exec("COMMIT");
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }

    return db;
}

// ---------- Row to API shapes ----------

function toUser(row) {
    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        dateOfBirth: row.date_of_birth,
        role: row.role,
        createdAt: row.created_at
    };
}

function toReport(row) {
    return {
        id: row.id,
        category: row.category,
        title: row.title,
        description: row.description,
        location: row.location,
        additionalDetails: row.additional_details,
        photo: row.photo_path ? "/uploads/" + row.photo_path : "",
        status: row.status,
        priority: row.priority,
        submittedAt: row.created_at,
        updatedAt: row.updated_at,
        reportedBy: row.reporter_email,
        reportedByName: row.reporter_name
    };
}

function escapeLike(text) {
    return text.replace(/[\\%_]/g, "\\$&");
}

function createRepository(db) {
    const REPORT_SELECT =
        "SELECT r.*, u.email AS reporter_email, u.name AS reporter_name " +
        "FROM reports r JOIN users u ON u.id = r.user_id";

    const statements = {
        userById: db.prepare("SELECT * FROM users WHERE id = ?"),
        userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
        insertUser: db.prepare(
            "INSERT INTO users " +
            "(name, email, mobile, date_of_birth, password_hash, role) " +
            "VALUES (?, ?, ?, ?, ?, ?)"
        ),
        updateUser: db.prepare(
            "UPDATE users SET name = ?, mobile = ?, date_of_birth = ?, " +
            "updated_at = " + NOW + " WHERE id = ?"
        ),
        updatePassword: db.prepare(
            "UPDATE users SET password_hash = ?, updated_at = " + NOW +
            " WHERE id = ?"
        ),
        touchLogin: db.prepare(
            "UPDATE users SET last_login_at = " + NOW + " WHERE id = ?"
        ),
        insertReport: db.prepare(
            "INSERT INTO reports (id, user_id, category, title, description, " +
            "location, additional_details, photo_path, priority) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ),
        reportById: db.prepare(REPORT_SELECT + " WHERE r.id = ?"),
        insertHistory: db.prepare(
            "INSERT INTO report_history (report_id, status, note, changed_by) " +
            "VALUES (?, ?, ?, ?)"
        ),
        updateReport: db.prepare(
            "UPDATE reports SET status = ?, priority = ?, updated_at = " +
            NOW + " WHERE id = ?"
        ),
        history: db.prepare(
            "SELECT h.status, h.note, h.created_at, u.name AS changed_by_name " +
            "FROM report_history h LEFT JOIN users u ON u.id = h.changed_by " +
            "WHERE h.report_id = ? ORDER BY h.id"
        )
    };

    function transaction(work) {
        db.exec("BEGIN");

        try {
            const result = work();

            db.exec("COMMIT");

            return result;
        } catch (error) {
            db.exec("ROLLBACK");
            throw error;
        }
    }

    function findReports(filters, forUserId) {
        const where = [];
        const params = [];

        if (forUserId) {
            where.push("r.user_id = ?");
            params.push(forUserId);
        }

        if (filters.status && STATUSES.includes(filters.status)) {
            where.push("r.status = ?");
            params.push(filters.status);
        }

        if (filters.category && CATEGORIES.includes(filters.category)) {
            where.push("r.category = ?");
            params.push(filters.category);
        }

        if (filters.priority && PRIORITIES.includes(filters.priority)) {
            where.push("r.priority = ?");
            params.push(filters.priority);
        }

        if (filters.q) {
            const like = "%" + escapeLike(filters.q.toLowerCase()) + "%";

            where.push(
                "(LOWER(r.title) LIKE ? ESCAPE '\\' OR " +
                "LOWER(r.id) LIKE ? ESCAPE '\\' OR " +
                "LOWER(r.location) LIKE ? ESCAPE '\\' OR " +
                "LOWER(r.category) LIKE ? ESCAPE '\\' OR " +
                "LOWER(u.name) LIKE ? ESCAPE '\\')"
            );
            params.push(like, like, like, like, like);
        }

        const clause = where.length ? " WHERE " + where.join(" AND ") : "";

        const pageSize = Math.min(
            Math.max(parseInt(filters.pageSize, 10) || 50, 1),
            200
        );
        const page = Math.max(parseInt(filters.page, 10) || 1, 1);

        const total = db.prepare(
            "SELECT COUNT(*) AS n FROM reports r JOIN users u " +
            "ON u.id = r.user_id" + clause
        ).get(...params).n;

        const rows = db.prepare(
            REPORT_SELECT + clause +
            " ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?"
        ).all(...params, pageSize, (page - 1) * pageSize);

        return {
            items: rows.map(toReport),
            total,
            page,
            pageSize
        };
    }

    return {
        statuses: STATUSES,
        priorities: PRIORITIES,
        categories: CATEGORIES,

        // ----- users -----

        getUserById(id) {
            return statements.userById.get(id) || null;
        },

        getUserByEmail(email) {
            return statements.userByEmail.get(email) || null;
        },

        createUser({ name, email, mobile, dateOfBirth, passwordHash, role }) {
            const result = statements.insertUser.run(
                name, email, mobile || "", dateOfBirth || "",
                passwordHash, role || "citizen"
            );

            return statements.userById.get(Number(result.lastInsertRowid));
        },

        updateUser(id, { name, mobile, dateOfBirth }) {
            statements.updateUser.run(name, mobile, dateOfBirth, id);

            return statements.userById.get(id);
        },

        setPasswordHash(id, hash) {
            statements.updatePassword.run(hash, id);
        },

        recordLogin(id) {
            statements.touchLogin.run(id);
        },

        // ----- reports -----

        createReport(report) {
            return transaction(function () {
                let id = "CCA-" + Date.now();

                while (statements.reportById.get(id)) {
                    id = "CCA-" + (Number(id.slice(4)) + 1);
                }

                statements.insertReport.run(
                    id, report.userId, report.category, report.title,
                    report.description, report.location,
                    report.additionalDetails || "", report.photoPath || "",
                    report.priority
                );

                statements.insertHistory.run(
                    id, "Submitted", "Report submitted by citizen.",
                    report.userId
                );

                return toReport(statements.reportById.get(id));
            });
        },

        getReport(id) {
            const row = statements.reportById.get(id);

            if (!row) return null;

            return {
                ...toReport(row),
                userId: row.user_id,
                history: statements.history.all(id).map(function (item) {
                    return {
                        status: item.status,
                        note: item.note,
                        at: item.created_at,
                        by: item.changed_by_name || "System"
                    };
                })
            };
        },

        listUserReports(userId, filters) {
            return findReports(filters, userId);
        },

        listAllReports(filters) {
            return findReports(filters, null);
        },

        updateReportStatus(id, { status, priority, note, adminId }) {
            return transaction(function () {
                const row = statements.reportById.get(id);

                if (!row) return null;

                statements.updateReport.run(
                    status || row.status,
                    priority || row.priority,
                    id
                );

                const changedStatus = status && status !== row.status;
                const changedPriority = priority && priority !== row.priority;

                if (changedStatus || changedPriority || note) {
                    const parts = [];

                    if (changedPriority) {
                        parts.push("Priority set to " + priority + ".");
                    }

                    if (note) parts.push(note);

                    statements.insertHistory.run(
                        id, status || row.status, parts.join(" "), adminId
                    );
                }

                return toReport(statements.reportById.get(id));
            });
        },

        deletePhotoPathFor(id) {
            const row = statements.reportById.get(id);

            return row ? row.photo_path : "";
        },

        // ----- admin numbers -----

        stats() {
            const byStatus = {};

            db.prepare(
                "SELECT status, COUNT(*) AS n FROM reports GROUP BY status"
            ).all().forEach(function (row) {
                byStatus[row.status] = row.n;
            });

            const total = db.prepare(
                "SELECT COUNT(*) AS n FROM reports"
            ).get().n;

            const highOpen = db.prepare(
                "SELECT COUNT(*) AS n FROM reports " +
                "WHERE priority = 'high' AND status != 'Resolved'"
            ).get().n;

            const citizens = db.prepare(
                "SELECT COUNT(*) AS n FROM users WHERE role = 'citizen'"
            ).get().n;

            return {
                total,
                pending: (byStatus["Submitted"] || 0) +
                    (byStatus["Under Review"] || 0),
                inProgress: byStatus["In Progress"] || 0,
                resolved: byStatus["Resolved"] || 0,
                highPriority: highOpen,
                citizens
            };
        },

        analytics() {
            const byCategory = db.prepare(
                "SELECT category, COUNT(*) AS count FROM reports " +
                "GROUP BY category ORDER BY count DESC"
            ).all();

            const byStatus = db.prepare(
                "SELECT status, COUNT(*) AS count FROM reports GROUP BY status"
            ).all();

            const byPriority = db.prepare(
                "SELECT priority, COUNT(*) AS count FROM reports " +
                "GROUP BY priority"
            ).all();

            const perDay = db.prepare(
                "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count " +
                "FROM reports WHERE created_at >= " +
                "strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') " +
                "GROUP BY day ORDER BY day"
            ).all();

            const average = db.prepare(
                "SELECT AVG((julianday(" +
                "(SELECT MIN(h.created_at) FROM report_history h " +
                "WHERE h.report_id = r.id AND h.status = 'Resolved')" +
                ") - julianday(r.created_at)) * 24) AS hours " +
                "FROM reports r WHERE r.status = 'Resolved'"
            ).get().hours;

            return {
                byCategory,
                byStatus,
                byPriority,
                perDay,
                averageResolutionHours:
                    average === null ? null : Math.round(average * 10) / 10
            };
        }
    };
}

module.exports = {
    openDatabase,
    createRepository,
    toUser,
    STATUSES,
    PRIORITIES,
    CATEGORIES
};
