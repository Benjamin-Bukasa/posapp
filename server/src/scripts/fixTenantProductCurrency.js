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
  node src/scripts/fixTenantProductCurrency.js --email user@example.com --currency CDF
  node src/scripts/fixTenantProductCurrency.js --tenantId <tenantId> --currency CDF

Options:
  --email      Email d'un utilisateur du tenant cible
  --tenantId   ID du tenant cible
  --currency   Devise a appliquer, ex: CDF, USD, EUR
  --dry-run    Affiche seulement ce qui serait modifie
`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const targetCurrency = normalizeCurrencyCode(args.currency, "");

  if ((!args.email && !args.tenantId) || !targetCurrency) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  let tenant = null;

  if (args.tenantId) {
    tenant = await prisma.tenant.findUnique({
      where: { id: args.tenantId },
      select: { id: true, name: true, primaryCurrencyCode: true },
    });
  } else if (args.email) {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
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
    tenant = user?.tenant || null;
  }

  if (!tenant) {
    throw new Error("Tenant introuvable.");
  }

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      sku: true,
      kind: true,
      unitPrice: true,
      currencyCode: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const impacted = products.filter(
    (product) => String(product.currencyCode || "").toUpperCase() !== targetCurrency,
  );

  console.log(`Tenant : ${tenant.name} (${tenant.id})`);
  console.log(`Devise actuelle du tenant : ${tenant.primaryCurrencyCode || "USD"}`);
  console.log(`Devise cible produits    : ${targetCurrency}`);
  console.log(`Produits trouves         : ${products.length}`);
  console.log(`Produits a corriger      : ${impacted.length}`);

  if (!impacted.length) {
    console.log("Aucune correction necessaire.");
    return;
  }

  impacted.slice(0, 20).forEach((product) => {
    console.log(
      `- ${product.sku || "--"} | ${product.name} | ${product.kind} | ${product.unitPrice} ${product.currencyCode}`,
    );
  });

  if (args["dry-run"]) {
    console.log("Dry-run termine. Aucune modification en base.");
    return;
  }

  const result = await prisma.product.updateMany({
    where: {
      tenantId: tenant.id,
      NOT: { currencyCode: targetCurrency },
    },
    data: {
      currencyCode: targetCurrency,
    },
  });

  console.log(`${result.count} produit(s) mis a jour vers ${targetCurrency}.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
