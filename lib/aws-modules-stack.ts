import * as cdk from 'aws-cdk-lib';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

interface AwsModulesStackProps extends cdk.StackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    // Create content bucket directly using CDK's Bucket construct
    const contentBucket = new s3.Bucket(this, 'ContentBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    // Export bucket name
    new cdk.CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.bucketName,
      exportName: 'ContentBucketName'
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
