import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class BedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create IAM role for Bedrock access
    const bedrockRole = new iam.Role(this, 'BedrockAccessRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Role for accessing AWS Bedrock models',
    });

    // Enable third-party models
    const thirdPartyModels = [
      // Anthropic Models
      'anthropic.claude-v2',
      'anthropic.claude-v2:1',
      'anthropic.claude-instant-v1',
      // Cohere Models
      'cohere.command-text-v14',
      'cohere.command-light-text-v14',
      'cohere.embed-english-v3',
      'cohere.embed-multilingual-v3',
      // AI21 Labs Models
      'ai21.j2-mid-v1',
      'ai21.j2-ultra-v1',
      // Stability AI Models
      'stability.stable-diffusion-xl-v1',
      'stability.stable-diffusion-xl-v0',
    ];

    // Create model access policy
    const modelAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: thirdPartyModels.map(model =>
        `arn:aws:bedrock:${this.region}::foundation-model/${model}`
      ),
    });

    // Add policy to role
    bedrockRole.addToPolicy(modelAccessPolicy);

    // Add additional permissions for model management
    bedrockRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:GetFoundationModel',
          'bedrock:ListFoundationModels',
          'bedrock:ListCustomModels',
          'bedrock:ListModelCustomizationJobs',
        ],
        resources: ['*'],
      })
    );

    // Output the role ARN
    new cdk.CfnOutput(this, 'BedrockAccessRoleArn', {
      value: bedrockRole.roleArn,
      description: 'ARN of the IAM role for Bedrock access',
    });

    // Add tags
    cdk.Tags.of(this).add('Service', 'AWS Bedrock');
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
  }
}
