const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const cashSessionController = require("../controllers/cashSessionController");

const router = express.Router();

router.get("/current", auth, requirePermission("cash_sessions.read"), cashSessionController.getCurrent);
router.get("/", auth, requirePermission("cash_sessions.read"), cashSessionController.list);
router.get(
  "/:id/stock-audit",
  auth,
  requirePermission("cash_sessions.read"),
  cashSessionController.getStockAudit,
);
router.get(
  "/:id/gift-history",
  auth,
  requirePermission("cash_sessions.read"),
  cashSessionController.getGiftHistory,
);
router.post(
  "/:id/opening-stock",
  auth,
  requirePermission("cash_sessions.open"),
  cashSessionController.saveOpeningStockSnapshot,
);
router.get("/:id", auth, requirePermission("cash_sessions.read"), cashSessionController.getById);
router.post("/open", auth, requirePermission("cash_sessions.open"), cashSessionController.open);
router.post(
  "/general-close",
  auth,
  requirePermission("cash_sessions.close_general"),
  cashSessionController.closeGeneralStore,
);
router.post(
  "/:id/close",
  auth,
  requirePermission("cash_sessions.close"),
  cashSessionController.close,
);
router.post(
  "/:id/movements",
  auth,
  requirePermission("cash_sessions.movement"),
  cashSessionController.addMovement,
);

module.exports = router;
