import { Stack, App, CfnOutput, RemovalPolicy, CfnDeletionPolicy } from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CustomStackSynthesizer } from './custom-stack-synthesizer';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: any) {
    super(scope, id, {
      ...props,
      synthesizer: new CustomStackSynthesizer()
    });

    // Create S3 bucket with explicit ACL configuration
    const contentBucket = new CfnBucket(this, 'ContentBucket', {
      accessControl: 'Private',
      versioningConfiguration: {
        status: 'Enabled'
      },
      bucketEncryption: {
        serverSideEncryptionConfiguration: [{
          serverSideEncryptionByDefault: {
            sseAlgorithm: 'AES256'
          }
        }]
      },
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
      }
    });

    // Explicitly set bucket properties to prevent automatic configuration
    contentBucket.cfnOptions.deletionPolicy = CfnDeletionPolicy.RETAIN;
    contentBucket.cfnOptions.updateReplacePolicy = CfnDeletionPolicy.RETAIN;

    // Export bucket name for Lambda functions
    new CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.ref,
      exportName: 'ContentBucketName'
    });
  }

  /**
   * Override prepare method to prevent automatic resource creation
   */
  protected prepare() {
    // Do nothing to prevent automatic resource creation
    return;
  }

  /**
   * Override validate method to prevent automatic validation
   */
  protected validate() {
    // Do nothing to prevent automatic validation
    return;
  }
}
