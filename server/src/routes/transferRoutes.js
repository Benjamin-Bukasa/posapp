const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const transferController = require("../controllers/transferController");

const router = express.Router();

router.get("/", auth, requirePermission("transfers.read"), transferController.listTransfers);
router.get("/:id/pdf", auth, requirePermission("transfers.read"), transferController.getTransferPdf);
router.get("/:id", auth, requirePermission("transfers.read"), transferController.getTransfer);
router.patch(
  "/:id",
  auth,
  requirePermission("transfers.update", "transfers.update_own_draft"),
  transferController.updateTransfer
);
router.delete(
  "/:id",
  auth,
  requirePermission("transfers.delete", "transfers.delete_own_draft"),
  transferController.deleteTransfer
);
router.post(
  "/:id/devalidate",
  auth,
  requirePermission("transfers.devalidate"),
  transferController.devalidateTransfer
);
router.post(
  "/",
  auth,
  requirePermission("transfers.create"),
  transferController.createTransfer
);
router.post(
  "/:id/complete",
  auth,
  requirePermission("transfers.update"),
  transferController.completeTransfer
);
router.post(
  "/:id/approve",
  auth,
  requirePermission("transfers.update"),
  transferController.approveTransfer
);
router.post(
  "/:id/reject",
  auth,
  requirePermission("transfers.update"),
  transferController.rejectTransfer
);

module.exports = router;
