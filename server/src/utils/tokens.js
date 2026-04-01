const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const accessExpires = process.env.JWT_ACCESS_EXPIRES || "15m";

const signAccessToken = (payload, expiresIn = accessExpires) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const signRefreshToken = (payload, days) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: `${days}d`,
  });
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

const generateTempPassword = () => {
  return crypto.randomBytes(8).toString("base64url");
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  hashToken,
  generateRandomToken,
  generateTempPassword,
};
