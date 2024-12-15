import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface CheckInEvent {
  userId?: string;
}

const ddbClient = new DynamoDBClient({});
const TABLE_NAME = 'user-check-ins';

export const handler = async (event: CheckInEvent) => {
  try {
    const userId = event.userId || uuidv4();
    const timestamp = new Date().toISOString();

    const params: PutItemCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        user_id: { S: userId },
        last_checkin_at: { S: timestamp }
      }
    };

    const command = new PutItemCommand(params);
    await ddbClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Check-in recorded successfully',
        userId,
        timestamp
      })
    };
  } catch (error) {
    console.error('Error writing to DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to record check-in', error })
    };
  }
};
