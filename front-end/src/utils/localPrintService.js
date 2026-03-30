import buildEscPosReceipt from "./escposReceipt";

const LOCAL_PRINTER_URL =
  import.meta.env.VITE_LOCAL_PRINTER_URL || "http://127.0.0.1:3210";

export const printReceiptViaLocalService = async ({
  order,
  amountReceived,
  cashierName,
  storeName,
  businessName,
}) => {
  const payload = buildEscPosReceipt({
    order,
    amountReceived,
    cashierName,
    storeName,
    businessName,
  });

  const response = await fetch(`${LOCAL_PRINTER_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentBase64: btoa(String.fromCharCode(...payload)),
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

export default printReceiptViaLocalService;
