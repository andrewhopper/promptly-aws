#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
// Temporarily comment out Amplify stack to isolate the issue
// import { AmplifyStack } from '../lib/amplify-stack';

const app = new cdk.App({
  context: {
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-lambda:createLogGroup': false,
    '@aws-cdk/aws-lambda:enableFunctionUrlInStackSynthesis': false,
  }
});

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack with minimal configuration
new AwsModulesStack(app, 'AwsModulesStack', {
  env,
  terminationProtection: false,
});

// Temporarily comment out Amplify stack
// new AmplifyStack(app, 'aws-modules-amplify', { env });

app.synth();
