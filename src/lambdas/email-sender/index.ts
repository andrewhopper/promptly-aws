import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import { EventBridgeEvent, Handler } from 'aws-lambda';

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

interface EmailEvent {
  to: string | string[];
  subject: string;
  body: string;
}

const ses = new SESClient({});

export const handler: Handler = async (event: EventBridgeEvent<string, CheckInEvent> | EmailEvent) => {
  try {
    let params: SendEmailCommandInput;

    if ('detail' in event) {
      // Handle EventBridge event
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
          Subject: { Data: subject }
        },
        Source: process.env.FROM_EMAIL || 'noreply@example.com'
      };
    } else {
      // Handle direct invocation
      const { to, subject, body } = event;
      params = {
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Body: {
            Text: { Data: body }
          },
          Subject: { Data: subject }
        },
        Source: process.env.FROM_EMAIL || 'noreply@example.com'
      };
    }

    const command = new SendEmailCommand(params);
    await ses.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email sent successfully' })
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to send email',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
