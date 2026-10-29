"use strict";

// =====================================================
// CONFIGURATION
// Values come from environment variables or a .env file.
// =====================================================

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");

function loadEnvFile(file) {
    if (!fs.existsSync(file)) return;

    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);

        if (!match || line.trim().startsWith("#")) continue;

        let value = match[2];

        if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);

        if (process.env[match[1]] === undefined) {
            process.env[match[1]] = value;
        }
    }
}

loadEnvFile(path.join(ROOT, ".env"));

function loadSecret(dataDir) {
    const fromEnv = process.env.JWT_SECRET;

    if (fromEnv && fromEnv.length >= 16) return fromEnv;

    // No secret supplied: create one once and keep it for later runs,
    // so people stay signed in after a restart.
    const file = path.join(dataDir, ".jwt-secret");

    fs.mkdirSync(dataDir, { recursive: true });

    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();

    const secret = crypto.randomBytes(48).toString("hex");

    fs.writeFileSync(file, secret, { mode: 0o600 });

    return secret;
}

function loadConfig(overrides = {}) {
    const dataDir = path.resolve(
        ROOT,
        overrides.dataDir || process.env.DATA_DIR || "data"
    );

    return {
        root: ROOT,
        port: Number(overrides.port ?? process.env.PORT ?? 3000),
        host: overrides.host || process.env.HOST || "127.0.0.1",
        dataDir,
        dbFile: overrides.dbFile || path.join(dataDir, "civic.db"),
        uploadDir: path.join(dataDir, "uploads"),
        secret: overrides.secret || loadSecret(dataDir),
        tokenTtlSeconds:
            Number(process.env.TOKEN_TTL_DAYS || 7) * 24 * 60 * 60,
        maxBodyBytes: 6 * 1024 * 1024,
        maxPhotoBytes: 3 * 1024 * 1024,
        admin: {
            name: process.env.ADMIN_NAME || "Administrator",
            email: (process.env.ADMIN_EMAIL || "admin@civicconnect.local")
                .toLowerCase(),
            password: process.env.ADMIN_PASSWORD || "Admin@12345",
            isDefaultPassword: !process.env.ADMIN_PASSWORD
        },
        quiet: Boolean(overrides.quiet)
    };
}

module.exports = { loadConfig, ROOT };
