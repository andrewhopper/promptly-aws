#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack with custom synthesizer
new AwsModulesStack(app, 'AwsModulesStack', {
  env,
  terminationProtection: false,
  synthesizer: new cdk.DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
    fileAssetsBucketName: `cdk-${env.account}-${env.region}-assets`,
    bucketPrefix: '',
    dockerTagPrefix: '',
    qualifier: 'custom',
    cloudFormationExecutionRole: `arn:aws:iam::${env.account}:role/cdk-custom-cfn-exec-role`,
    deployRoleArn: `arn:aws:iam::${env.account}:role/cdk-custom-deploy-role`,
    fileAssetPublishingRoleArn: `arn:aws:iam::${env.account}:role/cdk-custom-asset-publishing-role`,
  }),
});

app.synth();
