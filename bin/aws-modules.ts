import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
import { BedrockStack } from '../lib/bedrock-stack';

const app = new cdk.App();

// Deploy AWS Modules Stack
new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

// Deploy Bedrock Stack
new BedrockStack(app, 'BedrockStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

app.synth();
