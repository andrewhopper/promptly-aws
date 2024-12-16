#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

// Initialize app with minimal configuration
const app = new App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': true,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:defaultEncryption': false,
    '@aws-cdk/aws-s3:disableDefaultLogging': true,
    '@aws-cdk/aws-s3:disableAccessLogging': true,
    '@aws-cdk/aws-s3:disableServerAccessLogging': true,
    '@aws-cdk/aws-cloudwatch-logs:disableCloudWatchLogs': true,
    '@aws-cdk/core:target-partitions': ['aws'],
    '@aws-cdk/core:bootstrapQualifier': 'minimal'
  },
  analyticsReporting: false,
  treeMetadata: false
});

new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

app.synth();
