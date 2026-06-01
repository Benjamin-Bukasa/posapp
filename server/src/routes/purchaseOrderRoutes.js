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
  requirePermission("purchase_orders.update", "purchase_orders.update_own_draft"),
  purchaseOrderController.updatePurchaseOrder
);
router.delete(
  "/:id",
  auth,
  requirePermission("purchase_orders.delete", "purchase_orders.delete_own_draft"),
  purchaseOrderController.deletePurchaseOrder
);
router.post(
  "/:id/devalidate",
  auth,
  requirePermission("purchase_orders.devalidate"),
  purchaseOrderController.devalidatePurchaseOrder
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
