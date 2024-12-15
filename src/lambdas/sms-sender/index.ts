import { SNSClient, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';
import { EventBridgeEvent } from 'aws-lambda';

interface SMSEvent {
  phoneNumber: string;
  message: string;
}

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

const snsClient = new SNSClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent> | SMSEvent) => {
  try {
    let params: PublishCommandInput;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail, 'detail-type': detailType } = event;
      const message = detail.message ||
        `User ${detail.userId} ${detailType === 'CheckInRequired' ? 'needs to check in' : 'has checked in'}`;

      params = {
        Message: message,
        PhoneNumber: process.env.TO_PHONE_NUMBER,
      };
    } else {
      // Handle direct invocation
      const { phoneNumber, message } = event;
      params = {
        Message: message,
        PhoneNumber: phoneNumber,
      };
    }

    const command = new PublishCommand(params);
    await snsClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'SMS sent successfully' })
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send SMS', error })
    };
  }
};
