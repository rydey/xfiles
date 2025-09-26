import React, { useState, useEffect } from 'react';
import { Search, MessageCircle, Phone, User, ArrowRight } from 'lucide-react';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { api } from '../lib/api';

interface Contact {
  id: string;
  name: string | null;
  phoneNumber: string;
  type: 'INDIVIDUAL' | 'GROUP';
  messageCount: number;
  lastMessage?: {
    content: string;
    timestamp: string;
    direction: 'FROM' | 'TO';
  };
  categories: Array<{
    category: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

interface ContactsResponse {
  contacts: Contact[];
  total: number;
}


const HomePage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    if (!contacts || contacts.length === 0) {
      setFilteredContacts([]);
      return;
    }
    
    if (searchTerm.trim() === '') {
      // Default view: only contacts with more than 100 messages
      setFilteredContacts(contacts.filter(c => (c.messageCount || 0) > 100));
    } else {
      const filtered = contacts.filter(contact => {
        const nameMatch = contact.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const phoneMatch = contact.phoneNumber.includes(searchTerm);
        
        // Also check if search term matches the normalized version
        const normalizedSearch = normalizePhoneNumber(searchTerm);
        const normalizedPhoneMatch = contact.phoneNumber.includes(normalizedSearch);
        
        return nameMatch || phoneMatch || normalizedPhoneMatch;
      });
      setFilteredContacts(filtered);
    }
  }, [searchTerm, contacts]);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/contacts/public');
      const contactsData = response.data.contacts || [];
      setContacts(contactsData);
      // Initialize default view to >100 messages
      setFilteredContacts(contactsData.filter((c: Contact) => (c.messageCount || 0) > 100));
    } catch (e: any) {
      setError(`Failed to fetch contacts: ${e.message}`);
      // Reset state on error
      setContacts([]);
      setFilteredContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = (contact: Contact) => {
    window.location.href = `/chat/${contact.id}`;
  };

  const getContactInitial = (contact: Contact) => {
    if (contact.name) {
      return contact.name.charAt(0).toUpperCase();
    }
    return contact.phoneNumber.charAt(0);
  };

  const getContactDisplayName = (contact: Contact) => {
    return contact.name || contact.phoneNumber;
  };

  const formatLastMessage = (contact: Contact) => {
    if (!contact.lastMessage) return 'No messages';
    
    const direction = contact.lastMessage.direction === 'FROM' ? 'You: ' : '';
    const content = contact.lastMessage.content || 'No content';
    const truncated = content.length > 50 ? content.substring(0, 50) + '...' : content;
    
    return direction + truncated;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading contacts...</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center justify-center">
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contacts or numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>
        </div>
      </div>


      {/* Search Results */}
      <div className="max-w-md mx-auto">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📱</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No contacts found' : 'No contacts available'}
            </h3>
            <p className="text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search term.' 
                : 'The database is empty or contacts have not been imported.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="bg-white px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {getContactInitial(contact)}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {getContactDisplayName(contact)}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {contact.messageCount} msgs
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-500 truncate">
                        {contact.phoneNumber}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        contact.type === 'GROUP' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {contact.type}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {formatLastMessage(contact)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="text-center text-sm text-gray-500">
          {filteredContacts?.length || 0} of {contacts?.length || 0} contacts
        </div>
      </div>
    </div>
  );
};

export default HomePage;
