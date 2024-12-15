import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as identitystore from 'aws-cdk-lib/aws-identitystore';
import * as sso from 'aws-cdk-lib/aws-sso';
import { Construct } from 'constructs';
import { Token } from 'aws-cdk-lib';

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

    // Bedrock Image Generator Lambda
    const bedrockLambda = new nodejs.NodejsFunction(this, 'BedrockImageGeneratorFunction', {
      entry: 'src/lambdas/bedrock-image-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Add Bedrock permissions
    bedrockLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
      ],
      resources: ['*'],
    }));

    // Add S3 permissions for Bedrock Lambda
    bedrockLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject',
      ],
      resources: ['*'], // Will be updated with specific bucket ARN
    }));

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
        DYNAMODB_TABLE: 'UserCheckInsTable', // Update with actual table name
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

    // Bedrock Chat Lambda
    const bedrockChatLambda = new nodejs.NodejsFunction(this, 'BedrockChatFunction', {
      entry: 'src/lambdas/bedrock-chat/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        CHECKINS_TABLE_NAME: 'UserCheckInsTable',
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });

    // Add permissions for Bedrock Chat Lambda
    bedrockChatLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'dynamodb:PutItem',
      ],
      resources: ['*']
    }));

    // Content Generator Lambda
    const contentGeneratorLambda = new nodejs.NodejsFunction(this, 'ContentGeneratorFunction', {
      entry: 'src/lambdas/content-generator/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        CONTENT_BUCKET: contentBucket.bucketName
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
    });

    // Add Bedrock permissions for content generation
    contentGeneratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: ['*']
    }));

    // Add S3 permissions for image storage
    contentGeneratorLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject'
      ],
      resources: [
        `${contentBucket.bucketArn}/*`
      ]
    }));

    // Grant DynamoDB permissions
    dynamoWriterLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:PutItem',
      ],
      resources: ['*'], // Will be updated with specific table ARN
    }));

    // Voice Check-in Lambda
    const voiceCheckInLambda = new nodejs.NodejsFunction(this, 'VoiceCheckInFunction', {
      entry: 'src/lambdas/voice-check-in/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        BEDROCK_AGENT_ID: process.env.BEDROCK_AGENT_ID || '',
        BEDROCK_AGENT_ALIAS_ID: process.env.BEDROCK_AGENT_ALIAS_ID || '',
        SIP_MEDIA_APP_ID: process.env.SIP_MEDIA_APP_ID || '',
        DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || '',
        CONTENT_GENERATOR_FUNCTION_NAME: contentGeneratorLambda.functionName
      },
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
    });

    // Add permissions for voice check-in Lambda
    voiceCheckInLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'chime:CreateSipMediaApplicationCall',
        'chime:StartSipMediaApplicationCall',
        'chime:UpdateSipMediaApplicationCall',
        'transcribe:StartStreamTranscription',
        'bedrock:InvokeAgent',
        'polly:SynthesizeSpeech',
        'dynamodb:PutItem',
        'lambda:InvokeFunction'
      ],
      resources: ['*']
    }));

    // Set up AWS IAM Identity Center infrastructure
    const identityStoreId = new cdk.CfnParameter(this, 'IdentityStoreId', {
      type: 'String',
      description: 'The ID of the AWS IAM Identity Center store',
    });

    // Create base roles that will be assigned to groups
    const adminRole = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.ServicePrincipal('identitystore.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
      ],
      description: 'Admin role for Identity Center groups',
    });

    const powerUserRole = new iam.Role(this, 'PowerUserRole', {
      assumedBy: new iam.ServicePrincipal('identitystore.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess')
      ],
      description: 'Power User role for Identity Center groups',
    });

    const developerRole = new iam.Role(this, 'DeveloperRole', {
      assumedBy: new iam.ServicePrincipal('identitystore.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeBuildDeveloperAccess')
      ],
      inlinePolicies: {
        'DeveloperCustomPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'lambda:InvokeFunction',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
      description: 'Developer role for Identity Center groups',
    });

    // Create modifiable group configurations
    const adminGroupConfig = new cdk.CfnParameter(this, 'AdminGroupConfig', {
      type: 'String',
      description: 'Configuration for Admin group (JSON format: {"groupName": "string", "description": "string"})',
      default: JSON.stringify({
        groupName: 'Administrators',
        description: 'Administrative users with full access'
      })
    });

    const powerUserGroupConfig = new cdk.CfnParameter(this, 'PowerUserGroupConfig', {
      type: 'String',
      description: 'Configuration for Power User group (JSON format: {"groupName": "string", "description": "string"})',
      default: JSON.stringify({
        groupName: 'PowerUsers',
        description: 'Power users with elevated access'
      })
    });

    const developerGroupConfig = new cdk.CfnParameter(this, 'DeveloperGroupConfig', {
      type: 'String',
      description: 'Configuration for Developer group (JSON format: {"groupName": "string", "description": "string"})',
      default: JSON.stringify({
        groupName: 'Developers',
        description: 'Developers with limited access'
      })
    });

    // Create Identity Center Groups with parsed configurations
    const parseConfig = (config: string) => {
      try {
        return JSON.parse(config);
      } catch (e) {
        return JSON.parse(config.toString());
      }
    };

    const adminGroupConfigParsed = parseConfig(adminGroupConfig.valueAsString);
    const powerUserGroupConfigParsed = parseConfig(powerUserGroupConfig.valueAsString);
    const developerGroupConfigParsed = parseConfig(developerGroupConfig.valueAsString);

    const adminGroup = new identitystore.CfnGroup(this, 'AdminGroup', {
      identityStoreId: identityStoreId.valueAsString,
      description: adminGroupConfigParsed.description,
      displayName: adminGroupConfigParsed.groupName,
    });

    const powerUserGroup = new identitystore.CfnGroup(this, 'PowerUserGroup', {
      identityStoreId: identityStoreId.valueAsString,
      description: powerUserGroupConfigParsed.description,
      displayName: powerUserGroupConfigParsed.groupName,
    });

    const developerGroup = new identitystore.CfnGroup(this, 'DeveloperGroup', {
      identityStoreId: identityStoreId.valueAsString,
      description: developerGroupConfigParsed.description,
      displayName: developerGroupConfigParsed.groupName,
    });

    // Create SSO Instance ARN parameter
    const ssoInstanceArn = new cdk.CfnParameter(this, 'SSOInstanceArn', {
      type: 'String',
      description: 'The ARN of the AWS SSO instance',
    });

    // Create Permission Sets for each role
    const adminPermissionSet = new sso.CfnPermissionSet(this, 'AdminPermissionSet', {
      instanceArn: ssoInstanceArn.valueAsString,
      name: 'AdminPermissionSet',
      description: 'Permission set for administrators',
      sessionDuration: 'PT8H',
      managedPolicies: ['arn:aws:iam::aws:policy/AdministratorAccess'],
    });

    const powerUserPermissionSet = new sso.CfnPermissionSet(this, 'PowerUserPermissionSet', {
      instanceArn: ssoInstanceArn.valueAsString,
      name: 'PowerUserPermissionSet',
      description: 'Permission set for power users',
      sessionDuration: 'PT8H',
      managedPolicies: ['arn:aws:iam::aws:policy/PowerUserAccess'],
    });

    const developerPermissionSet = new sso.CfnPermissionSet(this, 'DeveloperPermissionSet', {
      instanceArn: ssoInstanceArn.valueAsString,
      name: 'DeveloperPermissionSet',
      description: 'Permission set for developers',
      sessionDuration: 'PT8H',
      managedPolicies: ['arn:aws:iam::aws:policy/AWSCodeBuildDeveloperAccess'],
      inlinePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:PutObject',
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:Query',
              'dynamodb:Scan',
              'lambda:InvokeFunction',
            ],
            Resource: '*',
          },
        ],
      }),
    });

    // Create Assignment Parameters for each group
    const accountId = new cdk.CfnParameter(this, 'AccountId', {
      type: 'String',
      description: 'The AWS account ID where the assignments will be made',
    });

    // Create assignments between groups and permission sets
    new sso.CfnAssignment(this, 'AdminAssignment', {
      instanceArn: ssoInstanceArn.valueAsString,
      permissionSetArn: adminPermissionSet.attrPermissionSetArn,
      principalId: adminGroup.attrGroupId,
      principalType: 'GROUP',
      targetId: accountId.valueAsString,
      targetType: 'AWS_ACCOUNT',
    });

    new sso.CfnAssignment(this, 'PowerUserAssignment', {
      instanceArn: ssoInstanceArn.valueAsString,
      permissionSetArn: powerUserPermissionSet.attrPermissionSetArn,
      principalId: powerUserGroup.attrGroupId,
      principalType: 'GROUP',
      targetId: accountId.valueAsString,
      targetType: 'AWS_ACCOUNT',
    });

    new sso.CfnAssignment(this, 'DeveloperAssignment', {
      instanceArn: ssoInstanceArn.valueAsString,
      permissionSetArn: developerPermissionSet.attrPermissionSetArn,
      principalId: developerGroup.attrGroupId,
      principalType: 'GROUP',
      targetId: accountId.valueAsString,
      targetType: 'AWS_ACCOUNT',
    });
  }
}
