import { DynamoDBClient, PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { EventBridgeEvent } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

interface CheckInEvent {
  userId?: string;
  timestamp?: number;
  message?: string;
}

interface CheckInResponse {
  statusCode: number;
  body: string;
}

const ddbClient = new DynamoDBClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent> | CheckInEvent): Promise<CheckInResponse> => {
  try {
    let userId: string;
    let timestamp: number;
    let message: string | undefined;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail } = event;
      userId = detail.userId || uuidv4();
      timestamp = detail.timestamp || Math.floor(Date.now() / 1000);
      message = detail.message;
    } else {
      // Handle direct invocation
      userId = event.userId || uuidv4();
      timestamp = event.timestamp || Math.floor(Date.now() / 1000);
      message = event.message;
    }

    const params: PutItemCommandInput = {
      TableName: process.env.TABLE_NAME || 'user-check-ins',
      Item: {
        user_id: { S: userId },
        last_checkin_at: { N: timestamp.toString() },
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
        humanReadableTime: new Date(timestamp * 1000).toISOString(),
        ...(message && { message })
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
