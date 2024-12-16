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

    // Create S3 bucket for content storage
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      accessControl: s3.BucketAccessControl.PRIVATE,
      serverAccessLogsPrefix: 'access-logs/'
    });

    // Email sender Lambda
    const emailSender = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/email-sender/index.ts'),
      handler: 'handler',
      environment: {
        FROM_EMAIL_ADDRESS: 'noreply@yourdomain.com',
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
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'last_checkin_at',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
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

    // Grant DynamoDB write permissions
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

    // Grant DynamoDB read permissions
    userCheckInsTable.grantReadData(dynamoReaderLambda);

    // Create S3 bucket for generated images
    const generatedImagesBucket = new s3.Bucket(this, 'GeneratedImagesBucket', {
      bucketName: `${this.account}-${this.region}-generated-images`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      serverAccessLogsPrefix: 'access-logs/',
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
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

    // Bedrock Agent Lambda
    const bedrockAgentLambda = new nodejs.NodejsFunction(this, 'BedrockAgentFunction', {
      entry: 'src/lambdas/bedrock-agent/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        DYNAMODB_TABLE: userCheckInsTable.tableName,
        BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID || 'your-agent-id',
        BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID || 'your-agent-alias-id'
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });

    // Add permissions for Bedrock Agent Lambda
    bedrockAgentLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeAgent',
        'transcribe:StartStreamTranscription',
        'polly:SynthesizeSpeech',
        'dynamodb:PutItem',
        'dynamodb:GetItem'
      ],
      resources: ['*']
    }));

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
