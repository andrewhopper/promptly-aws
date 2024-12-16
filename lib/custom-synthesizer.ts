import * as cdk from 'aws-cdk-lib';

export class NoS3Synthesizer extends cdk.DefaultStackSynthesizer {
  constructor(props?: cdk.DefaultStackSynthesizerProps) {
    super({
      ...props,
      fileAssetsBucketName: 'NONE', // Disable S3 bucket creation
      bucketPrefix: '',
      qualifier: 'minimal',
    });
  }
}
