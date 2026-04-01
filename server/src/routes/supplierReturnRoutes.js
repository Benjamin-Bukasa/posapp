const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const supplierReturnController = require("../controllers/supplierReturnController");

const router = express.Router();

router.get("/", auth, requirePermission("movements.read"), supplierReturnController.listSupplierReturns);
router.get("/:id", auth, requirePermission("movements.read"), supplierReturnController.getSupplierReturn);
router.post("/", auth, requirePermission("movements.create"), supplierReturnController.createSupplierReturn);
router.patch("/:id", auth, requirePermission("movements.update"), supplierReturnController.updateSupplierReturn);
router.delete("/:id", auth, requirePermission("movements.delete"), supplierReturnController.deleteSupplierReturn);
router.post("/:id/submit", auth, requirePermission("movements.update"), supplierReturnController.submitSupplierReturn);
router.post("/:id/approve", auth, requirePermission("movements.update"), supplierReturnController.approveSupplierReturn);
router.post("/:id/reject", auth, requirePermission("movements.update"), supplierReturnController.rejectSupplierReturn);
router.post("/:id/post", auth, requirePermission("movements.update"), supplierReturnController.postSupplierReturn);

module.exports = router;
