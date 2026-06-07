const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const customerController = require("../controllers/customerController");

const router = express.Router();

router.get("/", auth, requirePermission("customers.read"), customerController.listCustomers);
router.get("/:id", auth, requirePermission("customers.read"), customerController.getCustomer);
router.post(
  "/",
  auth,
  requirePermission("customers.create"),
  customerController.createCustomer
);
router.patch(
  "/:id",
  auth,
  requirePermission("customers.update"),
  customerController.updateCustomer
);
router.delete(
  "/:id",
  auth,
  requirePermission("customers.delete"),
  customerController.deleteCustomer
);

module.exports = router;
