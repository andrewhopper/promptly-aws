'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';
import { Amplify } from 'aws-amplify';

// Configure Amplify
Amplify.configure({
  API: {
    REST: {
      'BedrockAgent': {
        endpoint: process.env.NEXT_PUBLIC_API_ENDPOINT || '',
        region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'
      }
    }
  }
});

interface ChatMessage {
  position: 'left' | 'right';
  type: 'text';
  title: string;
  text: string;
  date: Date;
  id: string;
  status: 'sent' | 'received' | 'error' | 'pending';
  forwarded: boolean;
  replyButton: boolean;
  removeButton: boolean;
  retracted: boolean;
  className: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<any>(null);

  const scrollToBottom = () => {
    const chatContainer = document.querySelector('.message-list');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const createMessage = (text: string, position: 'left' | 'right', status: 'sent' | 'received' | 'error' | 'pending'): ChatMessage => {
    return {
      position,
      type: 'text',
      title: position === 'right' ? 'You' : 'Agent',
      text,
      date: new Date(),
      id: Date.now().toString(),
      status,
      forwarded: false,
      replyButton: false,
      removeButton: false,
      retracted: false,
      className: status === 'pending' ? 'message-pending' : '',
    };
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage = createMessage(inputText, 'right', 'sent');
    addMessage(userMessage);
    setInputText('');

    // Add typing indicator
    const typingMessage = createMessage('Agent is typing...', 'left', 'pending');
    addMessage(typingMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.status !== 'pending'));

      // Add agent response
      const agentMessage = createMessage(data.response, 'left', 'received');
      addMessage(agentMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.status !== 'pending'));

      // Add error message
      const errorMessage = createMessage(
        'Sorry, there was an error processing your message.',
        'left',
        'error'
      );
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="p-4 bg-white shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800">Chat with AI Agent</h1>
      </div>

      <div className="flex-grow overflow-auto p-4">
        <MessageList
          className="message-list"
          lockable={true}
          toBottomHeight={'100%'}
          dataSource={messages as any}
          referance={messageListRef}
        />
        {error && (
          <div className="text-red-500 text-sm mt-2 px-4">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Type your message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={isLoading}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputText.trim()}
            className={`px-6 py-2 rounded-lg font-medium ${
              isLoading || !inputText.trim()
                ? 'bg-gray-300 text-gray-500'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
