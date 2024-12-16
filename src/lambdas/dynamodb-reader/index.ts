import { DynamoDBClient, GetItemCommand, GetItemCommandInput, QueryCommand, QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

interface ReadCheckInEvent {
  userId?: string;
  lastCheckInBefore?: number; // Unix timestamp in seconds
  lastCheckInAfter?: number; // Unix timestamp in seconds
}

interface CheckInResponse {
  statusCode: number;
  body: string;
}

interface CheckInRecord {
  user_id: string;
  last_checkin_at: number;
}

const ddbClient = new DynamoDBClient({});

export const handler = async (event: ReadCheckInEvent): Promise<CheckInResponse> => {
  try {
    // If userId is provided, get specific user's check-in
    if (event.userId) {
      const params: GetItemCommandInput = {
        TableName: process.env.TABLE_NAME || 'user-check-ins',
        Key: {
          user_id: { S: event.userId }
        }
      };

      const command = new GetItemCommand(params);
      const response = await ddbClient.send(command);

      if (!response.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'User check-in not found' })
        };
      }

      const item = unmarshall(response.Item) as CheckInRecord;
      return {
        statusCode: 200,
        body: JSON.stringify({
          userId: item.user_id,
          lastCheckInAt: item.last_checkin_at,
          humanReadableTime: new Date(item.last_checkin_at * 1000).toISOString()
        })
      };
    }

    // If time range is provided, query by last_checkin_at using GSI
    if (event.lastCheckInBefore || event.lastCheckInAfter) {
      const params: QueryCommandInput = {
        TableName: process.env.TABLE_NAME || 'user-check-ins',
        IndexName: 'LastCheckInIndex',
        KeyConditionExpression: '#lca BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#lca': 'last_checkin_at'
        },
        ExpressionAttributeValues: {
          ':start': { N: (event.lastCheckInAfter || 0).toString() },
          ':end': { N: (event.lastCheckInBefore || Math.floor(Date.now() / 1000)).toString() }
        }
      };

      const command = new QueryCommand(params);
      const response = await ddbClient.send(command);

      const items = response.Items?.map(item => {
        const unmarshalled = unmarshall(item) as CheckInRecord;
        return {
          userId: unmarshalled.user_id,
          lastCheckInAt: unmarshalled.last_checkin_at,
          humanReadableTime: new Date(unmarshalled.last_checkin_at * 1000).toISOString()
        };
      }) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({
          checkIns: items,
          count: items.length
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Must provide either userId or time range parameters' })
    };

  } catch (error) {
    console.error('Error reading from DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to read check-in',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
