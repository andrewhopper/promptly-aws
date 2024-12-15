import { SNSClient, PublishCommand, PublishCommandInput } from '@aws-sdk/client-sns';

interface SMSEvent {
  phoneNumber: string;
  message: string;
}

const snsClient = new SNSClient({});

export const handler = async (event: SMSEvent) => {
  try {
    const { phoneNumber, message } = event;

    const params: PublishCommandInput = {
      PhoneNumber: phoneNumber,
      Message: message,
    };

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
