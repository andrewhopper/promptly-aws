import { Handler } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({});

export const handler: Handler = async (event) => {
  const { phoneNumber, message } = event;

  try {
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
      body: JSON.stringify({ message: 'Failed to send SMS', error }),
    };
  }
};
