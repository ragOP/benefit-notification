const mongoose = require("mongoose");
const connectDB = async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URI}`);
    console.log("mongoDB connected successfully");
  } catch (error) {
    console.log("MONGODB connection error", error);
    process.exit(1);
  }
};
module.exports = connectDB;