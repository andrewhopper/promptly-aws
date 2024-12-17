import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

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

    // DynamoDB table for user check-ins
    const userCheckInsTable = new dynamodb.Table(this, 'UserCheckInsTable', {
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'last_checkin_at', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Email Lambda
    const emailLambda = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      entry: 'src/lambdas/email-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@example.com',
        TO_EMAIL: process.env.TO_EMAIL || 'default@example.com',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add SES permissions
    emailLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // SMS Lambda
    const smsLambda = new nodejs.NodejsFunction(this, 'SmsSenderFunction', {
      entry: 'src/lambdas/sms-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TO_PHONE_NUMBER: process.env.TO_PHONE_NUMBER || '+1234567890',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add SNS permissions
    smsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'],
    }));

    // Slack Lambda
    const slackSenderLambda = new nodejs.NodejsFunction(this, 'SlackSenderFunction', {
      entry: 'src/lambdas/slack-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        SLACK_SECRET_ARN: process.env.SLACK_SECRET_ARN || '',
        QUEUE_URL: process.env.SLACK_QUEUE_URL || '',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add Slack API permissions
    slackSenderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
    }));

    // DynamoDB Writer Lambda
    const dynamoWriterLambda = new nodejs.NodejsFunction(this, 'DynamoWriterFunction', {
      entry: 'src/lambdas/dynamodb-writer/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // DynamoDB Reader Lambda
    const dynamoReaderLambda = new nodejs.NodejsFunction(this, 'DynamoReaderFunction', {
      entry: 'src/lambdas/dynamodb-reader/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: userCheckInsTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add DynamoDB permissions
    const dynamoDbPolicy = new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [userCheckInsTable.tableArn],
    });

    dynamoWriterLambda.addToRolePolicy(dynamoDbPolicy);
    dynamoReaderLambda.addToRolePolicy(dynamoDbPolicy);

    // Create S3 bucket for generated images
    const generatedImagesBucket = new s3.Bucket(this, 'GeneratedImagesBucket', {
      bucketName: `${this.account}-${this.region}-generated-images`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
    });

    // Step Function for check-in monitoring
    const getLastCheckIn = new sfnTasks.DynamoGetItem(this, 'GetLastCheckIn', {
      table: userCheckInsTable,
      key: {
        user_id: sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.userId')),
      },
    });

    // Add Chime SDK Voice permissions
    chimeLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'chime:CreateSipMediaApplication',
        'chime:DeleteSipMediaApplication',
        'chime:GetSipMediaApplication',
        'chime:UpdateSipMediaApplication',
        'chime:CreateSipRule',
        'chime:DeleteSipRule',
        'chime:UpdateSipRule',
      ],
      resources: ['*'],
    }));

    // Create VPC for RDS
    const vpc = new ec2.Vpc(this, 'DevVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        }
      ],
    });

    // Create security group for RDS
    const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
      vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: true,
    });

    // Create security group for bastion host
    const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc,
      description: 'Security group for bastion host',
      allowAllOutbound: true,
    });

    // Allow SSH access to bastion from anywhere (you may want to restrict this in production)
    bastionSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access from anywhere'
    );

    // Allow bastion to access RDS
    rdsSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(bastionSecurityGroup.securityGroupId),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from bastion host'
    );

    // Create key pair for bastion host
    const bastionKeyPair = new ec2.CfnKeyPair(this, 'BastionKeyPair', {
      keyName: 'bastion-key-pair',
    });

    // Create bastion host
    const bastionHost = new ec2.Instance(this, 'BastionHost', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: bastionSecurityGroup,
      keyName: bastionKeyPair.keyName,
    });

    // Create monitoring role for RDS enhanced monitoring
    const monitoringRole = new iam.Role(this, 'RDSMonitoringRole', {
      assumedBy: new iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSEnhancedMonitoringRole'),
      ],
    });

    // Create RDS instance
    const rdsInstance = new rds.DatabaseInstance(this, 'DevPostgresDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      securityGroups: [rdsSecurityGroup],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      deletionProtection: false, // For development only
      databaseName: 'devdb',
      credentials: rds.Credentials.fromGeneratedSecret('postgresAdmin'),
      parameterGroup: new rds.ParameterGroup(this, 'DevPostgresParams', {
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_15,
        }),
        parameters: {
          'shared_preload_libraries': 'pg_vector',
          'max_connections': '100',
        },
      }),
      monitoringInterval: cdk.Duration.seconds(60), // Enable detailed monitoring
      monitoringRole: monitoringRole, // Use the created IAM role
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // 7 days
      cloudwatchLogsExports: ['postgresql', 'upgrade'], // Enable CloudWatch logging
    });

    // Add outputs for connection information
    new cdk.CfnOutput(this, 'BastionHostId', {
      value: bastionHost.instanceId,
      description: 'Bastion Host Instance ID',
    });

    new cdk.CfnOutput(this, 'BastionPublicDNS', {
      value: bastionHost.instancePublicDnsName,
      description: 'Bastion Host Public DNS',
    });

    new cdk.CfnOutput(this, 'RDSEndpoint', {
      value: rdsInstance.instanceEndpoint.hostname,
      description: 'RDS Instance Endpoint',
    });

    new cdk.CfnOutput(this, 'RDSPort', {
      value: rdsInstance.instanceEndpoint.port.toString(),
      description: 'RDS Instance Port',
    });

    new cdk.CfnOutput(this, 'BastionKeyPairName', {
      value: bastionKeyPair.keyName,
      description: 'Name of the key pair for SSH access to bastion host',
    });

    slackSecret.grantRead(slackSender);
    slackSecret.grantRead(slackReceiverLambda);
    slackMessagesQueue.grantSendMessages(slackReceiverLambda);
    slackMessagesQueue.grantConsumeMessages(slackSender);

    const calculateTimeSinceLastCheckIn = new sfnTasks.LambdaInvoke(this, 'CalculateTime', {
      lambdaFunction: dynamoReaderLambda,
      payload: sfn.TaskInput.fromObject({
        userId: sfn.JsonPath.stringAt('$.userId'),
        lastCheckIn: sfn.JsonPath.stringAt('$.Item.last_checkin_at.S'),
      }),
    });

    const sendNotifications = new sfn.Parallel(this, 'SendNotifications');

    const emailNotification = new sfnTasks.LambdaInvoke(this, 'SendEmail', {
      lambdaFunction: emailLambda,
      resultPath: '$.emailResult',
    });

    const smsNotification = new sfnTasks.LambdaInvoke(this, 'SendSMS', {
      lambdaFunction: smsLambda,
      resultPath: '$.smsResult',
    });

    const slackNotification = new sfnTasks.LambdaInvoke(this, 'SendSlack', {
      lambdaFunction: slackSenderLambda,
      resultPath: '$.slackResult',
    });

    sendNotifications.branch(emailNotification, smsNotification, slackNotification);

    const checkInMonitoringStateMachine = new sfn.StateMachine(this, 'CheckInMonitoring', {
      definition: getLastCheckIn
        .next(calculateTimeSinceLastCheckIn)
        .next(new sfn.Choice(this, 'CheckTimeElapsed')
          .when(sfn.Condition.stringEquals('$.status', 'TIME_FOR_CHECKIN'), sendNotifications)
          .otherwise(new sfn.Succeed(this, 'NoActionNeeded'))
        ),
      timeout: Duration.minutes(5),
    });

    // EventBridge rule to trigger check-in monitoring
    new events.Rule(this, 'CheckInMonitoringRule', {
      schedule: events.Schedule.rate(Duration.minutes(15)),
      targets: [new targets.SfnStateMachine(checkInMonitoringStateMachine)],
    });
  }
}
