// =====================================================
// CIVICCONNECT AI — SETTINGS, LANGUAGE AND HELP ASSISTANT
// Load this file at the end of the page, after script.js.
// =====================================================

(function () {
    "use strict";

    // -------------------------------------------------
    // 1. STORAGE
    // -------------------------------------------------

    var KEYS = {
        theme: "civicTheme",           // light | dark | auto
        brightness: "civicBrightness", // 60 - 120
        language: "civicLanguage",     // en | hi | mr
        motion: "civicReduceMotion"    // "1" | "0"
    };

    function read(key, fallback) {
        try {
            var value = localStorage.getItem(key);
            return value === null ? fallback : value;
        } catch (error) {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // Storage unavailable: the preference lasts for this page only.
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // Ignore.
        }
    }

    function readJSON(key, fallback) {
        try {
            var value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function currentUser() {
        var user = readJSON("civicCurrentUser", null);
        return user && user.email ? user : null;
    }

    function myReports() {
        var user = currentUser();
        var all = readJSON("civicReports", []);

        if (!user || !Array.isArray(all)) return [];

        return all.filter(function (report) {
            return report && report.reportedBy &&
                String(report.reportedBy).toLowerCase() ===
                user.email.toLowerCase();
        });
    }


    // -------------------------------------------------
    // 2. APPEARANCE: THEME, BRIGHTNESS, MOTION
    // -------------------------------------------------

    var darkQuery = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    function isDark() {
        var theme = read(KEYS.theme, "light");

        if (theme === "dark") return true;
        if (theme === "auto") return Boolean(darkQuery && darkQuery.matches);

        return false;
    }

    function getBrightness() {
        var value = parseInt(read(KEYS.brightness, "100"), 10);

        if (isNaN(value)) value = 100;

        return Math.min(120, Math.max(60, value));
    }

    function applyAppearance() {
        var root = document.documentElement;
        var filters = [];
        var brightness = getBrightness();
        var dark = isDark();

        if (dark) filters.push("invert(0.92) hue-rotate(180deg)");
        if (brightness !== 100) {
            filters.push("brightness(" + (brightness / 100) + ")");
        }

        root.style.filter = filters.join(" ");
        root.classList.toggle("cc-dark", dark);
        root.classList.toggle(
            "cc-reduce-motion",
            read(KEYS.motion, "0") === "1"
        );

        // login.html and register.html have their own dark styles.
        if (document.body) {
            document.body.classList.toggle(
                "dark-mode",
                read(KEYS.theme, "light") === "dark"
            );
        }
    }

    if (darkQuery && darkQuery.addEventListener) {
        darkQuery.addEventListener("change", applyAppearance);
    }


    // -------------------------------------------------
    // 3. LANGUAGE
    // -------------------------------------------------
    // Navigation, dashboard, profile, settings and the assistant
    // are translated. Longer text, such as report descriptions
    // written by users, always stays as it was typed.

    var I18N = {
        "Dashboard": ["डैशबोर्ड", "डॅशबोर्ड"],
        "Report Issue": ["समस्या दर्ज करें", "तक्रार नोंदवा"],
        "My Reports": ["मेरी रिपोर्ट", "माझ्या तक्रारी"],
        "My Profile": ["मेरी प्रोफ़ाइल", "माझे प्रोफाइल"],
        "Profile": ["प्रोफ़ाइल", "प्रोफाइल"],
        "Logout": ["लॉग आउट", "लॉग आउट"],
        "Home": ["होम", "मुख्यपृष्ठ"],
        "Features": ["सुविधाएँ", "वैशिष्ट्ये"],
        "How It Works": ["यह कैसे काम करता है", "हे कसे चालते"],
        "Report an Issue": ["समस्या दर्ज करें", "तक्रार नोंदवा"],
        "Log In": ["लॉग इन", "लॉग इन"],
        "Register": ["रजिस्टर करें", "नोंदणी करा"],

        "YOUR CIVICCONNECT DASHBOARD": ["आपका सिविककनेक्ट डैशबोर्ड", "तुमचा सिविककनेक्ट डॅशबोर्ड"],
        "+ Report an Issue": ["+ समस्या दर्ज करें", "+ तक्रार नोंदवा"],
        "Total Reports": ["कुल रिपोर्ट", "एकूण तक्रारी"],
        "Under Review": ["समीक्षाधीन", "पुनरावलोकनात"],
        "In Progress": ["प्रगति में", "प्रगतीपथावर"],
        "Resolved": ["सुलझी हुई", "निराकरण झाले"],
        "ALL REPORTS": ["सभी रिपोर्ट", "सर्व तक्रारी"],
        "IN REVIEW": ["समीक्षा में", "पुनरावलोकनात"],
        "ONGOING": ["जारी", "सुरू"],
        "COMPLETED": ["पूर्ण", "पूर्ण"],
        "Your submitted civic issues": ["आपकी दर्ज की गई नागरिक समस्याएँ", "तुम्ही नोंदवलेल्या नागरी समस्या"],
        "Reports awaiting action": ["कार्रवाई की प्रतीक्षा में रिपोर्ट", "कारवाईच्या प्रतीक्षेत तक्रारी"],
        "Issues being addressed": ["जिन पर काम चल रहा है", "ज्यावर काम सुरू आहे"],
        "Issues marked resolved": ["सुलझाई गई समस्याएँ", "निराकरण झालेल्या समस्या"],
        "YOUR ACTIVITY": ["आपकी गतिविधि", "तुमची हालचाल"],
        "My Recent Reports": ["मेरी हाल की रिपोर्ट", "माझ्या अलीकडील तक्रारी"],
        "Keep track of your latest civic complaints.": ["अपनी नवीनतम शिकायतों पर नज़र रखें।", "तुमच्या ताज्या तक्रारींचा मागोवा ठेवा."],
        "View All →": ["सभी देखें →", "सर्व पहा →"],
        "GET THINGS DONE": ["काम पूरे करें", "कामे पूर्ण करा"],
        "Quick Actions": ["त्वरित कार्य", "झटपट कृती"],
        "Access your most-used features.": ["अपनी सबसे ज़्यादा इस्तेमाल होने वाली सुविधाएँ।", "तुम्ही सर्वाधिक वापरत असलेली वैशिष्ट्ये."],
        "Submit a new civic complaint.": ["नई नागरिक शिकायत दर्ज करें।", "नवीन नागरी तक्रार नोंदवा."],
        "Track My Reports": ["मेरी रिपोर्ट ट्रैक करें", "माझ्या तक्रारींचा मागोवा घ्या"],
        "Check your complaint status.": ["अपनी शिकायत की स्थिति देखें।", "तुमच्या तक्रारीची स्थिती पहा."],
        "Manage your account information.": ["अपने खाते की जानकारी प्रबंधित करें।", "तुमच्या खात्याची माहिती व्यवस्थापित करा."],
        "Settings & Help": ["सेटिंग्स और सहायता", "सेटिंग्ज आणि मदत"],
        "Theme, language, password and help.": ["थीम, भाषा, पासवर्ड और सहायता।", "थीम, भाषा, पासवर्ड आणि मदत."],
        "Small actions create a better community.": ["छोटे कदम बेहतर समाज बनाते हैं।", "छोट्या कृतींमधून चांगला समाज घडतो."],

        "CITIZEN ACTIVITY": ["नागरिक गतिविधि", "नागरिकांची हालचाल"],
        "+ Report New Issue": ["+ नई समस्या दर्ज करें", "+ नवीन तक्रार नोंदवा"],
        "TOTAL REPORTS": ["कुल रिपोर्ट", "एकूण तक्रारी"],
        "UNDER REVIEW": ["समीक्षाधीन", "पुनरावलोकनात"],
        "IN PROGRESS": ["प्रगति में", "प्रगतीपथावर"],
        "RESOLVED": ["सुलझी हुई", "निराकरण झाले"],
        "REPORT HISTORY": ["रिपोर्ट इतिहास", "तक्रारींचा इतिहास"],
        "Your Submitted Issues": ["आपकी दर्ज की गई समस्याएँ", "तुम्ही नोंदवलेल्या समस्या"],
        "Search reports": ["रिपोर्ट खोजें", "तक्रारी शोधा"],
        "Filter by status": ["स्थिति के अनुसार छाँटें", "स्थितीनुसार गाळा"],

        "Report a Civic Issue": ["नागरिक समस्या दर्ज करें", "नागरी समस्या नोंदवा"],
        "Submit Issue": ["समस्या जमा करें", "तक्रार सादर करा"],

        "← Back to Dashboard": ["← डैशबोर्ड पर वापस", "← डॅशबोर्डवर परत"],
        "My Reports →": ["मेरी रिपोर्ट →", "माझ्या तक्रारी →"],
        "Settings ↓": ["सेटिंग्स ↓", "सेटिंग्ज ↓"],
        "Personal Information": ["व्यक्तिगत जानकारी", "वैयक्तिक माहिती"],
        "Full Name": ["पूरा नाम", "पूर्ण नाव"],
        "Email Address": ["ईमेल पता", "ईमेल पत्ता"],
        "Mobile Number": ["मोबाइल नंबर", "मोबाईल क्रमांक"],
        "Date of Birth": ["जन्म तिथि", "जन्मतारीख"],
        "Account Type": ["खाते का प्रकार", "खात्याचा प्रकार"],
        "Edit Personal Information": ["व्यक्तिगत जानकारी बदलें", "वैयक्तिक माहिती संपादित करा"],
        "Save Changes": ["बदलाव सहेजें", "बदल जतन करा"],

        "Settings": ["सेटिंग्स", "सेटिंग्ज"],
        "Personalise how CivicConnect AI looks and works for you. Changes are saved on this device.": ["अपनी पसंद के अनुसार सिविककनेक्ट एआई का रूप बदलें। बदलाव इस डिवाइस पर सहेजे जाते हैं।", "तुमच्या आवडीनुसार सिविककनेक्ट एआयचे स्वरूप बदला. बदल या डिव्हाइसवर जतन होतात."],
        "Appearance": ["रूप-रंग", "दिसणे"],
        "Theme": ["थीम", "थीम"],
        "Light": ["लाइट", "लाइट"],
        "Dark": ["डार्क", "डार्क"],
        "Auto": ["ऑटो", "ऑटो"],
        "Auto follows your device setting.": ["ऑटो आपके डिवाइस की सेटिंग का पालन करता है।", "ऑटो तुमच्या डिव्हाइसच्या सेटिंगनुसार चालते."],
        "Brightness": ["ब्राइटनेस", "ब्राइटनेस"],
        "Make the page dimmer or brighter.": ["पेज को हल्का या तेज़ करें।", "पेज मंद किंवा तेजस्वी करा."],
        "Language": ["भाषा", "भाषा"],
        "Menus, dashboard, profile and settings.": ["मेनू, डैशबोर्ड, प्रोफ़ाइल और सेटिंग्स।", "मेनू, डॅशबोर्ड, प्रोफाइल आणि सेटिंग्ज."],
        "Accessibility": ["सुगमता", "सुलभता"],
        "Reduce animations": ["एनिमेशन कम करें", "अ‍ॅनिमेशन कमी करा"],
        "Turns off movement and transitions.": ["गति और बदलाव के प्रभाव बंद करता है।", "हालचाल आणि संक्रमण प्रभाव बंद करते."],
        "Security": ["सुरक्षा", "सुरक्षा"],
        "Change Password": ["पासवर्ड बदलें", "पासवर्ड बदला"],
        "Current password": ["वर्तमान पासवर्ड", "सध्याचा पासवर्ड"],
        "New password": ["नया पासवर्ड", "नवीन पासवर्ड"],
        "Confirm new password": ["नया पासवर्ड दोबारा लिखें", "नवीन पासवर्ड पुन्हा लिहा"],
        "Update Password": ["पासवर्ड अपडेट करें", "पासवर्ड अपडेट करा"],
        "Data & Privacy": ["डेटा और गोपनीयता", "डेटा आणि गोपनीयता"],
        "Download my data": ["मेरा डेटा डाउनलोड करें", "माझा डेटा डाउनलोड करा"],
        "Reset preferences": ["पसंद रीसेट करें", "पसंती रीसेट करा"],
        "Help & Support": ["सहायता और समर्थन", "मदत आणि सपोर्ट"],
        "Ask the Help Assistant": ["सहायक से पूछें", "मदत सहाय्यकाला विचारा"],
        "Frequently asked questions": ["अक्सर पूछे जाने वाले प्रश्न", "वारंवार विचारले जाणारे प्रश्न"],

        "Help Assistant": ["सहायक", "मदत सहाय्यक"],
        "Automated guide · not a live agent": ["स्वचालित गाइड · लाइव एजेंट नहीं", "स्वयंचलित मार्गदर्शक · थेट प्रतिनिधी नाही"],
        "Type your question...": ["अपना प्रश्न लिखें...", "तुमचा प्रश्न लिहा..."],
        "Send": ["भेजें", "पाठवा"],
        "How do I report an issue?": ["समस्या कैसे दर्ज करूँ?", "तक्रार कशी नोंदवू?"],
        "Track my report": ["मेरी रिपोर्ट ट्रैक करें", "माझ्या तक्रारीचा मागोवा"],
        "Phone or birth date": ["फ़ोन या जन्म तिथि", "फोन किंवा जन्मतारीख"],
        "Dark mode & language": ["डार्क मोड और भाषा", "डार्क मोड आणि भाषा"]
    };

    var originalText = new WeakMap();

    function languageIndex() {
        var language = read(KEYS.language, "en");

        if (language === "hi") return 0;
        if (language === "mr") return 1;

        return -1;
    }

    function t(text) {
        var index = languageIndex();

        return index >= 0 && I18N[text] ? I18N[text][index] : text;
    }

    function normalise(text) {
        return text.replace(/\s+/g, " ").trim();
    }

    function translateTree(root) {
        if (!root) return;

        var index = languageIndex();
        var walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    var parent = node.parentNode;

                    if (!parent) return NodeFilter.FILTER_REJECT;

                    var tag = parent.nodeName;

                    if (
                        tag === "SCRIPT" ||
                        tag === "STYLE" ||
                        tag === "TEXTAREA" ||
                        (parent.closest && parent.closest("[data-no-i18n]"))
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        var nodes = [];

        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach(function (node) {
            var base = originalText.has(node)
                ? originalText.get(node)
                : node.nodeValue;

            var key = normalise(base);

            if (!I18N[key]) return;

            if (!originalText.has(node)) originalText.set(node, base);

            if (index < 0) {
                node.nodeValue = originalText.get(node);
                return;
            }

            var lead = base.match(/^\s*/)[0];
            var trail = base.match(/\s*$/)[0];

            node.nodeValue = lead + I18N[key][index] + trail;
        });

        // Placeholders keep their English text in a data attribute.
        var scope = root.querySelectorAll
            ? root.querySelectorAll("[placeholder]")
            : [];

        Array.prototype.forEach.call(scope, function (field) {
            if (!field.hasAttribute("data-cc-placeholder")) {
                field.setAttribute(
                    "data-cc-placeholder",
                    field.getAttribute("placeholder")
                );
            }

            var english = field.getAttribute("data-cc-placeholder");

            field.setAttribute(
                "placeholder",
                index >= 0 && I18N[english] ? I18N[english][index] : english
            );
        });
    }

    function applyLanguage() {
        document.documentElement.lang = read(KEYS.language, "en");
        translateTree(document.body);
    }

    // Translate content that JavaScript adds later, such as report lists.
    function watchForNewContent() {
        if (!window.MutationObserver) return;

        new MutationObserver(function (mutations) {
            if (languageIndex() < 0) return;

            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1) translateTree(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }


    // -------------------------------------------------
    // 4. SETTINGS PANEL (profile page)
    // -------------------------------------------------

    function setNote(element, message, ok) {
        if (!element) return;

        element.textContent = message;
        element.className = "cc-note " + (ok ? "ok" : "error");
    }

    function initializeSettings() {
        var themeGroup = document.getElementById("ccTheme");
        var brightness = document.getElementById("ccBrightness");
        var brightnessValue = document.getElementById("ccBrightnessValue");
        var language = document.getElementById("ccLanguage");
        var motion = document.getElementById("ccMotion");

        function syncControls() {
            if (themeGroup) {
                var theme = read(KEYS.theme, "light");

                Array.prototype.forEach.call(
                    themeGroup.querySelectorAll("button"),
                    function (button) {
                        button.setAttribute(
                            "aria-pressed",
                            String(button.getAttribute("data-theme") === theme)
                        );
                    }
                );
            }

            if (brightness) brightness.value = String(getBrightness());

            if (brightnessValue) {
                brightnessValue.textContent = getBrightness() + "%";
            }

            if (language) language.value = read(KEYS.language, "en");
            if (motion) motion.checked = read(KEYS.motion, "0") === "1";
        }

        if (themeGroup) {
            themeGroup.addEventListener("click", function (event) {
                var button = event.target.closest("button[data-theme]");

                if (!button) return;

                write(KEYS.theme, button.getAttribute("data-theme"));
                applyAppearance();
                syncControls();
            });
        }

        if (brightness) {
            brightness.addEventListener("input", function () {
                write(KEYS.brightness, brightness.value);
                applyAppearance();
                syncControls();
            });
        }

        if (language) {
            language.addEventListener("change", function () {
                write(KEYS.language, language.value);
                applyLanguage();
                refreshAssistantLanguage();
            });
        }

        if (motion) {
            motion.addEventListener("change", function () {
                write(KEYS.motion, motion.checked ? "1" : "0");
                applyAppearance();
            });
        }

        // Change password
        var passwordForm = document.getElementById("ccPasswordForm");
        var passwordNote = document.getElementById("ccPasswordNote");

        if (passwordForm) {
            passwordForm.addEventListener("submit", function (event) {
                event.preventDefault();

                var current =
                    document.getElementById("ccCurrentPassword").value;
                var next = document.getElementById("ccNewPassword").value;
                var confirm =
                    document.getElementById("ccConfirmPassword").value;
                if (!currentUser() || typeof CivicAPI === "undefined") {
                    setNote(passwordNote, "Please log in again.", false);
                    return;
                }

                if (next.length < 8) {
                    setNote(
                        passwordNote,
                        "The new password must have at least 8 characters.",
                        false
                    );
                    return;
                }

                if (next !== confirm) {
                    setNote(passwordNote, "The new passwords do not match.", false);
                    return;
                }

                if (next === current) {
                    setNote(
                        passwordNote,
                        "Choose a password different from the current one.",
                        false
                    );
                    return;
                }

                CivicAPI.changePassword(current, next).then(function () {
                    passwordForm.reset();
                    setNote(passwordNote, "Password updated successfully.", true);
                }).catch(function (error) {
                    var fields = error.fields || {};

                    setNote(
                        passwordNote,
                        fields.newPassword || error.message,
                        false
                    );
                });
            });
        }

        // Download my data
        var download = document.getElementById("ccDownload");
        var prefNote = document.getElementById("ccPrefNote");

        if (download) {
            download.addEventListener("click", function () {
                var user = currentUser();

                if (!user || typeof CivicAPI === "undefined") return;

                CivicAPI.myReports().then(function (result) {
                    var data = {
                        exportedAt: new Date().toISOString(),
                        profile: user,
                        reports: result.items
                    };

                    var blob = new Blob(
                        [JSON.stringify(data, null, 2)],
                        { type: "application/json" }
                    );
                    var link = document.createElement("a");

                    link.href = URL.createObjectURL(blob);
                    link.download = "civicconnect-my-data.json";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();

                    setTimeout(function () {
                        URL.revokeObjectURL(link.href);
                    }, 1000);

                    setNote(prefNote, "Your data has been downloaded.", true);
                }).catch(function (error) {
                    setNote(prefNote, error.message, false);
                });
            });
        }

        // Reset preferences
        var reset = document.getElementById("ccReset");

        if (reset) {
            reset.addEventListener("click", function () {
                remove(KEYS.theme);
                remove(KEYS.brightness);
                remove(KEYS.language);
                remove(KEYS.motion);

                applyAppearance();
                applyLanguage();
                syncControls();
                refreshAssistantLanguage();

                setNote(prefNote, "Preferences were reset.", true);
            });
        }

        var openBot = document.getElementById("ccOpenBot");

        if (openBot) {
            openBot.addEventListener("click", function () {
                openAssistant();
            });
        }

        syncControls();

        // Open the section when the link is profile.html#settings
        if (window.location.hash === "#settings") {
            var section = document.getElementById("settings");

            if (section) {
                setTimeout(function () {
                    section.scrollIntoView({ behavior: "smooth" });
                }, 150);
            }
        }
    }


    // -------------------------------------------------
    // 5. HELP ASSISTANT
    // -------------------------------------------------
    // This is a rule-based guide that answers common questions
    // and can look up the signed-in user's own reports.
    // It is not connected to a live AI service.

    var A = {
        report: {
            en: "To report a problem:\n1. Open Report Issue.\n2. Choose a category and give a short title and description.\n3. Enter the location, or tap Use My Current Location.\n4. Upload a clear photo (JPG, PNG or WEBP, under 2 MB).\n5. Tick the confirmation and press Submit Issue.\nYou can then follow it in My Reports.",
            hi: "समस्या दर्ज करने के लिए:\n1. 'समस्या दर्ज करें' खोलें।\n2. श्रेणी चुनें और छोटा शीर्षक व विवरण लिखें।\n3. स्थान लिखें या 'मेरा वर्तमान स्थान' दबाएँ।\n4. साफ़ फ़ोटो अपलोड करें (JPG, PNG या WEBP, 2 MB से कम)।\n5. पुष्टि पर टिक करें और 'समस्या जमा करें' दबाएँ।\nफिर 'मेरी रिपोर्ट' में उसे ट्रैक करें।",
            mr: "तक्रार नोंदवण्यासाठी:\n1. 'तक्रार नोंदवा' उघडा.\n2. श्रेणी निवडा आणि लहान शीर्षक व वर्णन लिहा.\n3. ठिकाण लिहा किंवा 'माझे सध्याचे ठिकाण' दाबा.\n4. स्पष्ट फोटो अपलोड करा (JPG, PNG किंवा WEBP, 2 MB पेक्षा कमी).\n5. खात्रीवर टिक करा आणि 'तक्रार सादर करा' दाबा.\nनंतर 'माझ्या तक्रारी' मध्ये मागोवा घ्या."
        },
        profile: {
            en: "To change your name, mobile number or date of birth, open My Profile and use Edit Personal Information, then press Save Changes. Your email address cannot be changed.",
            hi: "नाम, मोबाइल नंबर या जन्म तिथि बदलने के लिए 'मेरी प्रोफ़ाइल' खोलें, 'व्यक्तिगत जानकारी बदलें' में बदलाव करें और 'बदलाव सहेजें' दबाएँ। ईमेल पता बदला नहीं जा सकता।",
            mr: "नाव, मोबाईल क्रमांक किंवा जन्मतारीख बदलण्यासाठी 'माझे प्रोफाइल' उघडा, 'वैयक्तिक माहिती संपादित करा' मध्ये बदल करा आणि 'बदल जतन करा' दाबा. ईमेल पत्ता बदलता येत नाही."
        },
        password: {
            en: "You can change your password in My Profile > Settings > Change Password. If you cannot log in at all, password recovery is not available yet in this version.",
            hi: "पासवर्ड 'मेरी प्रोफ़ाइल' > सेटिंग्स > 'पासवर्ड बदलें' में बदला जा सकता है। यदि आप लॉग इन ही नहीं कर पा रहे हैं, तो इस संस्करण में पासवर्ड रिकवरी अभी उपलब्ध नहीं है।",
            mr: "पासवर्ड 'माझे प्रोफाइल' > सेटिंग्ज > 'पासवर्ड बदला' येथे बदलता येतो. लॉग इन होतच नसेल, तर या आवृत्तीत पासवर्ड रिकव्हरी अजून उपलब्ध नाही."
        },
        settings: {
            en: "Open My Profile and scroll to Settings. There you can choose Light, Dark or Auto theme, adjust brightness, switch the language (English, Hindi, Marathi) and reduce animations.",
            hi: "'मेरी प्रोफ़ाइल' खोलकर सेटिंग्स तक जाएँ। वहाँ लाइट, डार्क या ऑटो थीम, ब्राइटनेस, भाषा (अंग्रेज़ी, हिंदी, मराठी) और एनिमेशन कम करने का विकल्प मिलेगा।",
            mr: "'माझे प्रोफाइल' उघडून सेटिंग्जपर्यंत जा. तिथे लाइट, डार्क किंवा ऑटो थीम, ब्राइटनेस, भाषा (इंग्रजी, हिंदी, मराठी) आणि अ‍ॅनिमेशन कमी करण्याचा पर्याय आहे."
        },
        photo: {
            en: "Photos must be JPG, PNG or WEBP and smaller than 2 MB. A clear, well-lit photo of the problem helps the authorities understand it. If the upload fails, try a smaller image.",
            hi: "फ़ोटो JPG, PNG या WEBP में और 2 MB से छोटी होनी चाहिए। समस्या की साफ़, रोशनी वाली फ़ोटो अधिकारियों को उसे समझने में मदद करती है। अपलोड न हो तो छोटी फ़ोटो आज़माएँ।",
            mr: "फोटो JPG, PNG किंवा WEBP आणि 2 MB पेक्षा लहान असावा. समस्येचा स्पष्ट, प्रकाशमान फोटो अधिकाऱ्यांना समजण्यास मदत करतो. अपलोड न झाल्यास लहान फोटो वापरून पहा."
        },
        time: {
            en: "I cannot promise a resolution time, because it depends on the authority handling the issue. Your report moves through Submitted, Under Review, In Progress and Resolved, and you can see its current status in My Reports.",
            hi: "मैं समाधान का समय नहीं बता सकता, क्योंकि यह संबंधित विभाग पर निर्भर करता है। रिपोर्ट 'जमा', 'समीक्षाधीन', 'प्रगति में' और 'सुलझी हुई' चरणों से गुज़रती है; उसकी स्थिति 'मेरी रिपोर्ट' में देखें।",
            mr: "निराकरणाची वेळ मी सांगू शकत नाही, कारण ती संबंधित विभागावर अवलंबून असते. तक्रार 'सादर', 'पुनरावलोकनात', 'प्रगतीपथावर' आणि 'निराकरण झाले' या टप्प्यांतून जाते; तिची स्थिती 'माझ्या तक्रारी' मध्ये पहा."
        },
        contact: {
            en: "This assistant is automated and there is no live support chat in this version. For urgent problems such as danger to life, please contact your local emergency services or municipal office directly.",
            hi: "यह सहायक स्वचालित है और इस संस्करण में लाइव सपोर्ट चैट नहीं है। जान को ख़तरे जैसी तत्काल समस्या के लिए कृपया सीधे स्थानीय आपातकालीन सेवाओं या नगर निगम कार्यालय से संपर्क करें।",
            mr: "हा सहाय्यक स्वयंचलित आहे आणि या आवृत्तीत थेट सपोर्ट चॅट नाही. जीवाला धोका अशा तातडीच्या समस्येसाठी कृपया स्थानिक आपत्कालीन सेवा किंवा महानगरपालिका कार्यालयाशी थेट संपर्क साधा."
        },
        hello: {
            en: "Hello! Ask me about reporting an issue, tracking a report, your profile or the settings.",
            hi: "नमस्ते! समस्या दर्ज करने, रिपोर्ट ट्रैक करने, प्रोफ़ाइल या सेटिंग्स के बारे में पूछें।",
            mr: "नमस्कार! तक्रार नोंदवणे, तक्रारीचा मागोवा, प्रोफाइल किंवा सेटिंग्जबद्दल विचारा."
        },
        thanks: {
            en: "You're welcome! Ask me anything else whenever you need.",
            hi: "आपका स्वागत है! कभी भी कुछ और पूछें।",
            mr: "आपले स्वागत आहे! गरज असेल तेव्हा काहीही विचारा."
        },
        fallback: {
            en: "I'm not sure about that one. I can help with reporting an issue, tracking a report (type a report ID such as CCA-1234567890123), your profile, photos, password and settings.",
            hi: "इस बारे में मुझे पक्का पता नहीं। मैं समस्या दर्ज करने, रिपोर्ट ट्रैक करने (CCA-1234567890123 जैसी रिपोर्ट आईडी लिखें), प्रोफ़ाइल, फ़ोटो, पासवर्ड और सेटिंग्स में मदद कर सकता हूँ।",
            mr: "याबद्दल मला खात्री नाही. मी तक्रार नोंदवणे, मागोवा (CCA-1234567890123 सारखा आयडी लिहा), प्रोफाइल, फोटो, पासवर्ड आणि सेटिंग्जमध्ये मदत करू शकतो."
        }
    };

    var INTENTS = [
        { id: "report", words: ["report", "complaint", "submit", "raise", "file a", "new issue", "दर्ज", "शिकायत", "तक्रार", "नोंद"] },
        { id: "track", words: ["track", "status", "progress", "my report", "where is my", "how many", "ट्रैक", "स्थिति", "मागोवा", "स्थिती"] },
        { id: "profile", words: ["profile", "phone", "mobile", "birth", "dob", "my name", "email", "प्रोफ़ाइल", "प्रोफाइल", "मोबाइल", "मोबाईल", "जन्म"] },
        { id: "password", words: ["password", "forgot", "log in", "login", "sign in", "पासवर्ड", "लॉग"] },
        { id: "settings", words: ["dark", "theme", "bright", "language", "setting", "night", "hindi", "marathi", "भाषा", "सेटिंग", "अंधेरा", "डार्क"] },
        { id: "photo", words: ["photo", "image", "picture", "upload", "फोटो", "फ़ोटो", "चित्र"] },
        { id: "time", words: ["how long", "how much time", "when will", "days", "resolve", "कब तक", "कितना समय", "किती वेळ", "कधी"] },
        { id: "contact", words: ["contact", "helpline", "call", "human", "agent", "support", "emergency", "संपर्क", "हेल्पलाइन"] },
        { id: "hello", words: ["hello", "hi ", "hey", "namaste", "नमस्ते", "नमस्कार"] },
        { id: "thanks", words: ["thank", "thanks", "धन्यवाद", "आभार"] }
    ];

    var assistant = {
        button: null,
        panel: null,
        messages: null,
        chips: null,
        input: null,
        built: false
    };

    function pick(entry) {
        var language = read(KEYS.language, "en");

        return entry[language] || entry.en;
    }

    function addMessage(text, who, link) {
        var bubble = document.createElement("div");

        bubble.className = "cc-msg " + who;
        bubble.setAttribute("data-no-i18n", "");
        bubble.textContent = text;

        if (link) {
            bubble.appendChild(document.createTextNode("\n"));

            var anchor = document.createElement("a");

            anchor.href = link.href;
            anchor.textContent = link.label;
            bubble.appendChild(anchor);
        }

        assistant.messages.appendChild(bubble);
        assistant.messages.scrollTop = assistant.messages.scrollHeight;
    }

    var LINKS = {
        report: { href: "report.html", label: { en: "Open Report Issue →", hi: "समस्या दर्ज करें खोलें →", mr: "तक्रार नोंदवा उघडा →" } },
        track: { href: "my-reports.html", label: { en: "Open My Reports →", hi: "मेरी रिपोर्ट खोलें →", mr: "माझ्या तक्रारी उघडा →" } },
        profile: { href: "profile.html", label: { en: "Open My Profile →", hi: "मेरी प्रोफ़ाइल खोलें →", mr: "माझे प्रोफाइल उघडा →" } },
        password: { href: "profile.html#settings", label: { en: "Open Settings →", hi: "सेटिंग्स खोलें →", mr: "सेटिंग्ज उघडा →" } },
        settings: { href: "profile.html#settings", label: { en: "Open Settings →", hi: "सेटिंग्स खोलें →", mr: "सेटिंग्ज उघडा →" } }
    };

    function linkFor(id) {
        var entry = LINKS[id];

        return entry ? { href: entry.href, label: pick(entry.label) } : null;
    }

    function trackSummary() {
        var user = currentUser();

        if (!user) {
            return {
                en: "Please log in first, then I can look up your reports.",
                hi: "कृपया पहले लॉग इन करें, फिर मैं आपकी रिपोर्ट देख सकूँगा।",
                mr: "कृपया आधी लॉग इन करा, मग मी तुमच्या तक्रारी पाहू शकेन."
            };
        }

        var reports = myReports();

        if (reports.length === 0) {
            return {
                en: "You have not submitted any reports yet.",
                hi: "आपने अभी तक कोई रिपोर्ट दर्ज नहीं की है।",
                mr: "तुम्ही अजून कोणतीही तक्रार नोंदवलेली नाही."
            };
        }

        function count(names) {
            return reports.filter(function (report) {
                return names.indexOf(
                    String(report.status || "").trim().toLowerCase()
                ) !== -1;
            }).length;
        }

        var waiting = count(["submitted", "under review", "pending"]);
        var working = count(["in progress", "in-progress"]);
        var done = count(["resolved", "completed"]);
        var n = reports.length;

        return {
            en: "You have " + n + " report(s): " + waiting + " waiting for review, " + working + " in progress, " + done + " resolved.\nType a report ID such as " + reports[0].id + " to check one.",
            hi: "आपकी " + n + " रिपोर्ट हैं: " + waiting + " समीक्षा की प्रतीक्षा में, " + working + " प्रगति में, " + done + " सुलझी हुई।\nकिसी एक को देखने के लिए रिपोर्ट आईडी लिखें, जैसे " + reports[0].id + "।",
            mr: "तुमच्या " + n + " तक्रारी आहेत: " + waiting + " पुनरावलोकनाच्या प्रतीक्षेत, " + working + " प्रगतीपथावर, " + done + " निराकरण झालेल्या.\nएखादी पाहण्यासाठी तक्रार आयडी लिहा, उदा. " + reports[0].id + "."
        };
    }

    function lookUpReport(id) {
        var user = currentUser();

        if (!user) return trackSummary();

        var found = myReports().filter(function (report) {
            return String(report.id).toUpperCase() === id.toUpperCase();
        })[0];

        if (!found) {
            return {
                en: "I could not find " + id + " among your reports. Please check the ID in My Reports.",
                hi: "आपकी रिपोर्ट में " + id + " नहीं मिली। कृपया 'मेरी रिपोर्ट' में आईडी जाँचें।",
                mr: "तुमच्या तक्रारींमध्ये " + id + " सापडली नाही. कृपया 'माझ्या तक्रारी' मध्ये आयडी तपासा."
            };
        }

        var date = found.submittedAt
            ? new Date(found.submittedAt).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric"
            })
            : "-";

        var status = found.status || "Submitted";
        var title = found.title || found.category || "Report";

        return {
            en: id + ": " + title + "\nStatus: " + status + "\nSubmitted: " + date,
            hi: id + ": " + title + "\nस्थिति: " + status + "\nदर्ज की गई: " + date,
            mr: id + ": " + title + "\nस्थिती: " + status + "\nनोंदवले: " + date
        };
    }

    function answer(intentId) {
        if (intentId === "track") {
            addMessage(pick(trackSummary()), "bot", linkFor("track"));
            return;
        }

        var entry = A[intentId] || A.fallback;

        addMessage(pick(entry), "bot", linkFor(intentId));
    }

    function handleQuestion(text) {
        var clean = text.trim();

        if (!clean) return;

        addMessage(clean, "user");

        var idMatch = clean.match(/CCA-\d+/i);

        if (idMatch) {
            addMessage(pick(lookUpReport(idMatch[0])), "bot", linkFor("track"));
            return;
        }

        var lower = " " + clean.toLowerCase() + " ";
        var best = null;
        var bestScore = 0;

        INTENTS.forEach(function (intent) {
            var score = 0;

            intent.words.forEach(function (word) {
                if (lower.indexOf(word) !== -1) score++;
            });

            if (score > bestScore) {
                best = intent.id;
                bestScore = score;
            }
        });

        answer(best || "fallback");
    }

    var CHIPS = [
        { label: "How do I report an issue?", intent: "report" },
        { label: "Track my report", intent: "track" },
        { label: "Phone or birth date", intent: "profile" },
        { label: "Dark mode & language", intent: "settings" }
    ];

    function greeting() {
        var user = currentUser();
        var first = user && user.name ? " " + user.name.split(" ")[0] : "";

        return {
            en: "Hi" + first + "! I'm the CivicConnect help assistant. I can guide you through reporting issues, tracking reports, your profile and settings.",
            hi: "नमस्ते" + first + "! मैं सिविककनेक्ट का सहायक हूँ। मैं समस्या दर्ज करने, रिपोर्ट ट्रैक करने, प्रोफ़ाइल और सेटिंग्स में आपकी मदद कर सकता हूँ।",
            mr: "नमस्कार" + first + "! मी सिविककनेक्टचा मदत सहाय्यक आहे. तक्रार नोंदवणे, मागोवा, प्रोफाइल आणि सेटिंग्जमध्ये मी मदत करू शकतो."
        };
    }

    function buildChips() {
        assistant.chips.replaceChildren();

        CHIPS.forEach(function (chip) {
            var button = document.createElement("button");

            button.type = "button";
            button.setAttribute("data-no-i18n", "");
            button.textContent = t(chip.label);

            button.addEventListener("click", function () {
                addMessage(t(chip.label), "user");
                answer(chip.intent);
            });

            assistant.chips.appendChild(button);
        });
    }

    function refreshAssistantLanguage() {
        if (!assistant.built) return;

        assistant.panel.querySelector("[data-cc-title]").textContent =
            t("Help Assistant");
        assistant.panel.querySelector("[data-cc-sub]").textContent =
            t("Automated guide · not a live agent");
        assistant.input.setAttribute("placeholder", t("Type your question..."));
        assistant.panel.querySelector("[data-cc-send]").textContent = t("Send");

        buildChips();
    }

    function buildAssistant() {
        var button = document.createElement("button");

        button.type = "button";
        button.className = "cc-bot-button";
        button.setAttribute("aria-label", "Open help assistant");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("data-no-i18n", "");
        button.textContent = "💬";

        var panel = document.createElement("section");

        panel.className = "cc-bot";
        panel.hidden = true;
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Help assistant");
        panel.setAttribute("data-no-i18n", "");

        panel.innerHTML =
            '<div class="cc-bot-head">' +
                '<div><strong data-cc-title></strong>' +
                '<span data-cc-sub></span></div>' +
                '<button type="button" class="cc-bot-close" ' +
                'aria-label="Close help assistant">✕</button>' +
            '</div>' +
            '<div class="cc-bot-messages" aria-live="polite"></div>' +
            '<div class="cc-chips"></div>' +
            '<form class="cc-bot-form">' +
                '<input type="text" maxlength="200" ' +
                'aria-label="Your question" autocomplete="off">' +
                '<button type="submit" data-cc-send></button>' +
            '</form>' +
            '<div class="cc-bot-foot">Answers come from built-in help topics.</div>';

        document.body.appendChild(button);
        document.body.appendChild(panel);

        assistant.button = button;
        assistant.panel = panel;
        assistant.messages = panel.querySelector(".cc-bot-messages");
        assistant.chips = panel.querySelector(".cc-chips");
        assistant.input = panel.querySelector("input");
        assistant.built = true;

        refreshAssistantLanguage();
        addMessage(pick(greeting()), "bot");

        button.addEventListener("click", function () {
            if (panel.hidden) {
                openAssistant();
            } else {
                closeAssistant();
            }
        });

        panel.querySelector(".cc-bot-close")
            .addEventListener("click", closeAssistant);

        panel.querySelector("form").addEventListener("submit", function (event) {
            event.preventDefault();

            handleQuestion(assistant.input.value);
            assistant.input.value = "";
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !panel.hidden) closeAssistant();
        });
    }

    function openAssistant() {
        if (!assistant.built) return;

        assistant.panel.hidden = false;
        assistant.button.setAttribute("aria-expanded", "true");
        assistant.input.focus();
    }

    function closeAssistant() {
        if (!assistant.built) return;

        assistant.panel.hidden = true;
        assistant.button.setAttribute("aria-expanded", "false");
        assistant.button.focus();
    }


    // -------------------------------------------------
    // 6. START
    // -------------------------------------------------

    function start() {
        applyAppearance();
        applyLanguage();

        // The assistant and the settings panel are only for signed-in pages
        // and for the public home page; login and register have their own.
        buildAssistant();
        initializeSettings();
        watchForNewContent();
    }

    // Apply the saved look at once so the page does not flash.
    applyAppearance();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();


// Keep the chatbot's copy of the person's reports fresh.
(function () {
    "use strict";

    window.addEventListener("load", function () {
        if (typeof CivicAPI !== "undefined" && CivicAPI.isLoggedIn() &&
            !CivicAPI.isAdmin()) {
            CivicAPI.myReports().catch(function () { /* optional */ });
        }
    });
})();
