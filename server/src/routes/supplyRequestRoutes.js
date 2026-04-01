const express = require("express");
const auth = require("../middlewares/auth");
const supplyRequestController = require("../controllers/supplyRequestController");

const router = express.Router();

router.get("/", auth, supplyRequestController.listSupplyRequests);
router.get("/:id", auth, supplyRequestController.getSupplyRequest);
router.get("/:id/pdf", auth, supplyRequestController.getSupplyRequestPdf);
router.post("/", auth, supplyRequestController.createSupplyRequest);
router.patch("/:id", auth, supplyRequestController.updateSupplyRequest);
router.delete("/:id", auth, supplyRequestController.deleteSupplyRequest);
router.post("/:id/submit", auth, supplyRequestController.submitSupplyRequest);
router.post("/:id/approve", auth, supplyRequestController.approveSupplyRequest);
router.post("/:id/reject", auth, supplyRequestController.rejectSupplyRequest);
router.post(
  "/:id/transfer",
  auth,
  supplyRequestController.createTransferFromSupplyRequest
);
router.post(
  "/:id/purchase-request",
  auth,
  supplyRequestController.createPurchaseRequestFromSupplyRequest
);

module.exports = router;
