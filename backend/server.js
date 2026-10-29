"use strict";

// =====================================================
// CIVICCONNECT AI — SERVER
// Start with:  node backend/server.js
// It serves the API under /api and the website itself,
// so open http://localhost:3000 in your browser.
// =====================================================

// node:sqlite needs a recent Node.js; explain clearly instead of crashing.
(function () {
    const parts = process.versions.node.split(".").map(Number);

    if (parts[0] < 22 || (parts[0] === 22 && parts[1] < 13)) {
        console.error(
            "CivicConnect AI needs Node.js 22.13 or newer. " +
            "You have " + process.versions.node + ". " +
            "Download the latest LTS from https://nodejs.org and try again."
        );
        process.exit(1);
    }
})();

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const { loadConfig } = require("./config");
const { openDatabase, createRepository } = require("./db");
const auth = require("./auth");
const { buildRoutes, HttpError } = require("./routes");

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

// Folders that must never be served as website files.
const PRIVATE_FOLDERS = new Set(["backend", "data", "node_modules"]);

// ---------- small in-memory rate limiter ----------

function createLimiter(limit, windowMs) {
    const hits = new Map();

    return function allow(key) {
        const now = Date.now();
        const entry = hits.get(key);

        if (!entry || entry.reset < now) {
            hits.set(key, { count: 1, reset: now + windowMs });
            return true;
        }

        entry.count++;

        return entry.count <= limit;
    };
}

function createServer(overrides = {}) {
    const config = loadConfig(overrides);
    const db = openDatabase(config.dbFile);
    const repo = createRepository(db);
    const routes = buildRoutes({ repo, config });

    const authLimiter = createLimiter(30, 15 * 60 * 1000);
    const apiLimiter = createLimiter(600, 60 * 1000);

    const log = config.quiet ? function () {} : console.log;

    // ---------- admin account ----------

    async function ensureAdmin() {
        if (repo.getUserByEmail(config.admin.email)) return;

        repo.createUser({
            name: config.admin.name,
            email: config.admin.email,
            passwordHash: await auth.hashPassword(config.admin.password),
            role: "admin"
        });

        log("Admin account created: " + config.admin.email);

        if (config.admin.isDefaultPassword) {
            log(
                "WARNING: the admin uses the default password. " +
                "Set ADMIN_PASSWORD in .env before sharing this site."
            );
        }
    }

    // ---------- helpers ----------

    function securityHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "same-origin");
    }

    function sendJson(res, status, body) {
        const payload = JSON.stringify(body);

        res.writeHead(status, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": Buffer.byteLength(payload),
            "Cache-Control": "no-store"
        });
        res.end(payload);
    }

    function readBody(req) {
        return new Promise(function (resolve, reject) {
            const chunks = [];
            let size = 0;

            req.on("data", function (chunk) {
                size += chunk.length;

                if (size > config.maxBodyBytes) {
                    reject(new HttpError(
                        413, "too_large", "The request is too large."
                    ));
                    req.destroy();
                    return;
                }

                chunks.push(chunk);
            });

            req.on("end", function () {
                if (size === 0) return resolve({});

                try {
                    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));

                    if (parsed === null || typeof parsed !== "object" ||
                        Array.isArray(parsed)) {
                        throw new Error("not an object");
                    }

                    resolve(parsed);
                } catch (error) {
                    reject(new HttpError(
                        400, "invalid_json", "The request body must be valid JSON."
                    ));
                }
            });

            req.on("error", reject);
        });
    }

    function currentUser(req) {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        const payload = auth.verifyToken(token, config.secret);

        return payload ? repo.getUserById(payload.sub) : null;
    }

    // ---------- API ----------

    async function handleApi(req, res, url) {
        const ip = req.socket.remoteAddress || "unknown";

        if (!apiLimiter(ip)) {
            throw new HttpError(
                429, "rate_limited", "Too many requests. Please slow down."
            );
        }

        if (url.pathname === "/api/auth/login" ||
            url.pathname === "/api/auth/register") {
            if (req.method === "POST" && !authLimiter(ip)) {
                throw new HttpError(
                    429, "rate_limited",
                    "Too many attempts. Please try again in a few minutes."
                );
            }
        }

        const found = routes.find(function (item) {
            return item.method === req.method && item.regex.test(url.pathname);
        });

        if (!found) {
            const pathExists = routes.some(function (item) {
                return item.regex.test(url.pathname);
            });

            throw pathExists
                ? new HttpError(405, "method_not_allowed", "Method not allowed.")
                : new HttpError(404, "not_found", "Unknown API endpoint.");
        }

        const match = found.regex.exec(url.pathname);
        const params = {};

        found.keys.forEach(function (key, index) {
            params[key] = decodeURIComponent(match[index + 1]);
        });

        let user = null;

        if (found.access !== "public") {
            user = currentUser(req);

            if (!user) {
                throw new HttpError(
                    401, "unauthorized", "Please log in to continue."
                );
            }

            if (found.access === "admin" && user.role !== "admin") {
                throw new HttpError(
                    403, "forbidden", "Administrator access is required."
                );
            }
        }

        const body = ["POST", "PUT", "PATCH"].includes(req.method)
            ? await readBody(req)
            : {};

        const result = await found.handler({
            req,
            user,
            params,
            body,
            query: Object.fromEntries(url.searchParams)
        });

        if (result && result.status && result.body !== undefined) {
            sendJson(res, result.status, result.body);
        } else {
            sendJson(res, 200, result);
        }
    }

    // ---------- website files ----------

    function serveFile(res, file, cache) {
        fs.stat(file, function (error, stats) {
            if (error || !stats.isFile()) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not found");
                return;
            }

            res.writeHead(200, {
                "Content-Type":
                    MIME_TYPES[path.extname(file).toLowerCase()] ||
                    "application/octet-stream",
                "Content-Length": stats.size,
                "Cache-Control": cache
            });

            fs.createReadStream(file).pipe(res);
        });
    }

    function handleStatic(req, res, url) {
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { Allow: "GET, HEAD" });
            res.end();
            return;
        }

        let pathname;

        try {
            pathname = decodeURIComponent(url.pathname);
        } catch (error) {
            res.writeHead(400);
            res.end("Bad request");
            return;
        }

        // Uploaded photos have random names and are not listable.
        if (pathname.startsWith("/uploads/")) {
            const name = path.basename(pathname);

            if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) {
                res.writeHead(404);
                res.end("Not found");
                return;
            }

            serveFile(res, path.join(config.uploadDir, name), "private, max-age=86400");
            return;
        }

        if (pathname === "/") pathname = "/index.html";

        const segments = pathname.split("/").filter(Boolean);

        const blocked = segments.some(function (part) {
            return part.startsWith(".") || part.includes("\0") ||
                PRIVATE_FOLDERS.has(part.toLowerCase());
        });

        const file = path.join(config.root, ...segments);

        if (
            blocked ||
            !file.startsWith(config.root + path.sep) ||
            !MIME_TYPES[path.extname(file).toLowerCase()]
        ) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not found");
            return;
        }

        serveFile(res, file, "no-cache");
    }

    // ---------- server ----------

    const server = http.createServer(async function (req, res) {
        const started = Date.now();
        const url = new URL(req.url, "http://localhost");

        securityHeaders(res);

        res.on("finish", function () {
            if (url.pathname.startsWith("/api/")) {
                log(
                    req.method + " " + url.pathname + " " +
                    res.statusCode + " " + (Date.now() - started) + "ms"
                );
            }
        });

        try {
            if (url.pathname.startsWith("/api/")) {
                // Token-based API, so any website origin may call it.
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader(
                    "Access-Control-Allow-Headers", "Authorization, Content-Type"
                );
                res.setHeader(
                    "Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS"
                );

                if (req.method === "OPTIONS") {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                await handleApi(req, res, url);
                return;
            }

            handleStatic(req, res, url);
        } catch (error) {
            if (error instanceof HttpError) {
                sendJson(res, error.status, {
                    error: {
                        code: error.code,
                        message: error.message,
                        fields: error.fields
                    }
                });
                return;
            }

            // Constraint errors from the database, such as a duplicate email
            // created at the same moment by two requests.
            if (error && /UNIQUE constraint/.test(String(error.message))) {
                sendJson(res, 409, {
                    error: { code: "conflict", message: "That record already exists." }
                });
                return;
            }

            console.error("Unexpected error:", error);

            if (!res.headersSent) {
                sendJson(res, 500, {
                    error: {
                        code: "server_error",
                        message: "Something went wrong on the server."
                    }
                });
            }
        }
    });

    function start() {
        return ensureAdmin().then(function () {
            return new Promise(function (resolve) {
                server.listen(config.port, config.host, function () {
                    resolve(server.address());
                });
            });
        });
    }

    function stop() {
        return new Promise(function (resolve) {
            server.close(function () {
                db.close();
                resolve();
            });
            server.closeAllConnections();
        });
    }

    return { server, start, stop, config, repo };
}

module.exports = { createServer };

if (require.main === module) {
    const app = createServer();

    app.start().then(function (address) {
        console.log("");
        console.log("CivicConnect AI is running.");
        console.log("Open  http://localhost:" + address.port);
        console.log("Database: " + app.config.dbFile);
        console.log("Press Ctrl+C to stop.");
        console.log("");
    }).catch(function (error) {
        if (error && error.code === "EADDRINUSE") {
            console.error("Port " + app.config.port + " is already in use. " +
                "Set a different PORT in .env.");
        } else {
            console.error(error);
        }

        process.exit(1);
    });

    ["SIGINT", "SIGTERM"].forEach(function (signal) {
        process.on(signal, function () {
            app.stop().then(function () {
                process.exit(0);
            });
        });
    });
}
