const express = require("express");
const auth = require("../middlewares/auth");
const reportController = require("../controllers/reportController");

const router = express.Router();

router.get("/sales-summary", auth, reportController.getSalesSummary);

module.exports = router;
