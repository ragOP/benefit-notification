// backend/server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const serviceAccount = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
};

console.log("Firebase project:", serviceAccount.project_id);

const PORT = process.env.PORT || 9010;
const BUTTON_SECRET = process.env.BUTTON_SECRET || "change-me";
let fcmToken = "";

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-button-secret"],
    credentials: true,
    maxAge: 86400,
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(bodyParser.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "x-button-secret"],
  },
});

io.on("connection", (socket) => {
  console.log("Admin connected:", socket.id);
  socket.on("disconnect", () => console.log("Admin disconnected:", socket.id));
});

app.get("/", (_req, res) => res.send("OK"));

// ------- ADMIN AUTH & FCM TOKEN ------- //

app.post("/save-token", (req, res) => {
  fcmToken = req.body.fcmToken;
  console.log("FCM Token saved:", fcmToken);
  res.json({ success: true, token: fcmToken });
});

app.get("/get-token", (req, res) => {
  res.json({ fcmToken });
});
app.post("/api/event", (req, res) => {
  const auth = req.header("x-button-secret");
  if (auth !== BUTTON_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { type = "unknown", who = "public-site", meta = {} } = req.body || {};
  const payload = { at: new Date().toISOString(), type, who, meta };

  io.emit("site:event", payload);
  return res.json({ ok: true });
});

// ------- FIREBASE NOTIFICATION ------- //

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/send-call-notification", async (req, res) => {
  try {
    const targetToken =
      req.body?.token || req.query?.token || latestAdminFcmToken;
    if (!targetToken) {
      return res
        .status(400)
        .json({ success: false, error: "Missing FCM token" });
    }
    const message = {
      token: targetToken,
      notification: {
        title: "Incoming Call",
        body: "A user clicked the Call button!",
      },
      //   android: {
      //     notification: {
      //       channelId: "chat-messages",
      //       priority: "high",
      //       sound: "default",
      //     },
      //   },
    };

    const response = await admin.messaging().send(message);

    res.json({ success: true, message: "Notification sent" });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Realtime server running on port ${PORT}`);
  console.log("Allowed origins: ALL (*)");
});
