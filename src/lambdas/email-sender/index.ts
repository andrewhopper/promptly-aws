import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';

interface EmailEvent {
  to: string;
  subject: string;
  body: string;
}

const sesClient = new SESClient({});

export const handler = async (event: EmailEvent) => {
  try {
    const { to, subject, body } = event;

    const params: SendEmailCommandInput = {
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Body: {
          Text: { Data: body }
        },
        Subject: { Data: subject },
      },
      Source: process.env.FROM_EMAIL,
    };

    const command = new SendEmailCommand(params);
    await sesClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send email', error })
    };
  }
};
