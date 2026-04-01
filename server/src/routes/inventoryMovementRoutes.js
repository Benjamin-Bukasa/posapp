const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const inventoryMovementController = require("../controllers/inventoryMovementController");

const router = express.Router();

router.get(
  "/",
  auth,
  requirePermission("movements.read"),
  inventoryMovementController.listInventoryMovements
);

module.exports = router;
