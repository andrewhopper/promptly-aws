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
    // Disable all asset staging and bucket creation
    process.env.CDK_DISABLE_ASSET_STAGING = 'true';
    process.env.CDK_DISABLE_VERSION_REPORTING = 'true';
    process.env.CDK_NEW_BOOTSTRAP = '1';
    process.env.CDK_DISABLE_STACK_TRACE = 'true';
    process.env.CDK_DISABLE_LOGGING = 'true';

    // Skip validation and asset staging
    session.validateOnSynth = false;
    session.skipValidation = true;

    super.synthesize(session);
  }

  protected addBootstrapVersionRule(): void {
    // Do nothing to prevent bootstrap version rule creation
    return;
  }
}
