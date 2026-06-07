const express = require("express");
const auth = require("../middlewares/auth");
const requirePlatformRole = require("../middlewares/requirePlatformRole");
const supportController = require("../controllers/supportController");

const router = express.Router();

router.get(
  "/tenants",
  auth,
  requirePlatformRole("TECHNICIAN"),
  supportController.listTenants,
);

router.post(
  "/sessions",
  auth,
  requirePlatformRole("TECHNICIAN"),
  supportController.startSupportSession,
);

module.exports = router;
