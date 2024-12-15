import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as servicecatalog from 'aws-cdk-lib/aws-servicecatalog';
import { Construct } from 'constructs';
import { CfnParameter } from 'aws-cdk-lib';

export interface ControlTowerStackProps extends cdk.StackProps {
  managementAccountId: string;
  auditAccountEmail: string;
  logArchiveAccountEmail: string;
  region: string;
}

export class ControlTowerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ControlTowerStackProps) {
    super(scope, id, props);

    // Parameters for Control Tower configuration
    const rootEmail = new CfnParameter(this, 'RootEmail', {
      type: 'String',
      description: 'Email address for the root user of the AWS Organization',
    });

    const auditEmail = new CfnParameter(this, 'AuditEmail', {
      type: 'String',
      description: 'Email address for the audit account',
      default: props.auditAccountEmail,
    });

    const logArchiveEmail = new CfnParameter(this, 'LogArchiveEmail', {
      type: 'String',
      description: 'Email address for the log archive account',
      default: props.logArchiveAccountEmail,
    });

    // Create IAM role for Control Tower
    const controlTowerRole = new iam.Role(this, 'ControlTowerServiceRole', {
      assumedBy: new iam.ServicePrincipal('controltower.amazonaws.com'),
      description: 'Role used by AWS Control Tower to manage resources',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // Create organizational units
    const coreOu = new cdk.CfnResource(this, 'CoreOU', {
      type: 'AWS::Organizations::OrganizationalUnit',
      properties: {
        Name: 'Core',
        ParentId: cdk.Fn.ref('AWS::Organizations::Organization'),
      },
    });

    const securityOu = new cdk.CfnResource(this, 'SecurityOU', {
      type: 'AWS::Organizations::OrganizationalUnit',
      properties: {
        Name: 'Security',
        ParentId: cdk.Fn.ref('AWS::Organizations::Organization'),
      },
    });

    const workloadsOu = new cdk.CfnResource(this, 'WorkloadsOU', {
      type: 'AWS::Organizations::OrganizationalUnit',
      properties: {
        Name: 'Workloads',
        ParentId: cdk.Fn.ref('AWS::Organizations::Organization'),
      },
    });

    // Configure Account Factory
    const accountFactory = new servicecatalog.CfnPortfolio(this, 'AccountFactory', {
      displayName: 'AWS Control Tower Account Factory Portfolio',
      providerName: 'AWS Control Tower',
      description: 'Portfolio containing AWS Control Tower Account Factory products',
    });

    // Configure mandatory guardrails
    const guardrails = [
      {
        name: 'AWS-GR_IAM_ROLE_CHANGE_PROHIBITED',
        description: 'Disallow changes to IAM roles created by AWS Control Tower',
        complianceLevel: 'MANDATORY',
      },
      {
        name: 'AWS-GR_AUDIT_BUCKET_DELETION_PROHIBITED',
        description: 'Disallow deletion of audit bucket',
        complianceLevel: 'MANDATORY',
      },
      {
        name: 'AWS-GR_ENCRYPTED_VOLUMES',
        description: 'Require EBS volume encryption',
        complianceLevel: 'MANDATORY',
      },
    ];

    // Add tags
    cdk.Tags.of(this).add('Environment', 'Production');
    cdk.Tags.of(this).add('ManagedBy', 'AWS Control Tower');
    cdk.Tags.of(this).add('Owner', 'Cloud Operations');

    // Output important information
    new cdk.CfnOutput(this, 'ManagementAccountId', {
      value: props.managementAccountId,
      description: 'AWS Control Tower Management Account ID',
    });

    new cdk.CfnOutput(this, 'AuditAccountEmail', {
      value: auditEmail.valueAsString,
      description: 'AWS Control Tower Audit Account Email',
    });

    new cdk.CfnOutput(this, 'LogArchiveAccountEmail', {
      value: logArchiveEmail.valueAsString,
      description: 'AWS Control Tower Log Archive Account Email',
    });
  }
}
