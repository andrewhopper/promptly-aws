import { Handler } from 'aws-lambda';
import { App, LogLevel } from '@slack/bolt';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({});
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
    const { channel, text } = event;
    const app = await initializeSlackApp();

    await app.client.chat.postMessage({
      channel,
      text,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message sent to Slack successfully' }),
    };
  } catch (error) {
    console.error('Error sending message to Slack:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send message to Slack', error }),
    };
  }
};
