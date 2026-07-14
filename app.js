let notificationCount = 0;

function updateNotificationBadge(count) {
    notificationCount = count;
    const badge = document.getElementById("notificationBadge");
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.classList.add("visible");
    } else {
        badge.classList.remove("visible");
    }
}

function addNotification(count = 1) {
    updateNotificationBadge(notificationCount + count);
}

function clearNotifications() {
    updateNotificationBadge(0);
}

const API_URL = "";
let currentReport = null;

let analysisHistory = [];
let lastAnalysis = null;
let lastBulk = null;
const charts = {};

const USERS_KEY = "srs_users";
const SESSION_KEY = "srs_session";

function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch { return {}; }
}
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
}
function setSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function switchAuth(mode) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.toggle("active", t.dataset.auth === mode));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.toggle("active", f.id === mode + "Form"));
    setText("signupError", "");
    setText("signinError", "");
}

function enterApp(user) {
    const overlay = document.getElementById("authOverlay");
    const app = document.getElementById("appContainer");
    if (overlay) overlay.style.display = "none";
    if (app) app.style.display = "flex";

    const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
    setText("userAvatar", initial);
    setText("userName", user.name || user.email);
    setText("profileAvatar", initial);
    setText("profileName", user.name || "User");
    setText("profileEmail", user.email);

    bootApp();
}

function initAuth() {
    const session = getSession();
    if (session && session.email) {
        enterApp(session);
        return;
    }

    const overlay = document.getElementById("authOverlay");
    const app = document.getElementById("appContainer");
    if (overlay) overlay.style.display = "flex";
    if (app) app.style.display = "none";

    document.querySelectorAll(".auth-tab").forEach(t => {
        t.addEventListener("click", () => switchAuth(t.dataset.auth));
    });
    document.querySelectorAll("[data-go]").forEach(a => {
        a.addEventListener("click", (e) => { e.preventDefault(); switchAuth(a.dataset.go); });
    });

    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("regName").value.trim();
            const email = document.getElementById("regEmail").value.trim().toLowerCase();
            const password = document.getElementById("regPassword").value;
            const confirm = document.getElementById("regConfirm").value;

            if (!name || !email || !password) {
                setText("signupError", "Please fill in all fields.");
                return;
            }
            if (/\d/.test(name)) {
                setText("signupError", "Name must not contain numbers.");
                return;
            }
            if (password.length < 6) {
                setText("signupError", "Password must be at least 6 characters.");
                return;
            }
            if (password !== confirm) {
                setText("signupError", "Passwords do not match.");
                return;
            }

            const users = getUsers();
            if (users[email]) {
                setText("signupError", "An account with this email already exists.");
                return;
            }

            users[email] = { name, email, password };
            saveUsers(users);
            setSession({ name, email });
            enterApp({ name, email });
        });
    }

    const signinForm = document.getElementById("signinForm");
    if (signinForm) {
        signinForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("loginEmail").value.trim().toLowerCase();
            const password = document.getElementById("loginPassword").value;
            const users = getUsers();
            const user = users[email];

            if (!user || user.password !== password) {
                setText("signinError", "Invalid email or password.");
                return;
            }
            setSession({ name: user.name, email: user.email });
            enterApp({ name: user.name, email: user.email });
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            clearSession();
            location.reload();
        });
    }
}

function bootApp() {
    initSidebar();
    initTabs();
    initSingleUpload();
    initBulkUpload();
    initAnalyzeButtons();
    initBuilder();
    initNav();
    initJobPostings();
    initSettings();
    updateNotificationBadge(0);
    const notifBtn = document.getElementById("notificationBtn");
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            clearNotifications();
        });
    }
}

function isAnalyticsActive() {
    const v = document.getElementById("analytics-view");
    return !!(v && v.classList.contains("active"));
}

function initNav() {
    document.querySelectorAll(".nav-item[data-view]").forEach(li => {
        const link = li.querySelector(".nav-link");
        if (!link) return;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const view = li.dataset.view;
            document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
            li.classList.add("active");
            document.querySelectorAll(".view-content").forEach(v => v.classList.remove("active"));
            const target = document.getElementById(view + "-view");
            if (target) target.classList.add("active");
            if (li.dataset.tab) {
                const tabBtn = document.querySelector(`.tab-btn[data-tab="${li.dataset.tab}"]`);
                if (tabBtn) tabBtn.click();
            }
            if (view === "analytics") renderAnalytics();
            if (view === "talent") renderTalent();
            if (view === "jobs") renderJobs();
            if (view === "settings") renderSettings();
        });
    });
}

function activateDashboardTab(tab) {
    document.querySelectorAll(".view-content").forEach(v => v.classList.remove("active"));
    const dv = document.getElementById("dashboard-view");
    if (dv) dv.classList.add("active");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    const dash = document.querySelector('.nav-item[data-view="dashboard"]');
    if (dash) dash.classList.add("active");
    const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (btn) btn.click();
}

const JOBS_KEY = "srs_jobs";
function getJobs() {
    try { return JSON.parse(localStorage.getItem(JOBS_KEY)) || []; }
    catch { return []; }
}
function saveJobs(j) { localStorage.setItem(JOBS_KEY, JSON.stringify(j)); }

function initJobPostings() {
    const save = document.getElementById("jpSave");
    if (save) {
        save.addEventListener("click", () => {
            const title = document.getElementById("jpTitle").value.trim();
            const desc = document.getElementById("jpDesc").value.trim();
            if (!desc) { alert("Please enter a job description."); return; }
            const jobs = getJobs();
            jobs.unshift({ id: Date.now(), title: title || "Untitled Role", desc });
            saveJobs(jobs);
            document.getElementById("jpTitle").value = "";
            document.getElementById("jpDesc").value = "";
            renderJobs();
        });
    }
    renderJobs();
}

function renderJobs() {
    const jobs = getJobs();
    const list = document.getElementById("jpList");
    const empty = document.getElementById("jpEmpty");
    const count = document.getElementById("jpCount");
    if (count) count.textContent = `${jobs.length}`;
    if (!list) return;
    if (!jobs.length) { if (empty) empty.style.display = "flex"; list.innerHTML = ""; return; }
    if (empty) empty.style.display = "none";
    list.innerHTML = jobs.map(j => `
        <div class="job-card-item">
            <div class="job-card-item-head">
                <span class="job-card-item-title">${escapeHtml(j.title)}</span>
                <button class="icon-btn-text" data-del="${j.id}" title="Delete">&#10005;</button>
            </div>
            <p class="job-card-item-desc">${escapeHtml(j.desc.slice(0, 160))}${j.desc.length > 160 ? "..." : ""}</p>
            <div class="job-card-item-actions">
                <button class="btn-secondary" data-load="single" data-id="${j.id}">Load to Single</button>
                <button class="btn-secondary" data-load="bulk" data-id="${j.id}">Load to Bulk</button>
            </div>
        </div>
    `).join("");
    list.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
        const id = Number(b.dataset.del);
        saveJobs(getJobs().filter(x => x.id !== id));
        renderJobs();
    }));
    list.querySelectorAll("[data-load]").forEach(b => b.addEventListener("click", () => {
        const job = getJobs().find(x => x.id === Number(b.dataset.id));
        if (!job) return;
        if (b.dataset.load === "single") {
            const el = document.getElementById("jobDescription");
            if (el) el.value = job.desc;
            activateDashboardTab("single");
        } else {
            const el = document.getElementById("bulkJd");
            if (el) el.value = job.desc;
            activateDashboardTab("bulk");
        }
    }));
}

function renderTalent() {
    const list = document.getElementById("talentList");
    const empty = document.getElementById("talentEmpty");
    if (!list) return;
    if (!analysisHistory.length) { if (empty) empty.style.display = "flex"; list.innerHTML = ""; return; }
    if (empty) empty.style.display = "none";
    list.innerHTML = analysisHistory.map((h, i) => {
        const score = h.score || 0;
        const skills = (h.skills || []).slice(0, 6)
            .map(s => `<span class="keyword-tag matched">${escapeHtml(s)}</span>`).join("");
        return `
            <div class="talent-item">
                <div class="talent-rank">${i + 1}</div>
                <div class="talent-main">
                    <div class="talent-name">${escapeHtml(h.name)}</div>
                    <div class="score-bar" style="margin-top:6px;"><div class="score-fill" style="width:${score}%"></div></div>
                    <div class="skill-tags" style="margin-top:8px;">${skills || '<span style="color:#999;font-size:12px;">No skills detected</span>'}</div>
                </div>
                <div class="talent-score">${score}%</div>
            </div>`;
    }).join("");
}

function initSettings() {
    const logout = document.getElementById("setLogout");
    if (logout) logout.addEventListener("click", () => { clearSession(); location.reload(); });
    const clear = document.getElementById("setClear");
    if (clear) clear.addEventListener("click", () => {
        if (confirm("Clear all local data (users, session, jobs, history)?")) {
            localStorage.removeItem("srs_users");
            localStorage.removeItem("srs_jobs");
            clearSession();
            location.reload();
        }
    });
    renderSettings();
}

function renderSettings() {
    const session = getSession();
    if (session) {
        const init = (session.name || session.email || "U").trim().charAt(0).toUpperCase();
        setText("setAvatar", init);
        setText("setName", session.name || "User");
        setText("setEmail", session.email || "");
    }
}

function skillFrequency() {
    const counts = {};
    analysisHistory.forEach(h => (h.skills || []).forEach(s => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts)
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

function makeChart(id, config) {
    if (charts[id]) charts[id].destroy();
    const el = document.getElementById(id);
    if (!el) return;
    charts[id] = new Chart(el.getContext("2d"), config);
}

function drawBar(id, emptyId, labels, values, color) {
    const el = document.getElementById(id);
    const empty = document.getElementById(emptyId);
    if (!el) return;
    if (!labels.length) {
        if (empty) empty.style.display = "block";
        el.style.display = "none";
        return;
    }
    if (empty) empty.style.display = "none";
    el.style.display = "block";
    makeChart(id, {
        type: "bar",
        data: {
            labels,
            datasets: [{ label: "Match %", data: values, backgroundColor: color, borderRadius: 6 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { font: { size: 11 } }, grid: { display: false } } }
        }
    });
}

function drawDoughnut(id, emptyId, values) {
    const el = document.getElementById(id);
    const empty = document.getElementById(emptyId);
    if (!el) return;
    if (!values[0] && !values[1]) {
        if (empty) empty.style.display = "block";
        el.style.display = "none";
        return;
    }
    if (empty) empty.style.display = "none";
    el.style.display = "block";
    makeChart(id, {
        type: "doughnut",
        data: {
            labels: ["Matched Skills", "Missing Skills"],
            datasets: [{ data: values, backgroundColor: ["#EC4899", "#DC2626"], borderWidth: 0 }]
        },
        options: { responsive: true, cutout: "62%", plugins: { legend: { position: "bottom" } } }
    });
}

function renderAnalytics() {
    if (typeof Chart === "undefined") return;

    drawBar("scoreChart", "scoreChartEmpty",
        analysisHistory.map(h => h.name),
        analysisHistory.map(h => h.score),
        "#EC4899");

    if (lastAnalysis && lastAnalysis.skill_comparison) {
        const sc = lastAnalysis.skill_comparison;
        drawDoughnut("skillChart", "skillChartEmpty",
            [sc.matched_skills.length, sc.missing_skills.length]);
    } else {
        drawDoughnut("skillChart", "skillChartEmpty", [0, 0]);
    }

    const freq = skillFrequency();
    drawBar("skillsFreqChart", "skillsFreqEmpty",
        freq.map(f => f.skill),
        freq.map(f => f.count),
        "#2563EB");

    if (lastBulk && lastBulk.length) {
        drawBar("bulkChart", "bulkChartEmpty",
            lastBulk.map(r => r.filename),
            lastBulk.map(r => r.match_score),
            "#EC4899");
    } else {
        drawBar("bulkChart", "bulkChartEmpty", [], [], "#EC4899");
    }
}


document.addEventListener("DOMContentLoaded", () => {
    initAuth();
});

function initSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("sidebar");
    if (toggle && sidebar) {
        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("collapsed");
        });
    }
}

function initTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabs = document.querySelectorAll(".tab-content");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabs.forEach(t => t.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
        });
    });
}

function initFileUpload(zoneId, inputId, fileNameId, multiple = false) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const fileNameDisplay = document.getElementById(fileNameId);
    const browseBtn = zone.querySelector(".btn-upload");

    if (browseBtn) {
        browseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            input.click();
        });
    }

    zone.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") {
            input.click();
        }
    });

    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            updateFileDisplay(files, fileNameDisplay, multiple);
        }
    });

    input.addEventListener("change", (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            updateFileDisplay(files, fileNameDisplay, multiple);
        }
    });
}

function updateFileDisplay(files, displayElement, multiple) {
    if (multiple) {
        displayElement.textContent = `${files.length} file(s) selected`;
        const countEl = document.getElementById("fileCount");
        if (countEl) countEl.textContent = `Selected: ${files.length} resume(s)`;
    } else {
        displayElement.textContent = files[0].name;
    }
}

function initSingleUpload() {
    initFileUpload("singleUploadZone", "singleFileInput", "singleFileName");
}

function initBulkUpload() {
    initFileUpload("bulkUploadZone", "bulkFileInput", "bulkFileName", true);
}

function initAnalyzeButtons() {
    const singleBtn = document.getElementById("singleAnalyzeBtn");
    const bulkBtn = document.getElementById("bulkAnalyzeBtn");
    if (singleBtn) singleBtn.addEventListener("click", analyzeSingle);
    if (bulkBtn) bulkBtn.addEventListener("click", analyzeBulk);
}

async function analyzeSingle() {
    const fileInput = document.getElementById("singleFileInput");
    const jdInput = document.getElementById("jobDescription");
    const emptyState = document.getElementById("emptyState");
    const resultsContent = document.getElementById("resultsContent");
    
    if (!fileInput || !fileInput.files.length) {
        alert("Please upload a resume first.");
        return;
    }
    if (!jdInput || !jdInput.value.trim()) {
        alert("Please enter a job description.");
        return;
    }
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("job_description", jdInput.value);
    
    const btn = document.getElementById("singleAnalyzeBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Analyzing...";
    }
    
    try {
        const response = await fetch(`${API_URL}/api/upload-single`, {
            method: "POST",
            body: formData,
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Analysis failed");
        }
        
        const data = await response.json();
        currentReport = data.report_filename;
        renderSingleResults(data);
        if (emptyState) emptyState.style.display = "none";
        if (resultsContent) {
            resultsContent.style.display = "block";
            resultsContent.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        updateMetrics(data.match_score);

        lastAnalysis = data;
        analysisHistory.push({
            name: data.candidate_name || "Resume",
            score: data.match_score || 0,
            skills: (data.skill_comparison && data.skill_comparison.matched_skills) || []
        });
        if (isAnalyticsActive()) renderAnalytics();
        addNotification(1);
    } catch (err) {
        alert(err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Analyze Resume";
        }
    }
}

const ROLE_MAP = {
    "Python Developer": ["python", "django", "flask", "sql", "postgresql", "rest api", "git", "docker"],
    "Data Scientist": ["python", "machine learning", "deep learning", "pandas", "numpy", "nlp", "data analysis", "tensorflow", "pytorch"],
    "Frontend Developer": ["react", "angular", "vue", "javascript", "typescript", "html", "css", "tailwind", "bootstrap"],
    "DevOps Engineer": ["aws", "azure", "gcp", "docker", "kubernetes", "jenkins", "ci/cd", "linux", "bash"],
    "Full Stack Developer": ["python", "react", "node.js", "sql", "django", "rest api", "docker"],
    "Mobile Developer": ["android", "ios", "flutter", "react native", "kotlin", "swift"],
    "UI/UX Designer": ["figma", "photoshop", "illustrator", "ui/ux"],
    "Product Manager": ["product management", "agile", "scrum", "communication", "leadership"],
};

function titleCase(str) {
    return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function generateGuidance(data) {
    const score = data.match_score || 0;
    const missingSkills = (data.skill_comparison && data.skill_comparison.missing_skills) || [];
    const missingKw = data.missing_keywords || [];
    const tips = [];

    let verdict;
    if (score >= 80) verdict = `Strong match at ${score}% — you are well positioned for this role.`;
    else if (score >= 60) verdict = `Good match at ${score}% — a few targeted improvements will make you a top candidate.`;
    else if (score >= 40) verdict = `Partial match at ${score}% — bridging the gaps below will help you compete.`;
    else verdict = `Low match at ${score}% — focus on the key missing areas to become competitive.`;
    tips.push(verdict);

    if (missingSkills.length) {
        const list = missingSkills.slice(0, 6).map(s => titleCase(s)).join(", ");
        tips.push(`Build or highlight experience in: ${list}. Add projects, certifications, or coursework that prove these skills.`);
    }
    if (missingKw.length) {
        const list = missingKw.slice(0, 5).map(k => `"${k}"`).join(", ");
        tips.push(`Include relevant keywords from the job description such as ${list} so your resume passes ATS screening.`);
    }
    tips.push(`Quantify achievements (e.g. "improved X by Y%") and tailor your professional summary to this specific role.`);
    return tips;
}

function generateMistakes(data) {
    const score = data.match_score || 0;
    const missingSkills = (data.skill_comparison && data.skill_comparison.missing_skills) || [];
    const missingKw = data.missing_keywords || [];
    const mp = (data.skill_comparison && data.skill_comparison.match_percentage) || 0;
    const mistakes = [];

    if (score < 80) mistakes.push(`Resume is only ${score}% aligned to this role — it is not tailored to the job description.`);
    if (mp < 70) mistakes.push(`Skill coverage is low (${mp}%) compared to what the role demands.`);
    if (missingSkills.length) {
        const list = missingSkills.slice(0, 6).map(s => titleCase(s)).join(", ");
        mistakes.push(`Missing required skills: ${list}.`);
    }
    if (missingKw.length) {
        const list = missingKw.slice(0, 5).map(k => `"${k}"`).join(", ");
        mistakes.push(`Missing important keywords from the JD such as ${list} — ATS may reject the resume.`);
    }
    if (!data.matched_keywords || data.matched_keywords.length === 0) {
        mistakes.push(`No overlapping keywords with the job description were detected.`);
    }
    if (mistakes.length === 0) mistakes.push(`No major mistakes found — the resume is well aligned to this role.`);
    return mistakes;
}

function renderRequirements(data) {
    const have = (data.skill_comparison && data.skill_comparison.matched_skills) || [];
    const need = (data.skill_comparison && data.skill_comparison.missing_skills) || [];
    const haveEl = document.getElementById("reqHave");
    const needEl = document.getElementById("reqNeed");
    if (haveEl) {
        haveEl.innerHTML = have.length
            ? have.map(s => `<span class="keyword-tag matched">${escapeHtml(s)}</span>`).join("")
            : '<span style="color:#999;font-size:12px;">None yet</span>';
    }
    if (needEl) {
        needEl.innerHTML = need.length
            ? need.map(s => `<span class="keyword-tag missing">${escapeHtml(s)}</span>`).join("")
            : '<span style="color:#999;font-size:12px;">Nothing missing — great!</span>';
    }
}

function generateJobs(data) {
    const candSkills = new Set(((data.skill_comparison && data.skill_comparison.matched_skills) || []).map(s => s.toLowerCase()));

    const results = [];
    for (const [role, req] of Object.entries(ROLE_MAP)) {
        const reqSet = req.map(r => r.toLowerCase());
        const matched = reqSet.filter(r => candSkills.has(r));
        if (matched.length === 0) continue;
        const score = Math.round((matched.length / reqSet.length) * 100);
        if (score < 30) continue;
        results.push({ role, score, matched });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 4);
}

function renderSingleResults(data) {
    const score = data.match_score || 0;
    const scoreText = document.getElementById("scoreText");
    const scoreCircle = document.getElementById("scoreCircle");
    const scoreGrade = document.getElementById("scoreGrade");
    
    if (scoreText) scoreText.textContent = `${score}%`;
    if (scoreCircle) scoreCircle.setAttribute("stroke-dasharray", `${score}, 100`);
    
    if (scoreGrade) {
        let gradeColor;
        if (score >= 80) { scoreGrade.textContent = "Excellent Match"; gradeColor = "var(--green)"; }
        else if (score >= 60) { scoreGrade.textContent = "Good Match"; gradeColor = "var(--amber)"; }
        else if (score >= 40) { scoreGrade.textContent = "Partial Match"; gradeColor = "#b45309"; }
        else { scoreGrade.textContent = "Low Match"; gradeColor = "var(--red)"; }
        scoreGrade.style.background = gradeColor;
    }

    if (score >= 80) {
        if (scoreCircle) scoreCircle.setAttribute("stroke", "#2E7D32");
    } else if (score >= 60) {
        if (scoreCircle) scoreCircle.setAttribute("stroke", "#F57C00");
    } else {
        if (scoreCircle) scoreCircle.setAttribute("stroke", "#C62828");
    }
    
    renderKeywords(
        (data.skill_comparison && data.skill_comparison.matched_skills) || [],
        (data.skill_comparison && data.skill_comparison.missing_skills) || []
    );

    const pot = data.potential_match;
    const potEl = document.getElementById("scorePotential");
    if (potEl) {
        potEl.textContent = (pot != null) ? `Your resume can match up to ${pot}% of this role` : "";
    }
    
    const llmJustification = document.getElementById("llmJustification");
    if (llmJustification && data.llm_justification) {
        llmJustification.textContent = `AI Assessment: ${data.llm_justification}`;
        llmJustification.style.display = "block";
    } else if (llmJustification) {
        llmJustification.style.display = "none";
    }
    const gapContent = document.getElementById("gapContent");
    if (gapContent) {
        gapContent.textContent = data.skill_gap_analysis || "No significant skill gaps detected.";
    }

    const guidanceList = document.getElementById("guidanceList");
    if (guidanceList) {
        const tips = generateGuidance(data);
        guidanceList.innerHTML = tips.map(t => `<li>${escapeHtml(t)}</li>`).join("");
    }

    const jobCards = document.getElementById("jobCards");
    if (jobCards) {
        const jobs = generateJobs(data);
        if (jobs.length) {
            jobCards.innerHTML = jobs.map(j => `
                <div class="job-card">
                    <div class="job-card-head">
                        <span class="job-title">${escapeHtml(j.role)}</span>
                        <span class="job-score">${j.score}% fit</span>
                    </div>
                    <div class="skill-tags">
                        ${j.matched.slice(0, 6).map(s => `<span class="keyword-tag matched">${escapeHtml(s)}</span>`).join("")}
                    </div>
                </div>
            `).join("");
        } else {
            jobCards.innerHTML = "<span style='color:#999;font-size:12px;'>Add more skills to your resume to see job suggestions.</span>";
        }
    }

    const mistakesList = document.getElementById("mistakesList");
    if (mistakesList) {
        const mistakes = generateMistakes(data);
        mistakesList.innerHTML = mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join("");
    }

    renderRequirements(data);
    
    const exportBtn = document.getElementById("singleExportBtn");
    if (exportBtn) {
        exportBtn.onclick = () => {
            if (currentReport) {
                window.open(`${API_URL}/api/download-report/${currentReport}`, "_blank");
            }
        };
    }
}

function renderKeywords(matched, missing) {
    const matchedContainer = document.getElementById("matchedKeywords");
    const missingContainer = document.getElementById("missingKeywords");
    
    if (matchedContainer) {
        matchedContainer.innerHTML = matched.length
            ? matched.map(kw => `<span class="keyword-tag matched">${escapeHtml(kw)}</span>`).join("")
            : "<span style='color:#999;font-size:12px;'>No keywords matched</span>";
    }
    
    if (missingContainer) {
        missingContainer.innerHTML = missing.length
            ? missing.map(kw => `<span class="keyword-tag missing">${escapeHtml(kw)}</span>`).join("")
            : "<span style='color:#999;font-size:12px;'>No missing keywords</span>";
    }
}

function updateMetrics(score) {
    const totalEl = document.getElementById("totalProcessed");
    const avgEl = document.getElementById("avgScore");
    const topEl = document.getElementById("topCandidates");
    
    if (totalEl) totalEl.textContent = Number(totalEl.textContent) + 1;
    if (avgEl) {
        const current = parseFloat(avgEl.textContent) || 0;
        const count = Number(totalEl.textContent) || 1;
        avgEl.textContent = `${Math.round(((current * (count - 1)) + score) / count)}%`;
    }
    if (topEl && score >= 70) topEl.textContent = Number(topEl.textContent) + 1;
}

async function analyzeBulk() {
    const fileInput = document.getElementById("bulkFileInput");
    const jdInput = document.getElementById("bulkJd");
    const bulkEmptyState = document.getElementById("bulkEmptyState");
    const bulkResultsContent = document.getElementById("bulkResultsContent");
    
    if (!fileInput || !fileInput.files.length) {
        alert("Please upload at least one resume.");
        return;
    }
    if (!jdInput || !jdInput.value.trim()) {
        alert("Please enter a job description.");
        return;
    }
    if (fileInput.files.length > 100) {
        alert("Maximum 100 resumes allowed.");
        return;
    }
    
    const formData = new FormData();
    Array.from(fileInput.files).forEach(f => formData.append("files", f));
    formData.append("job_description", jdInput.value);
    
    const btn = document.getElementById("bulkAnalyzeBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Processing...";
    }
    
    try {
        const response = await fetch(`${API_URL}/api/upload-bulk`, {
            method: "POST",
            body: formData,
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Bulk analysis failed");
        }
        
        const data = await response.json();
        const resultCount = document.getElementById("bulkResultCount");
        if (resultCount) resultCount.textContent = `${data.total} candidates`;
        renderBulkResults(data.results);
        if (bulkEmptyState) bulkEmptyState.style.display = "none";
        if (bulkResultsContent) {
            bulkResultsContent.style.display = "block";
            bulkResultsContent.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        lastBulk = data.results || [];
        (data.results || []).forEach(item => {
            analysisHistory.push({
                name: item.filename || "Resume",
                score: item.match_score || 0,
                skills: (item.skill_comparison && item.skill_comparison.matched_skills) || []
            });
        });
        if (isAnalyticsActive()) renderAnalytics();
        addNotification(data.total || 1);
    } catch (err) {
        alert(err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Analyze & Rank Candidates";
        }
    }
}

function renderBulkResults(results) {
    const tbody = document.getElementById("leaderboardBody");
    const shortlistSection = document.getElementById("shortlistSection");
    const shortlistBody = document.getElementById("shortlistBody");
    
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const shortlisted = [];
    
    results.forEach(item => {
        const row = document.createElement("div");
        row.className = "leaderboard-item";
        const rankClass = item.rank <= 3 ? ` rank-${item.rank}` : "";
        row.innerHTML = `
            <span class="rank${rankClass}">${item.rank}</span>
            <span>${escapeHtml(item.filename)}</span>
            <span>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${item.match_score}%"></div>
                </div>
                <small style="color: var(--text-secondary); font-size: 11px;">${item.match_score.toFixed(1)}%</small>
            </span>
            <span>
                <div class="skill-tags">
                    ${(item.skill_comparison.matched_skills || []).slice(0, 3).map(s => `<span class="keyword-tag matched">${escapeHtml(s)}</span>`).join("")}
                    ${(item.skill_comparison.matched_skills || []).length > 3 ? `<span style="color:var(--text-secondary);font-size:11px;">+${(item.skill_comparison.matched_skills || []).length - 3}</span>` : ""}
                </div>
            </span>
            <span>
                <div class="skill-tags">
                    ${(item.skill_comparison.missing_skills || []).slice(0, 3).map(s => `<span class="keyword-tag missing">${escapeHtml(s)}</span>`).join("")}
                    ${(item.skill_comparison.missing_skills || []).length > 3 ? `<span style="color:var(--text-secondary);font-size:11px;">+${(item.skill_comparison.missing_skills || []).length - 3}</span>` : ""}
                </div>
            </span>
        `;
        tbody.appendChild(row);
        
        if (item.match_score >= 70) {
            shortlisted.push(item);
        }
    });
    
    if (shortlistBody && shortlistSection) {
        shortlistBody.innerHTML = "";
        
        if (shortlisted.length === 0) {
            shortlistSection.style.display = "none";
            return;
        }
        
        shortlistSection.style.display = "block";
        const grid = document.createElement("div");
        grid.className = "shortlist-grid";
        
        shortlisted.forEach(item => {
            const matchedSkills = item.skill_comparison.matched_skills || [];
            const missingSkills = item.skill_comparison.missing_skills || [];
            const matchPercent = item.match_score;
            
            let reason = "";
            if (matchPercent >= 90) {
                reason = "Excellent match. Candidate possesses nearly all required skills and demonstrates strong alignment with the job requirements.";
            } else if (matchPercent >= 80) {
                reason = "Strong match. Candidate has most of the required skills with only minor gaps that can be addressed through onboarding.";
            } else if (matchPercent >= 70) {
                reason = "Good match. Candidate meets core requirements but may need training in a few areas. Recommended for interview.";
            } else {
                reason = "Moderate match. Candidate has some relevant skills but significant gaps exist. Consider for junior or training positions.";
            }
            
            if (matchedSkills.length > 0) {
                reason += ` Key strengths: ${matchedSkills.slice(0, 3).join(", ")}.`;
            }
            if (missingSkills.length > 0 && missingSkills.length <= 3) {
                reason += ` Areas to assess: ${missingSkills.join(", ")}.`;
            }
            
            const card = document.createElement("div");
            card.className = "shortlist-card";
            const llmJustification = item.llm_justification || "";
            card.innerHTML = `
                <div class="shortlist-card-head">
                    <span class="shortlist-name">${escapeHtml(item.filename)}</span>
                    <span class="shortlist-badge">Shortlisted</span>
                </div>
                <div class="shortlist-score">${matchPercent.toFixed(1)}%</div>
                <div class="shortlist-reason">${escapeHtml(reason)}${llmJustification ? `<br><br><strong style="color: var(--accent);">AI Justification:</strong> ${escapeHtml(llmJustification)}` : ""}</div>
                <div class="shortlist-skills">
                    ${matchedSkills.slice(0, 5).map(s => `<span class="keyword-tag matched">${escapeHtml(s)}</span>`).join("")}
                </div>
            `;
            grid.appendChild(card);
        });
        
        shortlistBody.appendChild(grid);
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function initBuilder() {
    const fields = ["rbName", "rbTitle", "rbEmail", "rbPhone", "rbLocation", "rbSummary", "rbSkills", "rbExp", "rbEdu"];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", renderResumePreview);
    });

    const photoZone = document.getElementById("rbPhotoZone");
    const photoInput = document.getElementById("rbPhoto");
    if (photoZone && photoInput) {
        const btn = photoZone.querySelector(".btn-upload");
        if (btn) btn.addEventListener("click", e => { e.stopPropagation(); photoInput.click(); });
        photoZone.addEventListener("click", e => { if (e.target.tagName !== "BUTTON") photoInput.click(); });
        photoInput.addEventListener("change", () => {
            const f = photoInput.files[0];
            const nameEl = document.getElementById("rbPhotoName");
            if (nameEl) nameEl.textContent = f ? f.name : "";
            if (!f) return;
            const reader = new FileReader();
            reader.onload = e => {
                const prev = document.getElementById("rbPhotoPreview");
                if (prev) {
                    prev.style.backgroundImage = `url(${e.target.result})`;
                    prev.style.backgroundSize = "cover";
                    prev.style.backgroundPosition = "center";
                    prev.textContent = "";
                }
            };
            reader.readAsDataURL(f);
        });
    }

    const printBtn = document.getElementById("rbPrintBtn");
    if (printBtn) printBtn.addEventListener("click", printResume);

    renderResumePreview();
}

function renderResumePreview() {
    const get = id => ((document.getElementById(id) || {}).value || "").trim();
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText("rbPrevName", get("rbName") || "Your Name");
    setText("rbPrevTitle", get("rbTitle") || "Professional Title");

    const contact = [get("rbEmail"), get("rbPhone"), get("rbLocation")].filter(Boolean).join("   •   ");
    setText("rbPrevContact", contact);

    const summary = get("rbSummary");
    const sumEl = document.getElementById("rbPrevSummary");
    if (sumEl) {
        sumEl.textContent = summary || "Your professional summary will appear here.";
        sumEl.classList.toggle("rb-muted", !summary);
    }

    const skills = get("rbSkills").split(",").map(s => s.trim()).filter(Boolean);
    const skEl = document.getElementById("rbPrevSkills");
    if (skEl) {
        skEl.innerHTML = skills.length
            ? skills.map(s => `<span class="rb-skill">${escapeHtml(s)}</span>`).join("")
            : '<span class="rb-muted">Your skills will appear here.</span>';
    }

    const exp = get("rbExp").split("\n").map(s => s.trim()).filter(Boolean);
    const expEl = document.getElementById("rbPrevExp");
    if (expEl) {
        expEl.innerHTML = exp.length
            ? exp.map(l => `<div class="rb-item">${escapeHtml(l.replace(/^[-•]\s*/, ""))}</div>`).join("")
            : '<p class="rb-muted">Your experience will appear here.</p>';
    }

    const edu = get("rbEdu").split("\n").map(s => s.trim()).filter(Boolean);
    const eduEl = document.getElementById("rbPrevEdu");
    if (eduEl) {
        eduEl.innerHTML = edu.length
            ? edu.map(l => `<div class="rb-item">${escapeHtml(l.replace(/^[-•]\s*/, ""))}</div>`).join("")
            : '<p class="rb-muted">Your education will appear here.</p>';
    }
}

function printResume() {
    const sheet = document.getElementById("rbSheet").outerHTML;
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Resume</title><link rel="stylesheet" href="styles.css"></head><body class="printing">${sheet}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}
