import { Handler } from 'aws-lambda';
import { App, LogLevel } from '@slack/bolt';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

interface SlackEvent {
  type: string;
  event: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    files?: Array<{
      url_private?: string;
      title?: string;
      mimetype?: string;
    }>;
  };
  team_id: string;
  event_id: string;
  event_time: number;
}

interface ProcessedMessage {
  messageId: string;
  timestamp: number;
  channel: string;
  user?: string;
  text?: string;
  threadTs?: string;
  files?: Array<{
    url: string;
    title: string;
    type: string;
  }>;
  eventType: string;
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

function processSlackEvent(event: SlackEvent): ProcessedMessage {
  const { event: slackEvent, event_id, event_time } = event;

  return {
    messageId: event_id,
    timestamp: event_time,
    channel: slackEvent.channel || '',
    user: slackEvent.user,
    text: slackEvent.text,
    threadTs: slackEvent.thread_ts,
    files: slackEvent.files?.map(file => ({
      url: file.url_private || '',
      title: file.title || '',
      type: file.mimetype || '',
    })),
    eventType: slackEvent.type,
  };
}

export const handler: Handler = async (event: SlackEvent) => {
  try {
    const app = await initializeSlackApp();

    if (!event.type || !event.event || !event.event.type) {
      throw new Error('Invalid event structure');
    }

    if (event.event.type === 'message') {
      const processedMessage = processSlackEvent(event);

      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MessageBody: JSON.stringify(processedMessage),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: 'slack_message',
          },
        },
      }));

      await app.client.chat.postMessage({
        channel: processedMessage.channel,
        text: 'Message received and queued for processing!',
        thread_ts: processedMessage.threadTs,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Event processed successfully',
          data: processedMessage,
        }),
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Unsupported event type: ${event.event.type}`,
      }),
    };
  } catch (error) {
    const slackError = error as SlackError;
    console.error('Error processing Slack event:', {
      error: slackError.message,
      data: slackError.data,
      statusCode: slackError.statusCode,
    });

    return {
      statusCode: slackError.statusCode || 500,
      body: JSON.stringify({
        message: 'Failed to process Slack event',
        error: slackError.message,
        details: slackError.data,
      }),
    };
  }
};
