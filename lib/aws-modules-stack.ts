import { Stack, App, CfnOutput, CfnResource, IResolvable } from 'aws-cdk-lib';
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

    // Create S3 bucket using direct CloudFormation template
    const cfnBucket = new CfnResource(this, 'ContentBucket', {
      type: 'AWS::S3::Bucket',
      properties: {
        AccessControl: 'Private',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        },
        OwnershipControls: {
          Rules: [{
            ObjectOwnership: 'BucketOwnerEnforced'
          }]
        },
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [{
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }]
        },
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }
    });

    // Export bucket name
    new CfnOutput(this, 'ContentBucketName', {
      value: cfnBucket.ref,
      exportName: 'ContentBucketName'
    });
  }

  // Override bind method to prevent implicit bucket creation
  public bind(): IResolvable {
    return {
      creationStack: [],
      resolve: () => ({
        s3Bucket: undefined,
        s3ObjectKey: undefined,
        assetHash: 'NONE',
        bucketName: 'NONE',
        objectKey: 'NONE',
        packaging: 'none',
        sourceHash: 'NONE'
      })
    };
  }
}
