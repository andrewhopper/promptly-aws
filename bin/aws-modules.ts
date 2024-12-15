import * as cdk from 'aws-cdk-lib';
import { AwsModulesStack } from '../lib/aws-modules-stack';
import { ControlTowerStack } from '../lib/control-tower-stack';

const app = new cdk.App();

// Deploy AWS Modules Stack
new AwsModulesStack(app, 'AwsModulesStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

// Deploy Control Tower Stack
new ControlTowerStack(app, 'ControlTowerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  managementAccountId: process.env.CDK_DEFAULT_ACCOUNT || '',
  auditAccountEmail: process.env.AUDIT_ACCOUNT_EMAIL || '',
  logArchiveAccountEmail: process.env.LOG_ARCHIVE_EMAIL || '',
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
});

app.synth();
