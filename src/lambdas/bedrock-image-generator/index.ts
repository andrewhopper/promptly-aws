import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface ImageGenerationEvent {
  prompt: string;
}

interface ImageGenerationResponse {
  statusCode: number;
  body: string;
}

const bedrockClient = new BedrockRuntimeClient({});

export const handler = async (event: ImageGenerationEvent): Promise<ImageGenerationResponse> => {
  try {
    const { prompt } = event;

    const command = new InvokeModelCommand({
      modelId: 'stability.stable-diffusion-xl-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        text_prompts: [{ text: prompt }],
        cfg_scale: 10,
        steps: 50,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Image generated successfully',
        imageData: responseBody.artifacts[0].base64,
      }),
    };
  } catch (error) {
    console.error('Error generating image with Bedrock:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to generate image',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
