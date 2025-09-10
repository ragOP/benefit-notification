// backend/server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const socketPayload = require("./src/model/payloadModel.js");
const connectDB = require("./src/db/db.js");
const { serviceAccount } = require("./src/services/service.js");
const PORT = process.env.PORT || 9010;
const BUTTON_SECRET = process.env.BUTTON_SECRET || "change-me";
let fcmToken = "";

const app = express();
const server = http.createServer(app);

//-------Db Connection----------//
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Realtime server running on port ${PORT}`);
      console.log("Allowed origins: ALL (*)");
    });
  })
  .catch((err) => {
    app.on("Error", (err) => {
      console.log("ERROr", err);
      throw err;
    });
    console.log("Mongo Db Connection Failed", err);
  });

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

//--------Socket-------------//
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

// Function to add a unique FCM token
const fcmTokens = [];
function addFcmToken(token) {
  if (!fcmTokens.includes(token)) {
    fcmTokens.push(token);
  }
}

//---------Save fcm Token--------------//
app.post("/save-token", (req, res) => {
  fcmToken = req.body.fcmToken;
  addFcmToken(fcmToken);
  console.log("FCM Token saved:", fcmToken);
  res.json({ success: true, token: fcmToken });
});

app.get("/get-token", (req, res) => {
  res.json({ fcmTokens });
});

//---------get payload---------//
app.post("/api/event", async (req, res) => {
  const auth = req.header("x-button-secret");
  if (auth !== BUTTON_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const { type = "unknown", who = "public-site", meta = {} } = req.body || {};
  const payload = { at: new Date().toISOString(), type, who, meta };

  const data = await socketPayload.create({
    id: `id_${Date.now()}_${Math.floor(Math.random() * 1e5)}`,
    type,
    who,
    meta,
  });
  io.emit("site:event", payload);
  return res.json({ ok: true, data });
});

app.get("/api/get-payload", async (req, res) => {
  try {
    const data = await socketPayload.find({}).sort({ createdAt: -1 });
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "no payload foyund" });
    }
    return res.status(200).json({
      success: true,
      data: data,
      message: "payload retrived successfully",
    });
  } catch (error) {
    console.log("failed to fetch data", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch payload" });
  }
});

// ------- FIREBASE NOTIFICATION ------- //
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.post("/send-call-notification", async (req, res) => {
  try {
    const { tel } = req.body;
    if (!fcmTokens.length) {
      return res
        .status(400)
        .json({ success: false, error: "No FCM tokens available" });
    }
    const results = [];
    for (const token of fcmTokens) {
      const message = {
        token,
        notification: {
          title: "Incoming Call",
          body: `call from ${tel} `,
        },
        android: {
          notification: {
            channelId: "chat-messages",
            priority: "high",
            sound: "default",
          },
        },
      };
      try {
        const response = await admin.messaging().send(message);
        results.push({ token, success: true, response });
      } catch (err) {
        results.push({ token, success: false, error: err.message });
      }
    }
    return res.json({ success: true, results });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
