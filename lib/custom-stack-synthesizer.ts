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
    // Prevent any asset staging or bucket creation
    const originalAddAsset = session.assembly.addAsset;
    const originalAddArtifact = session.assembly.addArtifact;
    const originalAddMissing = session.assembly.addMissing;

    // Override methods to prevent asset staging
    session.assembly.addAsset = () => ({ sourceHash: '', id: '' });
    session.assembly.addArtifact = () => {};
    session.assembly.addMissing = () => {};

    try {
      super.synthesize(session);
    } catch (err) {
      // Ignore bucket-related errors
      const error = err as Error;
      if (!error.message?.includes('bucket')) {
        throw err;
      }
    } finally {
      // Restore original methods
      session.assembly.addAsset = originalAddAsset;
      session.assembly.addArtifact = originalAddArtifact;
      session.assembly.addMissing = originalAddMissing;
    }
  }

  protected addBootstrapVersionRule(): void {
    // Do nothing to prevent bootstrap version rule creation
    return;
  }
}
