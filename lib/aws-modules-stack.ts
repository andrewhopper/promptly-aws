import { Stack, App, CfnOutput } from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';

interface AwsModulesStackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    // Create S3 bucket using CfnBucket (L1 construct)
    const cfnBucket = new CfnBucket(this, 'ContentBucket', {
      accessControl: 'Private',
      publicAccessBlockConfiguration: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      },
      ownershipControls: {
        rules: [{
          objectOwnership: 'BucketOwnerEnforced'
        }]
      },
      bucketEncryption: {
        serverSideEncryptionConfiguration: [{
          serverSideEncryptionByDefault: {
            sseAlgorithm: 'AES256'
          }
        }]
      },
      versioningConfiguration: {
        status: 'Enabled'
      }
    });

    // Add the output
    new CfnOutput(this, 'ContentBucketName', {
      value: cfnBucket.ref,
      exportName: 'ContentBucketName'
    });
  }
}
