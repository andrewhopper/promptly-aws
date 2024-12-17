import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);
    const { message } = body;

    // Prepare the prompt for the Bedrock model
    const prompt = {
      prompt: `\nHuman: ${message}\nAssistant:`,
      max_tokens: 500,
      temperature: 0.7,
      stop_sequences: ["\nHuman:"]
    };

    // Invoke Bedrock model (Claude)
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-v2',
      body: JSON.stringify(prompt),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Store the interaction in DynamoDB if it's a check-in
    if (message.toLowerCase().includes('check in') || message.toLowerCase().includes('checking in')) {
      const timestamp = new Date().toISOString();
      const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

      await docClient.send(new PutCommand({
        TableName: process.env.CHECKINS_TABLE_NAME,
        Item: {
          user_id: userId,
          last_checkin_at: timestamp,
          message: message,
          response: responseBody.completion
        }
      }));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        response: responseBody.completion
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to process message'
      })
    };
  }
};
