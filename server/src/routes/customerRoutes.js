const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const customerController = require("../controllers/customerController");

const router = express.Router();

router.get("/", auth, customerController.listCustomers);
router.get("/:id", auth, customerController.getCustomer);
router.post(
  "/",
  auth,
  requireRole("SUPERADMIN", "ADMIN", "USER"),
  customerController.createCustomer
);
router.patch(
  "/:id",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  customerController.updateCustomer
);

module.exports = router;
