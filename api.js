// =====================================================
// CIVICCONNECT AI — API CLIENT
// Talks to the Node backend (backend/server.js).
// Load this file BEFORE script.js on every page.
// =====================================================

(function () {
    "use strict";

    // Normally the Node server serves both the site and the API, so
    // the address is empty (same origin). If the pages are opened with
    // VS Code "Live Server" (ports 5500-5503) or straight from the
    // disk, the API is on the Node server at port 3000 instead.
    var port = window.location.port;
    var API_BASE = window.location.protocol === "file:" ||
        /^55\d\d$/.test(port)
        ? "http://localhost:3000"
        : "";

    var TOKEN_KEY = "civicToken";
    var USER_KEY = "civicCurrentUser";
    var CACHE_KEY = "civicReports"; // small cache used by the chatbot

    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function write(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }

    function remove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }

    function getToken() {
        return read(TOKEN_KEY) || "";
    }

    function getUser() {
        try {
            var user = JSON.parse(read(USER_KEY) || "null");
            return user && user.email ? user : null;
        } catch (e) {
            return null;
        }
    }

    function setUser(user) {
        write(USER_KEY, JSON.stringify(user));
    }

    function saveSession(token, user) {
        write(TOKEN_KEY, token);
        setUser(user);
    }

    function clearSession() {
        remove(TOKEN_KEY);
        remove(USER_KEY);
        remove(CACHE_KEY);
        remove("civicConnectLoggedIn");
        remove("civicLoggedInEmail");

        try { sessionStorage.removeItem("civicReturnAfterLogin"); } catch (e) { /* ignore */ }
    }

    // Every failed call rejects with an Error that has .status, .code
    // and .fields (field-by-field validation messages).
    function request(method, url, body) {
        var headers = {};
        var token = getToken();

        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (token) headers.Authorization = "Bearer " + token;

        return fetch(API_BASE + url, {
            method: method,
            headers: headers,
            body: body === undefined ? undefined : JSON.stringify(body)
        }).then(function (response) {
            return response.json().catch(function () {
                return null;
            }).then(function (data) {
                if (response.ok) return data;

                var info = data && data.error ? data.error : {};
                var error = new Error(
                    info.message || "Something went wrong. Please try again."
                );

                error.status = response.status;
                error.code = info.code || "error";
                error.fields = info.fields || {};

                // An expired or invalid login: send the person back to log in.
                if (response.status === 401 && token &&
                    url.indexOf("/api/auth/login") === -1) {
                    clearSession();
                    error.sessionExpired = true;
                }

                throw error;
            });
        }, function () {
            var error = new Error(
                "Cannot reach the server. Start it with: node backend/server.js"
            );

            error.status = 0;
            error.code = "network";
            error.fields = {};

            throw error;
        });
    }

    function query(params) {
        var parts = [];

        Object.keys(params || {}).forEach(function (key) {
            var value = params[key];

            if (value !== undefined && value !== null && value !== "" &&
                value !== "all") {
                parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }
        });

        return parts.length ? "?" + parts.join("&") : "";
    }

    // The chatbot reads a light copy of the person's reports.
    function cacheReports(items) {
        write(CACHE_KEY, JSON.stringify(items.map(function (r) {
            return {
                id: r.id,
                title: r.title,
                category: r.category,
                status: r.status,
                submittedAt: r.submittedAt,
                reportedBy: r.reportedBy
            };
        })));
    }

    window.CivicAPI = {
        getToken: getToken,
        getUser: getUser,
        setUser: setUser,
        saveSession: saveSession,
        clearSession: clearSession,
        isLoggedIn: function () { return Boolean(getToken() && getUser()); },
        isAdmin: function () {
            var user = getUser();
            return Boolean(getToken() && user && user.role === "admin");
        },

        register: function (data) {
            return request("POST", "/api/auth/register", data);
        },

        login: function (email, password) {
            return request("POST", "/api/auth/login", {
                email: email, password: password
            }).then(function (data) {
                saveSession(data.token, data.user);
                return data.user;
            });
        },

        // Refreshes the saved profile from the database.
        me: function () {
            return request("GET", "/api/auth/me").then(function (data) {
                setUser(data.user);
                return data.user;
            });
        },

        updateProfile: function (data) {
            return request("PUT", "/api/users/me", data).then(function (res) {
                setUser(res.user);
                return res.user;
            });
        },

        changePassword: function (currentPassword, newPassword) {
            return request("POST", "/api/users/me/password", {
                currentPassword: currentPassword,
                newPassword: newPassword
            });
        },

        createReport: function (data) {
            return request("POST", "/api/reports", data).then(function (res) {
                return res.report;
            });
        },

        myReports: function (filters) {
            return request("GET", "/api/reports/mine" + query(filters))
                .then(function (res) {
                    if (!filters || (!filters.status && !filters.q && !filters.category)) {
                        cacheReports(res.items);
                    }
                    return res;
                });
        },

        getReport: function (id) {
            return request("GET", "/api/reports/" + encodeURIComponent(id))
                .then(function (res) { return res.report; });
        },

        adminStats: function () {
            return request("GET", "/api/admin/stats");
        },

        adminAnalytics: function () {
            return request("GET", "/api/admin/analytics");
        },

        adminReports: function (filters) {
            return request("GET", "/api/admin/reports" + query(filters));
        },

        adminUpdateReport: function (id, data) {
            return request(
                "PATCH", "/api/admin/reports/" + encodeURIComponent(id), data
            ).then(function (res) { return res.report; });
        },

        meta: function () {
            return request("GET", "/api/meta");
        }
    };
})();
