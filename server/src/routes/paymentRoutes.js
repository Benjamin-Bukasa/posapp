const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.get("/", auth, requirePermission("payments.read"), paymentController.listPayments);
router.get("/:id", auth, requirePermission("payments.read"), paymentController.getPayment);
router.post(
  "/:id/refund",
  auth,
  requirePermission("payments.refund"),
  paymentController.refundPayment,
);

module.exports = router;
