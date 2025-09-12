const apn = require("apn");
const path = require("path");
const fs = require("fs");

let apnProvider = null;
exports.getApnProvider = function getApnProvider() {
  if (apnProvider) return apnProvider;

  const keyPath = process.env.APN_KEY_PATH;
  const keyId = process.env.APN_KEY_ID;
  const teamId = process.env.APN_TEAM_ID;
  const production =
    String(process.env.APN_PRODUCTION || "false").toLowerCase() === "true";

  if (!keyPath || !keyId || !teamId) {
    throw new Error(
      "Missing APNs env vars. Set APN_KEY_PATH, APN_KEY_ID, APN_TEAM_ID, APN_BUNDLE_ID, APN_PRODUCTION."
    );
  }

  const resolvedKeyPath = path.resolve(keyPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    throw new Error(`[APNs] .p8 key not found at: ${resolvedKeyPath}`);
  }

  apnProvider = new apn.Provider({
    token: {
      key: resolvedKeyPath,
      keyId,
      teamId,
    },
    production,
  });

  console.log("[APNs] Provider ready", {
    keyPath: resolvedKeyPath,
    keyId,
    teamId,
    production,
  });
  return apnProvider;
};
