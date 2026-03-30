const { hasPermission } = require("../utils/permissionAccess");

const requirePermission = (...codes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Non autorise." });
    }

    if (!hasPermission(req.user, ...codes)) {
      return res.status(403).json({
        message: "Vous n'avez pas la permission requise pour cette operation.",
      });
    }

    return next();
  };
};

module.exports = requirePermission;
