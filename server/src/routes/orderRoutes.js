const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.post("/", auth, requirePermission("sales.create"), orderController.createOrder);
router.get("/", auth, requirePermission("sales.read"), orderController.listOrders);
router.get("/:id/history", auth, requirePermission("sales.read"), orderController.getOrderHistory);
router.get("/:id", auth, requirePermission("sales.read"), orderController.getOrder);
router.patch("/:id", auth, requirePermission("sales.update"), orderController.updateOrder);
router.delete("/:id", auth, requirePermission("sales.cancel"), orderController.deleteOrder);

module.exports = router;
