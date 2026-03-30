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
  requirePermission("transfers.update"),
  transferController.updateTransfer
);
router.delete(
  "/:id",
  auth,
  requirePermission("transfers.delete"),
  transferController.deleteTransfer
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

module.exports = router;
