const prisma = require("../config/prisma");
const { normalizeCurrencyCode } = require("../utils/currencySettings");

const parseArgs = (argv = []) => {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;

    const key = entry.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
};

const printUsage = () => {
  console.log(`
Usage:
  node src/scripts/fixTenantSalesCurrency.js --email user@example.com --currency CDF
  node src/scripts/fixTenantSalesCurrency.js --tenantId <tenantId> --currency CDF

Options:
  --email      Email d'un utilisateur du tenant cible
  --tenantId   ID du tenant cible
  --currency   Devise a appliquer, ex: CDF, USD, EUR
  --dry-run    Affiche seulement ce qui serait modifie
`);
};

const resolveTenant = async ({ email, tenantId }) => {
  if (tenantId) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, primaryCurrencyCode: true },
    });
  }

  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        tenant: {
          select: {
            id: true,
            name: true,
            primaryCurrencyCode: true,
          },
        },
      },
    });
    return user?.tenant || null;
  }

  return null;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const targetCurrency = normalizeCurrencyCode(args.currency, "");

  if ((!args.email && !args.tenantId) || !targetCurrency) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const tenant = await resolveTenant(args);
  if (!tenant) {
    throw new Error("Tenant introuvable.");
  }

  const [ordersCount, orderItemsCount, paymentsCount] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: tenant.id,
        NOT: { currencyCode: targetCurrency },
      },
    }),
    prisma.orderItem.count({
      where: {
        order: {
          tenantId: tenant.id,
        },
        NOT: { currencyCode: targetCurrency },
      },
    }),
    prisma.payment.count({
      where: {
        tenantId: tenant.id,
        NOT: { currencyCode: targetCurrency },
      },
    }),
  ]);

  console.log(`Tenant : ${tenant.name} (${tenant.id})`);
  console.log(`Devise actuelle du tenant : ${tenant.primaryCurrencyCode || "USD"}`);
  console.log(`Devise cible ventes       : ${targetCurrency}`);
  console.log(`Commandes a corriger      : ${ordersCount}`);
  console.log(`Lignes de vente a corriger: ${orderItemsCount}`);
  console.log(`Paiements a corriger      : ${paymentsCount}`);

  if (args["dry-run"]) {
    console.log("Dry-run termine. Aucune modification en base.");
    return;
  }

  const [ordersResult, orderItemsResult, paymentsResult] = await prisma.$transaction([
    prisma.order.updateMany({
      where: {
        tenantId: tenant.id,
        NOT: { currencyCode: targetCurrency },
      },
      data: { currencyCode: targetCurrency },
    }),
    prisma.orderItem.updateMany({
      where: {
        order: {
          tenantId: tenant.id,
        },
        NOT: { currencyCode: targetCurrency },
      },
      data: { currencyCode: targetCurrency },
    }),
    prisma.payment.updateMany({
      where: {
        tenantId: tenant.id,
        NOT: { currencyCode: targetCurrency },
      },
      data: { currencyCode: targetCurrency },
    }),
  ]);

  console.log(`${ordersResult.count} commande(s) mises a jour.`);
  console.log(`${orderItemsResult.count} ligne(s) de vente mises a jour.`);
  console.log(`${paymentsResult.count} paiement(s) mis a jour.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
