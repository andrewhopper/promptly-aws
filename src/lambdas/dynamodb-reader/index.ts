import { DynamoDBClient, GetItemCommand, GetItemCommandInput } from '@aws-sdk/client-dynamodb';

interface ReadCheckInEvent {
  userId: string;
}

const ddbClient = new DynamoDBClient({});
const TABLE_NAME = 'user-check-ins';

export const handler = async (event: ReadCheckInEvent) => {
  try {
    const { userId } = event;

    const params: GetItemCommandInput = {
      TableName: TABLE_NAME,
      Key: {
        user_id: { S: userId }
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

    return {
      statusCode: 200,
      body: JSON.stringify({
        userId: response.Item.user_id.S,
        lastCheckInAt: response.Item.last_checkin_at.S
      })
    };
  } catch (error) {
    console.error('Error reading from DynamoDB:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to read check-in', error })
    };
  }
};
