import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

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

  }
}
