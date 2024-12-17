import { Handler } from 'aws-lambda';
import { App, LogLevel } from '@slack/bolt';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { EventBridgeEvent } from 'aws-lambda';

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: any[];
  attachments?: any[];
  thread_ts?: string;
  reply_broadcast?: boolean;
}

interface SlackError extends Error {
  data?: {
    error?: string;
  };
  statusCode?: number;
}

const secretsManager = new SecretsManagerClient({});
const sqs = new SQSClient({});
let slackApp: App | null = null;

async function validateChannel(app: App, channel: string): Promise<boolean> {
  try {
    const result = await app.client.conversations.info({ channel });
    return result.ok;
  } catch (error) {
    const slackError = error as SlackError;
    if (slackError.data?.error === 'channel_not_found') {
      return false;
    }
    throw error;
  }
}

async function initializeSlackApp() {
  if (slackApp) return slackApp;

  try {
    const secretsResponse = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: process.env.SLACK_SECRET_ARN,
      })
    );

    const secrets = JSON.parse(secretsResponse.SecretString || '{}');

    if (!secrets.SLACK_BOT_TOKEN || !secrets.SLACK_SIGNING_SECRET || !secrets.SLACK_APP_TOKEN) {
      throw new Error('Missing required Slack credentials');
    }

    slackApp = new App({
      token: secrets.SLACK_BOT_TOKEN,
      signingSecret: secrets.SLACK_SIGNING_SECRET,
      socketMode: true,
      appToken: secrets.SLACK_APP_TOKEN,
      logLevel: LogLevel.DEBUG,
    });

    return slackApp;
  } catch (error) {
    console.error('Error initializing Slack app:', error);
    throw new Error('Failed to initialize Slack app');
  }
}

export const handler: Handler = async (event: EventBridgeEvent<string, CheckInEvent> | SlackMessage) => {
  try {
    const app = await initializeSlackApp();

    let channel: string;
    let text: string;
    let blocks: any[] | undefined;
    let attachments: any[] | undefined;
    let thread_ts: string | undefined;
    let reply_broadcast: boolean | undefined;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail, 'detail-type': detailType } = event;
      channel = process.env.SLACK_CHANNEL || 'general';
      text = detail.message ||
        `User ${detail.userId} ${detailType === 'CheckInRequired' ? 'needs to check in' : 'has checked in'}`;
    } else {
      // Handle direct invocation
      ({ channel, text, blocks, attachments, thread_ts, reply_broadcast } = event);
    }

    // Validate channel exists
    const isValidChannel = await validateChannel(app, channel);
    if (!isValidChannel) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    // Send message using Slack Web API
    const response = await app.client.chat.postMessage({
      channel,
      text: text || 'Message with blocks',
      blocks,
      attachments,
      thread_ts,
      reply_broadcast,
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.error}`);
    }

    // Queue message for processing if needed
    if (process.env.QUEUE_URL) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify(event),
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Message sent to Slack successfully',
        timestamp: response.ts,
        channel: response.channel,
      }),
    };
  } catch (error) {
    const slackError = error as SlackError;
    console.error('Error sending message to Slack:', slackError);
    return {
      statusCode: slackError.statusCode || 500,
      body: JSON.stringify({
        message: 'Failed to send message to Slack',
        error: slackError.message,
      }),
    };
  }
};
