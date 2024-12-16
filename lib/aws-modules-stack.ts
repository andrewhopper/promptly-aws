import { Stack, App, CfnOutput } from 'aws-cdk-lib';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnBucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';

export class AwsModulesStack extends Stack {
  constructor(scope: App, id: string, props?: any) {
    super(scope, id, {
      ...props,
      env: props?.env
    });

    // Create S3 bucket with explicit ACL configuration
    const contentBucket = new CfnBucket(this, 'ContentBucket', {
      accessControl: BucketAccessControl.PRIVATE,
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
      },
      loggingConfiguration: {
        destinationBucketName: '',
        logFilePrefix: ''
      }
    });

    // Export bucket name for Lambda functions
    new CfnOutput(this, 'ContentBucketName', {
      value: contentBucket.ref,
      exportName: 'ContentBucketName'
    });
  }
}
