import { Handler } from 'aws-lambda';
import { App, LogLevel } from '@slack/bolt';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const secretsManager = new SecretsManagerClient({});
const sqs = new SQSClient({});
let slackApp: App | null = null;

async function initializeSlackApp() {
  if (slackApp) return slackApp;

  const secretsResponse = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: process.env.SLACK_SECRETS_ARN,
    })
  );

  const secrets = JSON.parse(secretsResponse.SecretString || '{}');

  slackApp = new App({
    token: secrets.SLACK_BOT_TOKEN,
    signingSecret: secrets.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: secrets.SLACK_APP_TOKEN,
    logLevel: LogLevel.DEBUG,
  });

  return slackApp;
}

export const handler: Handler = async (event) => {
  try {
    const app = await initializeSlackApp();

    // Set up message listener
    app.message(async ({ message, say }) => {
      // Send message to SQS
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify({
          type: 'message',
          user: message.user,
          text: message.text,
          channel: message.channel,
          ts: message.ts,
        }),
      }));

      // Acknowledge receipt
      await say('Message received and queued for processing!');
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Slack event processed successfully' }),
    };
  } catch (error) {
    console.error('Error processing Slack event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process Slack event', error }),
    };
  }
};
