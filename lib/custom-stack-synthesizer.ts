import { DefaultStackSynthesizer, Stack, ISynthesisSession } from 'aws-cdk-lib';

export class CustomStackSynthesizer extends DefaultStackSynthesizer {
  constructor() {
    super({
      generateBootstrapVersionRule: false,
      fileAssetsBucketName: 'NONE',  // Use NONE to completely disable bucket creation
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
    try {
      // Attempt synthesis without asset staging
      super.synthesize(session);
    } catch (err) {
      // Ignore bucket-related errors during synthesis
      const error = err as Error;
      if (!error.message?.includes('bucket')) {
        throw err;
      }
    }
  }

  protected addBootstrapVersionRule(): void {
    // Do nothing to prevent bootstrap version rule creation
    return;
  }
}
