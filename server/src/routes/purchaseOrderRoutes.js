const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const purchaseOrderController = require("../controllers/purchaseOrderController");

const router = express.Router();

router.get("/", auth, requirePermission("purchase_orders.read"), purchaseOrderController.listPurchaseOrders);
router.get("/:id", auth, requirePermission("purchase_orders.read"), purchaseOrderController.getPurchaseOrder);
router.get("/:id/pdf", auth, requirePermission("purchase_orders.read"), purchaseOrderController.getPurchaseOrderPdf);
router.post(
  "/",
  auth,
  requirePermission("purchase_orders.create"),
  purchaseOrderController.createPurchaseOrder
);
router.patch(
  "/:id",
  auth,
  requirePermission("purchase_orders.update"),
  purchaseOrderController.updatePurchaseOrder
);
router.delete(
  "/:id",
  auth,
  requirePermission("purchase_orders.delete"),
  purchaseOrderController.deletePurchaseOrder
);
router.post(
  "/:id/send",
  auth,
  requirePermission("purchase_orders.update"),
  purchaseOrderController.sendPurchaseOrder
);
router.post(
  "/:id/approve",
  auth,
  requirePermission("purchase_orders.update"),
  purchaseOrderController.approvePurchaseOrder
);
router.post(
  "/:id/reject",
  auth,
  requirePermission("purchase_orders.update"),
  purchaseOrderController.rejectPurchaseOrder
);

module.exports = router;
