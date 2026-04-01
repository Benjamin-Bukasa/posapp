const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const supplierController = require("../controllers/supplierController");

const router = express.Router();

router.get("/", auth, supplierController.listSuppliers);
router.post(
  "/",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  supplierController.createSupplier
);

module.exports = router;
