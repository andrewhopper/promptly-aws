'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

interface VoiceChatProps {
  onCheckIn: (message: string) => void;
  onAgentResponse?: (speakFn: (text: string) => Promise<void>) => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ onCheckIn, onAgentResponse }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const pollyClient = useMemo(() => new PollyClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ''
    }
  }), []);

  const speakText = useCallback(async (text: string) => {
    try {
      const command = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
        Engine: 'neural'
      });

      const response = await pollyClient.send(command);
      if (response.AudioStream instanceof Uint8Array) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = response.AudioStream.buffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);
      }
    } catch (error) {
      console.error('Error synthesizing speech:', error);
    }
  }, [pollyClient]);

  useEffect(() => {
    if (onAgentResponse) {
      onAgentResponse(speakText);
    }
  }, [onAgentResponse, speakText]);

  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return null;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      const text = lastResult[0].transcript;
      setTranscript(text);

      if (lastResult.isFinal) {
        onCheckIn(text);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    return recognition;
  }, [onCheckIn]);

  useEffect(() => {
    const rec = initializeSpeechRecognition();
    if (rec) {
      setRecognition(rec);
    }
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [initializeSpeechRecognition, recognition]);

  const handleToggleRecording = async () => {
    if (!recognition) {
      console.error('Speech recognition not initialized');
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      try {
        await recognition.start();
        setIsRecording(true);
        await speakText('Voice recognition started. You can speak now.');
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <button
        onClick={handleToggleRecording}
        className={`px-4 py-2 rounded-full ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white font-semibold transition-colors`}
      >
        {isRecording ? 'Stop Recording' : 'Start Voice Chat'}
      </button>
      {transcript && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <p className="text-gray-700">{transcript}</p>
        </div>
      )}
    </div>
  );
};
