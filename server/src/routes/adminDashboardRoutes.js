const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const adminDashboardController = require("../controllers/adminDashboardController");

const router = express.Router();

router.get(
  "/",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  adminDashboardController.getAdminDashboard,
);

module.exports = router;
