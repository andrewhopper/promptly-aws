import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface AwsModulesStackProps extends cdk.StackProps {}

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      env: props?.env,
      synthesizer: new cdk.CliCredentialsStackSynthesizer({
        fileAssetsBucketName: undefined,
        bucketPrefix: '',
        dockerTagPrefix: '',
        qualifier: 'custom',
      }),
    });

    // Set CDK context to disable S3 features
    this.node.setContext('@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy', false);
    this.node.setContext('@aws-cdk/aws-s3:createDefaultLoggingPolicy', false);
    this.node.setContext('@aws-cdk/aws-s3:defaultEncryption', false);
    this.node.setContext('@aws-cdk/aws-s3:disableDefaultLogging', true);
    this.node.setContext('@aws-cdk/aws-s3:disableAccessLogging', true);
    this.node.setContext('@aws-cdk/aws-s3:disableServerAccessLogging', true);

    // Create a log group for Lambda functions
    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Common Lambda configuration with explicit logging and no asset bundling
    const commonLambdaProps: cdk.aws_lambda_nodejs.NodejsFunctionProps = {
      bundling: {
        minify: false,
        sourceMap: false,
        target: 'es2020',
        externalModules: ['aws-sdk', '*'],
        forceDockerBundling: false,
        nodeModules: [],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: () => [],
        },
        define: {
          'process.env.DISABLE_BUNDLING': 'true',
        },
      },
      logGroup,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    };

    const emailSender = new NodejsFunction(this, 'EmailSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/email-sender/index.ts'),
      handler: 'handler',
      environment: {
        FROM_EMAIL_ADDRESS: 'noreply@yourdomain.com',
      },
      ...commonLambdaProps,
    });

    emailSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    const smsSender = new NodejsFunction(this, 'SmsSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/lambdas/sms-sender/index.ts'),
      handler: 'handler',
      ...commonLambdaProps,
    });

    smsSender.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'],
    }));

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

    userCheckInsTable.addGlobalSecondaryIndex({
      indexName: 'LastCheckInIndex',
      partitionKey: {
        name: 'last_checkin_at',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const dynamoWriterLambda = new NodejsFunction(this, 'DynamoWriterFunction', {
      entry: 'src/lambdas/dynamodb-writer/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
      ...commonLambdaProps,
    });

    userCheckInsTable.grantWriteData(dynamoWriterLambda);

    const dynamoReaderLambda = new NodejsFunction(this, 'DynamoReaderFunction', {
      entry: 'src/lambdas/dynamodb-reader/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
      ...commonLambdaProps,
    });

    userCheckInsTable.grantReadData(dynamoReaderLambda);

    const bedrockLambda = new NodejsFunction(this, 'BedrockImageGeneratorFunction', {
      entry: 'src/lambdas/bedrock-image-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {},
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      ...commonLambdaProps,
    });

    bedrockLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    const slackMessagesQueue = new sqs.Queue(this, 'SlackMessagesQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(14),
    });

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

    const bedrockAgentLambda = new NodejsFunction(this, 'BedrockAgentFunction', {
      entry: 'src/lambdas/bedrock-agent/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        DYNAMODB_TABLE: userCheckInsTable.tableName,
        BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID || 'your-agent-id',
        BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID || 'your-agent-alias-id'
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      ...commonLambdaProps,
    });

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

    const slackSender = new NodejsFunction(this, 'SlackSenderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/lambdas/slack-sender/index.ts',
      handler: 'handler',
      environment: {
        SLACK_SECRET_ARN: slackTokens.secretArn,
      },
      ...commonLambdaProps,
    });

    const slackReceiver = new NodejsFunction(this, 'SlackReceiverFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: 'src/lambdas/slack-receiver/index.ts',
      handler: 'handler',
      environment: {
        SLACK_SECRET_ARN: slackTokens.secretArn,
        QUEUE_URL: slackMessagesQueue.queueUrl,
      },
      ...commonLambdaProps,
    });

    slackTokens.grantRead(slackSender);
    slackTokens.grantRead(slackReceiver);
    slackMessagesQueue.grantSendMessages(slackReceiver);
  }
}
