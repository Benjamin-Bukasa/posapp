const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/tenantController");

const router = express.Router();

router.get(
  "/current",
  auth,
  requirePermission("settings.read"),
  controller.getCurrentTenant,
);

router.patch(
  "/current",
  auth,
  requirePermission("settings.update"),
  controller.updateCurrentTenant,
);

module.exports = router;
