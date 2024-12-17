import { Handler } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { EventBridgeEvent } from 'aws-lambda';

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

interface SMSEvent {
  phoneNumber: string;
  message: string;
}

const sns = new SNSClient({});

export const handler: Handler = async (event: EventBridgeEvent<string, CheckInEvent> | SMSEvent) => {
  try {
    let phoneNumber: string;
    let message: string;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail, 'detail-type': detailType } = event;
      phoneNumber = process.env.TO_PHONE_NUMBER || '';
      message = detail.message ||
        `User ${detail.userId} ${detailType === 'CheckInRequired' ? 'needs to check in' : 'has checked in'}`;
    } else {
      // Handle direct invocation
      ({ phoneNumber, message } = event);
    }

    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
    });

    await sns.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'SMS sent successfully' }),
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to send SMS',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};
