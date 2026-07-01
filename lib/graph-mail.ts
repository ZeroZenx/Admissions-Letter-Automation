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
    throw new Error(`Microsoft Graph sendMail failed with ${response.status}: ${text}`);
  }
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}
