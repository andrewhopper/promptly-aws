import { Stack, App, CfnOutput, StackProps } from 'aws-cdk-lib';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';
import { Construct } from 'constructs';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';

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

    // Use L1 construct directly without any high-level features
    const bucket = new CfnBucket(this, 'Bucket', {
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

// Base stack class that prevents automatic bucket creation
class NoAssetStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, {
      ...props,
      // Use minimal synthesizer configuration
      synthesizer: new CustomStackSynthesizer()
    });

    // Override methods that might create buckets
    const stack = this as any;
    stack.templateOptions = {
      ...stack.templateOptions,
      description: 'Stack with no automatic bucket creation',
      transforms: [],
      metadata: {}
    };
  }

  // Override asset methods
  protected allocateLogicalId(): string {
    return '';
  }
}

// Use NoAssetStack instead of Stack
export class AwsModulesStack extends NoAssetStack {
  constructor(scope: App, id: string, props?: AwsModulesStackProps) {
    super(scope, id, props);

    // Create bucket using raw construct
    const bucket = new RawBucket(this, 'ContentBucket');

    // Add the output
    new CfnOutput(this, 'ContentBucketName', {
      value: bucket.bucketName,
      exportName: 'ContentBucketName'
    });
  }
}
