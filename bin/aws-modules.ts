#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
import { NoS3Synthesizer } from '../lib/custom-synthesizer';

const app = new cdk.App({
  context: {
    '@aws-cdk/core:newStyleStackSynthesis': false,
    '@aws-cdk/core:bootstrapQualifier': 'minimal',
    '@aws-cdk/core:enableLegacyStackSynthesizer': false,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': false,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': false,
    '@aws-cdk/aws-s3:defaultEncryption': false,
    '@aws-cdk/aws-s3:disableDefaultLogging': true,
    '@aws-cdk/aws-s3:disableAccessLogging': true,
    '@aws-cdk/aws-s3:disableServerAccessLogging': true,
    '@aws-cdk/aws-cloudwatch-logs:disableCloudWatchLogs': true,
  }
});

new AwsModulesStack(app, 'AwsModulesStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' },
  synthesizer: new NoS3Synthesizer(),
});

app.synth();
