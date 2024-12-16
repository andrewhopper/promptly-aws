import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

interface CheckInEvent {
  userId?: string;
}

interface CheckInResponse {
  statusCode: number;
  body: string;
}

const ddbClient = new DynamoDBClient({});

export const handler = async (event: CheckInEvent): Promise<CheckInResponse> => {
  try {
    const userId = event.userId || uuidv4();
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    const params: PutItemCommandInput = {
      TableName: process.env.TABLE_NAME || 'user-check-ins',
      Item: {
        user_id: { S: userId },
        last_checkin_at: { N: timestamp.toString() }
      }
    };

    const command = new PutItemCommand(params);
    await ddbClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Check-in recorded successfully',
        userId,
        timestamp,
        humanReadableTime: new Date(timestamp * 1000).toISOString()
      })
    };
  } catch (error) {
    console.error('Error writing to DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to record check-in',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
