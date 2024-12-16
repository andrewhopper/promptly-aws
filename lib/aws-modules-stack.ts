import { Stack, App, CfnOutput, aws_s3 as s3, StackProps } from 'aws-cdk-lib';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';

interface AwsModulesStackProps extends StackProps {
  env?: {
    account?: string;
    region?: string;
  };
}

// Create a raw bucket construct that doesn't use high-level features
class RawBucket extends Construct {
  public readonly bucketName: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new s3.CfnBucket(this, 'Bucket', {
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

    this.bucketName = bucket.ref;
  }
}

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    // Create bucket using raw construct
    const bucket = new RawBucket(this, 'ContentBucket');

    // Add the output
    new CfnOutput(this, 'ContentBucketName', {
      value: bucket.bucketName,
      exportName: 'ContentBucketName'
    });
  }
}
