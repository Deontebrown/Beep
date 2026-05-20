import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT ?? 3000);
const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "prime-connects.db.json");
const SEED_PATH = join(DATA_DIR, "prime-connects.seed.json");
const SESSION_SECRET = process.env.SESSION_SECRET ?? "prime-connects-dev-session-secret";
const SESSION_COOKIE = "prime_session";
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const TOOLBOX_CATEGORIES = ["Marketing", "Sales", "Finance", "Starting Up", "HR", "IT", "Products", "Other"];
const TOOLBOX_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp"]);
const TOOLBOX_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/csv",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/octet-stream"
]);

async function ensureDb() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
    seed.users = seed.users.map((user) => ({ ...user, passwordHash: user.passwordHash === "demo" ? hashPassword("PrimePass123") : user.passwordHash }));
    await writeFile(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  return normalizeDb(JSON.parse(await readFile(DB_PATH, "utf8")));
}

function normalizeDb(db) {
  for (const key of ["users", "events", "attendances", "connections", "messages", "feedPosts", "skillSwaps", "badges", "toolboxDocuments"]) db[key] ||= [];
  for (const user of db.users) {
    user.badges ||= [];
    user.isAdmin = Boolean(user.isAdmin) || user.email?.toLowerCase() === "networking@primeconnectsindy.com";
    user.termsAccepted = Boolean(user.termsAccepted);
    user.deactivated = Boolean(user.deactivated);
  }
  db.badges = db.badges.map((badge) => typeof badge === "string" ? { name: badge, criteriaType: "manual", criteriaCount: 0, iconUrl: "" } : { iconUrl: "", criteriaType: "manual", criteriaCount: 0, ...badge });
  return db;
}

async function writeDb(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

function id(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(value) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function sessionToken(userId) {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie ?? "").split(";").filter(Boolean).map((cookie) => {
    const [key, ...parts] = cookie.trim().split("=");
    return [key, decodeURIComponent(parts.join("="))];
  }));
}

function tokenUserId(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  return sign(payload) === parts[2] ? parts[0] : null;
}

function sessionUserId(request) {
  return tokenUserId(parseCookies(request)[SESSION_COOKIE]);
}

function bearerUserId(request) {
  const header = request.headers.authorization || "";
  return header.startsWith("Bearer ") ? tokenUserId(header.slice(7)) : null;
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(body));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function onlineStatus(user) {
  const lastSeen = user?.lastSeenAt ? Date.parse(user.lastSeenAt) : 0;
  if (!lastSeen) return "offline";
  const minutes = (Date.now() - lastSeen) / 60000;
  if (minutes <= 5) return "online";
  if (minutes <= 60) return "recent";
  return "offline";
}

function isAdmin(user) {
  return Boolean(user?.isAdmin) || user?.email?.toLowerCase() === "networking@primeconnectsindy.com";
}


function badgeName(badge) {
  return typeof badge === "string" ? badge : badge.name;
}

function connectionCount(db, userId) {
  return db.connections.filter((connection) => connection.requesterId === userId || connection.recipientId === userId).length;
}

function attendanceCount(db, userId) {
  return db.attendances.filter((attendance) => attendance.userId === userId && attendance.checkedIn).length;
}

function awardBadge(db, user, badge) {
  const name = badgeName(badge);
  if (!name || user.badges.includes(name)) return false;
  user.badges.push(name);
  db.feedPosts.unshift({ id: id("post"), authorId: user.id, type: "BADGE", body: `Earned the ${name} badge through Prime Connects.`, createdAt: new Date().toISOString(), likes: [], comments: [] });
  return true;
}

function awardEligibleBadges(db, user) {
  for (const badge of db.badges) {
    if (typeof badge === "string") continue;
    const count = Number(badge.criteriaCount ?? 0);
    if (count > 0 && badge.criteriaType === "connections" && connectionCount(db, user.id) >= count) awardBadge(db, user, badge);
    if (count > 0 && ["events", "attendances"].includes(badge.criteriaType) && attendanceCount(db, user.id) >= count) awardBadge(db, user, badge);
  }
}

function normalizeBusinessTypes(value) {
  return Array.isArray(value) ? value.slice(0, 3) : value ? [value] : [];
}

function cleanFileName(value) {
  return String(value ?? "document").replace(/[\\/<>:"|?*]+/g, "-").trim() || "document";
}

function isAllowedToolboxDocument(fileName, fileType) {
  const extension = extname(cleanFileName(fileName)).toLowerCase();
  const mimeType = String(fileType ?? "").toLowerCase();
  return TOOLBOX_EXTENSIONS.has(extension) || TOOLBOX_MIME_TYPES.has(mimeType);
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, isAdmin: isAdmin(user), emailVerified: user.emailVerified, profileComplete: user.profileComplete, termsAccepted: Boolean(user.termsAccepted), deactivated: Boolean(user.deactivated), profile: user.profile, badges: user.badges ?? [], onlineStatus: onlineStatus(user) };
}

function publicBadges(db) {
  return (db.badges || []).map((badge) => typeof badge === "string" ? { name: badge, criteriaType: "manual", criteriaCount: 0, iconUrl: "" } : { name: badge.name, criteriaType: badge.criteriaType || "manual", criteriaCount: Number(badge.criteriaCount || 0), iconUrl: badge.iconUrl || "" });
}

function tokenSet(value) {
  return new Set((Array.isArray(value) ? value.join(" ") : value ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function overlap(a, b) {
  const first = tokenSet(a);
  const second = tokenSet(b);
  return [...first].filter((token) => second.has(token)).length;
}

function scoreMatch(viewer, candidate, db) {
  let score = 35;
  if (viewer.industry === candidate.industry) score += 18;
  if (!normalizeBusinessTypes(viewer.businessType).some((type) => normalizeBusinessTypes(candidate.businessType).includes(type))) score += 6;
  score += Math.min(overlap(viewer.lookingFor, candidate.services) * 12, 24);
  score += Math.min(overlap(viewer.services, candidate.lookingFor) * 10, 20);
  score += Math.min(overlap(viewer.interests, candidate.interests) * 5, 15);
  const viewerSwaps = db.skillSwaps.filter((swap) => swap.userId === viewer.userId);
  const candidateSwaps = db.skillSwaps.filter((swap) => swap.userId === candidate.userId);
  for (const swap of viewerSwaps) for (const other of candidateSwaps) score += Math.min(overlap(swap.seeking, other.offering) * 8, 16);
  return Math.max(0, Math.min(99, score));
}

function authUser(request, db) {
  const userId = sessionUserId(request) || bearerUserId(request);
  return db.users.find((user) => user.id === userId) ?? null;
}

function completeRequired(values) {
  return values.every((value) => Array.isArray(value) ? value.length > 0 : typeof value === "number" ? Number.isFinite(value) : typeof value === "string" && value.trim().length > 0);
}

async function api(request, response) {
  const db = await readDb();
  const url = new URL(request.url, `http://${request.headers.host}`);
  const route = `${request.method} ${url.pathname}`;

  if (route === "GET /api/me") {
    const me = authUser(request, db);
    if (me) {
      me.lastSeenAt = new Date().toISOString();
      await writeDb(db);
    }
    return json(response, 200, { user: publicUser(me), counts: { events: db.events.length, members: db.users.filter((user) => user.profileComplete).length } });
  }

  if (route === "POST /api/auth/signup") {
    const input = await body(request);
    const email = String(input.email ?? "").toLowerCase().trim();
    const password = String(input.password ?? "");
    if (!email.includes("@") || password.length < 8) return json(response, 400, { error: "Use a valid email and a password with 8+ characters." });
    if (db.users.some((user) => user.email === email)) return json(response, 409, { error: "An account with this email already exists." });
    const verificationToken = randomBytes(24).toString("hex");
    db.users.push({ id: id("user"), email, passwordHash: hashPassword(password), emailVerified: false, verificationToken, failedLoginAttempts: 0, lockedUntilReset: false, profileComplete: false, termsAccepted: false, deactivated: false, profile: null, badges: [], isAdmin: false, lastSeenAt: null });
    await writeDb(db);
    return json(response, 200, { verificationToken });
  }

  if (route === "POST /api/auth/verify") {
    const input = await body(request);
    const user = db.users.find((candidate) => candidate.verificationToken === input.token);
    if (!user) return json(response, 404, { error: "Verification link is invalid or expired." });
    user.emailVerified = true;
    user.verificationToken = null;
    user.lastSeenAt = new Date().toISOString();
    await writeDb(db);
    const authToken = sessionToken(user.id);
    return json(response, 200, { user: publicUser(user), authToken }, { "set-cookie": `${SESSION_COOKIE}=${authToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
  }

  if (route === "POST /api/auth/login") {
    const input = await body(request);
    const user = db.users.find((candidate) => candidate.email === String(input.email ?? "").toLowerCase().trim());
    if (!user) return json(response, 401, { error: "Invalid email or password." });
    if (user.lockedUntilReset) return json(response, 423, { error: "This account is locked. Reset your password to continue." });
    if (!user.emailVerified) return json(response, 403, { error: "Verify your email before signing in." });
    if (!verifyPassword(String(input.password ?? ""), user.passwordHash)) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) user.lockedUntilReset = true;
      await writeDb(db);
      return json(response, 401, { error: user.lockedUntilReset ? "Too many attempts. Password reset required." : "Invalid email or password." });
    }
    user.failedLoginAttempts = 0;
    user.deactivated = false;
    user.lastSeenAt = new Date().toISOString();
    await writeDb(db);
    const authToken = sessionToken(user.id);
    return json(response, 200, { user: publicUser(user), authToken }, { "set-cookie": `${SESSION_COOKIE}=${authToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` });
  }

  if (route === "POST /api/auth/forgot-password") {
    const input = await body(request);
    const user = db.users.find((candidate) => candidate.email === String(input.email ?? "").toLowerCase().trim());
    if (user && String(input.password ?? "").length >= 8) {
      user.passwordHash = hashPassword(input.password);
      user.failedLoginAttempts = 0;
      user.lockedUntilReset = false;
      await writeDb(db);
    }
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/auth/logout") return json(response, 200, { ok: true }, { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });

  const user = authUser(request, db);
  if (!user) return json(response, 401, { error: "Authentication required." });
  user.lastSeenAt = new Date().toISOString();

  if (route === "POST /api/terms/accept") {
    user.termsAccepted = true;
    user.termsAcceptedAt = new Date().toISOString();
    await writeDb(db);
    return json(response, 200, { user: publicUser(user) });
  }

  if (route === "POST /api/account/deactivate") {
    user.deactivated = true;
    user.deactivatedAt = new Date().toISOString();
    await writeDb(db);
    return json(response, 200, { ok: true }, { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  }

  if (route === "POST /api/account/delete") {
    const userId = user.id;
    db.users = db.users.filter((candidate) => candidate.id !== userId);
    db.attendances = db.attendances.filter((attendance) => attendance.userId !== userId);
    db.connections = db.connections.filter((connection) => connection.requesterId !== userId && connection.recipientId !== userId);
    db.messages = db.messages.filter((message) => message.senderId !== userId && message.receiverId !== userId);
    db.feedPosts = db.feedPosts.filter((post) => post.authorId !== userId).map((post) => ({ ...post, comments: (post.comments || []).filter((comment) => comment.authorId !== userId) }));
    db.skillSwaps = db.skillSwaps.filter((swap) => swap.userId !== userId);
    await writeDb(db);
    return json(response, 200, { ok: true }, { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  }

  if (!user.termsAccepted) return json(response, 451, { error: "Terms and Conditions acceptance required." });

  if (route === "POST /api/profile") {
    const input = await body(request);
    if (!completeRequired([input.fullName, input.photoUrl, input.age ?? user.profile?.age, input.industry, input.businessType, input.title, input.services, input.lookingFor, input.interests])) return json(response, 400, { error: "Complete all required profile fields." });
    const existingAge = user.profile?.age;
    user.profile = { fullName: input.fullName, photoUrl: input.photoUrl, age: existingAge ?? input.age, industry: input.industry, businessType: normalizeBusinessTypes(input.businessType), title: input.title, services: input.services, lookingFor: input.lookingFor, interests: input.interests, socialLinks: input.socialLinks ?? "", bio: input.bio ?? "", portfolioItems: (input.portfolioItems ?? user.profile?.portfolioItems ?? []).slice(0, 4), userId: user.id };
    user.profileComplete = true;
    await writeDb(db);
    return json(response, 200, { user: publicUser(user) });
  }

  if (!user.profileComplete) return json(response, 403, { error: "Completed profile required." });

  if (route === "GET /api/events") {
    const connectedIds = new Set(db.connections.filter((connection) => connection.requesterId === user.id || connection.recipientId === user.id).map((connection) => connection.requesterId === user.id ? connection.recipientId : connection.requesterId));
    const events = db.events.map((event) => {
      const attendees = db.attendances.filter((attendance) => attendance.eventId === event.id && attendance.checkedIn).map((attendance) => db.users.find((candidate) => candidate.id === attendance.userId)).filter(Boolean).filter((candidate) => candidate.id !== user.id && candidate.profileComplete && !candidate.deactivated).map((candidate) => ({ ...candidate.profile, id: candidate.id, badges: candidate.badges, onlineStatus: onlineStatus(candidate), connected: connectedIds.has(candidate.id), matchScore: scoreMatch(user.profile, candidate.profile, db) })).sort((a, b) => b.matchScore - a.matchScore);
      return { ...event, attendees, pendingMatches: attendees.length < 2 };
    });
    return json(response, 200, { events });
  }

  if (route === "POST /api/events/check-in") {
    const input = await body(request);
    const existing = db.attendances.find((attendance) => attendance.userId === user.id && attendance.eventId === input.eventId);
    if (existing) existing.checkedIn = true;
    else db.attendances.push({ userId: user.id, eventId: input.eventId, checkedIn: true });
    if (attendanceCount(db, user.id) >= 3 && !user.badges.includes("Event Regular")) user.badges.push("Event Regular");
    awardEligibleBadges(db, user);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/connections") {
    const connections = db.connections.filter((connection) => connection.requesterId === user.id || connection.recipientId === user.id).map((connection) => ({ ...connection, user: publicUser(db.users.find((candidate) => candidate.id === (connection.requesterId === user.id ? connection.recipientId : connection.requesterId) && !candidate.deactivated)) }));
    return json(response, 200, { connections });
  }

  if (route === "POST /api/connections") {
    const input = await body(request);
    if (input.recipientId === user.id || !db.users.some((candidate) => candidate.id === input.recipientId && !candidate.deactivated)) return json(response, 400, { error: "Choose a valid member to connect with." });
    const existing = db.connections.find((connection) => (connection.requesterId === user.id && connection.recipientId === input.recipientId) || (connection.requesterId === input.recipientId && connection.recipientId === user.id));
    if (existing) existing.note = input.note ?? existing.note;
    else db.connections.push({ id: id("connection"), requesterId: user.id, recipientId: input.recipientId, status: "CONNECTED", note: input.note ?? "", createdAt: new Date().toISOString() });
    const count = connectionCount(db, user.id);
    const badge = count >= 10 ? "10 Connections" : count >= 5 ? "5 Connections" : count === 1 ? "First Connection" : null;
    if (badge) awardBadge(db, user, badge);
    awardEligibleBadges(db, user);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/feed") return json(response, 200, { posts: db.feedPosts.map((post) => ({ ...post, comments: (post.comments || []).map((comment) => ({ ...comment, author: publicUser(db.users.find((candidate) => candidate.id === comment.authorId && !candidate.deactivated)) })), author: publicUser(db.users.find((candidate) => candidate.id === post.authorId && !candidate.deactivated)) })) });

  if (route === "POST /api/feed") {
    const input = await body(request);
    const text = String(input.body ?? "").trim();
    if (text.length < 8) return json(response, 400, { error: "Share a little more detail about your win." });
    if (/https?:\/\/|www\./i.test(text)) return json(response, 400, { error: "Prime Feed posts cannot include external links or URLs." });
    if (/(fuck|shit|bitch|asshole|nude|nudity|sex|porn|xxx)/i.test(text)) return json(response, 400, { error: "Keep Prime Feed posts professional, safe, and focused on wins and connections." });
    db.feedPosts.unshift({ id: id("post"), authorId: user.id, type: "WIN", body: text, createdAt: new Date().toISOString(), likes: [], comments: [] });
    await writeDb(db);
    return json(response, 200, { ok: true });
  }


  if (route === "POST /api/feed/edit") {
    const input = await body(request);
    const post = db.feedPosts.find((item) => item.id === input.postId);
    if (!post) return json(response, 404, { error: "Feed post not found." });
    if (post.authorId !== user.id) return json(response, 403, { error: "You can only edit your own posts." });
    const text = String(input.body ?? "").trim();
    if (text.length < 8) return json(response, 400, { error: "Share a little more detail about your win." });
    if (/https?:\/\/|www\./i.test(text)) return json(response, 400, { error: "Prime Feed posts cannot include external links or URLs." });
    if (/(fuck|shit|bitch|asshole|nude|nudity|sex|porn|xxx)/i.test(text)) return json(response, 400, { error: "Keep Prime Feed posts professional, safe, and focused on wins and connections." });
    post.body = text;
    post.editedAt = new Date().toISOString();
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/feed/delete") {
    const input = await body(request);
    const post = db.feedPosts.find((item) => item.id === input.postId);
    if (!post) return json(response, 404, { error: "Feed post not found." });
    if (post.authorId !== user.id) return json(response, 403, { error: "You can only delete your own posts." });
    db.feedPosts = db.feedPosts.filter((item) => item.id !== input.postId);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/feed/comment") {
    const input = await body(request);
    const post = db.feedPosts.find((item) => item.id === input.postId);
    if (!post) return json(response, 404, { error: "Feed post not found." });
    const text = String(input.body ?? "").trim();
    if (text.length < 1) return json(response, 400, { error: "Comment text required." });
    if (/https?:\/\/|www\./i.test(text)) return json(response, 400, { error: "Comments cannot include external links or URLs." });
    if (/(fuck|shit|bitch|asshole|nude|nudity|sex|porn|xxx)/i.test(text)) return json(response, 400, { error: "Keep comments professional and safe." });
    post.comments = post.comments || [];
    post.comments.push({ id: id("comment"), authorId: user.id, body: text.slice(0, 500), createdAt: new Date().toISOString() });
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/messages") return json(response, 200, { messages: db.messages.filter((message) => message.senderId === user.id || message.receiverId === user.id).map((message) => ({ ...message, sender: publicUser(db.users.find((candidate) => candidate.id === message.senderId)), receiver: publicUser(db.users.find((candidate) => candidate.id === message.receiverId)) })) });

  if (route === "POST /api/messages") {
    const input = await body(request);
    const connected = db.connections.some((connection) => (connection.requesterId === user.id && connection.recipientId === input.receiverId) || (connection.requesterId === input.receiverId && connection.recipientId === user.id));
    if (!connected) return json(response, 403, { error: "Only connected members can message each other." });
    db.messages.push({ id: id("message"), senderId: user.id, receiverId: input.receiverId, body: String(input.body ?? "").slice(0, 1000), createdAt: new Date().toISOString() });
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/messages/edit") {
    const input = await body(request);
    const message = db.messages.find((item) => item.id === input.messageId);
    if (!message) return json(response, 404, { error: "Message not found." });
    if (message.senderId !== user.id) return json(response, 403, { error: "You can only edit your own messages." });
    const text = String(input.body ?? "").trim();
    if (!text) return json(response, 400, { error: "Message text required." });
    message.body = text.slice(0, 1000);
    message.editedAt = new Date().toISOString();
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/messages/delete") {
    const input = await body(request);
    const message = db.messages.find((item) => item.id === input.messageId);
    if (!message) return json(response, 404, { error: "Message not found." });
    if (message.senderId !== user.id) return json(response, 403, { error: "You can only delete your own messages." });
    db.messages = db.messages.filter((item) => item.id !== input.messageId);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/skill-swaps") return json(response, 200, { swaps: db.skillSwaps.map((swap) => ({ ...swap, user: publicUser(db.users.find((candidate) => candidate.id === swap.userId && !candidate.deactivated)) })) });

  if (route === "POST /api/skill-swaps") {
    const input = await body(request);
    if (!input.offering || !input.seeking) return json(response, 400, { error: "Add what you offer and what you need." });
    db.skillSwaps.unshift({ id: id("swap"), userId: user.id, offering: input.offering, seeking: input.seeking, completed: false, createdAt: new Date().toISOString() });
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/badges") {
    return json(response, 200, { badges: publicBadges(db) });
  }

  if (route === "GET /api/toolbox") {
    return json(response, 200, { documents: db.toolboxDocuments || [] });
  }

  if (route === "POST /api/admin/toolbox") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const title = String(input.title ?? "").trim();
    const category = TOOLBOX_CATEGORIES.includes(input.category) ? input.category : "Other";
    const fileData = String(input.fileData ?? "").trim();
    const fileName = cleanFileName(input.fileName || title);
    const fileType = String(input.fileType || "application/octet-stream").toLowerCase();
    if (!title || !fileData) return json(response, 400, { error: "Document title and file are required." });
    if (!fileData.startsWith("data:")) return json(response, 400, { error: "Upload a valid document file." });
    if (!isAllowedToolboxDocument(fileName, fileType)) return json(response, 400, { error: "Unsupported document type. Upload a PDF, Word, Excel, PowerPoint, text, CSV, RTF, or OpenDocument file." });
    db.toolboxDocuments = db.toolboxDocuments || [];
    db.toolboxDocuments.unshift({ id: id("doc"), title, category, description: String(input.description ?? "").trim().slice(0, 220), fileName, fileType, fileData, createdAt: new Date().toISOString() });
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/admin/toolbox/delete") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const documentId = String(input.id ?? "");
    if (!db.toolboxDocuments.some((doc) => doc.id === documentId)) return json(response, 404, { error: "Document not found." });
    db.toolboxDocuments = db.toolboxDocuments.filter((doc) => doc.id !== documentId);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "GET /api/admin") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    return json(response, 200, { users: db.users.map(publicUser), events: db.events, badges: publicBadges(db), toolboxDocuments: db.toolboxDocuments || [] });
  }

  if (route === "POST /api/admin/events/delete") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const eventId = String(input.id ?? "");
    if (!db.events.some((event) => event.id === eventId)) return json(response, 404, { error: "Event not found." });
    db.events = db.events.filter((event) => event.id !== eventId);
    db.attendances = db.attendances.filter((attendance) => attendance.eventId !== eventId);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/admin/events") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const event = input.id ? db.events.find((item) => item.id === input.id) : null;
    const payload = {
      id: input.id || id("event"),
      name: input.name,
      date: input.date,
      location: input.location,
      description: input.description,
      dressCode: input.dressCode,
      flyerUrl: input.flyerUrl ?? "",
      rsvpUrl: input.rsvpUrl ?? ""
    };
    if (event) Object.assign(event, payload);
    else db.events.push(payload);
    await writeDb(db);
    return json(response, 200, { event: payload });
  }

  if (route === "POST /api/admin/badges") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const name = String(input.name ?? "").trim();
    const originalName = String(input.originalName ?? "").trim();
    if (!name) return json(response, 400, { error: "Badge name required." });
    const badge = { name, criteriaType: input.criteriaType || "manual", criteriaCount: Number(input.criteriaCount || 0), iconUrl: String(input.iconUrl ?? "") };
    const existingIndex = db.badges.findIndex((existing) => badgeName(existing) === (originalName || name));
    if (existingIndex >= 0) {
      const previousName = badgeName(db.badges[existingIndex]);
      db.badges[existingIndex] = badge;
      if (previousName !== name) for (const candidate of db.users) candidate.badges = (candidate.badges || []).map((item) => item === previousName ? name : item);
    } else if (!db.badges.some((existing) => badgeName(existing) === name)) db.badges.push(badge);
    for (const candidate of db.users) awardEligibleBadges(db, candidate);
    await writeDb(db);
    return json(response, 200, { badges: publicBadges(db) });
  }

  if (route === "POST /api/admin/badges/assign") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    const target = db.users.find((candidate) => candidate.id === input.userId);
    const badge = db.badges.find((candidate) => badgeName(candidate) === input.badgeName);
    if (!target || !badge) return json(response, 400, { error: "Choose a valid user and badge." });
    awardBadge(db, target, badge);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  if (route === "POST /api/admin/users/admin") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    if (input.userId === user.id && input.isAdmin === false) return json(response, 400, { error: "Admins cannot remove their own admin access." });
    const target = db.users.find((candidate) => candidate.id === input.userId);
    if (!target) return json(response, 404, { error: "User not found." });
    target.isAdmin = Boolean(input.isAdmin);
    await writeDb(db);
    return json(response, 200, { user: publicUser(target) });
  }

  if (route === "POST /api/admin/users/remove") {
    if (!isAdmin(user)) return json(response, 403, { error: "Admin access required." });
    const input = await body(request);
    if (input.userId === user.id) return json(response, 400, { error: "Admins cannot remove themselves." });
    db.users = db.users.filter((candidate) => candidate.id !== input.userId);
    db.attendances = db.attendances.filter((attendance) => attendance.userId !== input.userId);
    db.connections = db.connections.filter((connection) => connection.requesterId !== input.userId && connection.recipientId !== input.userId);
    db.messages = db.messages.filter((message) => message.senderId !== input.userId && message.receiverId !== input.userId);
    db.feedPosts = db.feedPosts.filter((post) => post.authorId !== input.userId);
    db.skillSwaps = db.skillSwaps.filter((swap) => swap.userId !== input.userId);
    await writeDb(db);
    return json(response, 200, { ok: true });
  }

  return json(response, 404, { error: "Not found." });
}

async function staticFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = resolve(PUBLIC_DIR, `.${pathname}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return json(response, 403, { error: "Forbidden." });
  try {
    const data = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(302, { location: "/" });
    response.end();
  }
}

await ensureDb();
createServer((request, response) => {
  if (request.url?.startsWith("/api/")) api(request, response);
  else staticFile(request, response);
}).listen(PORT, () => {
  console.log(`Prime Connects MVP running at http://localhost:${PORT}`);
});
