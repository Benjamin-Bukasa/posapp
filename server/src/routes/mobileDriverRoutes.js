const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const driverMobileController = require("../controllers/driverMobileController");

const router = express.Router();

router.get(
  "/assignments",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.listAssignments,
);
router.get(
  "/assignments/current",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.getCurrentAssignment,
);
router.post(
  "/location",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.postDriverLocation,
);
router.post(
  "/deliveries/from-order/:orderId",
  auth,
  requireRole("ADMIN", "SUPERADMIN"),
  driverMobileController.createDeliveryFromOrder,
);
router.patch(
  "/deliveries/:id/assign",
  auth,
  requireRole("ADMIN", "SUPERADMIN"),
  driverMobileController.assignDelivery,
);
router.patch(
  "/deliveries/:id/start",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.startDelivery,
);
router.patch(
  "/deliveries/:id/arrive",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.arriveDelivery,
);
router.patch(
  "/deliveries/:id/complete",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.completeDelivery,
);
router.patch(
  "/deliveries/:id/cancel",
  auth,
  requireRole("DRIVER", "ADMIN", "SUPERADMIN"),
  driverMobileController.cancelDelivery,
);

module.exports = router;
