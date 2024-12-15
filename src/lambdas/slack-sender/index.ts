import { App, LogLevel } from '@slack/bolt';
import { EventBridgeEvent } from 'aws-lambda';

interface SlackEvent {
  channel: string;
  message: string;
}

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent> | SlackEvent) => {
  try {
    let channel: string;
    let message: string;

    if ('detail' in event) {
      // Handle EventBridge event
      const { detail, 'detail-type': detailType } = event;
      channel = process.env.SLACK_CHANNEL || 'general';
      message = detail.message ||
        `User ${detail.userId} ${detailType === 'CheckInRequired' ? 'needs to check in' : 'has checked in'}`;
    } else {
      // Handle direct invocation
      channel = event.channel;
      message = event.message;
    }

    // Send message to Slack
    await app.client.chat.postMessage({
      channel,
      text: message,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message sent to Slack successfully' })
    };
  } catch (error) {
    console.error('Error sending message to Slack:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send message to Slack', error })
    };
  }
};
