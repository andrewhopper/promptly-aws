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
import * as chime from 'aws-cdk-lib/aws-chime';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Email Lambda
    const emailLambda = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      entry: 'src/lambdas/email-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        FROM_EMAIL: 'noreply@example.com', // Update with actual email
        TO_EMAIL: 'default@example.com', // Update with actual email
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
        TO_PHONE_NUMBER: '+1234567890', // Update with actual phone number
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

    // DynamoDB table for user check-ins
    const userCheckInsTable = new dynamodb.Table(this, 'UserCheckInsTable', {
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'last_checkin_at', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Slack Lambda functions
    const slackSenderLambda = new nodejs.NodejsFunction(this, 'SlackSenderFunction', {
      entry: 'src/lambdas/slack-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN || 'your-bot-token',
        SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET || 'your-signing-secret',
        SLACK_CHANNEL: 'check-ins'
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add Slack API permissions
    slackSenderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue'
      ],
      resources: ['*']
    }));

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

    // DynamoDB Reader Lambda
    const dynamoReaderLambda = new nodejs.NodejsFunction(this, 'DynamoReaderFunction', {
      entry: 'src/lambdas/dynamodb-reader/index.ts',
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

    // Add DynamoDB permissions for both lambdas
    const dynamoDbPolicy = new iam.PolicyStatement({
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Query',
        'dynamodb:Scan',
      ],
      resources: [userCheckInsTable.tableArn], // Updated with specific table ARN
    });

    dynamoWriterLambda.addToRolePolicy(dynamoDbPolicy);
    dynamoReaderLambda.addToRolePolicy(dynamoDbPolicy);

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
          expiration: Duration.days(30), // Expire access logs after 30 days
          prefix: 'access-logs/',
        }
      ],
    });

    // Bedrock Image Generator Lambda
    const bedrockLambda = new nodejs.NodejsFunction(this, 'BedrockImageGeneratorFunction', {
      entry: 'src/lambdas/bedrock-image-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        BUCKET_NAME: generatedImagesBucket.bucketName,
      },
      timeout: Duration.minutes(1),
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

    // Chime SDK Voice Lambda
    const chimeLambda = new nodejs.NodejsFunction(this, 'ChimeVoiceFunction', {
      entry: 'src/lambdas/chime-voice/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        REGION: this.region,
        VOCODE_API_KEY: process.env.VOCODE_API_KEY || 'your-vocode-api-key'
      },
      timeout: Duration.seconds(30),
      memorySize: 256,
    });

    // Create Voice Connector for PSTN calls
    const voiceConnector = new cdk.CfnResource(this, 'CheckInVoiceConnector', {
      type: 'AWS::Chime::VoiceConnector',
      properties: {
        name: 'CheckInVoiceConnector',
        region: this.region,
        termination: {
          callingRegions: ['US'],
          cidrAllowedList: ['0.0.0.0/0']
        }
      }
    });

    // Create phone number order for the voice connector
    const phoneNumberOrder = new cdk.CfnResource(this, 'CheckInPhoneNumberOrder', {
      type: 'AWS::Chime::PhoneNumberOrder',
      properties: {
        productType: 'VoiceConnector',
        phoneNumberType: 'Local',
        phoneAreaCode: '202', // Washington DC area code
        maxResults: 1
      }
    });

    // Associate phone number with voice connector
    const phoneNumberAssociation = new cdk.CfnResource(this, 'CheckInPhoneNumberAssociation', {
      type: 'AWS::Chime::PhoneNumberAssociation',
      properties: {
        voiceConnectorId: voiceConnector.ref,
        e164PhoneNumber: cdk.Fn.getAtt(phoneNumberOrder.logicalId, 'PhoneNumber')
      }
    });

    // Create SIP Media Application for voice calls
    const sipMediaApp = new cdk.CfnResource(this, 'CheckInSipMediaApp', {
      type: 'AWS::Chime::SipMediaApplication',
      properties: {
        name: 'CheckInVoiceApp',
        awsRegion: this.region,
        endpoints: [{
          lambdaArn: chimeLambda.functionArn
        }]
      }
    });

    // Update Lambda environment with Chime resources
    chimeLambda.addEnvironment('SIP_MEDIA_APP_ID', sipMediaApp.ref);
    chimeLambda.addEnvironment('VOICE_CONNECTOR_ID', voiceConnector.ref);
    chimeLambda.addEnvironment('FROM_PHONE_NUMBER', cdk.Token.asString(cdk.Fn.getAtt(phoneNumberOrder.logicalId, 'PhoneNumber')));

    // Add dependencies to ensure proper creation order
    sipMediaApp.node.addDependency(chimeLambda);
    voiceConnector.node.addDependency(sipMediaApp);
    phoneNumberOrder.node.addDependency(voiceConnector);
    phoneNumberAssociation.node.addDependency(phoneNumberOrder);

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
        'chime:CreateSipMediaApplicationCall',
        'chime:DeleteSipMediaApplicationCall',
        'chime:GetSipMediaApplicationCall',
        'chime:UpdateSipMediaApplicationCall',
        'chime:CreateVoiceConnector',
        'chime:DeleteVoiceConnector',
        'chime:GetVoiceConnector',
        'chime:UpdateVoiceConnector',
        'chime:AssociatePhoneNumbersWithVoiceConnector',
        'chime:DisassociatePhoneNumbersFromVoiceConnector',
        'chime:ListPhoneNumbersForVoiceConnector'
      ],
      resources: ['*'],
    }));

    // Grant Polly and Transcribe permissions
    chimeLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'polly:SynthesizeSpeech',
        'transcribe:StartStreamTranscription',
        'transcribe:StartStreamTranscriptionWebSocket'
      ],
      resources: ['*']
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

    // EventBridge Event Bus
    const checkInEventBus = new events.EventBus(this, 'CheckInEventBus', {
      eventBusName: 'user-check-in-bus'
    });

    // Grant permissions to publish events
    const eventBusPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [checkInEventBus.eventBusArn]
    });

    // Step Function for monitoring check-ins
    const timeCalculator = new lambda.Function(this, 'TimeCalculatorFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/lambdas/time-calculator'),
      timeout: Duration.seconds(30),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // Create Step Function
    const checkInMonitor = new sfn.StateMachine(this, 'CheckInMonitorStateMachine', {
      definition: sfn.Chain.start(new sfnTasks.DynamoGetItem(this, 'GetLastCheckIn', {
        table: userCheckInsTable,
        key: {
          'user_id': sfnTasks.DynamoAttributeValue.fromString(sfn.JsonPath.stringAt('$.userId'))
        },
        resultPath: '$.checkInData'
      }))
      .next(new sfnTasks.LambdaInvoke(this, 'CalculateElapsedTime', {
        lambdaFunction: timeCalculator,
        payload: sfn.TaskInput.fromObject({
          lastCheckIn: sfn.JsonPath.stringAt('$.checkInData.Item.last_checkin_at.S'),
          currentTime: sfn.JsonPath.stringAt('$$.State.EnteredTime')
        }),
        resultPath: '$.timeCalculation',
        resultSelector: {
          'status.$': '$.Payload.status',
          'elapsedTime.$': '$.Payload.elapsedTime',
          'metadata.$': '$.Payload.metadata'
        }
      }))
      .next(new sfn.Choice(this, 'CheckTimeForCheckin')
        .when(sfn.Condition.stringEquals('$.timeCalculation.status', 'TIME_FOR_CHECKIN'), new sfnTasks.EventBridgePutEvents(this, 'PublishCheckinEvent', {
          entries: [{
            detail: sfn.TaskInput.fromObject({
              type: 'TIME_FOR_CHECKIN',
              userId: sfn.JsonPath.stringAt('$.userId'),
              elapsedTime: sfn.JsonPath.stringAt('$.timeCalculation.elapsedTime'),
              message: sfn.JsonPath.stringAt('$.timeCalculation.metadata.message'),
              lastCheckIn: sfn.JsonPath.stringAt('$.timeCalculation.metadata.lastCheckInTime'),
              currentTime: sfn.JsonPath.stringAt('$.timeCalculation.metadata.currentTime'),
              thresholdSeconds: sfn.JsonPath.stringAt('$.timeCalculation.metadata.thresholdSeconds')
            }),
            detailType: 'TimeForCheckin',
            source: 'custom.checkin',
            eventBus: checkInEventBus
          }]
        }))
        .otherwise(new sfn.Succeed(this, 'Success'))),
      timeout: Duration.minutes(5),
      tracingEnabled: true,
    });

    // Grant permissions
    userCheckInsTable.grantReadData(checkInMonitor);
    timeCalculator.grantInvoke(checkInMonitor);
    checkInEventBus.grantPutEventsTo(checkInMonitor);

    // Schedule state machine execution
    new events.Rule(this, 'CheckInMonitorSchedule', {
      schedule: events.Schedule.rate(Duration.minutes(15)),
      targets: [new targets.SfnStateMachine(checkInMonitor, {
        input: events.RuleTargetInput.fromObject({
          userId: events.EventField.fromPath('$.detail.userId')
        })
      })]
    });

    // Event pattern for check-in monitoring
    const checkInPattern = {
      source: ['custom.checkin'],
      detailType: ['TimeForCheckin'],
      detail: {
        type: ['TIME_FOR_CHECKIN']
      }
    };

    // Rule for check-in notifications
    const checkInRule = new events.Rule(this, 'CheckInNotificationRule', {
      eventBus: checkInEventBus,
      eventPattern: checkInPattern,
      ruleName: 'check-in-notification-rule',
      description: 'Triggers notifications when check-in is required or received'
    });

    // Add EventBridge targets
    checkInRule.addTarget(new targets.LambdaFunction(emailLambda));
    checkInRule.addTarget(new targets.LambdaFunction(smsLambda));
    checkInRule.addTarget(new targets.LambdaFunction(dynamoWriterLambda));
    checkInRule.addTarget(new targets.LambdaFunction(slackSenderLambda));

    // Grant permissions to Lambda functions to be triggered by EventBridge
    emailLambda.addPermission('EventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: checkInRule.ruleArn
    });

    smsLambda.addPermission('EventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: checkInRule.ruleArn
    });

    dynamoWriterLambda.addPermission('EventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: checkInRule.ruleArn
    });

    slackSenderLambda.addPermission('EventBridgeInvoke', {
      principal: new iam.ServicePrincipal('events.amazonaws.com'),
      sourceArn: checkInRule.ruleArn
    });

    // Output EventBus ARN for reference
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: checkInEventBus.eventBusArn,
      description: 'ARN of the Check-in Event Bus'
    });
  }
}
