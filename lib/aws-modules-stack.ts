import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
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

    // Create S3 bucket for generated images
    const generatedImagesBucket = new s3.Bucket(this, 'GeneratedImagesBucket', {
      bucketName: `${this.account}-${this.region}-generated-images`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
      autoDeleteObjects: true, // For development - change for production
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      serverAccessLogsPrefix: 'access-logs/',
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30), // Expire access logs after 30 days
          prefix: 'access-logs/',
        }
      ],
    });

    // Bedrock Image Generator Lambda
    const bedrockLambda = new nodejs.NodejsFunction(this, 'BedrockImageGeneratorFunction', {
      entry: 'src/lambdas/bedrock-image-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        BUCKET_NAME: generatedImagesBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });

    // Add Bedrock permissions
    bedrockLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    // Add S3 permissions for Bedrock Lambda
    generatedImagesBucket.grantReadWrite(bedrockLambda);

    // Create Secrets Manager secret for Slack credentials
    const slackSecret = new secretsmanager.Secret(this, 'SlackCredentials', {
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

    // Create SQS queue for Slack messages
    const slackMessagesQueue = new sqs.Queue(this, 'SlackMessagesQueue', {
      queueName: 'slack-messages-queue',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14),
    });

    // Slack Receiver Lambda
    const slackReceiverLambda = new nodejs.NodejsFunction(this, 'SlackReceiverFunction', {
      entry: 'src/lambdas/slack-receiver/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        SLACK_SECRET_ARN: slackSecret.secretArn,
        QUEUE_URL: slackMessagesQueue.queueUrl,
      },
    });

    // Add SQS permissions to Slack Receiver Lambda
    slackReceiverLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage'],
      resources: [slackMessagesQueue.queueArn],
    }));

    // Add Secrets Manager permissions to Slack Receiver Lambda
    slackReceiverLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [slackSecret.secretArn],
    }));

    // Slack message sender Lambda
    const slackSender = new nodejs.NodejsFunction(this, 'SlackSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/slack-sender/index.ts'),
      handler: 'handler',
      environment: {
        SLACK_SECRET_ARN: slackSecret.secretArn,
        QUEUE_URL: slackMessagesQueue.queueUrl,
      },
    });

    // Grant permissions
    slackSecret.grantRead(slackSender);
    slackSecret.grantRead(slackReceiverLambda);
    slackMessagesQueue.grantSendMessages(slackReceiverLambda);
    slackMessagesQueue.grantConsumeMessages(slackSender);
  }
}
