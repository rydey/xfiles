import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, Save, Edit3, User, Phone } from 'lucide-react';
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

interface MessageInstance {
  targetMessage: Message;
  contextMessages: Message[];
  timestamp: string;
}

interface MessageContext {
  messageInstances: MessageInstance[];
  total: number;
}

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  type: 'INDIVIDUAL' | 'GROUP';
}

const MessageCorrectionPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInstances, setMessageInstances] = useState<MessageInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [editSenderId, setEditSenderId] = useState<string>('');
  const [editReceiverId, setEditReceiverId] = useState<string>('');
  const [editDirection, setEditDirection] = useState<'FROM' | 'TO' | 'UNKNOWN'>('UNKNOWN');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  // Available contacts for dropdown
  const [contacts, setContacts] = useState<Contact[]>([]);
  
  // Search states for dropdowns
  const [senderSearchTerm, setSenderSearchTerm] = useState('');
  const [receiverSearchTerm, setReceiverSearchTerm] = useState('');
  const [showSenderDropdown, setShowSenderDropdown] = useState(false);
  const [showReceiverDropdown, setShowReceiverDropdown] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowSenderDropdown(false);
        setShowReceiverDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await api.get('/contacts/public');
      setContacts(response.data.contacts);
    } catch (e: any) {
      console.error('Error fetching contacts:', e);
      setError('Failed to load contacts. Please refresh the page.');
    }
  };

  // Filter contacts based on search term
  const getFilteredContacts = (searchTerm: string) => {
    if (!contacts || !Array.isArray(contacts)) return [];
    if (!searchTerm.trim()) return contacts;
    
    return contacts.filter(contact => 
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phoneNumber.includes(searchTerm)
    );
  };

  // Get contact display name
  const getContactDisplayName = (contact: Contact) => {
    return contact.name || contact.phoneNumber;
  };

  // Handle sender selection
  const handleSenderSelect = (contact: Contact) => {
    setEditSenderId(contact.id);
    setSenderSearchTerm(getContactDisplayName(contact));
    setShowSenderDropdown(false);
  };

  // Handle receiver selection
  const handleReceiverSelect = (contact: Contact) => {
    setEditReceiverId(contact.id);
    setReceiverSearchTerm(getContactDisplayName(contact));
    setShowReceiverDropdown(false);
  };

  // Get selected contact info
  const getSelectedSender = () => {
    return contacts.find(c => c.id === editSenderId);
  };

  const getSelectedReceiver = () => {
    return contacts.find(c => c.id === editReceiverId);
  };

  // Start editing a specific message
  const startEditingMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditSenderId(message.sender?.id || '');
    setEditReceiverId(message.receiver?.id || '');
    setEditDirection(message.direction);
    
    // Initialize search terms with current values
    setSenderSearchTerm(message.sender ? getContactDisplayName(message.sender) : '');
    setReceiverSearchTerm(message.receiver ? getContactDisplayName(message.receiver) : '');
    setEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditing(false);
    setEditingMessageId(null);
    setEditSenderId('');
    setEditReceiverId('');
    setEditDirection('UNKNOWN');
    setSenderSearchTerm('');
    setReceiverSearchTerm('');
  };

  const searchMessage = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/messages/search?q=${encodeURIComponent(searchTerm)}`);
      const data: MessageContext = response.data;
      
      console.log('API Response:', data); // Debug log
      
      // Ensure messageInstances exists and is an array
      const instances = data.messageInstances || [];
      console.log('Instances:', instances); // Debug log
      setMessageInstances(instances);
      
      // Initialize with first instance if available
      if (instances.length > 0) {
        const firstInstance = instances[0];
        setEditSenderId(firstInstance.targetMessage.sender?.id || '');
        setEditReceiverId(firstInstance.targetMessage.receiver?.id || '');
        setEditDirection(firstInstance.targetMessage.direction);
        
        // Initialize search terms with current values
        setSenderSearchTerm(firstInstance.targetMessage.sender ? getContactDisplayName(firstInstance.targetMessage.sender) : '');
        setReceiverSearchTerm(firstInstance.targetMessage.receiver ? getContactDisplayName(firstInstance.targetMessage.receiver) : '');
      }
    } catch (e: any) {
      const errorMessage = e.response?.data?.error || e.message || 'Failed to search messages';
      setError(`Search failed: ${errorMessage}`);
      // Reset state on error
      setMessageInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingMessageId) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await api.put(`/messages/${editingMessageId}/correct`, {
        senderId: editSenderId || null,
        receiverId: editReceiverId || null,
        direction: editDirection
      });
      
      // Refresh the search results
      await searchMessage();
      cancelEditing();
      
      // Show success feedback
      setError(null);
      setSuccessMessage('Message corrected successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (e: any) {
      const errorMessage = e.response?.data?.error || e.message || 'Failed to save changes';
      setError(`Save failed: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const getMessageAlignment = (message: Message) => {
    if (message.direction === 'FROM') {
      return 'justify-start';
    } else {
      return 'justify-end';
    }
  };

  const getMessageBubbleStyle = (message: Message) => {
    if (message.direction === 'FROM') {
      return 'bg-gray-200 text-gray-900';
    } else {
      return 'bg-blue-500 text-white';
    }
  };

  const isTargetMessage = (message: Message, targetMessage: Message) => {
    return message.id === targetMessage.id;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-gray-900">Message Correction</h1>
              <p className="text-sm text-gray-500">Search and correct message sender/receiver</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Message Content
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Enter message content to search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchMessage()}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={searchMessage}
                disabled={loading || !searchTerm.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-red-600">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Success Display */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-green-600">{successMessage}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-400 hover:text-green-600 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Message Instances */}
        {messageInstances && messageInstances.length > 0 && (
          <div className="space-y-6">
            {messageInstances.map((instance, instanceIndex) => {
              if (!instance || !instance.targetMessage) return null;
              return (
              <div key={instance.targetMessage.id} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {editingMessageId === instance.targetMessage.id ? 'Editing Message' : `Message Instance ${instanceIndex + 1}`}
                  </h2>
                  <div className="flex space-x-2">
                    {!editing ? (
                      <button
                        onClick={() => startEditingMessage(instance.targetMessage)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    ) : editingMessageId === instance.targetMessage.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          <span>Save</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditingMessage(instance.targetMessage)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
            </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-900 mb-2">{instance.targetMessage.content}</p>
                  <div className="text-sm text-gray-500">
                    {formatMaldivesTime(instance.targetMessage.timestamp)} • {instance.targetMessage.messageType}
                  </div>
                </div>

                {editing && editingMessageId === instance.targetMessage.id && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Direction
                  </label>
                  <select
                    value={editDirection}
                    onChange={(e) => setEditDirection(e.target.value as 'FROM' | 'TO' | 'UNKNOWN')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FROM">FROM (Received)</option>
                    <option value="TO">TO (Sent)</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>

                <div className="relative dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search sender by name or number..."
                      value={senderSearchTerm}
                      onChange={(e) => {
                        setSenderSearchTerm(e.target.value);
                        setShowSenderDropdown(true);
                      }}
                      onFocus={() => setShowSenderDropdown(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {editSenderId && (
                      <button
                        onClick={() => {
                          setEditSenderId('');
                          setSenderSearchTerm('');
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {showSenderDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {getFilteredContacts(senderSearchTerm).map(contact => (
                        <div
                          key={contact.id}
                          onClick={() => handleSenderSelect(contact)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                {getContactDisplayName(contact)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {contact.phoneNumber}
                              </div>
                            </div>
                            <div className={`px-2 py-1 text-xs rounded-full ${
                              contact.type === 'GROUP' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {contact.type}
                            </div>
                          </div>
                        </div>
                      ))}
                      {getFilteredContacts(senderSearchTerm).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No contacts found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="relative dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receiver
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search receiver by name or number..."
                      value={receiverSearchTerm}
                      onChange={(e) => {
                        setReceiverSearchTerm(e.target.value);
                        setShowReceiverDropdown(true);
                      }}
                      onFocus={() => setShowReceiverDropdown(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {editReceiverId && (
                      <button
                        onClick={() => {
                          setEditReceiverId('');
                          setReceiverSearchTerm('');
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {showReceiverDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {getFilteredContacts(receiverSearchTerm).map(contact => (
                        <div
                          key={contact.id}
                          onClick={() => handleReceiverSelect(contact)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">
                                {getContactDisplayName(contact)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {contact.phoneNumber}
                              </div>
                            </div>
                            <div className={`px-2 py-1 text-xs rounded-full ${
                              contact.type === 'GROUP' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {contact.type}
                            </div>
                          </div>
                        </div>
                      ))}
                      {getFilteredContacts(receiverSearchTerm).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">
                          No contacts found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}


                {/* Context Messages for this instance */}
                <div className="mt-4">
                  <h3 className="text-md font-medium text-gray-700 mb-3">
                    Context Messages (10 before + target + 10 after)
                  </h3>
                  <div className="space-y-4">
                    {(instance.contextMessages || []).map((message, index) => (
                      <div
                        key={message.id}
                        className={`p-4 rounded-lg border-2 ${
                          isTargetMessage(message, instance.targetMessage) 
                            ? 'border-blue-500 bg-blue-50' 
                            : editingMessageId === message.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {isTargetMessage(message, instance.targetMessage) && (
                              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                TARGET
                              </span>
                            )}
                            {editingMessageId === message.id && (
                              <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                EDITING
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => startEditingMessage(message)}
                            disabled={editing && editingMessageId !== message.id}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </div>

                  <div className={`flex ${getMessageAlignment(message)}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${getMessageBubbleStyle(message)}`}>
                      {message.content && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      )}
                      <div className={`text-xs mt-1 ${
                        message.direction === 'FROM' ? 'text-gray-500' : 'text-blue-100'
                      }`}>
                        {formatMaldivesTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span>
                        <User className="w-3 h-3 inline mr-1" />
                        From: {message.sender ? `${message.sender.name || 'No name'} (${message.sender.phoneNumber})` : 'Unknown'}
                      </span>
                      <span>
                        <Phone className="w-3 h-3 inline mr-1" />
                        To: {message.receiver ? `${message.receiver.name || 'No name'} (${message.receiver.phoneNumber})` : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {!loading && searchTerm && (!messageInstances || messageInstances.length === 0) && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
            <p className="text-gray-500">Try a different search term.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageCorrectionPage;
