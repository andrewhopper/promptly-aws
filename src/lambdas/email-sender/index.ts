import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { EventBridgeEvent } from 'aws-lambda';

interface EmailEvent {
  to: string;
  subject: string;
  body: string;
}

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

const sesClient = new SESClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent> | EmailEvent) => {
  try {
    let params: SendEmailCommandInput;

    if ('detail' in event) {
      const { detail, 'detail-type': detailType } = event;
      const subject = detailType === 'CheckInRequired'
        ? 'Time to Check In!'
        : 'Check-in Received';
      const message = detail.message ||
        `User ${detail.userId} ${detailType === 'CheckInRequired' ? 'needs to check in' : 'has checked in'}`;

      params = {
        Destination: {
          ToAddresses: [process.env.TO_EMAIL || 'default@example.com']
        },
        Message: {
          Body: {
            Text: { Data: message }
          },
          Subject: { Data: subject },
        },
        Source: process.env.FROM_EMAIL || 'noreply@example.com',
      };
    } else {
      const { to, subject, body } = event;
      params = {
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Body: {
            Text: { Data: body }
          },
          Subject: { Data: subject },
        },
        Source: process.env.FROM_EMAIL || 'noreply@example.com',
      };
    }

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
