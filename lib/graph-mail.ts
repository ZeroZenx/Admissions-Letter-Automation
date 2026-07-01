type SendMailInput = {
  accessToken: string;
  recipient: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentContent: Buffer;
  timeoutMs?: number;
};

export const GRAPH_SEND_TIMEOUT_MS = 30_000;
export const GRAPH_ERROR_DETAIL_LIMIT = 500;

export async function sendGraphMail(input: SendMailInput) {
  const timeoutMs = input.timeoutMs ?? GRAPH_SEND_TIMEOUT_MS;
  let response: Response;
  try {
    response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: {
            contentType: "HTML",
            content: input.body
          },
          toRecipients: [
            {
              emailAddress: {
                address: input.recipient
              }
            }
          ],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: input.attachmentName,
              contentType: "application/pdf",
              contentBytes: input.attachmentContent.toString("base64")
            }
          ]
        },
        saveToSentItems: true
      })
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Error(`Microsoft Graph sendMail timed out after ${timeoutMs}ms.`);
    }
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatGraphSendError(response.status, text));
  }
}

export function formatGraphSendError(status: number, responseText: string) {
  return `Microsoft Graph sendMail failed with ${status}: ${extractGraphErrorDetail(responseText)}`;
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

function extractGraphErrorDetail(responseText: string) {
  const parsedMessage = parseGraphErrorMessage(responseText);
  const detail = (parsedMessage ?? responseText ?? "").replace(/\s+/g, " ").trim();
  if (!detail) return "No response body.";
  if (detail.length <= GRAPH_ERROR_DETAIL_LIMIT) return detail;
  return `${detail.slice(0, GRAPH_ERROR_DETAIL_LIMIT - 1)}…`;
}

function parseGraphErrorMessage(responseText: string) {
  try {
    const parsed = JSON.parse(responseText) as unknown;
    if (!parsed || typeof parsed !== "object" || !("error" in parsed)) return null;
    const error = parsed.error;
    if (!error || typeof error !== "object" || !("message" in error)) return null;
    return typeof error.message === "string" ? error.message : null;
  } catch {
    return null;
  }
}
