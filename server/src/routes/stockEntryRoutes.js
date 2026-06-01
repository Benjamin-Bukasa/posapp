const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const stockEntryController = require("../controllers/stockEntryController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/template",
  auth,
  requirePermission("movements.create"),
  stockEntryController.downloadStockEntryTemplate
);
router.post(
  "/import",
  auth,
  requirePermission("movements.create"),
  upload.single("file"),
  stockEntryController.importStockEntries
);
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
  requirePermission("movements.update", "movements.update_own_draft"),
  stockEntryController.updateStockEntry
);
router.delete(
  "/:id",
  auth,
  requirePermission("movements.delete", "movements.delete_own_draft"),
  stockEntryController.deleteStockEntry
);
router.post(
  "/:id/devalidate",
  auth,
  requirePermission("movements.devalidate"),
  stockEntryController.devalidateStockEntry
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
