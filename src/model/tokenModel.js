const { mongoose, Schema } = require("mongoose");

const tokenSchema = new Schema({
  apnToken: {
    type: String,
  },
  fcmToken: {
    type: String,
  },
});
const token = mongoose.model("token", tokenSchema);
module.exports = token;
