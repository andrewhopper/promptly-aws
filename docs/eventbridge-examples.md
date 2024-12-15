# EventBridge Integration Examples

This document provides examples of how to use the EventBridge integration for check-in notifications.

## Event Structure

Events should follow this structure:

```json
{
  "source": "custom.checkin",
  "detail-type": "CheckInRequired",
  "detail": {
    "userId": "user123",
    "timestamp": 1234567890000,
    "message": "Optional custom message"
  }
}
```

## Supported Event Types

1. `CheckInRequired` - Triggers when a check-in is needed
2. `CheckInReceived` - Triggers when a check-in is recorded

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

## Configured Targets

The following Lambda functions are configured as targets:

1. Email Sender (`EmailSenderFunction`)
   - Sends email notifications for check-in events
   - Configure recipient using `TO_EMAIL` environment variable

2. SMS Sender (`SmsSenderFunction`)
   - Sends SMS notifications for check-in events
   - Configure recipient using `TO_PHONE_NUMBER` environment variable

3. DynamoDB Writer (`DynamoWriterFunction`)
   - Records check-in events in DynamoDB
   - Uses table name from `TABLE_NAME` environment variable

## Testing Events

Using AWS CLI:

```bash
aws events put-events --entries '[{
  "Source": "custom.checkin",
  "DetailType": "CheckInRequired",
  "Detail": "{\"userId\":\"test123\",\"timestamp\":1234567890000}",
  "EventBusName": "user-check-in-bus"
}]'
```
