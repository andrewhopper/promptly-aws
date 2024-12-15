'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from 'react-chat-elements';
import type { IMessageListProps, MessageType, IMessage } from 'react-chat-elements/dist/type';
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
  status: 'waiting' | 'sent' | 'received' | 'read';
  focus?: boolean;
  forwarded?: boolean;
  replyButton?: boolean;
  removeButton?: boolean;
  notch?: boolean;
  retracted?: boolean;
  titleColor?: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

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

  const createMessage = (text: string, position: 'left' | 'right', status: ChatMessage['status']): ChatMessage => {
    return {
      position,
      type: 'text',
      title: position === 'left' ? 'Bedrock Agent' : 'You',
      text,
      date: new Date(),
      id: Date.now().toString(),
      status,
      focus: false,
      forwarded: false,
      replyButton: false,
      removeButton: false,
      notch: true,
      retracted: false,
      titleColor: position === 'left' ? '#4080ff' : '#40a9ff'
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
    const typingMessage = createMessage('Agent is typing...', 'left', 'waiting');
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
      setMessages(prev => prev.filter(msg => msg.status !== 'waiting'));

      // Add agent response
      const agentMessage = createMessage(data.response, 'left', 'received');
      addMessage(agentMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.status !== 'waiting'));

      // Add error message
      const errorMessage = createMessage(
        'Sorry, there was an error processing your message.',
        'left',
        'received'
      );
      addMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      <div className="p-4 bg-white dark:bg-gray-800 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">AWS Modules Chat</h1>
      </div>

      <div className="flex-grow overflow-auto p-4">
        <MessageList
          className="message-list"
          lockable={true}
          toBottomHeight={'100%'}
          dataSource={messages.map((msg): MessageType => ({
            type: 'text',
            position: msg.position,
            title: msg.title,
            text: msg.text,
            date: msg.date.getTime(),
            id: msg.id,
            status: msg.status,
            focus: msg.focus ?? false,
            forwarded: msg.forwarded ?? false,
            replyButton: msg.replyButton ?? false,
            removeButton: msg.removeButton ?? false,
            notch: msg.notch ?? true,
            retracted: msg.retracted ?? false,
            titleColor: msg.titleColor ?? (msg.position === 'left' ? '#4080ff' : '#40a9ff')
          }))}
          referance={messageListRef}
        />
        {error && (
          <div className="text-red-500 text-sm mt-2 px-4">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
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
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputText.trim()}
            className={`px-6 py-2 rounded-lg font-medium ${
              isLoading || !inputText.trim()
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                : 'bg-blue-500 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
