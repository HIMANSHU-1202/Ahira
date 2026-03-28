/* ==========================================================
   AHIRA — chat.js
   1.  State
   2.  Navigation
   3.  Home
   4.  Chat
   5.  Planner (tasks, events, calendar strip, pinning)
   6.  Water (target, log, chart)
   7.  Period
   8.  Medicine (priority, stock, notes)
   9.  Grocery (full form, urgency, deadline)
   10. Wellness loader
   11. Init
========================================================== */


/* ─────────────────────────────────────────────────────────
   1. STATE
───────────────────────────────────────────────────────── */

let water        = parseInt(localStorage.getItem("water")) || 0;
let waterTarget  = parseInt(localStorage.getItem("waterTarget")) || 8;
let waterLog     = JSON.parse(localStorage.getItem("waterLog"))     || [];   // [{time, glasses}]
let waterWeekly  = JSON.parse(localStorage.getItem("waterWeekly"))  || {};   // {"YYYY-MM-DD": n}

let medicines    = JSON.parse(localStorage.getItem("medicines"))    || [];
let groceryItems = JSON.parse(localStorage.getItem("groceryItems")) || [];

let currentGroceryFilter = "all";
let currentMedFilter     = "all";
let selectedTaskType     = "task";
let selectedTaskPriority = "normal";
let selectedMedPriority  = "normal";
let completedVisible     = false;

let lastPeriodDate = localStorage.getItem("lastPeriodDate")
    ? new Date(localStorage.getItem("lastPeriodDate"))
    : null;

const safe = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };


/* ─────────────────────────────────────────────────────────
   2. NAVIGATION
───────────────────────────────────────────────────────── */

function nav(screen, btn) {
    document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
    const target = document.getElementById(screen);
    if (target) target.style.display = "block";

    document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
    if (btn && btn.classList && btn.classList.contains("navBtn")) btn.classList.add("active");

    const loaders = {
        homeScreen:     loadHomeData,
        plannerScreen:  loadPlanner,
        wellnessScreen: loadWellnessScreen,
        medicineScreen: loadMedicines,
        waterScreen:    loadWaterScreen,
        groceryScreen:  loadGrocery,
        periodScreen:   calculatePeriod,
    };
    if (loaders[screen]) loaders[screen]();
}


/* ─────────────────────────────────────────────────────────
   3. HOME
───────────────────────────────────────────────────────── */

async function loadHomeData() {
    updateDateTime();
    renderHomeWaterDrops();
    calculatePeriod();
    renderHomeMedCard();
    renderHomeGroceryCard();
    renderHomeAlerts();
    try {
        const res  = await fetch("/reminders");
        const data = await res.json();
        updateSummaryCounts(data.tasks);
    } catch (e) { console.error("[Home]", e); }
}

/* ── Home mood checker ── */
function selectMood(btn, mood, emoji) {
    // Highlight selected button
    document.querySelectorAll(".moodBtn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    const responses = {
        happy: {
            text: `${emoji} You're glowing today! That positive energy is contagious 🌟\n\nKeep doing whatever made you feel this way. Maybe share that joy with someone you love today? 💜`,
            tip: "Tip: Write down 3 things that made you happy today — it helps reinforce the good feelings."
        },
        calm: {
            text: `${emoji} What a peaceful state to be in 🌿\n\nCalmness is a superpower. Use this energy to focus on something meaningful or just enjoy the stillness.`,
            tip: "Tip: Try a 5-minute mindful breathing session to deepen this calm."
        },
        tired: {
            text: `${emoji} You deserve rest — no guilt about that 💤\n\nYour body is telling you something important. Take a short nap, drink water, and don't push yourself too hard today.`,
            tip: "Tip: A 20-minute power nap can restore alertness. Avoid screens before sleeping."
        },
        sad: {
            text: `${emoji} It's okay to feel sad. You don't have to be okay all the time 💜\n\nAhira is here with you. Take it one moment at a time. Be gentle with yourself today.`,
            tip: "Tip: Try stepping outside for 10 minutes. Fresh air and a change of scenery can gently lift your mood."
        },
        stressed: {
            text: `${emoji} Take a breath — you've handled hard things before 💪\n\nBreak whatever is stressing you into tiny steps. You don't have to solve everything right now.`,
            tip: "Tip: Write down what's stressing you, then pick just one thing to act on today."
        },
        anxious: {
            text: `${emoji} Your feelings are valid. Anxiety is hard 💜\n\nTry the 5-4-3-2-1 grounding technique: name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.`,
            tip: "Tip: Slow breathing — 4 counts in, hold 4, out 6 — activates your body's calm response."
        },
        energetic: {
            text: `${emoji} Love this energy! ⚡ Channel it well today!\n\nThis is a great time to tackle something you've been putting off, or move your body — a walk, dance, or workout.`,
            tip: "Tip: Use this energy on your top 1-2 priorities. Don't scatter it across too many tasks."
        },
        grateful: {
            text: `${emoji} Gratitude is one of the most powerful feelings 🥰\n\nYou're in a beautiful headspace. Take a moment to appreciate the small things — they add up to everything.`,
            tip: "Tip: Text someone you're grateful for today. It'll make both of you feel wonderful."
        }
    };

    const r = responses[mood];
    const el = document.getElementById("moodResponse");
    if (!el || !r) return;

    el.innerHTML = `<div style="margin-bottom:8px;">${r.text.replace(/\n/g,"<br>")}</div>
        <div style="background:rgba(138,108,255,0.08);border-radius:8px;padding:8px 10px;font-size:12px;color:var(--purple);font-weight:500;">
            💡 ${r.tip}
        </div>
        <button onclick="document.getElementById('message').value='I feel ${mood}';nav('chatScreen',null);sendMessage();"
            style="margin-top:10px;width:100%;padding:9px;border:none;border-radius:12px;
            background:linear-gradient(135deg,var(--purple),#b06fff);color:white;font-size:13px;
            font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;">
            💬 Talk to Ahira about this
        </button>`;
    el.classList.add("visible");
}
function renderHomeMedCard() {
    if (medicines.length === 0) {
        safe("homeMedSub",     el => el.innerText = "No medicines added yet");
        safe("homeMedMeta",    el => el.innerText = "");
        safe("homeMedBarFill", el => el.style.width = "0%");
        return;
    }

    const total     = medicines.length;
    const taken     = medicines.filter(m => m.taken).length;
    const low       = medicines.filter(m => m.stock <= 5).length;
    const out       = medicines.filter(m => m.stock === 0).length;
    const pct       = Math.round((taken / total) * 100);

    safe("homeMedBarFill", el => el.style.width = pct + "%");

    if (out > 0) {
        safe("homeMedSub",  el => { el.innerText = `${out} medicine${out>1?"s":""} out of stock ⚠️`; el.style.color = "#ff6b8a"; });
    } else if (low > 0) {
        safe("homeMedSub",  el => { el.innerText = `${low} medicine${low>1?"s":""} running low`; el.style.color = "#ffb347"; });
    } else {
        safe("homeMedSub",  el => { el.innerText = `${taken} of ${total} taken today`; el.style.color = "var(--text-mid)"; });
    }

    const nextMed = medicines.find(m => !m.taken && m.time);
    safe("homeMedMeta", el => {
        el.innerText = nextMed ? `Next: ${nextMed.name} at ${nextMed.time}` : `${total} medicines tracked`;
    });
}

/* ── Home grocery card ── */
function renderHomeGroceryCard() {
    if (groceryItems.length === 0) {
        safe("homeGrocerySub",     el => el.innerText = "No items added yet");
        safe("homeGroceryMeta",    el => el.innerText = "");
        safe("homeGroceryBarFill", el => el.style.width = "0%");
        return;
    }

    const total   = groceryItems.length;
    const done    = groceryItems.filter(g => g.checked).length;
    const urgent  = groceryItems.filter(g => g.urgency === "urgent" && !g.checked).length;
    const overdue = groceryItems.filter(g => g.deadline && new Date(g.deadline) < new Date() && !g.checked).length;
    const pct     = Math.round((done / total) * 100);

    safe("homeGroceryBarFill", el => el.style.width = pct + "%");

    if (overdue > 0) {
        safe("homeGrocerySub", el => { el.innerText = `${overdue} item${overdue>1?"s":""} past deadline ⚠️`; el.style.color = "#ff6b8a"; });
    } else if (urgent > 0) {
        safe("homeGrocerySub", el => { el.innerText = `${urgent} urgent item${urgent>1?"s":""} to buy`; el.style.color = "#ffb347"; });
    } else {
        safe("homeGrocerySub", el => { el.innerText = `${done} of ${total} items collected`; el.style.color = "var(--text-mid)"; });
    }

    safe("homeGroceryMeta", el => {
        el.innerText = urgent > 0
            ? `${total - done} remaining · ${urgent} urgent`
            : `${total - done} remaining`;
    });
}

function updateDateTime() {
    safe("dateTime", el => {
        el.innerText = new Date().toLocaleString("en-IN", {
            weekday: "long", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    });
}

function updateSummaryCounts(tasks) {
    const today = new Date(); today.setHours(0,0,0,0);
    let overdue = 0, tod = 0, upcoming = 0;
    tasks.forEach(t => {
        if (t.completed === 1) return;
        if (!t.date) { upcoming++; return; }
        const d = new Date(t.date); d.setHours(0,0,0,0);
        if      (d < today)                       overdue++;
        else if (d.getTime() === today.getTime()) tod++;
        else                                      upcoming++;
    });
    safe("overdueNum",  el => el.innerText = overdue);
    safe("todayNum",    el => el.innerText = tod);
    safe("upcomingNum", el => el.innerText = upcoming);
}

/* ── HOME ALERT BANNERS ── */
function renderHomeAlerts() {
    const container = document.getElementById("homeAlerts");
    if (!container) return;
    container.innerHTML = "";

    // Medicine alerts
    const lowMeds = medicines.filter(m => m.stock <= 5);
    const outMeds = medicines.filter(m => m.stock === 0);

    if (outMeds.length > 0) {
        container.innerHTML += `
        <div class="alertBanner danger" onclick="nav('medicineScreen',null)">
            <span class="alertBannerIcon">💊</span>
            <span class="alertBannerText"><b>${outMeds[0].name}</b>${outMeds.length > 1 ? ` +${outMeds.length-1} more` : ""} — out of stock!</span>
            <span class="alertBannerArrow">›</span>
        </div>`;
    } else if (lowMeds.length > 0) {
        container.innerHTML += `
        <div class="alertBanner warning" onclick="nav('medicineScreen',null)">
            <span class="alertBannerIcon">💊</span>
            <span class="alertBannerText"><b>${lowMeds[0].name}</b>${lowMeds.length > 1 ? ` +${lowMeds.length-1} more` : ""} — running low (${lowMeds[0].stock} left)</span>
            <span class="alertBannerArrow">›</span>
        </div>`;
    }

    // Grocery alerts
    const urgentGrocery  = groceryItems.filter(g => g.urgency === "urgent" && !g.checked);
    const overdueGrocery = groceryItems.filter(g => g.deadline && new Date(g.deadline) < new Date() && !g.checked);

    if (overdueGrocery.length > 0) {
        container.innerHTML += `
        <div class="alertBanner danger" onclick="nav('groceryScreen',null)">
            <span class="alertBannerIcon">🛒</span>
            <span class="alertBannerText"><b>${overdueGrocery[0].name}</b>${overdueGrocery.length > 1 ? ` +${overdueGrocery.length-1} more` : ""} — deadline passed!</span>
            <span class="alertBannerArrow">›</span>
        </div>`;
    } else if (urgentGrocery.length > 0) {
        container.innerHTML += `
        <div class="alertBanner warning" onclick="nav('groceryScreen',null)">
            <span class="alertBannerIcon">🛒</span>
            <span class="alertBannerText"><b>${urgentGrocery.length} urgent item${urgentGrocery.length > 1 ? "s" : ""}</b> need restocking</span>
            <span class="alertBannerArrow">›</span>
        </div>`;
    }

    // All good state — show a positive banner only if user has data
    if (container.innerHTML === "" && (medicines.length > 0 || groceryItems.length > 0)) {
        container.innerHTML = `
        <div class="alertBanner ok">
            <span class="alertBannerIcon">✅</span>
            <span class="alertBannerText">Medicines &amp; grocery all stocked up!</span>
        </div>`;
    }
}

function renderHomeWaterDrops() {
    const container = document.getElementById("homeWaterDrops");
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < waterTarget; i++) {
        const s = document.createElement("span");
        s.className = `waterDrop ${i < water ? "filled" : "empty"}`;
        s.innerText = "💧";
        container.appendChild(s);
    }
    safe("homeWaterCount",  el => el.innerText = water);
    safe("homeWaterTarget", el => el.innerText = waterTarget);
    safe("wellWaterSub",    el => el.innerText = `${water} / ${waterTarget} glasses today`);
    localStorage.setItem("water", water);
}


/* ─────────────────────────────────────────────────────────
   4. CHAT  — OpenRouter called directly from the browser
   Why browser-side: the Python server has no internet access.
   The user's browser does — so we call OpenRouter from here.
───────────────────────────────────────────────────────── */

// ── Config ──────────────────────────────────────────────────
const OPENROUTER_KEY   = "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";
const OPENROUTER_URL   = "https://openrouter.ai/api/v1/chat/completions";
const CHAT_MODEL       = "openrouter/free";   // confirmed working free model

// ── Conversation history (in-memory for this session) ───────
let chatHistory = [];   // [{role, content}, ...]

// ── Ahira system prompt ──────────────────────────────────────
function buildSystemPrompt() {
    const now   = new Date().toLocaleString("en-IN", {
        weekday:"long", day:"numeric", month:"long", year:"numeric",
        hour:"2-digit", minute:"2-digit"
    });
    const today = new Date().toISOString().slice(0, 10);

    return `You are Ahira — a warm, caring AI companion designed for women.

Your personality:
- You feel like a best friend: kind, emotionally intelligent, genuine
- Never sound robotic or clinical — talk the way a caring friend texts
- Use light emojis naturally, not on every sentence
- When someone is sad or anxious, acknowledge their feelings before giving advice
- Never be dismissive. Give real, specific responses — not generic platitudes
- Ask follow-up questions before jumping to solutions
- Celebrate small wins genuinely
- Gently nudge healthy habits without being preachy

You help with: emotional support, venting, stress, anxiety, daily planning,
meal ideas, outfit advice, period and wellness, medicine reminders, grocery
planning, and setting reminders.

Tone rules:
- SHORT responses (2-4 lines) for emotional moments. Longer only for plans/recipes
- Never start with "I understand", "I hear you", "Of course!" or "Absolutely!"
- It's okay to say "honestly" or "that sounds really hard" — friends do that
- If someone shares something difficult, acknowledge it genuinely first
- Do not reveal you are an AI unless directly asked. Just be Ahira.

Today is ${now}.

REMINDER SYSTEM:
If the user asks to set a reminder, confirm it warmly, then on a new line at the
very end of your reply ONLY, add this exact hidden tag:
[REMINDER: task_text | ${today} | HH:MM]

Use 24-hour time. Only add the tag when the user explicitly asks for a reminder.
Do NOT add it for any other message.`;
}

// ── Main send function ───────────────────────────────────────
async function sendMessage() {
    const input   = document.getElementById("message");
    const message = input.value.trim();
    if (!message) return;

    const chatEl = document.getElementById("chat");

    // Remove suggestion chips after first message
    chatEl.querySelector(".chatSuggestions")?.remove();

    // Show user bubble
    appendUserBubble(chatEl, message);
    input.value = "";
    chatEl.scrollTop = chatEl.scrollHeight;

    // Typing indicator
    const typingWrap = createTypingIndicator();
    chatEl.appendChild(typingWrap);
    chatEl.scrollTop = chatEl.scrollHeight;

    const botMsgEl = typingWrap.querySelector(".botMsg");

    try {
        // Build messages array: system + history + new message
        const messages = [
            { role: "system",  content: buildSystemPrompt() },
            ...chatHistory,
            { role: "user",    content: message }
        ];

        const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer":  "https://ahira.app",
                "X-OpenRouter-Title": "Ahira",
                "Content-Type":  "application/json"
            },
            body: JSON.stringify({
                model:      CHAT_MODEL,
                messages,
                max_tokens: 500,
                temperature: 0.85
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenRouter ${res.status}: ${errText}`);
        }

        const data  = await res.json();
        const raw   = data.choices?.[0]?.message?.content || "";

        // Parse out any reminder tag
        const { reply, reminder } = parseReminderTag(raw);

        // Render reply
        botMsgEl.classList.remove("typing");
        renderBotText(botMsgEl, reply);

        // Save turns to history (keep last 20 turns = 40 messages)
        chatHistory.push({ role: "user",      content: message });
        chatHistory.push({ role: "assistant", content: reply   });
        if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);

        // Auto-save reminder via backend
        if (reminder) {
            await saveReminderToBackend(reminder);
            showReminderToast(reminder);
        }

    } catch (err) {
        console.error("[Ahira chat error]", err);
        botMsgEl.classList.remove("typing");
        botMsgEl.innerText = "Hmm, I had a connection issue. Check your internet and try again 💜";
    }

    chatEl.scrollTop = chatEl.scrollHeight;
}

// ── Parse [REMINDER: ...] tag ────────────────────────────────
function parseReminderTag(text) {
    const match = text.match(/\[REMINDER:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\d{2}:\d{2})\s*\]/i);
    if (!match) return { reply: text.trim(), reminder: null };

    const today    = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    let date       = match[2].trim();
    if (/tomorrow/i.test(date))              date = tomorrow;
    else if (!/\d{4}-\d{2}-\d{2}/.test(date)) date = today;

    const reminder = { task: match[1].trim(), date, time: match[3].trim() };
    const reply    = text.slice(0, match.index).trim();
    return { reply, reminder };
}

// ── Save reminder to FastAPI backend ────────────────────────
async function saveReminderToBackend(reminder) {
    try {
        await fetch("/add_reminder", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
                task:     reminder.task,
                date:     reminder.date,
                time:     reminder.time,
                priority: "normal"
            })
        });
    } catch (e) {
        console.error("[Reminder save]", e);
    }
}

// ── DOM helpers ──────────────────────────────────────────────
function appendUserBubble(chatEl, message) {
    const wrap       = document.createElement("div");
    wrap.className   = "userMsgWrap";
    wrap.innerHTML   = `<div class="userMsg">${escapeHtml(message)}</div>`;
    chatEl.appendChild(wrap);
}

function createTypingIndicator() {
    const wrap     = document.createElement("div");
    wrap.className = "botMsgWrap";
    wrap.innerHTML = `
        <div class="botAvatar">A</div>
        <div class="botMsg typing">
            <span class="typingDot"></span>
            <span class="typingDot"></span>
            <span class="typingDot"></span>
        </div>`;
    return wrap;
}

function renderBotText(el, text) {
    el.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Reminder toast notification ──────────────────────────────
function showReminderToast(reminder) {
    document.getElementById("reminderToast")?.remove();

    const toast     = document.createElement("div");
    toast.id        = "reminderToast";
    toast.className = "reminderToast";
    toast.innerHTML = `
        <span style="font-size:20px;">✅</span>
        <div>
            <div style="font-weight:700;font-size:13px;color:#4c1d95;">Reminder saved!</div>
            <div style="font-size:12px;color:#6b21a8;margin-top:2px;">
                ${escapeHtml(reminder.task)}
                ${reminder.date ? "· " + reminder.date : ""}
                ${reminder.time ? "at " + reminder.time : ""}
            </div>
        </div>`;

    document.querySelector(".phone").appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toastVisible"));
    setTimeout(() => {
        toast.classList.remove("toastVisible");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ── Quick chat shortcuts ─────────────────────────────────────
function quickChat(msg) {
    document.getElementById("message").value = msg;
    sendMessage();
}

document.getElementById("message")?.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});


/* ─────────────────────────────────────────────────────────
   5. PLANNER
───────────────────────────────────────────────────────── */

/* ── Calendar Strip ── */
function buildCalStrip() {
    const strip = document.getElementById("calStrip");
    if (!strip) return;
    strip.innerHTML = "";
    const today = new Date();
    for (let i = -2; i <= 4; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const isToday = i === 0;
        const cell = document.createElement("div");
        cell.className = "calCell" + (isToday ? " calToday" : "");
        cell.innerHTML = `
            <div class="calDay">${d.toLocaleDateString("en-IN",{weekday:"short"}).slice(0,3)}</div>
            <div class="calNum">${d.getDate()}</div>`;
        strip.appendChild(cell);
    }
    safe("plannerDateLabel", el => {
        el.innerText = today.toLocaleDateString("en-IN",{weekday:"long",month:"long",day:"numeric"});
    });
}

/* ── Chip selectors ── */
function initChips(containerId, stateKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(".typeChip").forEach(chip => {
        chip.addEventListener("click", () => {
            container.querySelectorAll(".typeChip").forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            if (stateKey === "task")     selectedTaskType     = chip.dataset.val;
            if (stateKey === "priority") selectedTaskPriority = chip.dataset.val;
            if (stateKey === "medpri")   selectedMedPriority  = chip.dataset.val;
        });
    });
}

/* ── Modal open/close ── */
function openAddTask() {
    document.getElementById("addTaskModal").style.display = "flex";
    // reset chips
    selectedTaskType = "task"; selectedTaskPriority = "normal";
    document.querySelectorAll("#taskTypeChips .typeChip").forEach((c,i) => c.classList.toggle("active", i===0));
    document.querySelectorAll("#taskPriorityChips .typeChip").forEach((c,i) => c.classList.toggle("active", i===0));
}

function closeAddTask(e) {
    if (!e || e.target.classList.contains("modalOverlay")) {
        document.getElementById("addTaskModal").style.display = "none";
    }
}

/* ── Save ── */
async function saveTask() {
    const task     = document.getElementById("taskInput").value.trim();
    const date     = document.getElementById("dateInput").value;
    const time     = document.getElementById("timeInput").value;
    const pinned   = document.getElementById("pinTask").checked;

    if (!task) { alert("Please enter a task name."); return; }

    // Save extra meta to localStorage (type, pinned) alongside DB reminder
    const localMeta = JSON.parse(localStorage.getItem("taskMeta") || "{}");

    try {
        const res  = await fetch("/add_reminder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, date, time, priority: selectedTaskPriority })
        });
        const data = await res.json();

        if (data.status === "success") {
            // We'll store type/pinned keyed by task+date for lightweight local meta
            const key = `${task}__${date}`;
            localMeta[key] = { type: selectedTaskType, pinned };
            localStorage.setItem("taskMeta", JSON.stringify(localMeta));

            document.getElementById("taskInput").value = "";
            document.getElementById("dateInput").value  = "";
            document.getElementById("timeInput").value  = "";
            document.getElementById("pinTask").checked  = false;
            closeAddTask();
            loadPlanner();
        }
    } catch (e) { alert("Network error. Please try again."); }
}

/* ── Load ── */
async function loadPlanner() {
    buildCalStrip();
    initChips("taskTypeChips",     "task");
    initChips("taskPriorityChips", "priority");

    const todayList     = document.getElementById("todayTaskList");
    const upcomingList  = document.getElementById("upcomingTaskList");
    const completedList = document.getElementById("completedTaskList");
    const pinnedList    = document.getElementById("pinnedList");
    const pinnedSection = document.getElementById("pinnedSection");

    if (!todayList) return;
    todayList.innerHTML = upcomingList.innerHTML = completedList.innerHTML = "";
    if (pinnedList) pinnedList.innerHTML = "";

    try {
        const res  = await fetch("/reminders");
        const data = await res.json();
        const localMeta = JSON.parse(localStorage.getItem("taskMeta") || "{}");

        const now = new Date(); now.setHours(0,0,0,0);
        let hasPinned = false;

        data.tasks.forEach(task => {
            const meta = localMeta[`${task.task}__${task.date}`] || {};
            const card = buildPlannerCard(task, meta);

            if (meta.pinned && !task.completed) {
                pinnedList.innerHTML += card;
                hasPinned = true;
            }

            if (task.completed) {
                completedList.innerHTML += card;
                return;
            }

            if (!task.date) { upcomingList.innerHTML += card; return; }

            const d = new Date(task.date); d.setHours(0,0,0,0);
            if (d.getTime() === now.getTime()) todayList.innerHTML += card;
            else if (d > now)                  upcomingList.innerHTML += card;
            else                               todayList.innerHTML += card; // overdue → show in today
        });

        if (!todayList.innerHTML)    todayList.innerHTML    = emptyMsg("No tasks for today 🌸");
        if (!upcomingList.innerHTML) upcomingList.innerHTML = emptyMsg("Nothing upcoming yet");

        if (pinnedSection) pinnedSection.style.display = hasPinned ? "block" : "none";

        updateSummaryCounts(data.tasks);
    } catch (e) { console.error("[Planner]", e); }
}

function buildPlannerCard(task, meta) {
    const done  = task.completed === 1;
    const typeIcon = { task:"📋", event:"🎉", reminder:"🔔" }[meta.type || "task"];
    const priColor = task.priority === "high" ? "#ff6b8a" : "var(--text-light)";

    return `
    <div class="plannerCard ${done ? "taskDone" : ""}" style="${task.priority === "high" ? "border-left:3px solid #ff6b8a;" : ""}">
        <div class="plannerCardLeft">
            <div class="plannerTypeIcon">${typeIcon}</div>
            <div>
                <div class="taskText">${task.task}</div>
                <div class="taskMeta">
                    ${task.date ? "📅 " + task.date : ""}
                    ${task.time ? " ⏰ " + task.time : ""}
                    <span style="color:${priColor};margin-left:4px;">${task.priority === "high" ? "🔥" : ""}</span>
                </div>
            </div>
        </div>
        <div style="display:flex;gap:5px;">
            <button class="iconBtn ${done ? "btnDone" : "btnPrimary"}" onclick="toggleTask(${task.id})">✔</button>
            <button class="iconBtn btnDanger" onclick="deleteTask(${task.id})">🗑</button>
        </div>
    </div>`;
}

function emptyMsg(txt) {
    return `<p style="color:var(--text-light);font-size:13px;padding:12px 0;text-align:center;">${txt}</p>`;
}

function toggleCompleted() {
    completedVisible = !completedVisible;
    const list = document.getElementById("completedTaskList");
    const arrow = document.getElementById("completedToggleArrow");
    if (list)  list.style.display  = completedVisible ? "block" : "none";
    if (arrow) arrow.innerText     = completedVisible ? "∨" : "›";
}

async function deleteTask(id) {
    await fetch("/reminder/" + id, { method: "DELETE" });
    loadPlanner();
}

async function toggleTask(id) {
    await fetch("/reminder/" + id + "/toggle", { method: "POST" });
    loadPlanner();
}


/* ─────────────────────────────────────────────────────────
   6. WATER
───────────────────────────────────────────────────────── */

function loadWaterScreen() {
    renderWaterRing();
    renderWaterGlassGrid();
    renderWaterLog();
    renderWaterChart();
    safe("waterTargetLabel", el => el.innerText = waterTarget);
    safe("waterMlLabel",     el => el.innerText = (water * 250) + " ml");
}

function renderWaterRing() {
    safe("detailWaterCount", el => el.innerText = water);
    const circle = document.getElementById("waterRingCircle");
    if (!circle) return;
    const circumference = 314;
    const pct = Math.min(water / waterTarget, 1);
    circle.style.strokeDashoffset = circumference - pct * circumference;
}

function renderWaterGlassGrid() {
    const container = document.getElementById("detailWaterGlasses");
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < waterTarget; i++) {
        const d = document.createElement("div");
        d.className = "glassItem";
        d.innerHTML = `
            <div class="glassTube ${i < water ? "active" : ""}"><div class="glassFill"></div></div>
            <span class="glassNum">${i + 1}</span>`;
        container.appendChild(d);
    }
}

function renderWaterLog() {
    const container = document.getElementById("waterLog");
    if (!container) return;
    if (waterLog.length === 0) {
        container.innerHTML = emptyMsg("No glasses logged yet today");
        return;
    }
    container.innerHTML = waterLog.slice().reverse().map(entry => `
        <div class="waterLogEntry">
            <span class="waterLogTime">${entry.time}</span>
            <span class="waterLogGlass">💧 Glass ${entry.glass}</span>
            <span style="font-size:12px;color:var(--text-light);">+250ml</span>
        </div>`).join("");
}

function renderWaterChart() {
    const barEl    = document.getElementById("waterBarChart");
    const labelEl  = document.getElementById("waterBarLabels");
    if (!barEl || !labelEl) return;

    barEl.innerHTML = "";
    labelEl.innerHTML = "";

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
    }

    const maxVal = Math.max(waterTarget, ...days.map(d => waterWeekly[d.toISOString().slice(0,10)] || 0));

    days.forEach(d => {
        const key = d.toISOString().slice(0,10);
        const val = key === new Date().toISOString().slice(0,10) ? water : (waterWeekly[key] || 0);
        const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
        const isToday = key === new Date().toISOString().slice(0,10);

        const bar = document.createElement("div");
        bar.className = "waterBar";
        bar.innerHTML = `<div class="waterBarFill ${isToday ? "barToday" : ""}" style="height:${Math.max(pct,4)}%;">
            <span class="barVal">${val}</span></div>`;
        barEl.appendChild(bar);

        const lbl = document.createElement("div");
        lbl.className = "barLabel";
        lbl.innerText = d.toLocaleDateString("en-IN",{weekday:"short"}).slice(0,3);
        labelEl.appendChild(lbl);
    });
}

function addWater() {
    if (water >= waterTarget) return;
    water++;
    const now = new Date();
    waterLog.push({ time: now.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}), glass: water });
    localStorage.setItem("water", water);
    localStorage.setItem("waterLog", JSON.stringify(waterLog));

    const todayKey = now.toISOString().slice(0,10);
    waterWeekly[todayKey] = water;
    localStorage.setItem("waterWeekly", JSON.stringify(waterWeekly));

    renderHomeWaterDrops();
    loadWaterScreen();
}

function removeWater() {
    if (water <= 0) return;
    water--;
    waterLog.pop();
    localStorage.setItem("water", water);
    localStorage.setItem("waterLog", JSON.stringify(waterLog));
    renderHomeWaterDrops();
    loadWaterScreen();
}

function resetWater() {
    water = 0; waterLog = [];
    localStorage.setItem("water", 0);
    localStorage.setItem("waterLog", JSON.stringify([]));
    renderHomeWaterDrops();
    loadWaterScreen();
}

function openWaterTarget()  { document.getElementById("waterTargetModal").style.display = "flex"; }
function closeWaterTarget(e) {
    if (!e || e.target.classList.contains("modalOverlay"))
        document.getElementById("waterTargetModal").style.display = "none";
}

function saveWaterTarget() {
    const val = parseInt(document.getElementById("waterTargetInput").value);
    if (val > 0 && val <= 20) {
        waterTarget = val;
        localStorage.setItem("waterTarget", val);
    }
    closeWaterTarget();
    loadWaterScreen();
    renderHomeWaterDrops();
}


/* ─────────────────────────────────────────────────────────
   7. PERIOD
───────────────────────────────────────────────────────── */

function setPeriodDate() {
    const input = prompt("Enter your last period start date (YYYY-MM-DD):");
    if (!input) return;
    lastPeriodDate = new Date(input);
    localStorage.setItem("lastPeriodDate", input);
    calculatePeriod();
}

function calculatePeriod() {
    if (!lastPeriodDate) return;
    const today    = new Date();
    const diff     = Math.floor((today - lastPeriodDate) / (1000 * 60 * 60 * 24));
    const cycle    = 28;
    const remaining = cycle - (diff % cycle);
    const progress  = ((cycle - remaining) / cycle) * 100;

    ["periodDays","periodDaysDetail","periodDaysBig"].forEach(id => safe(id, el => el.innerText = remaining));
    ["periodFill","periodFillWell","periodFillDetail"].forEach(id => safe(id, el => el.style.width = progress + "%"));

    safe("periodBigLabel",  el => el.innerText = `Next Period in ${remaining} Days`);
    safe("wellPeriodSub",   el => el.innerText = `Next in ${remaining} days`);

    const nextDate = new Date(lastPeriodDate);
    nextDate.setDate(nextDate.getDate() + cycle - (diff % cycle));
    safe("periodDateLabel", el => el.innerText = nextDate.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}));

    const dotsContainer = document.getElementById("homePeriodDots");
    if (dotsContainer) {
        dotsContainer.innerHTML = "";
        const elapsed  = cycle - remaining;
        const fraction = Math.floor(elapsed / cycle * 8);
        for (let i = 0; i < 8; i++) {
            const dot = document.createElement("span");
            dot.className = "dot" + (i < fraction ? " filled" : "") + (i === fraction ? " today" : "");
            dotsContainer.appendChild(dot);
        }
    }
}


/* ─────────────────────────────────────────────────────────
   8. MEDICINE
───────────────────────────────────────────────────────── */

function toggleMedicineForm() {
    const form = document.getElementById("medicineForm");
    if (!form) return;
    const isOpen = form.style.display !== "none";
    form.style.display = isOpen ? "none" : "block";
    if (!isOpen) {
        selectedMedPriority = "normal";
        initChips("medPriorityChips", "medpri");
    }
}

function filterMeds(type, btn) {
    currentMedFilter = type;
    document.querySelectorAll(".filterTab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    loadMedicines();
}

function addMedicine() {
    const name      = document.getElementById("medName").value.trim();
    const dose      = parseInt(document.getElementById("medDose").value)  || 0;
    const stock     = parseInt(document.getElementById("medStock").value) || 0;
    const time      = document.getElementById("medTime").value;
    const frequency = document.getElementById("medFrequency").value;
    const notes     = document.getElementById("medNotes").value.trim();

    if (!name || !stock) { alert("Please enter medicine name and stock."); return; }

    const emojis = ["💊","🩺","🧴","🍊","🧪","💉"];
    medicines.push({
        name, dose, stock, originalStock: stock,
        time, frequency, notes, priority: selectedMedPriority,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        taken: false, addedDate: new Date().toISOString().slice(0,10)
    });
    localStorage.setItem("medicines", JSON.stringify(medicines));

    // Clear form
    ["medName","medDose","medStock","medTime","medNotes"].forEach(id => safe(id, el => el.value = ""));
    toggleMedicineForm();
    loadMedicines();
}

function loadMedicines() {
    const container = document.getElementById("medicineList");
    if (!container) return;
    container.innerHTML = "";

    const searchVal = (document.getElementById("medSearch")?.value || "").toLowerCase();
    const filtered  = medicines.filter(med => {
        const matchFilter = currentMedFilter === "all" || med.frequency === currentMedFilter;
        const matchSearch = med.name.toLowerCase().includes(searchVal);
        return matchFilter && matchSearch;
    });

    const sections = {
        critical: filtered.filter(m => m.priority === "high"),
        daily:    filtered.filter(m => m.priority !== "high" && m.frequency !== "weekly"),
        weekly:   filtered.filter(m => m.frequency === "weekly"),
    };

    let html = "";
    if (sections.critical.length) {
        html += `<div class="sectionLabel" style="color:#ff6b8a;">🔥 Critical</div>`;
        sections.critical.forEach(med => html += buildMedCard(med, medicines.indexOf(med)));
    }
    if (sections.daily.length) {
        html += `<div class="sectionLabel">Daily Medications</div>`;
        sections.daily.forEach(med => html += buildMedCard(med, medicines.indexOf(med)));
    }
    if (sections.weekly.length) {
        html += `<div class="sectionLabel">Weekly Medications</div>`;
        sections.weekly.forEach(med => html += buildMedCard(med, medicines.indexOf(med)));
    }
    if (!html) html = emptyMsg("No medicines added yet 💊");
    container.innerHTML = html;

    // Update summary strip
    const low   = medicines.filter(m => m.stock <= 5).length;
    const taken = medicines.filter(m => m.taken).length;
    safe("medTotalCount", el => el.innerText = medicines.length);
    safe("medLowCount",   el => el.innerText = low);
    safe("medTakenCount", el => el.innerText = taken);

    // Wellness sub-label
    safe("wellMedSub", el => {
        if (medicines.length === 0) { el.innerText = "No medicines tracked"; return; }
        const low2 = medicines.filter(m => m.stock <= 5).length;
        el.innerText = `${medicines.length} tracked${low2 > 0 ? ` · ${low2} low ⚠️` : " · All OK ✅"}`;
    });

    // Refresh home card
    renderHomeMedCard();
    renderHomeAlerts();
}

function buildMedCard(med, i) {
    const stockPct   = med.originalStock > 0 ? Math.round((med.stock / med.originalStock) * 100) : 0;
    const stockColor = med.stock <= 5 ? "#ff6b8a" : med.stock <= 10 ? "#ffb347" : "var(--purple)";
    const urgentBorder = med.priority === "high" ? "border-left:3px solid #ff6b8a;" : "";

    return `
    <div class="medCard" style="${urgentBorder}">
        <div class="medIconBox">${med.emoji || "💊"}</div>
        <div class="medInfo" style="flex:1;">
            <div class="medName">${med.name} ${med.priority === "high" ? `<span style="font-size:11px;color:#ff6b8a;">CRITICAL</span>` : ""}</div>
            <div class="medMeta">
                ${med.dose ? med.dose + "mg · " : ""}${med.frequency || "daily"}
                ${med.time ? " · ⏰ " + med.time : ""}
            </div>
            ${med.notes ? `<div class="medNoteText">📝 ${med.notes}</div>` : ""}
            <div class="medStockBar">
                <div class="medStockFill" style="width:${stockPct}%;background:${stockColor};"></div>
            </div>
            <div style="font-size:11px;color:${stockColor};margin-top:2px;">📦 ${med.stock} left</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
            <div class="medCheck ${med.taken ? "checked" : ""}" onclick="toggleMedTaken(${i})"
                title="${med.taken ? "Mark undone" : "Mark taken"}">
                ${med.taken ? "✓" : ""}
            </div>
            <button class="iconBtn btnDanger" style="font-size:11px;padding:3px 7px;"
                onclick="deleteMedicine(${i})">🗑</button>
        </div>
    </div>`;
}

function toggleMedTaken(i) {
    if (!medicines[i].taken && medicines[i].stock > 0) {
        medicines[i].stock = Math.max(0, medicines[i].stock - 1);
    }
    medicines[i].taken = !medicines[i].taken;
    localStorage.setItem("medicines", JSON.stringify(medicines));
    loadMedicines();
}

function deleteMedicine(i) {
    medicines.splice(i, 1);
    localStorage.setItem("medicines", JSON.stringify(medicines));
    loadMedicines();
}


/* ─────────────────────────────────────────────────────────
   9. GROCERY
───────────────────────────────────────────────────────── */

const catEmoji = { veggies:"🥕", dairy:"🥛", snacks:"🍪", other:"📦", all:"🛒" };

function openGroceryForm()   { document.getElementById("groceryFormModal").style.display = "flex"; }
function closeGroceryForm(e) {
    if (!e || e.target.classList.contains("modalOverlay"))
        document.getElementById("groceryFormModal").style.display = "none";
}

function addGroceryItem() {
    const name     = document.getElementById("groceryName").value.trim();
    const qty      = parseInt(document.getElementById("groceryQty").value) || 1;
    const unit     = document.getElementById("groceryUnit").value;
    const category = document.getElementById("groceryCat").value;
    const urgency  = document.getElementById("groceryUrgency").value;
    const deadline = document.getElementById("groceryDeadline").value;
    const notes    = document.getElementById("groceryNotes").value.trim();

    if (!name) { alert("Please enter item name."); return; }

    groceryItems.push({ name, qty, unit, category, urgency, deadline, notes, checked: false,
        emoji: catEmoji[category] || "🛒", addedDate: new Date().toISOString().slice(0,10) });
    localStorage.setItem("groceryItems", JSON.stringify(groceryItems));

    ["groceryName","groceryQty","groceryDeadline","groceryNotes"].forEach(id => safe(id, el => el.value = ""));
    closeGroceryForm();
    loadGrocery();
}

function loadGrocery() {
    const urgentEl  = document.getElementById("urgentGroceryList");
    const fullEl    = document.getElementById("groceryFullList");
    if (!urgentEl || !fullEl) return;

    urgentEl.innerHTML = "";
    fullEl.innerHTML   = "";

    const filtered = groceryItems.filter(item =>
        currentGroceryFilter === "all" || item.category === currentGroceryFilter
    );

    let urgentCount = 0, doneCount = 0;

    filtered.forEach((item, _) => {
        const realIdx = groceryItems.indexOf(item);
        const card = buildGroceryCard(item, realIdx);
        if (item.checked) doneCount++;
        if (item.urgency === "urgent" && !item.checked) { urgentEl.innerHTML += card; urgentCount++; }
        else { fullEl.innerHTML += card; }
    });

    if (!urgentEl.innerHTML) urgentEl.innerHTML = emptyMsg("No urgent items ✅");
    if (!fullEl.innerHTML)   fullEl.innerHTML   = emptyMsg("No items yet. Tap + Add to start.");

    // Stats
    safe("groceryTotalCount",  el => el.innerText = groceryItems.length);
    safe("groceryUrgentCount", el => el.innerText = groceryItems.filter(g => g.urgency === "urgent" && !g.checked).length);
    safe("groceryDoneCount",   el => el.innerText = groceryItems.filter(g => g.checked).length);

    // Wellness sub-label
    safe("wellGrocerySub", el => {
        const urg = groceryItems.filter(g => g.urgency === "urgent" && !g.checked).length;
        el.innerText = urg > 0 ? `${urg} urgent item${urg>1?"s":""} ⚠️` : `${groceryItems.length} items tracked`;
    });

    // Refresh home card
    renderHomeGroceryCard();
    renderHomeAlerts();
}

function buildGroceryCard(item, i) {
    const deadlineStr = item.deadline
        ? `<span style="color:${isOverdue(item.deadline) ? "#ff6b8a" : "var(--text-light)"};">📅 ${item.deadline}</span>`
        : "";
    const urgencyBadge = item.urgency === "urgent"
        ? `<span class="urgencyBadge urgent">Urgent</span>`
        : item.urgency === "low"
        ? `<span class="urgencyBadge low">Low</span>` : "";

    return `
    <div class="groceryItemCard ${item.checked ? "groceryDone" : ""}">
        <div class="groceryCheck ${item.checked ? "checked" : ""}" onclick="toggleGrocery(${i})">
            ${item.checked ? "✓" : ""}
        </div>
        <div style="flex:1;">
            <div class="groceryName ${item.checked ? "strikethrough" : ""}">${item.emoji} ${item.name} ${urgencyBadge}</div>
            <div class="groceryMeta">
                ${item.qty} ${item.unit || "pcs"}
                ${deadlineStr}
                ${item.notes ? `· ${item.notes}` : ""}
            </div>
        </div>
        <button class="iconBtn btnDanger" style="font-size:11px;padding:3px 7px;" onclick="deleteGrocery(${i})">🗑</button>
    </div>`;
}

function isOverdue(dateStr) {
    return dateStr && new Date(dateStr) < new Date();
}

function toggleGrocery(i) {
    groceryItems[i].checked = !groceryItems[i].checked;
    localStorage.setItem("groceryItems", JSON.stringify(groceryItems));
    loadGrocery();
}

function deleteGrocery(i) {
    groceryItems.splice(i, 1);
    localStorage.setItem("groceryItems", JSON.stringify(groceryItems));
    loadGrocery();
}

function filterGrocery(type, btn) {
    currentGroceryFilter = type;
    document.querySelectorAll(".filterTab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    loadGrocery();
}


/* ─────────────────────────────────────────────────────────
   10. WELLNESS LOADER
───────────────────────────────────────────────────────── */

function loadWellnessScreen() {
    calculatePeriod();
    renderHomeWaterDrops();
    loadMedicines();
    loadGrocery();
}


/* ─────────────────────────────────────────────────────────
   11. INIT
───────────────────────────────────────────────────────── */

window.onload = function() {
    nav("homeScreen", document.querySelector(".navBtn.active"));
};