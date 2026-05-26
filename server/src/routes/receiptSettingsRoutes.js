const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/receiptSettingsController");

const router = express.Router();

router.get(
  "/current",
  auth,
  controller.getCurrentReceiptSettings,
);

router.patch(
  "/current",
  auth,
  requirePermission("settings.update"),
  controller.updateCurrentReceiptSettings,
);

module.exports = router;
