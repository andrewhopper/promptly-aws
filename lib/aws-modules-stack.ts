import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Email sender Lambda
    const emailSender = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/email-sender/index.ts'),
      handler: 'handler',
      environment: {
        FROM_EMAIL_ADDRESS: 'noreply@yourdomain.com', // Replace with verified SES email
      },
    });

    // Grant SES permissions to email sender Lambda
    emailSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // SMS sender Lambda
    const smsSender = new nodejs.NodejsFunction(this, 'SmsSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/sms-sender/index.ts'),
      handler: 'handler',
    });

    // Grant SNS permissions to SMS sender Lambda
    smsSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'],
    }));

    // Create DynamoDB table for user check-ins
    const userCheckInsTable = new dynamodb.Table(this, 'UserCheckInsTable', {
      tableName: 'user-check-ins',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING, // For GUID storage
      },
      sortKey: {
        name: 'last_checkin_at',
        type: dynamodb.AttributeType.NUMBER, // For Unix timestamp
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change to RETAIN for production
      timeToLiveAttribute: 'ttl', // Optional: if we want to expire old check-ins
    });

    // Add GSI for querying by last_checkin_at
    userCheckInsTable.addGlobalSecondaryIndex({
      indexName: 'LastCheckInIndex',
      partitionKey: {
        name: 'last_checkin_at',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB Writer Lambda
    const dynamoWriterLambda = new nodejs.NodejsFunction(this, 'DynamoWriterFunction', {
      entry: 'src/lambdas/dynamodb-writer/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
    });

    // Grant DynamoDB write permissions to the Lambda
    userCheckInsTable.grantWriteData(dynamoWriterLambda);

    // DynamoDB Reader Lambda
    const dynamoReaderLambda = new nodejs.NodejsFunction(this, 'DynamoReaderFunction', {
      entry: 'src/lambdas/dynamodb-reader/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
    });

    // Grant DynamoDB read permissions to the Lambda
    userCheckInsTable.grantReadData(dynamoReaderLambda);

    // Bedrock Image Generator Lambda
    const bedrockLambda = new nodejs.NodejsFunction(this, 'BedrockImageGeneratorFunction', {
      entry: 'src/lambdas/bedrock-image-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
    });

    // Create SQS queue for Slack messages
    const slackMessagesQueue = new sqs.Queue(this, 'SlackMessagesQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create Secrets Manager secret for Slack tokens
    const slackTokens = new secretsmanager.Secret(this, 'SlackCredentials', {
      secretName: 'slack/credentials',
      description: 'Slack API credentials for bot',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          SLACK_BOT_TOKEN: '',
          SLACK_APP_TOKEN: '',
          SLACK_SIGNING_SECRET: '',
        }),
        generateStringKey: 'dummy',
      },
    });

    // Slack message sender Lambda
    const slackSender = new nodejs.NodejsFunction(this, 'SlackSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/lambdas/slack-sender/index.ts',
      handler: 'handler',
      environment: {
        SLACK_SECRET_ARN: slackTokens.secretArn,
      },
    });

    // Slack message receiver Lambda
    const slackReceiver = new nodejs.NodejsFunction(this, 'SlackReceiverFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/lambdas/slack-receiver/index.ts',
      handler: 'handler',
      environment: {
        SLACK_SECRET_ARN: slackTokens.secretArn,
        QUEUE_URL: slackMessagesQueue.queueUrl,
      },
    });

    // Grant permissions
    slackTokens.grantRead(slackSender);
    slackTokens.grantRead(slackReceiver);
    slackMessagesQueue.grantSendMessages(slackReceiver);
  }
}
