const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const inventoryController = require("../controllers/inventoryController");

const router = express.Router();

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
