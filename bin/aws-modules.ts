import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
import { AmplifyStack } from '../lib/amplify-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1', // Set default region if not specified
};

// Create the main stack
new AwsModulesStack(app, 'AwsModulesStack', { env });

// Create the Amplify stack
new AmplifyStack(app, 'AmplifyStack', { env });

app.synth();
