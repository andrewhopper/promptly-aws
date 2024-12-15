import { Handler } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

export const handler: Handler = async (event) => {
  const { to, subject, body } = event;

  try {
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: Array.isArray(to) ? to : [to],
      },
      Message: {
        Body: {
          Text: { Data: body },
        },
        Subject: { Data: subject },
      },
      Source: process.env.FROM_EMAIL_ADDRESS,
    });

    await ses.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' }),
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send email', error }),
    };
  }
};
