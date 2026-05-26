const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const inventoryController = require("../controllers/inventoryController");
const inventorySessionController = require("../controllers/inventorySessionController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/sessions/current",
  auth,
  requirePermission("inventory.read"),
  inventorySessionController.getCurrent
);
router.get(
  "/sessions/template",
  auth,
  requirePermission("inventory.read"),
  inventorySessionController.downloadTemplate
);
router.post(
  "/sessions/import",
  auth,
  requirePermission("inventory.update"),
  upload.single("file"),
  inventorySessionController.importTemplate
);
router.get(
  "/sessions",
  auth,
  requirePermission("inventory.read"),
  inventorySessionController.list
);
router.get(
  "/sessions/:id",
  auth,
  requirePermission("inventory.read"),
  inventorySessionController.getById
);
router.get(
  "/sessions/:id/export",
  auth,
  requirePermission("inventory.read"),
  inventorySessionController.exportById
);
router.post(
  "/sessions",
  auth,
  requirePermission("inventory.create"),
  inventorySessionController.create
);
router.patch(
  "/sessions/:id/counts",
  auth,
  requirePermission("inventory.update"),
  inventorySessionController.updateCounts
);
router.post(
  "/sessions/:id/submit",
  auth,
  requirePermission("inventory.update"),
  inventorySessionController.submit
);
router.post(
  "/sessions/:id/approve",
  auth,
  requirePermission("inventory.update"),
  inventorySessionController.approve
);
router.post(
  "/sessions/:id/reject",
  auth,
  requirePermission("inventory.update"),
  inventorySessionController.reject
);
router.post(
  "/sessions/:id/close",
  auth,
  requirePermission("inventory.update"),
  inventorySessionController.close
);
router.get(
  "/",
  auth,
  requirePermission("stock_state.read", "inventory.read"),
  inventoryController.listInventory
);
router.post(
  "/adjust",
  auth,
  requirePermission("inventory.create", "inventory.update"),
  inventoryController.adjustInventory
);
router.patch(
  "/:id/min-level",
  auth,
  requirePermission("inventory.update"),
  inventoryController.updateMinLevel
);

module.exports = router;
