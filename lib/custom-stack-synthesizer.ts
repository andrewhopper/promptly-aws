import { DefaultStackSynthesizer, Stack, ISynthesisSession } from 'aws-cdk-lib';

export class CustomStackSynthesizer extends DefaultStackSynthesizer {
  constructor() {
    super({
      generateBootstrapVersionRule: false,
      // Use empty strings to prevent bucket creation
      fileAssetsBucketName: '',
      bucketPrefix: '',
      qualifier: 'minimal',
      cloudFormationExecutionRole: '',
      deployRoleArn: '',
      fileAssetPublishingRoleArn: '',
      imageAssetPublishingRoleArn: '',
      lookupRoleArn: ''
    });

    // Disable asset staging before any synthesis
    process.env.CDK_DISABLE_ASSET_STAGING = 'true';
    process.env.CDK_NO_ASSET_BUCKET = 'true';
    process.env.CDK_NO_STAGING = 'true';
  }

  public synthesize(session: ISynthesisSession): void {
    try {
      // Override asset staging methods
      const originalAddAsset = session.assembly.addAsset;
      session.assembly.addAsset = () => ({
        sourceHash: '',
        fileName: '',
        packaging: 'none',
        id: ''
      });

      super.synthesize(session);

      // Restore original method after synthesis
      session.assembly.addAsset = originalAddAsset;
    } catch (err: unknown) {
      // Only rethrow non-bucket related errors
      if (err instanceof Error && !err.message.includes('bucket')) {
        throw err;
      }
    }
  }

  protected addBootstrapVersionRule(): void {
    // Do nothing to prevent bootstrap version rule creation
    return;
  }
}
