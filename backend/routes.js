"use strict";

// =====================================================
// API ROUTES AND INPUT VALIDATION
// =====================================================

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const auth = require("./auth");
const { toUser } = require("./db");

class HttpError extends Error {
    constructor(status, code, message, fields) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
    }
}

// ---------- validation helpers ----------

function text(value, { min = 0, max = 500 } = {}) {
    if (typeof value !== "string") return null;

    const clean = value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

    return clean.length >= min && clean.length <= max ? clean : null;
}

function isEmail(value) {
    return typeof value === "string" &&
        value.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isMobile(value) {
    return typeof value === "string" && /^[6-9][0-9]{9}$/.test(value);
}

function isPastDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(value + "T00:00:00Z");

    return !isNaN(date.getTime()) &&
        date.getTime() <= Date.now() &&
        date.getUTCFullYear() >= 1900;
}

function fail(fields) {
    throw new HttpError(
        400, "validation_error", "Please correct the highlighted details.",
        fields
    );
}

// Picks a priority from the category and the words used in the report.
function inferPriority(category, title, description) {
    const words = (title + " " + description).toLowerCase();

    if (
        category === "Public Safety" ||
        /danger|accident|fire|live wire|electric|collapse|flood|injur|urgent|emergency|gas leak|open manhole|sparking/.test(words)
    ) {
        return "high";
    }

    if (["Water/Sanitation", "Drainage", "Road Damage"].includes(category)) {
        return "medium";
    }

    return "low";
}

// ---------- photo handling ----------

const PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

function looksLikeImage(buffer, mime) {
    if (mime === "image/jpeg") {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mime === "image/png") {
        return buffer.slice(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
    }

    return buffer.slice(0, 4).toString("latin1") === "RIFF" &&
        buffer.slice(8, 12).toString("latin1") === "WEBP";
}

function savePhoto(dataUrl, config) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/
        .exec(dataUrl);

    if (!match) fail({ photo: "Upload a JPG, PNG or WEBP image." });

    const bytes = Buffer.from(match[2], "base64");

    if (bytes.length === 0 || bytes.length > config.maxPhotoBytes) {
        fail({ photo: "The photo must be smaller than 3 MB." });
    }

    if (!looksLikeImage(bytes, match[1])) {
        fail({ photo: "That file is not a valid image." });
    }

    fs.mkdirSync(config.uploadDir, { recursive: true });

    const name = crypto.randomUUID() + PHOTO_TYPES[match[1]];

    fs.writeFileSync(path.join(config.uploadDir, name), bytes);

    return name;
}

// ---------- routes ----------

function buildRoutes({ repo, config }) {
    const routes = [];

    function route(method, pattern, access, handler) {
        const keys = [];
        const regex = new RegExp(
            "^" + pattern.replace(/:([a-zA-Z]+)/g, function (_, key) {
                keys.push(key);
                return "([^/]+)";
            }) + "/?$"
        );

        routes.push({ method, regex, keys, access, handler });
    }

    function session(user) {
        return {
            token: auth.createToken(
                { sub: user.id, role: user.role },
                config.secret,
                config.tokenTtlSeconds
            ),
            user: toUser(user)
        };
    }

    // ----- health -----

    route("GET", "/api/health", "public", function () {
        return { status: "ok", time: new Date().toISOString() };
    });

    route("GET", "/api/meta", "public", function () {
        return {
            categories: repo.categories,
            statuses: repo.statuses,
            priorities: repo.priorities
        };
    });

    // ----- accounts -----

    route("POST", "/api/auth/register", "public", async function ({ body }) {
        const errors = {};
        const name = text(body.name, { min: 2, max: 80 });
        const email = typeof body.email === "string"
            ? body.email.trim().toLowerCase() : "";
        const mobile = typeof body.mobile === "string"
            ? body.mobile.trim() : "";
        const dateOfBirth = body.dateOfBirth;
        const password = body.password;

        if (!name) errors.name = "Enter your full name (2-80 characters).";
        if (!isEmail(email)) errors.email = "Enter a valid email address.";
        if (!isMobile(mobile)) {
            errors.mobile = "Enter a valid 10-digit mobile number.";
        }
        if (!isPastDate(dateOfBirth)) {
            errors.dateOfBirth = "Enter a valid date of birth.";
        }
        if (typeof password !== "string" || password.length < 8 ||
            password.length > 128) {
            errors.password = "Password must be 8-128 characters.";
        }

        if (Object.keys(errors).length) fail(errors);

        if (repo.getUserByEmail(email)) {
            throw new HttpError(
                409, "email_taken",
                "An account with this email already exists."
            );
        }

        const user = repo.createUser({
            name,
            email,
            mobile,
            dateOfBirth,
            passwordHash: await auth.hashPassword(password),
            role: "citizen"
        });

        return { status: 201, body: { user: toUser(user) } };
    });

    route("POST", "/api/auth/login", "public", async function ({ body }) {
        const email = typeof body.email === "string"
            ? body.email.trim().toLowerCase() : "";
        const password = typeof body.password === "string" ? body.password : "";

        const user = repo.getUserByEmail(email);

        // The same message is used for both cases on purpose.
        const valid = user
            ? await auth.verifyPassword(password, user.password_hash)
            : false;

        if (!valid) {
            throw new HttpError(
                401, "invalid_credentials",
                "Incorrect email or password."
            );
        }

        repo.recordLogin(user.id);

        return session(user);
    });

    route("GET", "/api/auth/me", "user", function ({ user }) {
        return { user: toUser(user) };
    });

    route("PUT", "/api/users/me", "user", function ({ user, body }) {
        const errors = {};
        const name = text(body.name, { min: 2, max: 80 });
        const mobile = typeof body.mobile === "string"
            ? body.mobile.trim() : "";
        const dateOfBirth = body.dateOfBirth;

        if (!name) errors.name = "Enter your full name (2-80 characters).";
        if (!isMobile(mobile)) {
            errors.mobile = "Enter a valid 10-digit mobile number.";
        }
        if (dateOfBirth !== "" && !isPastDate(dateOfBirth)) {
            errors.dateOfBirth = "Enter a valid date of birth.";
        }

        if (Object.keys(errors).length) fail(errors);

        return {
            user: toUser(repo.updateUser(user.id, {
                name, mobile, dateOfBirth: dateOfBirth || ""
            }))
        };
    });

    route("POST", "/api/users/me/password", "user", async function ({ user, body }) {
        const current = typeof body.currentPassword === "string"
            ? body.currentPassword : "";
        const next = body.newPassword;

        if (!(await auth.verifyPassword(current, user.password_hash))) {
            throw new HttpError(
                400, "wrong_password", "Your current password is not correct."
            );
        }

        if (typeof next !== "string" || next.length < 8 || next.length > 128) {
            fail({ newPassword: "Password must be 8-128 characters." });
        }

        if (next === current) {
            fail({ newPassword: "Choose a different password." });
        }

        repo.setPasswordHash(user.id, await auth.hashPassword(next));

        return { ok: true };
    });

    // ----- citizen reports -----

    route("POST", "/api/reports", "user", function ({ user, body }) {
        const errors = {};
        const category = body.category;
        const title = text(body.title, { min: 3, max: 100 });
        const description = text(body.description, { min: 10, max: 2000 });
        const location = text(body.location, { min: 2, max: 300 });
        const extra = body.additionalDetails === undefined ||
            body.additionalDetails === ""
            ? "" : text(body.additionalDetails, { max: 2000 });

        if (!repo.categories.includes(category)) {
            errors.category = "Choose a valid category.";
        }
        if (!title) errors.title = "Title must be 3-100 characters.";
        if (!description) {
            errors.description = "Describe the issue (10-2000 characters).";
        }
        if (!location) errors.location = "Enter the location (2-300 characters).";
        if (extra === null) {
            errors.additionalDetails = "Additional details are too long.";
        }

        if (Object.keys(errors).length) fail(errors);

        let photoPath = "";

        if (body.photo) {
            photoPath = savePhoto(body.photo, config);
        }

        const report = repo.createReport({
            userId: user.id,
            category,
            title,
            description,
            location,
            additionalDetails: extra,
            photoPath,
            priority: inferPriority(category, title, description)
        });

        return { status: 201, body: { report } };
    });

    route("GET", "/api/reports/mine", "user", function ({ user, query }) {
        return repo.listUserReports(user.id, {
            status: query.status,
            category: query.category,
            q: query.q ? String(query.q).slice(0, 100) : "",
            page: query.page,
            pageSize: query.pageSize || 200
        });
    });

    route("GET", "/api/reports/:id", "user", function ({ user, params }) {
        const report = repo.getReport(params.id);

        // Citizens only see their own reports; the answer is the same
        // whether a report is missing or belongs to someone else.
        if (!report || (user.role !== "admin" && report.userId !== user.id)) {
            throw new HttpError(404, "not_found", "Report not found.");
        }

        delete report.userId;

        return { report };
    });

    // ----- admin -----

    route("GET", "/api/admin/stats", "admin", function () {
        return repo.stats();
    });

    route("GET", "/api/admin/analytics", "admin", function () {
        return repo.analytics();
    });

    route("GET", "/api/admin/reports", "admin", function ({ query }) {
        return repo.listAllReports({
            status: query.status,
            category: query.category,
            priority: query.priority,
            q: query.q ? String(query.q).slice(0, 100) : "",
            page: query.page,
            pageSize: query.pageSize
        });
    });

    route("PATCH", "/api/admin/reports/:id", "admin", function ({ user, params, body }) {
        const errors = {};
        const status = body.status;
        const priority = body.priority;
        const note = body.note === undefined ? "" : text(body.note, { max: 500 });

        if (status !== undefined && !repo.statuses.includes(status)) {
            errors.status = "Choose a valid status.";
        }
        if (priority !== undefined && !repo.priorities.includes(priority)) {
            errors.priority = "Choose a valid priority.";
        }
        if (note === null) errors.note = "The note is too long (500 max).";
        if (status === undefined && priority === undefined && !note) {
            errors.status = "Nothing to update.";
        }

        if (Object.keys(errors).length) fail(errors);

        const report = repo.updateReportStatus(params.id, {
            status, priority, note, adminId: user.id
        });

        if (!report) throw new HttpError(404, "not_found", "Report not found.");

        return { report: repo.getReport(params.id) };
    });

    return routes;
}

module.exports = { buildRoutes, HttpError };
