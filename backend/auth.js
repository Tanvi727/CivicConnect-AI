"use strict";

// =====================================================
// PASSWORDS AND TOKENS
// Passwords are stored as salted scrypt hashes.
// Sessions use signed tokens (HS256, the JWT format).
// =====================================================

const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);

    return "scrypt$" + salt.toString("hex") + "$" + hash.toString("hex");
}

async function verifyPassword(password, stored) {
    const parts = String(stored || "").split("$");

    if (parts.length !== 3 || parts[0] !== "scrypt") return false;

    const expected = Buffer.from(parts[2], "hex");
    const actual = await scrypt(
        password,
        Buffer.from(parts[1], "hex"),
        expected.length
    );

    return crypto.timingSafeEqual(actual, expected);
}

function sign(data, secret) {
    return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

function createToken(payload, secret, ttlSeconds) {
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" })
    ).toString("base64url");

    const body = Buffer.from(
        JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })
    ).toString("base64url");

    return header + "." + body + "." + sign(header + "." + body, secret);
}

function verifyToken(token, secret) {
    const parts = String(token || "").split(".");

    if (parts.length !== 3) return null;

    const expected = Buffer.from(sign(parts[0] + "." + parts[1], secret));
    const received = Buffer.from(parts[2]);

    if (
        expected.length !== received.length ||
        !crypto.timingSafeEqual(expected, received)
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf8")
        );

        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch (error) {
        return null;
    }
}

module.exports = { hashPassword, verifyPassword, createToken, verifyToken };
