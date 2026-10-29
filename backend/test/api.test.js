"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createServer } = require("../server");

// 1x1 transparent PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let app, base, dir;

async function call(method, url, body, token) {
    const res = await fetch(base + url, {
        method,
        headers: Object.assign(
            { "Content-Type": "application/json" },
            token ? { Authorization: "Bearer " + token } : {}
        ),
        body: body ? JSON.stringify(body) : undefined
    });

    let json = null;
    try { json = await res.json(); } catch (e) { /* no body */ }

    return { status: res.status, body: json };
}

const citizen = {
    name: "Asha Patil",
    email: "Asha@Example.com",
    mobile: "9876543210",
    dateOfBirth: "2000-05-14",
    password: "Secret123"
};

test.before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "civic-"));
    app = createServer({
        port: 0,
        dataDir: dir,
        dbFile: path.join(dir, "test.db"),
        uploadDir: path.join(dir, "uploads"),
        secret: "test-secret-test-secret",
        quiet: true
    });
    const address = await app.start();
    base = "http://127.0.0.1:" + address.port;
});

test.after(async () => {
    await app.stop();
    fs.rmSync(dir, { recursive: true, force: true });
});

test("health and meta are public", async () => {
    assert.strictEqual((await call("GET", "/api/health")).status, 200);
    const meta = await call("GET", "/api/meta");
    assert.ok(meta.body.categories.includes("Drainage"));
});

test("register validates input", async () => {
    const r = await call("POST", "/api/auth/register", { name: "A", email: "bad" });
    assert.strictEqual(r.status, 400);
    assert.ok(r.body.error.fields.email);
    assert.ok(r.body.error.fields.mobile);
    assert.ok(r.body.error.fields.password);
});

let token;

test("register, duplicate, login keep phone and birth date", async () => {
    const r = await call("POST", "/api/auth/register", citizen);
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.body.user.email, "asha@example.com");
    assert.strictEqual(r.body.user.mobile, "9876543210");
    assert.strictEqual(r.body.user.dateOfBirth, "2000-05-14");
    assert.strictEqual(r.body.user.passwordHash, undefined);

    const dup = await call("POST", "/api/auth/register", citizen);
    assert.strictEqual(dup.status, 409);

    const bad = await call("POST", "/api/auth/login",
        { email: citizen.email, password: "wrong" });
    assert.strictEqual(bad.status, 401);

    const ok = await call("POST", "/api/auth/login",
        { email: "ASHA@example.com", password: citizen.password });
    assert.strictEqual(ok.status, 200);
    token = ok.body.token;
    assert.strictEqual(ok.body.user.mobile, "9876543210");

    const me = await call("GET", "/api/auth/me", null, token);
    assert.strictEqual(me.body.user.dateOfBirth, "2000-05-14");
});

test("protected routes need a valid token", async () => {
    assert.strictEqual((await call("GET", "/api/auth/me")).status, 401);
    assert.strictEqual((await call("GET", "/api/auth/me", null, "x.y.z")).status, 401);
});

test("profile update and password change", async () => {
    const up = await call("PUT", "/api/users/me",
        { name: "Asha P", mobile: "9123456780", dateOfBirth: "2001-01-02" }, token);
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.body.user.mobile, "9123456780");

    const wrong = await call("POST", "/api/users/me/password",
        { currentPassword: "nope", newPassword: "Another123" }, token);
    assert.strictEqual(wrong.status, 400);

    const change = await call("POST", "/api/users/me/password",
        { currentPassword: citizen.password, newPassword: "Another123" }, token);
    assert.strictEqual(change.status, 200);

    const old = await call("POST", "/api/auth/login",
        { email: citizen.email, password: citizen.password });
    assert.strictEqual(old.status, 401);

    const fresh = await call("POST", "/api/auth/login",
        { email: citizen.email, password: "Another123" });
    assert.strictEqual(fresh.status, 200);
    token = fresh.body.token;
});

let reportId;

test("create report with photo, priority inferred", async () => {
    const bad = await call("POST", "/api/reports", { title: "x" }, token);
    assert.strictEqual(bad.status, 400);

    const badPhoto = await call("POST", "/api/reports", {
        category: "Drainage", title: "Blocked drain",
        description: "The drain is blocked near the school.",
        location: "MG Road", photo: "data:image/png;base64,AAAA"
    }, token);
    assert.strictEqual(badPhoto.status, 400);

    const r = await call("POST", "/api/reports", {
        category: "Road Damage", title: "Big pothole",
        description: "Deep pothole, there was an accident yesterday.",
        location: "College Road, Nashik", photo: PNG
    }, token);
    assert.strictEqual(r.status, 201);
    assert.match(r.body.report.id, /^CCA-\d+$/);
    assert.strictEqual(r.body.report.status, "Submitted");
    assert.strictEqual(r.body.report.priority, "high");
    assert.match(r.body.report.photo, /^\/uploads\/.+\.png$/);
    reportId = r.body.report.id;

    const img = await fetch(base + r.body.report.photo);
    assert.strictEqual(img.status, 200);
    assert.strictEqual(img.headers.get("content-type"), "image/png");
});

test("citizens only see their own reports", async () => {
    const list = await call("GET", "/api/reports/mine", null, token);
    assert.strictEqual(list.body.items.length, 1);
    assert.strictEqual(list.body.total, 1);

    const one = await call("GET", "/api/reports/" + reportId, null, token);
    assert.strictEqual(one.status, 200);
    assert.strictEqual(one.body.report.history.length, 1);

    await call("POST", "/api/auth/register", {
        name: "Other Person", email: "other@example.com", mobile: "9000000001",
        dateOfBirth: "1999-09-09", password: "Secret123"
    });
    const other = await call("POST", "/api/auth/login",
        { email: "other@example.com", password: "Secret123" });
    const stranger = await call("GET", "/api/reports/" + reportId, null, other.body.token);
    assert.strictEqual(stranger.status, 404);

    const otherList = await call("GET", "/api/reports/mine", null, other.body.token);
    assert.strictEqual(otherList.body.items.length, 0);
});

test("admin area is protected and works", async () => {
    assert.strictEqual((await call("GET", "/api/admin/stats", null, token)).status, 403);

    const login = await call("POST", "/api/auth/login", {
        email: app.config.admin.email, password: app.config.admin.password
    });
    assert.strictEqual(login.status, 200);
    assert.strictEqual(login.body.user.role, "admin");
    const admin = login.body.token;

    const list = await call("GET", "/api/admin/reports?status=Submitted", null, admin);
    assert.strictEqual(list.body.total, 1);

    const search = await call("GET", "/api/admin/reports?q=pothole", null, admin);
    assert.strictEqual(search.body.total, 1);
    const none = await call("GET", "/api/admin/reports?q=zzzz%25", null, admin);
    assert.strictEqual(none.body.total, 0);

    const invalid = await call("PATCH", "/api/admin/reports/" + reportId,
        { status: "Nope" }, admin);
    assert.strictEqual(invalid.status, 400);

    const patch = await call("PATCH", "/api/admin/reports/" + reportId,
        { status: "In Progress", note: "Crew assigned" }, admin);
    assert.strictEqual(patch.status, 200);
    assert.strictEqual(patch.body.report.status, "In Progress");
    assert.strictEqual(patch.body.report.history.length, 2);

    const missing = await call("PATCH", "/api/admin/reports/CCA-1",
        { status: "Resolved" }, admin);
    assert.strictEqual(missing.status, 404);

    const stats = await call("GET", "/api/admin/stats", null, admin);
    assert.strictEqual(stats.body.total, 1);
    assert.strictEqual(stats.body.inProgress, 1);

    const analytics = await call("GET", "/api/admin/analytics", null, admin);
    assert.strictEqual(analytics.status, 200);

    // citizen sees the updated status
    const mine = await call("GET", "/api/reports/" + reportId, null, token);
    assert.strictEqual(mine.body.report.status, "In Progress");
});

test("private files are not served and unknown routes 404", async () => {
    assert.strictEqual((await fetch(base + "/backend/db.js")).status, 404);
    assert.strictEqual((await fetch(base + "/.env")).status, 404);
    assert.strictEqual((await fetch(base + "/data/test.db")).status, 404);
    assert.strictEqual((await fetch(base + "/../package.json")).status, 404);
    assert.strictEqual((await call("GET", "/api/nope")).status, 404);
    assert.strictEqual((await call("DELETE", "/api/health")).status, 405);
});
