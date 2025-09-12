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
const { sendViaAPNs } = require("./src/utils/ios/index.js");
const token = require("./src/model/tokenModel.js");
const PORT = process.env.PORT || 9010;
const BUTTON_SECRET = process.env.BUTTON_SECRET || "change-me";

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

//---------Save fcm Token--------------//
app.post("/save-token", async (req, res) => {
  try {
    const { fcmToken, apnToken } = req.body;

    const tokenData = await token.findOneAndUpdate(
      {},
      { $set: { fcmToken, apnToken } },
      { new: true, upsert: true }
    );

    console.log("Token saved/updated:", tokenData);
    res.json({ success: true, token: tokenData });
  } catch (error) {
    console.error("Error saving token:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/get-token", async (req, res) => {
  const fcmToken = await token.find({});
  if (!fcmToken) {
    return res
      .status(404)
      .json({ success: false, data: null, message: "failed to get fcm token" });
  }
  return res.status(200).json({
    success: true,
    data: fcmToken,
    message: "fcm token fetched successfully",
  });
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
    const user = await token.findOne({}, { fcmToken: 1, _id: 0 });

    if (!user || !user.fcmToken) {
      return res
        .status(404)
        .json({ success: false, message: "No FCM token found" });
    }

    const fcmToken = user.fcmToken;
    const results = [];
    const message = {
      token: fcmToken,
      notification: {
        title: "Incoming Call",
        body: `call from ${tel} `,
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
    };
    try {
      const response = await admin.messaging().send(message);
      results.push({ token: fcmToken, success: true, response });
    } catch (err) {
      results.push({ token: fcmToken, success: false, error: err.message });
    }
    return res.json({ success: true, results });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/send-ios-notification", async (req, res) => {
  try {
    const { tel, topicOverride } = req.body;

    const notificationData = {
      title: "Incoming Call",
      body: `Call from ${tel}`,
    };

    const results = [];
    let successCount = 0,
      failureCount = 0;

    const user = await token.findOne({}, { apnToken: 1, _id: 0 });

    if (!user || !user.apnToken) {
      return res
        .status(404)
        .json({ success: false, message: "No APN token found" });
    }

    const apnToken = user.apnToken;

    const resp = await sendViaAPNs({
      apnToken,
      notificationData,
      topicOverride,
    });

    results.push({ apnToken, ...resp });
    resp.success ? successCount++ : failureCount++;

    return res.status(200).json({
      statusCode: 200,
      data: {
        successCount,
        failureCount,
        results,
      },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});
