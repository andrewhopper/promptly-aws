import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

interface ImageGenerationEvent {
  prompt: string;
  bucketName: string;
}

const bedrockClient = new BedrockRuntimeClient({});
const s3Client = new S3Client({});

export const handler = async (event: ImageGenerationEvent) => {
  try {
    const { prompt, bucketName } = event;
    const imageId = uuidv4();

    const modelParams = {
      modelId: 'stability.stable-diffusion-xl',
      input: {
        text_prompts: [{ text: prompt }],
        cfg_scale: 10,
        steps: 50,
      }
    };

    const command = new InvokeModelCommand({
      modelId: modelParams.modelId,
      body: JSON.stringify(modelParams.input)
    });

    const response = await bedrockClient.send(command);
    const imageData = JSON.parse(new TextDecoder().decode(response.body)).artifacts[0].base64;
    const imageBuffer = Buffer.from(imageData, 'base64');

    // Upload to S3
    const s3Key = `generated-images/${imageId}.png`;
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/png'
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Image generated and stored successfully',
        imageId,
        s3Location: `s3://${bucketName}/${s3Key}`
      })
    };
  } catch (error) {
    console.error('Error generating image:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to generate image', error })
    };
  }
};
