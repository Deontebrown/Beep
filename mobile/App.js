import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Linking, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { api, apiUrl } from "./src/api";

const tabs = ["home", "events", "connections", "messages", "feed", "toolbox", "account"];
const labels = { home: "Home", events: "Events", connections: "Connect", messages: "Messages", feed: "Feed", toolbox: "Toolbox", account: "Account", admin: "Admin" };
const icons = { home: "⌂", events: "□", connections: "◇", messages: "✉", feed: "▤", toolbox: "▣", account: "○", admin: "♛" };

function initials(name = "PC") {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ profile, size = 48 }) {
  if (profile?.photoUrl) return <Image source={{ uri: profile.photoUrl }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 3 }]} />;
  return <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 3 }]}><Text style={styles.avatarText}>{initials(profile?.fullName)}</Text></View>;
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Button({ title, onPress, variant = "primary", style }) {
  return <TouchableOpacity onPress={onPress} style={[styles.button, styles[`${variant}Button`], style]}><Text style={[styles.buttonText, styles[`${variant}ButtonText`]]}>{title}</Text></TouchableOpacity>;
}

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({ events: 0, members: 0 });
  const [tab, setTab] = useState("home");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("maya@primeconnects.test");
  const [password, setPassword] = useState("PrimePass123");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [postBody, setPostBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [data, setData] = useState({ events: [], connections: [], feed: [], messages: [], swaps: [], toolboxDocuments: [], badges: [], admin: null });

  const callApi = useCallback((path, options) => api(path, { token, ...options }), [token]);

  const loadMe = useCallback(async () => {
    const result = await api("/api/me", { token });
    setUser(result.user);
    setCounts(result.counts);
    return result.user;
  }, [token]);

  const loadAppData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [events, connections, feed, messages, swaps, toolbox, badges] = await Promise.all([
        callApi("/api/events"),
        callApi("/api/connections"),
        callApi("/api/feed"),
        callApi("/api/messages"),
        callApi("/api/skill-swaps"),
        callApi("/api/toolbox").catch(() => ({ documents: [] })),
        callApi("/api/badges").catch(() => ({ badges: [] }))
      ]);
      const next = { events: events.events || [], connections: connections.connections || [], feed: feed.posts || [], messages: messages.messages || [], swaps: swaps.swaps || [], toolboxDocuments: toolbox.documents || [], badges: badges.badges || [], admin: null };
      if (user?.isAdmin) next.admin = await callApi("/api/admin");
      setData(next);
      setSelectedEventId((current) => next.events.some((event) => event.id === current) ? current : next.events[0]?.id || null);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }, [callApi, token, user?.isAdmin]);

  useEffect(() => { if (token) loadAppData(); }, [token, loadAppData]);

  async function login() {
    setLoading(true);
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setToken(result.authToken);
      setUser(result.user);
      setTab("home");
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setToken(null);
    setUser(null);
    setData({ events: [], connections: [], feed: [], messages: [], swaps: [], toolboxDocuments: [], badges: [], admin: null });
    setStatus("");
  }

  async function sharePost() {
    try {
      await callApi("/api/feed", { method: "POST", body: JSON.stringify({ body: postBody }) });
      setPostBody("");
      await loadAppData();
    } catch (error) { setStatus(error.message); }
  }

  async function sendMessage() {
    try {
      await callApi("/api/messages", { method: "POST", body: JSON.stringify({ receiverId: selectedThread, body: messageBody }) });
      setMessageBody("");
      await loadAppData();
    } catch (error) { setStatus(error.message); }
  }

  async function checkIn(eventId) {
    try {
      await callApi("/api/events/check-in", { method: "POST", body: JSON.stringify({ eventId }) });
      await loadAppData();
    } catch (error) { setStatus(error.message); }
  }

  async function connect(userId) {
    try {
      await callApi("/api/connections", { method: "POST", body: JSON.stringify({ recipientId: userId, note: "Connected from mobile app." }) });
      await loadAppData();
    } catch (error) { setStatus(error.message); }
  }

  async function deleteOwnPost(postId) {
    Alert.alert("Delete post?", "This removes your post from the Prime Feed.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => { await callApi("/api/feed/delete", { method: "POST", body: JSON.stringify({ postId }) }); await loadAppData(); } }]);
  }

  const selectedEvent = data.events.find((event) => event.id === selectedEventId) || data.events[0];
  const threadMessages = useMemo(() => data.messages.filter((message) => [message.senderId, message.receiverId].includes(selectedThread)), [data.messages, selectedThread]);

  if (!user) {
    return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" /><ScrollView contentContainerStyle={styles.authPage}><Text style={styles.brand}>♛ Prime Connects</Text><Text style={styles.heroTitle}>Mobile MVP</Text><Text style={styles.muted}>Connect with members, RSVP to events, message your network, and browse the Prime Business Toolbox from Expo.</Text><Text style={styles.label}>API URL</Text><Text style={styles.apiUrl}>{apiUrl()}</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} placeholder="Email" /><TextInput value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholder="Password" /><Button title={loading ? "Signing in..." : "Sign in"} onPress={login} /><Text style={styles.status}>{status}</Text><Text style={styles.hint}>Use EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:3000 when running on a physical device.</Text></ScrollView></SafeAreaView>;
  }

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" /><View style={styles.header}><View><Text style={styles.eyebrow}>Prime Connects Inc.</Text><Text style={styles.headerTitle}>One Network.</Text></View>{user.isAdmin ? <TouchableOpacity onPress={() => setTab("admin")} style={styles.adminPill}><Text style={styles.adminPillText}>Admin</Text></TouchableOpacity> : null}</View><ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAppData} />} contentContainerStyle={styles.content}>{status ? <Text style={styles.status}>{status}</Text> : null}{tab === "home" && <Home user={user} counts={counts} data={data} setTab={setTab} />}{tab === "events" && <Events events={data.events} selectedEvent={selectedEvent} setSelectedEventId={setSelectedEventId} checkIn={checkIn} connect={connect} />}{tab === "connections" && <Connections data={data} connect={connect} setTab={setTab} setSelectedThread={setSelectedThread} />}{tab === "messages" && <Messages connections={data.connections} selectedThread={selectedThread} setSelectedThread={setSelectedThread} threadMessages={threadMessages} user={user} messageBody={messageBody} setMessageBody={setMessageBody} sendMessage={sendMessage} />}{tab === "feed" && <Feed user={user} posts={data.feed} postBody={postBody} setPostBody={setPostBody} sharePost={sharePost} deleteOwnPost={deleteOwnPost} />}{tab === "toolbox" && <Toolbox documents={data.toolboxDocuments} />}{tab === "account" && <Account user={user} logout={logout} />}{tab === "admin" && <Admin admin={data.admin} />}</ScrollView><View style={styles.nav}>{tabs.map((item) => <TouchableOpacity key={item} onPress={() => setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && styles.activeNav]}>{icons[item]}</Text><Text style={[styles.navText, tab === item && styles.activeNav]}>{labels[item]}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

function Home({ user, counts, data, setTab }) {
  return <View><Card style={styles.profileCard}><Avatar profile={user.profile} size={72} /><Text style={styles.title}>Welcome, {user.profile?.fullName?.split(" ")[0]}</Text><Text style={styles.muted}>{user.profile?.title}</Text></Card><View style={styles.grid}><TouchableOpacity onPress={() => setTab("events")} style={styles.metric}><Text style={styles.metricValue}>{counts.events}</Text><Text style={styles.metricLabel}>Events</Text></TouchableOpacity><TouchableOpacity onPress={() => setTab("connections")} style={styles.metric}><Text style={styles.metricValue}>{data.connections.length}</Text><Text style={styles.metricLabel}>Connections</Text></TouchableOpacity></View></View>;
}

function Events({ events, selectedEvent, setSelectedEventId, checkIn, connect }) {
  return <View><Text style={styles.title}>Upcoming Events</Text>{events.map((event) => <TouchableOpacity key={event.id} onPress={() => setSelectedEventId(event.id)}><Card><Text style={styles.cardTitle}>{event.name}</Text><Text style={styles.muted}>{new Date(event.date).toLocaleDateString()} · {event.location}</Text></Card></TouchableOpacity>)}{selectedEvent ? <Card><Text style={styles.eyebrow}>Event detail</Text>{selectedEvent.flyerUrl && !selectedEvent.flyerUrl.startsWith("data:application/pdf") ? <Image source={{ uri: selectedEvent.flyerUrl }} style={styles.flyer} /> : null}<Text style={styles.title}>{selectedEvent.name}</Text><Text style={styles.body}>{selectedEvent.description}</Text><Button title="RSVP / Check in" onPress={() => checkIn(selectedEvent.id)} />{selectedEvent.attendees?.map((attendee) => <View key={attendee.id} style={styles.row}><Avatar profile={attendee} /><View style={styles.rowBody}><Text style={styles.cardTitle}>{attendee.fullName}</Text><Text style={styles.muted}>{attendee.title}</Text></View>{attendee.connected ? <Text style={styles.gold}>Connected</Text> : <Button title="Connect" variant="mini" onPress={() => connect(attendee.id)} />}</View>)}</Card> : null}</View>;
}

function Connections({ data, connect, setTab, setSelectedThread }) {
  const top = data.events.flatMap((event) => event.attendees || []).slice(0, 5);
  return <View><Text style={styles.title}>Connections</Text>{top.map((attendee) => <Card key={attendee.id}><Text style={styles.cardTitle}>{attendee.fullName}</Text><Text style={styles.muted}>{attendee.title}</Text>{attendee.connected ? <Text style={styles.gold}>Connected</Text> : <Button title="Connect" onPress={() => connect(attendee.id)} />}</Card>)}<Text style={styles.sectionTitle}>Your network</Text>{data.connections.map((connection) => <TouchableOpacity key={connection.user.id} onPress={() => { setSelectedThread(connection.user.id); setTab("messages"); }}><Card><Text style={styles.cardTitle}>{connection.user.profile?.fullName}</Text><Text style={styles.muted}>{connection.note || "Tap to message"}</Text></Card></TouchableOpacity>)}</View>;
}

function Messages({ connections, selectedThread, setSelectedThread, threadMessages, user, messageBody, setMessageBody, sendMessage }) {
  if (!selectedThread) return <View><Text style={styles.title}>Messages</Text>{connections.map((connection) => <TouchableOpacity key={connection.user.id} onPress={() => setSelectedThread(connection.user.id)}><Card><Text style={styles.cardTitle}>{connection.user.profile?.fullName}</Text><Text style={styles.muted}>Open private chat</Text></Card></TouchableOpacity>)}</View>;
  return <View><Button title="Back to inbox" variant="secondary" onPress={() => setSelectedThread(null)} />{threadMessages.map((message) => <View key={message.id} style={[styles.bubble, message.senderId === user.id && styles.mine]}><Text style={[styles.bubbleText, message.senderId === user.id && styles.mineText]}>{message.body}</Text><Text style={[styles.bubbleMeta, message.senderId === user.id && styles.mineMeta]}>{message.sender.profile?.fullName}{message.editedAt ? " · edited" : ""}</Text></View>)}<TextInput value={messageBody} onChangeText={setMessageBody} style={styles.input} placeholder="Write a message" /><Button title="Send" onPress={sendMessage} /></View>;
}

function Feed({ user, posts, postBody, setPostBody, sharePost, deleteOwnPost }) {
  return <View><Text style={styles.title}>Prime Feed</Text><TextInput value={postBody} onChangeText={setPostBody} style={[styles.input, styles.textarea]} multiline placeholder="Share a professional win" /><Button title="Share win" onPress={sharePost} />{posts.map((post) => { const mine = post.author?.id === user.id; return <Card key={post.id}><Text style={styles.cardTitle}>{post.author?.profile?.fullName || "Prime Member"}</Text><Text style={styles.body}>{post.body}</Text><Text style={styles.muted}>{post.likes?.length || 0} likes{post.editedAt ? " · edited" : ""}</Text>{mine ? <Button title="Delete my post" variant="secondary" onPress={() => deleteOwnPost(post.id)} /> : null}</Card>; })}</View>;
}

function Toolbox({ documents }) {
  return <View><Text style={styles.title}>Prime Business Toolbox</Text>{documents.map((doc) => <Card key={doc.id}><Text style={styles.cardTitle}>{doc.title}</Text><Text style={styles.muted}>{doc.category} · {doc.fileName}</Text><Text style={styles.body}>{doc.description}</Text><Button title="Open document" variant="secondary" onPress={() => Linking.openURL(doc.fileData)} /></Card>)}</View>;
}

function Account({ user, logout }) {
  return <View><Card style={styles.profileCard}><Avatar profile={user.profile} size={86} /><Text style={styles.title}>{user.profile?.fullName}</Text><Text style={styles.muted}>{user.email}</Text></Card><Button title="Log out" variant="secondary" onPress={logout} /></View>;
}

function Admin({ admin }) {
  if (!admin) return <Card><Text style={styles.cardTitle}>Admin data loading...</Text></Card>;
  return <View><Text style={styles.title}>Admin Portal</Text><Card><Text style={styles.cardTitle}>Events</Text><Text style={styles.metricValue}>{admin.events?.length || 0}</Text></Card><Card><Text style={styles.cardTitle}>Badges</Text><Text style={styles.metricValue}>{admin.badges?.length || 0}</Text></Card><Card><Text style={styles.cardTitle}>Toolbox documents</Text><Text style={styles.metricValue}>{admin.toolboxDocuments?.length || 0}</Text></Card><Card><Text style={styles.cardTitle}>Users</Text><Text style={styles.metricValue}>{admin.users?.length || 0}</Text></Card><Text style={styles.hint}>Use the web admin console for uploads and detailed editing while the mobile admin dashboard tracks live counts.</Text></View>;
}

const gold = "#C49A2A";
const dark = "#1A1A1A";
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: dark },
  authPage: { flexGrow: 1, justifyContent: "center", padding: 24, backgroundColor: dark },
  brand: { color: gold, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase", marginBottom: 20 },
  heroTitle: { color: "white", fontSize: 48, fontWeight: "900", lineHeight: 50, marginBottom: 12 },
  header: { backgroundColor: dark, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: gold, fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
  headerTitle: { color: "white", fontSize: 28, fontWeight: "900" },
  adminPill: { borderColor: gold, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  adminPillText: { color: gold, fontWeight: "900" },
  content: { padding: 16, paddingBottom: 104, backgroundColor: "#FAFAF8" },
  title: { color: dark, fontSize: 28, fontWeight: "900", marginBottom: 10 },
  sectionTitle: { color: dark, fontSize: 20, fontWeight: "900", marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: "white", borderColor: "rgba(212,185,106,.45)", borderWidth: 1, borderRadius: 22, padding: 15, marginBottom: 12 },
  profileCard: { alignItems: "center" },
  cardTitle: { color: dark, fontSize: 16, fontWeight: "900", marginBottom: 4 },
  body: { color: "#444", lineHeight: 20, marginVertical: 6 },
  muted: { color: "#777", lineHeight: 20 },
  hint: { color: "#b9ad91", lineHeight: 20, marginTop: 12 },
  status: { color: gold, marginVertical: 10, fontWeight: "800" },
  apiUrl: { color: gold, marginBottom: 12 },
  label: { color: "white", fontWeight: "900", marginTop: 16 },
  input: { backgroundColor: "#fffdfa", borderColor: "#e2d6b1", borderWidth: 1, borderRadius: 16, padding: 14, marginVertical: 8, color: dark },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  button: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryButton: { backgroundColor: gold },
  secondaryButton: { backgroundColor: "#F9F3E3", borderColor: "#D4B96A", borderWidth: 1 },
  miniButton: { backgroundColor: dark, paddingVertical: 8, paddingHorizontal: 10 },
  buttonText: { fontWeight: "900" },
  primaryButtonText: { color: "white" },
  secondaryButtonText: { color: "#8B6914" },
  miniButtonText: { color: gold, fontSize: 12 },
  nav: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: dark, borderTopColor: "rgba(212,185,106,.35)", borderTopWidth: 1, paddingTop: 8, paddingBottom: 18 },
  navItem: { flex: 1, alignItems: "center" },
  navIcon: { color: "#8d8679", fontSize: 18 },
  navText: { color: "#8d8679", fontSize: 10, fontWeight: "900" },
  activeNav: { color: gold },
  grid: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, backgroundColor: "white", borderRadius: 20, padding: 16, borderColor: "rgba(212,185,106,.45)", borderWidth: 1 },
  metricValue: { color: gold, fontSize: 28, fontWeight: "900" },
  metricLabel: { color: "#777", fontWeight: "800" },
  avatar: { borderColor: "#D4B96A", borderWidth: 2, marginRight: 10 },
  avatarFallback: { backgroundColor: dark, borderColor: "#D4B96A", borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { color: gold, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopColor: "rgba(212,185,106,.25)", borderTopWidth: 1 },
  rowBody: { flex: 1 },
  gold: { color: gold, fontWeight: "900" },
  flyer: { width: "100%", height: 180, borderRadius: 18, marginBottom: 12 },
  bubble: { alignSelf: "flex-start", maxWidth: "82%", backgroundColor: "white", borderRadius: 18, padding: 12, marginBottom: 8, borderColor: "rgba(212,185,106,.35)", borderWidth: 1 },
  mine: { alignSelf: "flex-end", backgroundColor: dark },
  bubbleText: { color: dark },
  bubbleMeta: { color: "#777", fontSize: 11, marginTop: 4 },
  mineText: { color: "white" },
  mineMeta: { color: gold },
});
