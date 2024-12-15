import { ChimeSDKVoiceClient, CreateSipMediaApplicationCommand } from '@aws-sdk/client-chime-sdk-voice';

const chimeClient = new ChimeSDKVoiceClient({});

export const handler = async (event: any) => {
  try {
    // Example: Create a SIP media application
    const createAppCommand = new CreateSipMediaApplicationCommand({
      Name: 'CheckInVoiceApp',
      Endpoints: [
        {
          LambdaArn: process.env.VOICE_HANDLER_LAMBDA_ARN,
        },
      ],
    });

    const response = await chimeClient.send(createAppCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully created Chime voice application',
        applicationId: response.SipMediaApplication?.SipMediaApplicationId,
      }),
    };
  } catch (error) {
    console.error('Error in Chime voice handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error creating Chime voice application',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
