import { Handler } from 'aws-lambda';
import { ChimeSDKVoiceClient, CreateSipMediaApplicationCallCommand } from '@aws-sdk/client-chime-sdk-voice';
import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine } from '@aws-sdk/client-polly';
import { Readable } from 'stream';

interface VoiceCallEvent {
  phoneNumber: string;
  message?: string;
}

const chimeClient = new ChimeSDKVoiceClient({ region: process.env.REGION });
const pollyClient = new PollyClient({ region: process.env.REGION });

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const synthesizeSpeech = async (text: string): Promise<Buffer> => {
  const command = new SynthesizeSpeechCommand({
    Text: text,
    OutputFormat: 'mp3',
    VoiceId: VoiceId.Joanna,
    Engine: Engine.NEURAL
  });

  try {
    const response = await pollyClient.send(command);
    if (!response.AudioStream) {
      throw new Error('No audio stream returned from Polly');
    }

    return await streamToBuffer(response.AudioStream as unknown as Readable);
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw error;
  }
};

export const handler: Handler<VoiceCallEvent> = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!process.env.FROM_PHONE_NUMBER || !process.env.SIP_MEDIA_APP_ID || !process.env.VOICE_CONNECTOR_ID) {
    throw new Error('Required environment variables are not set');
  }

  try {
    const { phoneNumber, message = 'Hello, this is your check-in reminder.' } = event;

    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    const audioBuffer = await synthesizeSpeech(message);
    const audioBase64 = audioBuffer.toString('base64');

    const callCommand = new CreateSipMediaApplicationCallCommand({
      FromPhoneNumber: process.env.FROM_PHONE_NUMBER,
      ToPhoneNumber: phoneNumber,
      SipMediaApplicationId: process.env.SIP_MEDIA_APP_ID,
      ArgumentsMap: {
        AudioData: audioBase64,
        VoiceConnectorId: process.env.VOICE_CONNECTOR_ID
      }
    });

    const response = await chimeClient.send(callCommand);
    console.log('Call initiated:', JSON.stringify(response, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Call initiated successfully',
        callId: response.SipMediaApplicationCall?.TransactionId,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error initiating call:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error initiating call',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      })
    };
  }
};
