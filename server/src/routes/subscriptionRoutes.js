const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const {
  renewSubscription,
  updateReminders,
} = require("../controllers/subscriptionController");

const router = express.Router();

router.post(
  "/renew",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  renewSubscription
);

router.patch(
  "/reminders",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  updateReminders
);

module.exports = router;
