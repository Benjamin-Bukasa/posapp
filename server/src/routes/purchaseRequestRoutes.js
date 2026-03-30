const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const purchaseRequestController = require("../controllers/purchaseRequestController");

const router = express.Router();

router.get("/", auth, requirePermission("purchase_requests.read"), purchaseRequestController.listPurchaseRequests);
router.get("/:id", auth, requirePermission("purchase_requests.read"), purchaseRequestController.getPurchaseRequest);
router.get("/:id/pdf", auth, requirePermission("purchase_requests.read"), purchaseRequestController.getPurchaseRequestPdf);
router.post(
  "/",
  auth,
  requirePermission("purchase_requests.create"),
  purchaseRequestController.createPurchaseRequest
);
router.patch("/:id", auth, purchaseRequestController.updatePurchaseRequest);
router.delete(
  "/:id",
  auth,
  requirePermission("purchase_requests.delete"),
  purchaseRequestController.deletePurchaseRequest
);
router.post(
  "/:id/submit",
  auth,
  requirePermission("purchase_requests.update"),
  purchaseRequestController.submitPurchaseRequest
);
router.post(
  "/:id/approve",
  auth,
  requirePermission("purchase_requests.update"),
  purchaseRequestController.approvePurchaseRequest
);
router.post(
  "/:id/reject",
  auth,
  requirePermission("purchase_requests.update"),
  purchaseRequestController.rejectPurchaseRequest
);

module.exports = router;
