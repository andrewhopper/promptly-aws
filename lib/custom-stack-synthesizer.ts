import { DefaultStackSynthesizer, Stack, ISynthesisSession } from 'aws-cdk-lib';

export class CustomStackSynthesizer extends DefaultStackSynthesizer {
  constructor() {
    super({
      generateBootstrapVersionRule: false,
      fileAssetsBucketName: 'NONE',
      bucketPrefix: '',
      qualifier: 'minimal',
      cloudFormationExecutionRole: 'NONE',
      deployRoleArn: 'NONE',
      fileAssetPublishingRoleArn: 'NONE',
      imageAssetPublishingRoleArn: 'NONE',
      lookupRoleArn: 'NONE'
    });
  }

  public synthesize(session: ISynthesisSession): void {
    // Disable asset staging completely
    process.env.CDK_DISABLE_ASSET_STAGING = 'true';
    process.env.CDK_DISABLE_VERSION_REPORTING = 'true';

    super.synthesize(session);
  }
}
