#!/usr/bin/env node

// Set CDK environment variables before any imports
process.env.CDK_DISABLE_ASSET_STAGING = 'true';
process.env.CDK_NEW_BOOTSTRAP = '1';

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Initialize app with minimal configuration
const app = new cdk.App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': true,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/core:bootstrapQualifier': 'minimal'
  }
});

new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
