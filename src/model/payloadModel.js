const { mongoose, Schema } = require("mongoose");

const socketPayloadSchema = new Schema(
  {
    id: {
      type: String,
    },
    type: {
      type: String,
    },
    who: {
      type: String,
    },
    meta: {
      tel: { type: Number },
      page: { type: String },
    },
  },
  { timestamps: true }
);
const socketPayload = mongoose.model("socketPayload", socketPayloadSchema);
module.exports = socketPayload;
