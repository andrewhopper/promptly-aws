import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class AwsModulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Email Lambda
    const emailLambda = new nodejs.NodejsFunction(this, 'EmailSenderFunction', {
      entry: 'src/lambdas/email-sender/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
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

    // DynamoDB Writer Lambda
    const dynamoWriterLambda = new nodejs.NodejsFunction(this, 'DynamoWriterFunction', {
      entry: 'src/lambdas/dynamodb-writer/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
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
      bundling: {
        minify: true,
        sourceMap: true,
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
      resources: ['*'], // Will be updated with specific table ARN
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
      bundling: {
        minify: true,
        sourceMap: true,
      },
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

    // Chime SDK Voice Lambda
    const chimeLambda = new nodejs.NodejsFunction(this, 'ChimeVoiceFunction', {
      entry: 'src/lambdas/chime-voice/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
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
    });

    // Enable Performance Insights
    const cfnDBInstance = rdsInstance.node.defaultChild as rds.CfnDBInstance;
    cfnDBInstance.enablePerformanceInsights = true;
    cfnDBInstance.performanceInsightsRetentionPeriod = 7; // 7 days retention
  }
}
