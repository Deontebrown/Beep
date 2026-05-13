const state = {
  user: null,
  counts: { events: 0, members: 0 },
  tab: "home",
  status: "",
  data: { events: [], connections: [], feed: [], messages: [], swaps: [], admin: null },
  selectedEvent: null,
  selectedThread: null,
  selectedProfileId: null,
  selectedProfileTab: "overview",
  accountTab: "overview",
  previousTab: "home",
  authMode: "signup",
  verificationToken: null,
  onboardingStep: 0,
  onboarding: {
    fullName: "",
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
    age: "",
    industry: "Technology",
    businessType: ["Small Business"],
    title: "",
    services: [],
    lookingFor: [],
    interests: [],
    socialLinks: "",
    bio: ""
  },
  profileEdit: null,
  adminEventEdit: null
};

const industries = ["Technology", "Finance", "Arts", "Real Estate", "Healthcare", "Marketing", "Business Services", "Food & Hospitality", "Education", "Nonprofit", "Construction", "Other"];
const businessTypes = ["Small Business", "Minority-Owned Business", "Established Business", "Women Owned Business", "Black Owned", "Start-Up", "Veteran Owned"];
const services = ["Brand Design", "Social Media", "Photography", "Accounting", "Legal Support", "Websites", "Event Planning", "Funding Strategy", "Business Coaching", "Content Creation", "Business Services"];
const goals = ["Clients", "Collaborators", "Mentors", "Investors", "Vendors", "Skill Swaps", "Community Connections"];
const interests = ["Sports", "Music", "Travel", "Food", "Community", "Fitness", "Youth Leadership", "Art", "Faith", "Tech"];
const app = document.querySelector("#app");

const navIcons = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
  events: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h3M13 14h3M8 17h3"/></svg>',
  connections: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3.5 20c.8-3.2 2.7-5 5-5s4.2 1.8 5 5"/><path d="M13.5 17c.8-1.5 1.9-2.3 3.2-2.3 1.8 0 3.2 1.3 3.8 3.8"/></svg>',
  messages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 12h5"/></svg>',
  feed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  account: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 3.5-6 7-6s6 2 7 6"/></svg>',
  admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-5"/></svg>'
};
function navIcon(id) { return navIcons[id] || navIcons.home; }


async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function avatar(profile) { return profile?.photoUrl ? `<img class="avatar" src="${esc(profile.photoUrl)}" alt="${esc(profile.fullName)} profile">` : `<div class="avatar">${esc((profile?.fullName || "PC").split(" ").map((p) => p[0]).join("").slice(0, 2))}</div>`; }
function tags(items) { return `<div class="tags">${(items || []).slice(0, 4).map((tag) => `<em>${esc(tag)}</em>`).join("")}</div>`; }
function onlineDot(status) { return `<span class="status-dot ${esc(status || "offline")}" title="${esc(status || "offline")}"></span>`; }
function asArray(value) { return Array.isArray(value) ? value : value ? [value] : []; }
function readFileAsDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function fileInput(id, label, accept) { return `<label class="field upload-field">${label}<input id="${id}" type="file" accept="${accept}"></label>`; }
function flyerPreview(event) { if (!event?.flyerUrl) return ""; return String(event.flyerUrl).startsWith("data:application/pdf") ? `<a class="flyer pdf-flyer" href="${esc(event.flyerUrl)}" target="_blank" rel="noopener">Open event flyer PDF</a>` : `<img class="flyer" src="${esc(event.flyerUrl)}" alt="${esc(event.name)} flyer">`; }
function setStatus(message) { state.status = message; const node = document.querySelector(".status"); if (node) node.textContent = message; }

function titleParts(title = "") { const parts = String(title).split(/\s+at\s+/i); return { title: parts[0] || title, company: parts.slice(1).join(" at ") }; }
function profilePortfolio(profile) {
  const items = profile?.portfolioItems || (profile?.portfolioImages || []).map((image, index) => ({ image, description: `Work example ${index + 1}` }));
  return items.slice(0, 4);
}

function threadMessagesFor(userId) { return state.data.messages.filter((message) => [message.senderId, message.receiverId].includes(userId)); }
function lastThreadMessage(userId) { return threadMessagesFor(userId).at(-1); }
function messagePreview(message) { if (!message) return "No messages yet — start the conversation."; const mine = message.senderId === state.user.id ? "You: " : ""; return `${mine}${message.body}`; }
function messageTime(message) { if (!message?.createdAt) return ""; return new Date(message.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }); }
function businessTypeText(value) { return asArray(value).join(", "); }
function findPublicProfile(userId) {
  for (const event of state.data.events) {
    const attendee = event.attendees.find((item) => item.id === userId);
    if (attendee) return attendee;
  }
  const connection = state.data.connections.find((item) => item.user.id === userId);
  if (connection?.user?.profile) return { id: connection.user.id, ...connection.user.profile, badges: connection.user.badges || [], onlineStatus: connection.user.onlineStatus, connected: true, matchScore: null };
  const post = state.data.feed.find((item) => item.author?.id === userId);
  if (post?.author?.profile) return { id: post.author.id, ...post.author.profile, badges: post.author.badges || [], onlineStatus: post.author.onlineStatus, connected: state.data.connections.some((item) => item.user.id === post.author.id), matchScore: null };
  return null;
}
function openProfile(userId) { state.selectedProfileId = userId; state.selectedProfileTab = "overview"; state.previousTab = state.tab === "profile" ? state.previousTab : state.tab; state.tab = "profile"; render(); }

async function init() {
  const me = await api("/api/me");
  state.user = me.user;
  state.counts = me.counts;
  if (state.user?.profileComplete) await loadAppData();
  render();
}
async function loadAppData() {
  const [events, connections, feed, messages, swaps] = await Promise.all([api("/api/events"), api("/api/connections"), api("/api/feed"), api("/api/messages"), api("/api/skill-swaps")]);
  state.data = { ...state.data, events: events.events, connections: connections.connections, feed: feed.posts, messages: messages.messages, swaps: swaps.swaps };
  state.selectedEvent ||= state.data.events[0]?.id;
  if (state.user?.isAdmin) state.data.admin = await api("/api/admin");
}
function render() {
  if (!state.user) return renderAuth();
  if (!state.user.profileComplete) return renderOnboarding();
  renderApp();
}

function renderAuth() {
  app.innerHTML = `<main class="page"><div class="auth-wrap"><section class="hero"><div class="brand">♛ Prime Connects Inc.</div><h1>Prime Connects<br>App</h1><p>Enhance every in-person event with intentional introductions, private follow-ups, community wins, and meaningful professional relationships.</p><div class="metrics"><div><strong>${state.counts.events}</strong><span>Seeded events</span></div><div><strong>${state.counts.members}</strong><span>Demo members</span></div></div></section><section class="panel"><p class="eyebrow">Secure account access</p><h2>${state.authMode === "signup" ? "Create your verified account" : state.authMode === "login" ? "Welcome back" : "Reset password"}</h2><label class="field">Email<input id="email" value="${state.authMode === "login" ? "maya@primeconnects.test" : "founder@primeconnects.test"}"></label><label class="field">Password<input id="password" type="password" value="PrimePass123"></label><button class="primary" id="authSubmit">${state.authMode === "signup" ? "Sign up" : state.authMode === "login" ? "Log in" : "Reset password"}</button>${state.verificationToken ? `<button class="secondary" id="verify">Verify email and continue</button>` : ""}<p class="status">${esc(state.status)}</p><div class="links"><button data-mode="signup">Sign up</button><button data-mode="login">Log in</button><button data-mode="reset">Forgot password</button></div><p class="hint">Admin login: networking@primeconnectsindy.com / PrimePass123</p></section></div></main>`;
  document.querySelectorAll("[data-mode]").forEach((button) => button.onclick = () => { state.authMode = button.dataset.mode; state.status = ""; render(); });
  document.querySelector("#authSubmit").onclick = authSubmit;
  document.querySelector("#verify")?.addEventListener("click", verify);
}
async function authSubmit() {
  try {
    const email = document.querySelector("#email").value;
    const password = document.querySelector("#password").value;
    if (state.authMode === "signup") {
      const result = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
      state.verificationToken = result.verificationToken;
      render();
      setStatus("Verification link generated. Use the gold button to simulate the email click.");
      return;
    }
    if (state.authMode === "reset") {
      await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, password }) });
      state.authMode = "login";
      render();
      setStatus("Password reset complete. Sign in with the new password.");
      return;
    }
    const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    state.user = result.user;
    state.tab = "home";
    if (state.user.profileComplete) await loadAppData();
    render();
  } catch (error) { setStatus(error.message); }
}
async function verify() {
  const result = await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ token: state.verificationToken }) });
  state.user = result.user;
  render();
}

function renderOnboarding() {
  const step = state.onboardingStep;
  const screens = [
    photoStep(),
    textStep("Your Name", "fullName", "Enter full name."),
    textStep("Age", "age", "Enter your age once. You cannot edit age after account creation.", "number"),
    selectStep("Your Industry", "industry", industries),
    choiceStep("Business Type", "businessType", businessTypes, 3),
    textStep("What You Do", "title", "Job title, business name, or one-line description."),
    multiStep("Services You Offer", "services", services, "Add another service"),
    multiStep("What You're Looking For", "lookingFor", goals, "Add another goal"),
    multiStep("Interests & Hobbies", "interests", interests, "Add another hobby or interest"),
    textStep("Social Media Links", "socialLinks", "Optional but encouraged — LinkedIn, Instagram, or other handles.")
  ];
  const progress = Math.round(((step + 1) / screens.length) * 100);
  app.innerHTML = `<main class="page"><section class="panel"><p class="eyebrow">Verified as ${esc(state.user.email)}</p><div class="progress"><span style="width:${progress}%"></span></div>${screens[step]}<div class="buttons"><button class="secondary" id="back" ${step === 0 ? "disabled" : ""}>Back</button><button class="primary" id="next">${step === screens.length - 1 ? "Enter Prime Connects" : "Continue"}</button></div><p class="status">${esc(state.status)}</p></section></main>`;
  bindOnboardingInputs();
  document.querySelector("#back").onclick = () => { state.onboardingStep -= 1; render(); };
  document.querySelector("#next").onclick = async () => { if (state.onboardingStep < screens.length - 1) { state.onboardingStep += 1; render(); } else await saveProfile(state.onboarding); };
}
function textStep(title, key, help, type = "text") { return `<div class="step"><h2>${title}</h2><p>${help}</p><input data-field="${key}" type="${type}" value="${esc(state.onboarding[key])}"></div>`; }
function photoStep() { return `<div class="step"><h2>Upload Profile Photo</h2><p>Upload a PNG, JPG, JPEG, GIF, WEBP, or other image file from your device.</p>${fileInput("profileUpload", "Choose image file", "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/*")}${state.onboarding.photoUrl ? `<div class="upload-preview">${avatar({ fullName: state.onboarding.fullName || "Prime Member", photoUrl: state.onboarding.photoUrl })}</div>` : ""}</div>`; }
function selectStep(title, key, options) { return `<div class="step"><h2>${title}</h2><select data-field="${key}">${options.map((option) => `<option ${state.onboarding[key] === option ? "selected" : ""}>${option}</option>`).join("")}</select></div>`; }
function choiceStep(title, key, options, max = 1) { const selected = asArray(state.onboarding[key]); return `<div class="step"><h2>${title}</h2>${max > 1 ? `<p>Select up to ${max}.</p>` : ""}<div class="chips">${options.map((option) => `<button class="chip ${selected.includes(option) ? "active" : ""}" data-choice="${key}:${option}:${max}">${option}</button>`).join("")}</div></div>`; }
function multiStep(title, key, options, placeholder) { const allOptions = [...options, ...state.onboarding[key].filter((item) => !options.includes(item))]; return `<div class="step"><h2>${title}</h2><div class="chips">${allOptions.map((option) => `<button class="chip ${state.onboarding[key].includes(option) ? "active" : ""}" data-multi="${key}:${option}">${option}</button>`).join("")}</div><div class="add-row"><input id="custom-${key}" placeholder="${placeholder}"><button class="mini" data-add-custom="${key}">+ Add</button></div></div>`; }
function bindOnboardingInputs() {
  document.querySelectorAll("[data-field]").forEach((input) => input.oninput = () => state.onboarding[input.dataset.field] = input.value);
  document.querySelectorAll("[data-choice]").forEach((button) => button.onclick = () => { const [key, value, maxValue] = button.dataset.choice.split(":"); const max = Number(maxValue || 1); if (max > 1) toggleLimitedArrayValue(state.onboarding, key, value, max); else state.onboarding[key] = value; render(); });
  document.querySelectorAll("[data-multi]").forEach((button) => button.onclick = () => toggleArrayValue(state.onboarding, ...button.dataset.multi.split(":")));
  document.querySelectorAll("[data-add-custom]").forEach((button) => button.onclick = () => addCustomValue(state.onboarding, button.dataset.addCustom));
  document.querySelector("#profileUpload")?.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) { state.onboarding.photoUrl = await readFileAsDataUrl(file); render(); } });
}
function toggleArrayValue(target, key, value) { target[key] = target[key].includes(value) ? target[key].filter((item) => item !== value) : [...target[key], value]; render(); }
function toggleLimitedArrayValue(target, key, value, max) { const current = asArray(target[key]); target[key] = current.includes(value) ? current.filter((item) => item !== value) : current.length < max ? [...current, value] : current; }
function addCustomValue(target, key) { const input = document.querySelector(`#custom-${key}`); const value = input.value.trim(); if (value && !target[key].includes(value)) target[key].push(value); render(); }
async function saveProfile(profile, nextTab = "home") {
  try {
    const result = await api("/api/profile", { method: "POST", body: JSON.stringify(profile) });
    state.user = result.user;
    state.profileEdit = null;
    state.tab = nextTab;
    await loadAppData();
    render();
  } catch (error) { setStatus(error.message); }
}

function renderApp() {
  const tabs = [["home", "Home"], ["events", "Events"], ["connections", "Connect"], ["messages", "Messages"], ["feed", "Feed"], ["account", "Account"]];
  if (state.user.isAdmin) tabs.push(["admin", "Admin"]);
  app.innerHTML = `<main class="page"><div class="app-wrap"><section class="phone"><header class="top"><div><p class="eyebrow">Prime Connects Inc.</p><h1>One Network. Endless Possibilities.</h1></div><button class="icon home-icon" data-home title="Home">${navIcon("home")}</button></header><div class="content">${screen()}</div><nav class="nav">${tabs.map(([id, label]) => `<button class="${state.tab === id ? "active" : ""}" data-tab="${id}">${navIcon(id)}<span>${label}</span></button>`).join("")}</nav></section><aside class="desktop-panel"><p class="eyebrow">MVP Console</p><h2>Built for mobile and ready for web.</h2><p>Use Home to return to the signed-in landing page. Admin users can manage events, flyers, RSVP links, badges, and users.</p><div class="metrics"><div><strong>${state.data.events.length}</strong><span>Published events</span></div><div><strong>${state.data.connections.length}</strong><span>Your connections</span></div></div></aside></div></main>`;
  document.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => { state.tab = button.dataset.tab; if (state.tab === "messages") state.selectedThread = null; render(); });
  document.querySelector("[data-home]").onclick = () => { state.tab = "home"; render(); };
  bindScreen();
}
function screen() { return ({ home: homeScreen, events: eventsScreen, connections: connectionsScreen, messages: messagesScreen, feed: feedScreen, account: accountScreen, admin: adminScreen, profile: profileScreen })[state.tab](); }
function homeScreen() { return `<section class="screen"><div class="profile compact">${avatar(state.user.profile)}<h2>Welcome, ${esc(state.user.profile.fullName.split(" ")[0])}</h2><p>${esc(state.user.profile.title)}</p></div><div class="home-grid"><button class="event-card" data-tab="events"><span>Next step</span><strong>Find an event</strong><small>RSVP and see AI matches.</small></button><button class="event-card" data-tab="connections"><span>Network</span><strong>${state.data.connections.length} connections</strong><small>Follow up with private notes.</small></button><button class="event-card" data-tab="feed"><span>Community</span><strong>Prime Feed</strong><small>Share wins and connection stories.</small></button></div><h3>Upcoming</h3>${state.data.events.slice(0, 2).map(eventSummary).join("")}</section>`; }
function eventSummary(item) { return `<article class="event-card"><span>${new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric" })}</span><strong>${esc(item.name)}</strong><small>${esc(item.location)}</small></article>`; }
function eventsScreen() {
  const event = state.data.events.find((item) => item.id === state.selectedEvent) || state.data.events[0];
  return `<section class="screen"><h2>Upcoming Events</h2><div class="stack">${state.data.events.map((item) => `<button class="event-card" data-event="${item.id}"><span>${new Date(item.date).toLocaleDateString([], { month: "short", day: "numeric" })}</span><strong>${esc(item.name)}</strong><small>${esc(item.location)}</small></button>`).join("")}</div>${event ? `<div class="detail">${flyerPreview(event)}<p class="eyebrow">Event detail</p><h3>${esc(event.name)}</h3><p>${esc(event.description)}</p><p><strong>Dress code:</strong> ${esc(event.dressCode)}</p><button class="primary" id="rsvp">I'll be there</button>${event.pendingMatches ? `<div class="pending">✦ Pending — Waiting for More Attendees</div>` : ""}<h4>AI-ranked attendees</h4>${event.attendees.map(memberCard).join("")}</div>` : ""}</section>`;
}
function memberCard(attendee) { const parts = titleParts(attendee.title); return `<article class="member profile-click" data-profile="${attendee.id}">${avatar(attendee)}<div><div class="member-head"><strong>${esc(attendee.fullName)} ${onlineDot(attendee.onlineStatus)}</strong><span>${attendee.connected ? "✓ Connected" : `${attendee.matchScore}%`}</span></div><p>${esc(parts.title)}${parts.company ? ` · ${esc(parts.company)}` : ""} · ${esc(attendee.industry)}</p><small>${esc(businessTypeText(attendee.businessType))}</small>${tags(attendee.lookingFor)}${attendee.connected ? `<div class="connected-pill">✓ Connected</div>` : `<input data-note="${attendee.id}" placeholder="Private note: where you met / follow-up"><button class="mini" data-connect="${attendee.id}">🤝 Connect</button>`}</div></article>`; }
function connectionsScreen() { const top = state.data.events.flatMap((event) => event.attendees).sort((a, b) => b.matchScore - a.matchScore).slice(0, 5); return `<section class="screen"><h2>Connections</h2><p>Browse top AI-matched attendees, connect, and save private context notes.</p><h3>Top matches</h3>${top.map(memberCard).join("")}<h3>Your network</h3>${state.data.connections.map((connection) => `<article class="row thread-row profile-click" data-profile="${connection.user.id}">${avatar(connection.user.profile)}<div><strong>${esc(connection.user.profile?.fullName)} ${onlineDot(connection.user.onlineStatus)}</strong><p>${esc(connection.note || "No note yet.")}</p></div><span class="connected-pill">✓ Connected</span></article>`).join("") || "<p>No connections yet.</p>"}</section>`; }

function portfolioGrid(items, editable = false) {
  return `<div class="portfolio-grid">${items.map((item, index) => `<div class="portfolio-item"><img src="${esc(item.image)}" alt="Portfolio item ${index + 1}"><p>${esc(item.description || "Work example")}</p>${editable ? `<div class="portfolio-controls"><button class="mini" data-portfolio-up="${index}">↑</button><button class="mini" data-portfolio-down="${index}">↓</button><button class="mini danger" data-portfolio-delete="${index}">Delete</button></div><input data-portfolio-desc="${index}" value="${esc(item.description || "")}" placeholder="Short description">` : ""}</div>`).join("") || "<p>No portfolio examples yet.</p>"}</div>`;
}
function profileTabs(active) { return `<div class="profile-tabs"><button class="${active === "overview" ? "active" : ""}" data-profile-tab="overview">Overview</button><button class="${active === "portfolio" ? "active" : ""}" data-profile-tab="portfolio">Portfolio</button></div>`; }
function profileScreen() {
  const member = findPublicProfile(state.selectedProfileId);
  if (!member) return `<section class="screen"><button class="secondary" id="backFromProfile">Back</button><p>Profile not found.</p></section>`;
  const parts = titleParts(member.title);
  const items = profilePortfolio(member);
  const socialLinks = String(member.socialLinks || "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  const isConnected = !!member.connected;
  const actions = member.id === state.user.id ? "" : `<div class="profile-actions"><button class="primary" data-profile-connect="${member.id}">${isConnected ? "Connected" : "Connect"}</button><button class="secondary" data-profile-message="${member.id}">Message</button></div>`;
  const overview = `<div class="profile-section"><h3>Badges</h3><div class="badge-grid compact-badges">${(member.badges || []).map((badge) => `<div>🏆 ${esc(badge)}</div>`).join("") || "<p>No badges yet.</p>"}</div></div><div class="profile-section"><h3>Business</h3><p><strong>Business type:</strong> ${esc(businessTypeText(member.businessType) || "Not listed")}</p><p><strong>Industry:</strong> ${esc(member.industry || "Not listed")}</p></div><div class="profile-section"><h3>Skills & Services</h3>${tags(member.services)}</div><div class="profile-section"><h3>Looking For</h3>${tags(member.lookingFor)}</div>${socialLinks.length ? `<div class="profile-section"><h3>Social Links</h3><div class="social-list">${socialLinks.map((link) => `<span>${esc(link)}</span>`).join("")}</div></div>` : ""}`;
  const portfolio = `<div class="profile-section"><h3>Portfolio / Work Examples</h3>${portfolioGrid(items)}</div>`;
  return `<section class="screen"><button class="secondary" id="backFromProfile">Back</button><article class="public-profile-card"><div class="public-profile-top">${avatar(member)}<div><h2>${esc(member.fullName)}</h2><p>${esc(parts.title)}</p>${parts.company ? `<strong>${esc(parts.company)}</strong>` : ""}</div></div>${actions}<div class="profile-meta-row">${member.matchScore === null || member.matchScore === undefined ? "" : `<span class="match-pill">${member.matchScore}% match</span>`}${isConnected ? `<span class="connected-pill">✓ Connected</span>` : ""}${onlineDot(member.onlineStatus)}</div>${profileTabs(state.selectedProfileTab)}${state.selectedProfileTab === "portfolio" ? portfolio : overview}</article></section>`;
}

function messagesScreen() {
  const selected = state.data.connections.find((connection) => connection.user.id === state.selectedThread);
  if (!selected) {
    return `<section class="screen"><h2>Messages</h2><p>Your private conversations with connected members.</p><div class="dm-list">${state.data.connections.map((connection) => { const last = lastThreadMessage(connection.user.id); return `<button class="dm-row" data-thread="${connection.user.id}">${avatar(connection.user.profile)}<div><strong>${esc(connection.user.profile?.fullName)} ${onlineDot(connection.user.onlineStatus)}</strong><p>${esc(messagePreview(last))}</p></div><small>${esc(messageTime(last))}</small></button>`; }).join("") || "<p>Connect with someone before messaging.</p>"}</div></section>`;
  }
  const threadMessages = threadMessagesFor(selected.user.id);
  return `<section class="screen chat-screen"><button class="secondary" id="backToInbox">Back to messages</button><button class="chat-profile-header" data-profile="${selected.user.id}">${avatar(selected.user.profile)}<span><strong>${esc(selected.user.profile?.fullName)}</strong><small>${esc(selected.user.profile?.title || "View profile")}</small></span>${onlineDot(selected.user.onlineStatus)}</button><div class="message-list">${threadMessages.map((message) => `<div class="bubble ${message.senderId === state.user.id ? "mine" : ""}">${esc(message.body)}<small>${esc(message.sender.profile?.fullName)}</small></div>`).join("") || '<p class="empty-thread">No messages yet. Say hello.</p>'}</div><div class="message-composer"><input id="messageBody" placeholder="Write a private message"><button class="primary" id="sendMessage">Send</button></div></section>`;
}
function feedScreen() { return `<section class="screen"><h2>Prime Feed</h2><p>Keep posts professional and focused on wins and connections. External links, nudity, and profanity are blocked.</p><textarea id="postBody" placeholder="Share a professional win from Prime Connects."></textarea><button class="primary" id="sharePost">◆ Share win</button><p class="status">${esc(state.status)}</p>${state.data.feed.map((post) => `<article class="feed"><button class="row feed-author" data-profile="${post.author.id}">${avatar(post.author.profile)}<div><strong>${esc(post.author.profile?.fullName || "Prime Member")}</strong><p>${post.type === "BADGE" ? "Badge achievement" : esc(post.author.profile?.title)}</p></div></button><p>${esc(post.body)}</p><small>${post.likes.length} likes · Comments enabled</small></article>`).join("")}</section>`; }
function accountScreen() {
  const profile = state.profileEdit || structuredClone(state.user.profile);
  const items = profilePortfolio(profile);
  const overview = `<h3>Edit profile</h3><label class="field">Full name<input id="editName" value="${esc(profile.fullName)}"></label><label class="field">Age cannot be edited<input value="${esc(profile.age)}" disabled></label><label class="field">Industry<select id="editIndustry">${industries.map((item) => `<option ${profile.industry === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><div class="field"><span>Business type (select up to 3)</span><div class="chips">${businessTypes.map((item) => `<button class="chip ${asArray(profile.businessType).includes(item) ? "active" : ""}" data-edit-business="${item}">${item}</button>`).join("")}</div></div><label class="field">What you do<input id="editTitle" value="${esc(profile.title)}"></label><label class="field">Social links<input id="editSocial" value="${esc(profile.socialLinks)}"></label><button class="primary" id="saveProfile">Save profile changes</button><h3>Skill Swap</h3><input id="offering" placeholder="I can offer..."><input id="seeking" placeholder="In exchange for..."><button class="primary" id="addSwap">Publish skill swap</button>${state.data.swaps.map((swap) => `<article class="swap"><strong>${esc(swap.user.profile?.fullName)}</strong><p>Offers ${esc(swap.offering)}</p><p>Needs ${esc(swap.seeking)}</p></article>`).join("")}`;
  const portfolio = `<h3>Portfolio</h3><p>Add up to 4 examples. Visitors can view these but cannot edit.</p>${portfolioGrid(items, true)}${items.length < 4 ? `<div class="portfolio-add"><input id="portfolioImage" placeholder="Image URL"><input id="portfolioDescription" placeholder="Short description"><button class="primary" id="addPortfolioItem">Add portfolio item</button></div>` : ""}<button class="primary" id="savePortfolio">Save portfolio</button>`;
  return `<section class="screen"><div class="profile"><label class="profile-photo-upload" title="Tap to change profile picture">${avatar(profile)}<input id="editPhotoUpload" type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/*"><span>Tap photo to change</span></label><h2>${esc(profile.fullName)}</h2><p>${esc(profile.title)}</p></div><div class="badge-grid">${state.user.badges.map((badge) => `<div>🏆 ${esc(badge)}</div>`).join("") || "<p>No badges yet.</p>"}</div>${profileTabs(state.accountTab)}${state.accountTab === "portfolio" ? portfolio : overview}<button class="secondary" id="logout">Log out</button></section>`;
}

function adminScreen() {
  const admin = state.data.admin || { users: [], events: [], badges: [] };
  const editing = state.adminEventEdit || { name: "", date: "", location: "", description: "", dressCode: "", flyerUrl: "", rsvpUrl: "" };
  return `<section class="screen"><h2>Admin Portal</h2><p>Signed in as networking@primeconnectsindy.com. Manage event details, flyers, RSVP links, badges, and users.</p><h3>Events</h3><select id="adminEventSelect"><option value="">Create new event</option>${admin.events.map((event) => `<option value="${event.id}">${esc(event.name)}</option>`).join("")}</select><input id="adminName" placeholder="Event name" value="${esc(editing.name)}"><input id="adminDate" placeholder="Event date ISO" value="${esc(editing.date)}"><input id="adminLocation" placeholder="Location" value="${esc(editing.location)}"><input id="adminDress" placeholder="Dress code" value="${esc(editing.dressCode)}">${fileInput("adminFlyerUpload", "Upload flyer (PNG, JPEG, PDF, etc.)", "image/*,application/pdf")}<input id="adminFlyer" placeholder="Event flyer URL or uploaded file data" value="${esc(editing.flyerUrl)}"><input id="adminRsvp" placeholder="I'll be there RSVP link" value="${esc(editing.rsvpUrl)}"><textarea id="adminDescription" placeholder="Description">${esc(editing.description)}</textarea><button class="primary" id="saveEvent">Save event</button><h3>Badges</h3><input id="badgeName" placeholder="New badge name"><select id="badgeCriteria"><option value="manual">Manual award later</option><option value="connections">Connection count</option></select><input id="badgeCriteriaCount" type="number" min="0" placeholder="Requirement count, e.g. 100"><button class="primary" id="createBadge">Create badge</button><div class="tags">${admin.badges.map((badge) => `<em>${esc(badge.name || badge)}${badge.criteriaType === "connections" ? ` · ${badge.criteriaCount} connections` : ""}</em>`).join("")}</div><h3>Users</h3>${admin.users.map((user) => `<article class="row"><div>${avatar(user.profile)}</div><div><strong>${esc(user.profile?.fullName || user.email)} ${onlineDot(user.onlineStatus)}</strong><p>${esc(user.email)}</p></div>${user.email !== state.user.email ? `<button class="mini danger" data-remove-user="${user.id}">Remove</button>` : ""}</article>`).join("")}</section>`;
}
function bindScreen() {
  document.querySelectorAll("[data-event]").forEach((button) => button.onclick = () => { state.selectedEvent = button.dataset.event; render(); });
  document.querySelectorAll("[data-profile]").forEach((item) => item.onclick = (event) => { if (event.target.closest("[data-connect], [data-note], input")) return; openProfile(item.dataset.profile); });
  document.querySelector("#backFromProfile")?.addEventListener("click", () => { state.tab = state.previousTab || "connections"; render(); });
  document.querySelectorAll("[data-profile-tab]").forEach((button) => button.onclick = () => { if (state.tab === "account") state.accountTab = button.dataset.profileTab; else state.selectedProfileTab = button.dataset.profileTab; render(); });
  document.querySelector("[data-profile-connect]")?.addEventListener("click", async (event) => { await api("/api/connections", { method: "POST", body: JSON.stringify({ recipientId: event.currentTarget.dataset.profileConnect, note: "Connected from profile." }) }); await loadAppData(); render(); });
  document.querySelector("[data-profile-message]")?.addEventListener("click", async (event) => { const userId = event.currentTarget.dataset.profileMessage; if (!state.data.connections.some((connection) => connection.user.id === userId)) await api("/api/connections", { method: "POST", body: JSON.stringify({ recipientId: userId, note: "Connected from profile message." }) }); await loadAppData(); state.selectedThread = userId; state.tab = "messages"; render(); });
  document.querySelector("#rsvp")?.addEventListener("click", async () => { const event = state.data.events.find((item) => item.id === state.selectedEvent); await api("/api/events/check-in", { method: "POST", body: JSON.stringify({ eventId: state.selectedEvent }) }); await loadAppData(); render(); if (event?.rsvpUrl) window.open(event.rsvpUrl, "_blank", "noopener"); });
  document.querySelectorAll("[data-connect]").forEach((button) => button.onclick = async () => { const recipientId = button.dataset.connect; const note = document.querySelector(`[data-note="${recipientId}"]`)?.value || ""; await api("/api/connections", { method: "POST", body: JSON.stringify({ recipientId, note }) }); await loadAppData(); render(); });
  document.querySelectorAll("[data-thread]").forEach((button) => button.onclick = () => { state.selectedThread = button.dataset.thread; state.tab = "messages"; render(); });
  document.querySelector("#backToInbox")?.addEventListener("click", () => { state.selectedThread = null; render(); });
  document.querySelector("#sendMessage")?.addEventListener("click", async () => { await api("/api/messages", { method: "POST", body: JSON.stringify({ receiverId: state.selectedThread, body: document.querySelector("#messageBody").value }) }); await loadAppData(); render(); });
  document.querySelector("#sharePost")?.addEventListener("click", async () => { try { await api("/api/feed", { method: "POST", body: JSON.stringify({ body: document.querySelector("#postBody").value }) }); state.status = ""; await loadAppData(); render(); } catch (error) { setStatus(error.message); } });
  document.querySelector("#addSwap")?.addEventListener("click", async () => { await api("/api/skill-swaps", { method: "POST", body: JSON.stringify({ offering: document.querySelector("#offering").value, seeking: document.querySelector("#seeking").value }) }); await loadAppData(); render(); });
  document.querySelectorAll("[data-edit-business]").forEach((button) => button.onclick = () => { state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.businessType = asArray(state.profileEdit.businessType); if (state.profileEdit.businessType.includes(button.dataset.editBusiness)) state.profileEdit.businessType = state.profileEdit.businessType.filter((item) => item !== button.dataset.editBusiness); else if (state.profileEdit.businessType.length < 3) state.profileEdit.businessType.push(button.dataset.editBusiness); render(); });
  document.querySelectorAll("[data-portfolio-desc]").forEach((input) => input.oninput = () => { state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.portfolioItems = profilePortfolio(state.profileEdit); state.profileEdit.portfolioItems[Number(input.dataset.portfolioDesc)].description = input.value; });
  document.querySelectorAll("[data-portfolio-delete]").forEach((button) => button.onclick = () => { state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.portfolioItems = profilePortfolio(state.profileEdit).filter((_, index) => index !== Number(button.dataset.portfolioDelete)); render(); });
  document.querySelectorAll("[data-portfolio-up]").forEach((button) => button.onclick = () => { const index = Number(button.dataset.portfolioUp); if (index <= 0) return; state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.portfolioItems = profilePortfolio(state.profileEdit); [state.profileEdit.portfolioItems[index - 1], state.profileEdit.portfolioItems[index]] = [state.profileEdit.portfolioItems[index], state.profileEdit.portfolioItems[index - 1]]; render(); });
  document.querySelectorAll("[data-portfolio-down]").forEach((button) => button.onclick = () => { const index = Number(button.dataset.portfolioDown); state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.portfolioItems = profilePortfolio(state.profileEdit); if (index >= state.profileEdit.portfolioItems.length - 1) return; [state.profileEdit.portfolioItems[index + 1], state.profileEdit.portfolioItems[index]] = [state.profileEdit.portfolioItems[index], state.profileEdit.portfolioItems[index + 1]]; render(); });
  document.querySelector("#addPortfolioItem")?.addEventListener("click", () => { const image = document.querySelector("#portfolioImage").value.trim(); const description = document.querySelector("#portfolioDescription").value.trim(); if (!image) return; state.profileEdit = state.profileEdit || structuredClone(state.user.profile); state.profileEdit.portfolioItems = [...profilePortfolio(state.profileEdit), { image, description }].slice(0, 4); render(); });
  document.querySelector("#savePortfolio")?.addEventListener("click", async () => { const current = state.user.profile; await saveProfile({ ...current, portfolioItems: state.profileEdit?.portfolioItems || profilePortfolio(current) }, "account"); state.accountTab = "portfolio"; });
  document.querySelector("#editPhotoUpload")?.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) { const photoUrl = await readFileAsDataUrl(file); state.profileEdit = { ...(state.profileEdit || structuredClone(state.user.profile)), photoUrl }; await saveProfile({ ...state.user.profile, photoUrl }, "account"); } });
  document.querySelector("#saveProfile")?.addEventListener("click", async () => { const current = state.user.profile; await saveProfile({ ...current, photoUrl: current.photoUrl, fullName: document.querySelector("#editName").value, industry: document.querySelector("#editIndustry").value, businessType: state.profileEdit?.businessType || asArray(current.businessType), title: document.querySelector("#editTitle").value, socialLinks: document.querySelector("#editSocial").value, portfolioItems: state.profileEdit?.portfolioItems || profilePortfolio(current) }, "account"); });
  document.querySelector("#logout")?.addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); state.user = null; state.tab = "home"; render(); });
  document.querySelector("#adminEventSelect")?.addEventListener("change", (event) => { state.adminEventEdit = state.data.admin.events.find((item) => item.id === event.target.value) || null; render(); });
  document.querySelector("#saveEvent")?.addEventListener("click", async () => { await api("/api/admin/events", { method: "POST", body: JSON.stringify({ id: state.adminEventEdit?.id, name: document.querySelector("#adminName").value, date: document.querySelector("#adminDate").value, location: document.querySelector("#adminLocation").value, dressCode: document.querySelector("#adminDress").value, flyerUrl: document.querySelector("#adminFlyer").value, rsvpUrl: document.querySelector("#adminRsvp").value, description: document.querySelector("#adminDescription").value }) }); state.adminEventEdit = null; await loadAppData(); render(); });
  document.querySelector("#adminFlyerUpload")?.addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (file) { const input = document.querySelector("#adminFlyer"); input.value = await readFileAsDataUrl(file); } });
  document.querySelector("#createBadge")?.addEventListener("click", async () => { await api("/api/admin/badges", { method: "POST", body: JSON.stringify({ name: document.querySelector("#badgeName").value, criteriaType: document.querySelector("#badgeCriteria").value, criteriaCount: document.querySelector("#badgeCriteriaCount").value }) }); await loadAppData(); render(); });
  document.querySelectorAll("[data-remove-user]").forEach((button) => button.onclick = async () => { await api("/api/admin/users/remove", { method: "POST", body: JSON.stringify({ userId: button.dataset.removeUser }) }); await loadAppData(); render(); });
}

init().catch((error) => { app.innerHTML = `<main class="page"><section class="panel"><h2>Prime Connects</h2><p class="status">${esc(error.message)}</p></section></main>`; });
