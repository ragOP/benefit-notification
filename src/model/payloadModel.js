const mongoose = require("mongoose");
const { Schema } = mongoose;

const metaSchema = new Schema(
  {
    tel: { type: String },
    page: { type: String },
  },
  { _id: false }
);

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
    meta: metaSchema,
  },
  { timestamps: true }
);

const socketPayload = mongoose.model("socketPayload", socketPayloadSchema);
module.exports = socketPayload;
