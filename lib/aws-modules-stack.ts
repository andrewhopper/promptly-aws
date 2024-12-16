import { Stack, App, CfnOutput, CfnResource } from 'aws-cdk-lib';

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
      synthesizer: undefined
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
        LoggingConfiguration: {
          DestinationBucketName: '',
          LogFilePrefix: ''
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
}
