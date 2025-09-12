const apn = require("apn");
const { getApnProvider } = require("../apn");

exports.sendViaAPNs = async function sendViaAPNs({
  apnToken,
  notificationData = {},
  topicOverride,
}) {
  const configuredTopic = process.env.APN_BUNDLE_ID;
  const topic = topicOverride || configuredTopic;

  if (!topic) {
    return {
      success: false,
      message: "Missing APN_BUNDLE_ID",
      error: "missing_topic",
    };
  }
  if (!apnToken) {
    return {
      success: false,
      message: "Missing APNs token",
      error: "missing_apns_token",
    };
  }

  const title = notificationData?.title || "New Notification";
  const body = notificationData?.body || "You have a new notification";

  try {
    const provider = getApnProvider();
    const note = new apn.Notification();
    note.topic = topic;
    note.pushType = "alert";
    note.alert = { title, body };
    note.sound = "default";
    note.badge = 1;
    note.payload = {
      timestamp: new Date().toISOString(),
    };
    note.expiry = Math.floor(Date.now() / 1000) + 3600;

    const resp = await provider.send(note, apnToken);

    if (resp.sent?.length) {
      return {
        success: true,
        message: "Push sent via APNs",
        messageId: resp.sent[0]?.device || null,
      };
    }

    const errInfo = resp.failed?.[0];
    const reason =
      errInfo?.response?.reason ||
      errInfo?.error?.message ||
      "Unknown APNs error";
    return {
      success: false,
      message: "Failed to send push (APNs)",
      error: reason,
    };
  } catch (err) {
    return {
      success: false,
      message: "Failed to send push (APNs)",
      error: err?.message || String(err),
    };
  }
};
