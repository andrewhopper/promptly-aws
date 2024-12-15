# EventBridge Integration Examples

This document provides examples of how to use the EventBridge integration for check-in notifications.

## Event Structure

Events should follow this structure:

```json
{
  "version": "0",
  "id": "example-event-id",
  "detail-type": "CheckInRequired",
  "source": "custom.checkin",
  "account": "123456789012",
  "time": "2024-01-15T00:00:00Z",
  "region": "us-east-1",
  "detail": {
    "userId": "user123",
    "timestamp": 1705276800000,
    "elapsedTime": 3600001,
    "message": "Optional custom message"
  }
}
```

## Supported Event Types

1. `CheckInRequired` - Triggers when a check-in is needed
2. `CheckInReceived` - Triggers when a check-in is recorded
3. `CheckInOverdue` - Triggers when elapsed time since last check-in exceeds 1 hour

## Event Pattern Details

The event pattern matches on:
- Source: `custom.checkin`
- Detail Types: `CheckInRequired`, `CheckInReceived`, `CheckInOverdue`
- Elapsed Time: Matches when time since last check-in > 1 hour (3600000 ms)

## Publishing Events

Using AWS SDK v3:

```typescript
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eventbridge = new EventBridgeClient({});

const publishCheckInRequired = async (userId: string, message?: string) => {
  const command = new PutEventsCommand({
    Entries: [{
      EventBusName: 'user-check-in-bus',
      Source: 'custom.checkin',
      DetailType: 'CheckInRequired',
      Detail: JSON.stringify({
        userId,
        timestamp: Date.now(),
        message
      })
    }]
  });

  return eventbridge.send(command);
};
```

## Integration Examples

### 1. Email Integration

```typescript
// Email Lambda Handler (src/lambdas/email-sender/index.ts)
import { EventBridgeEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface CheckInEvent {
  userId: string;
  timestamp: number;
  message?: string;
}

const ses = new SESClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent>) => {
  const { detail, 'detail-type': detailType } = event;

  const subject = detailType === 'CheckInOverdue'
    ? 'Check-in Overdue Alert'
    : 'Check-in Notification';

  const command = new SendEmailCommand({
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [process.env.TO_EMAIL] },
    Message: {
      Subject: { Data: subject },
      Body: {
        Text: {
          Data: `User ${detail.userId} ${detailType === 'CheckInOverdue' ? 'is overdue for check-in' : 'needs to check in'}`
        }
      }
    }
  });

  return ses.send(command);
};
```

### 2. SMS Integration

```typescript
// SMS Lambda Handler (src/lambdas/sms-sender/index.ts)
import { EventBridgeEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent>) => {
  const { detail, 'detail-type': detailType } = event;

  const message = detailType === 'CheckInOverdue'
    ? `ALERT: User ${detail.userId} is overdue for check-in`
    : `Reminder: User ${detail.userId} needs to check in`;

  const command = new PublishCommand({
    PhoneNumber: process.env.TO_PHONE_NUMBER,
    Message: message
  });

  return sns.send(command);
};
```

### 3. Slack Integration

```typescript
// Slack Lambda Handler (src/lambdas/slack-sender/index.ts)
import { App } from '@slack/bolt';
import { EventBridgeEvent } from 'aws-lambda';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent>) => {
  const { detail, 'detail-type': detailType } = event;

  const message = detailType === 'CheckInOverdue'
    ? `:warning: User ${detail.userId} is overdue for check-in`
    : `:bell: User ${detail.userId} needs to check in`;

  await app.client.chat.postMessage({
    channel: process.env.SLACK_CHANNEL,
    text: message,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message
        }
      }
    ]
  });
};
```

### 4. DynamoDB Integration

```typescript
// DynamoDB Writer Lambda Handler (src/lambdas/dynamodb-writer/index.ts)
import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const dynamo = new DynamoDBClient({});

export const handler = async (event: EventBridgeEvent<string, CheckInEvent>) => {
  const { detail } = event;

  const command = new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: marshall({
      user_id: detail.userId,
      last_checkin_at: detail.timestamp,
      status: event['detail-type']
    })
  });

  return dynamo.send(command);
};
```

### Error Handling and Retries

All Lambda functions include automatic retries through EventBridge:
- Default retry policy: 185 seconds
- Retry count: 24 attempts
- Exponential backoff

Example retry configuration in CDK:
```typescript
const rule = new events.Rule(this, 'CheckInRule', {
  eventBus,
  eventPattern: checkInPattern,
  targets: [
    new targets.LambdaFunction(emailLambda, {
      retryAttempts: 3,
      maxEventAge: Duration.hours(2)
    })
  ]
});
```

## Testing Events

Using AWS CLI:

```bash
# Test CheckInRequired event
aws events put-events --entries '[{
  "Source": "custom.checkin",
  "DetailType": "CheckInRequired",
  "Detail": "{\"userId\":\"test123\",\"timestamp\":1234567890000}",
  "EventBusName": "user-check-in-bus"
}]'

# Test CheckInOverdue event
aws events put-events --entries '[{
  "Source": "custom.checkin",
  "DetailType": "CheckInOverdue",
  "Detail": "{\"userId\":\"test123\",\"timestamp\":1234567890000,\"elapsedTime\":3600001}",
  "EventBusName": "user-check-in-bus"
}]'
```
