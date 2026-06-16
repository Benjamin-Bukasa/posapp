const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const reportController = require("../controllers/reportController");

const router = express.Router();

router.get("/sales-report", auth, requirePermission("sales.read"), reportController.getSalesReport);
router.get("/sales-summary", auth, requirePermission("sales.read"), reportController.getSalesSummary);

module.exports = router;
