const express = require("express");
const auth = require("../middlewares/auth");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.get("/", auth, paymentController.listPayments);
router.get("/:id", auth, paymentController.getPayment);

module.exports = router;
