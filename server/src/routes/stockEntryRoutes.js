const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const stockEntryController = require("../controllers/stockEntryController");

const router = express.Router();

router.get("/", auth, requirePermission("movements.read"), stockEntryController.listStockEntries);
router.get("/:id", auth, requirePermission("movements.read"), stockEntryController.getStockEntry);
router.get("/:id/pdf", auth, requirePermission("movements.read"), stockEntryController.getStockEntryPdf);
router.post(
  "/",
  auth,
  requirePermission("movements.create"),
  stockEntryController.createStockEntry
);
router.patch(
  "/:id",
  auth,
  requirePermission("movements.update"),
  stockEntryController.updateStockEntry
);
router.delete(
  "/:id",
  auth,
  requirePermission("movements.delete"),
  stockEntryController.deleteStockEntry
);
router.post(
  "/:id/approve",
  auth,
  requirePermission("movements.update"),
  stockEntryController.approveStockEntry
);
router.post(
  "/:id/reject",
  auth,
  requirePermission("movements.update"),
  stockEntryController.rejectStockEntry
);
router.post(
  "/:id/post",
  auth,
  requirePermission("movements.update"),
  stockEntryController.postStockEntry
);

module.exports = router;
