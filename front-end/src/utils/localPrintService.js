import buildEscPosReceipt from "./escposReceipt";

const LOCAL_PRINTER_URL =
  import.meta.env.VITE_LOCAL_PRINTER_URL || "http://127.0.0.1:3210";

export const printBytesViaLocalService = async ({
  bytes,
  printerServiceUrl,
  printerName,
}) => {
  const payload =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const targetUrl = printerServiceUrl || LOCAL_PRINTER_URL;

  const response = await fetch(`${targetUrl}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentBase64: btoa(String.fromCharCode(...payload)),
      printerName: printerName || undefined,
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.message || "Le service local d'impression a refuse le ticket.",
    );
  }

  return data;
};

export const printReceiptViaLocalService = async ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
  receiptSettings,
  printerServiceUrl,
  printerName,
}) => {
  const payload = buildEscPosReceipt({
    order,
    amountReceived,
    cashierName,
    storeName,
    businessName,
    receiptSettings,
  });
  return printBytesViaLocalService({
    bytes: payload,
    printerServiceUrl,
    printerName,
  });
};

export default printReceiptViaLocalService;
