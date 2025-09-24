import React, { useState, useEffect } from 'react';
import { ArrowLeft, Phone, User, MoreVertical } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { formatMaldivesTime, formatMaldivesDate } from '../utils/timeUtils';
import { api } from '../lib/api';

interface Message {
  id: string;
  messageType: 'SMS' | 'INSTANT';
  direction: 'FROM' | 'TO' | 'UNKNOWN';
  content: string | null;
  timestamp: string;
  sender?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    type: 'INDIVIDUAL' | 'GROUP';
  };
  receiver?: {
    id: string;
    name: string | null;
    phoneNumber: string;
    type: 'INDIVIDUAL' | 'GROUP';
  };
}

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  type: 'INDIVIDUAL' | 'GROUP';
}

interface ChatResponse {
  messages: Message[];
  contact: Contact;
  total: number;
}

const ChatLogPage: React.FC = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contactId) {
      fetchChatLog(contactId);
    }
  }, [contactId]);

  const fetchChatLog = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/chat/${id}`);
      setMessages(response.data.messages);
      setContact(response.data.contact);
    } catch (e: any) {
      setError(`Failed to fetch chat log: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return formatMaldivesTime(timestamp);
  };

  const formatDate = (timestamp: string) => {
    return formatMaldivesDate(timestamp);
  };

  const getMessageAlignment = (message: Message) => {
    if (message.direction === 'FROM') {
      return 'justify-start'; // Received messages on the left
    } else {
      return 'justify-end'; // Sent messages on the right
    }
  };

  const getMessageBubbleStyle = (message: Message) => {
    if (message.direction === 'FROM') {
      return 'bg-gray-200 text-gray-900'; // Received messages
    } else {
      return 'bg-blue-500 text-white'; // Sent messages
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">💬</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact not found</h2>
          <p className="text-gray-600">The requested contact could not be found.</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {contact.name || contact.phoneNumber}
              </h1>
              <p className="text-sm text-gray-500 truncate">
                {contact.phoneNumber}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="max-w-md mx-auto pb-20">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">💬</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages</h3>
            <p className="text-gray-500">Start a conversation with this contact.</p>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {Object.entries(messageGroups).map(([date, dayMessages]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="text-center mb-4">
                  <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                    {formatDate(dayMessages[0].timestamp)}
                  </span>
                </div>
                
                {/* Messages for this date */}
                <div className="space-y-2">
                  {dayMessages.map((message, index) => (
                    <div key={message.id} className={`flex ${getMessageAlignment(message)}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${getMessageBubbleStyle(message)}`}>
                        {message.content && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                        <div className={`text-xs mt-1 ${
                          message.direction === 'FROM' ? 'text-gray-500' : 'text-blue-100'
                        }`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom spacing for mobile */}
      <div className="h-20"></div>
    </div>
  );
};

export default ChatLogPage;
