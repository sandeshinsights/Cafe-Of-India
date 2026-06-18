import { FaxResult } from "./types";

const SR_FAX_URL = "https://secure.srfax.com";

export async function sendOrderFax(receiptText: string, orderId: string): Promise<FaxResult> {
  const accessId = process.env.SR_FAX_ACCESS_ID;
  const accessKey = process.env.SR_FAX_ACCESS_KEY;
  const faxNumber = process.env.SR_FAX_NUMBER;
  const recipientFax = process.env.RECIPIENT_FAX_NUMBER;

  if (!accessId || !accessKey || !faxNumber || !recipientFax || recipientFax === "PLACEHOLDER") {
    console.log(`[OrderPrint] SRFax not configured — skipping for order ${orderId.slice(0, 8)}`);
    return { success: true, attempt: 1 };
  }

  try {
    // Base64 encode the receipt text as a .txt file
    const fileContent = Buffer.from(receiptText, "utf-8").toString("base64");

    const response = await fetch(SR_FAX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_id: accessId,
        access_pwd: accessKey,
        action: "Send_Fax",
        sFaxNumber: faxNumber,
        sFaxTarget: recipientFax,
        sFaxSubject: `ORDER ${orderId.slice(0, 8).toUpperCase()}`,
        FaxFileContent: fileContent,
        sFaxFileType: "TXT",
        sFaxFileName: `order-${orderId.slice(0, 8)}.txt`,
      }),
    });

    const data = await response.json();

    if (data.Status === "Success" || data.StatusCode === 0) {
      console.log(`[OrderPrint] SRFax sent for order ${orderId.slice(0, 8)}:`, JSON.stringify(data));
      return { success: true, attempt: 1 };
    } else {
      const errorMsg = data.StatusMessage || data.Message || `Status: ${data.Status}`;
      console.error(`[OrderPrint] SRFax failed for order ${orderId.slice(0, 8)}:`, errorMsg);
      return { success: false, attempt: 1, error: errorMsg };
    }
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error";
    console.error(`[OrderPrint] SRFax error for order ${orderId.slice(0, 8)}:`, errorMsg);
    return { success: false, attempt: 1, error: errorMsg };
  }
}