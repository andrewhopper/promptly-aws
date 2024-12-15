import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { EventBridgeEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

interface CheckInEvent {
  userId?: string;
  timestamp?: number;
  message?: string;
}

const ddbClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || 'user-check-ins';

export const handler = async (event: EventBridgeEvent<string, CheckInEvent> | CheckInEvent) => {
  try {
    let userId: string;
    let timestamp: string;
    let message: string | undefined;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail } = event;
      userId = detail.userId || uuidv4();
      timestamp = new Date(detail.timestamp || Date.now()).toISOString();
      message = detail.message;
    } else {
      // Handle direct invocation
      userId = event.userId || uuidv4();
      timestamp = new Date(event.timestamp || Date.now()).toISOString();
      message = event.message;
    }

    const params: PutItemCommandInput = {
      TableName: TABLE_NAME,
      Item: {
        user_id: { S: userId },
        last_checkin_at: { S: timestamp },
        ...(message && { message: { S: message } })
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
        ...(message && { message })
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
