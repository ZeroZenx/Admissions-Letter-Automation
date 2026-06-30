type SendMailInput = {
  accessToken: string;
  recipient: string;
  subject: string;
  body: string;
  attachmentName: string;
  attachmentContent: Buffer;
};

export async function sendGraphMail(input: SendMailInput) {
  const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft Graph sendMail failed with ${response.status}: ${text}`);
  }
}
