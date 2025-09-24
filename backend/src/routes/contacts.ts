import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { normalizePhoneNumber, isSameContact } from '../utils/phoneUtils';

const router = express.Router();
const prisma = new PrismaClient();

// Get all contacts (authenticated)
router.get('/public', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10000;
    
    const contacts = await prisma.contact.findMany({
      take: limit,
      include: {
        categories: {
          include: {
            category: true
          }
        },
        _count: {
          select: {
            sentMessages: true,
            receivedMessages: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedContacts = contacts.map(contact => ({
      ...contact,
      id: contact.id.toString(),
      messageCount: (contact._count.sentMessages || 0) + (contact._count.receivedMessages || 0),
      categories: contact.categories.map(cc => ({
        ...cc,
        id: cc.id.toString(),
        category: {
          ...cc.category,
          id: cc.category.id.toString()
        }
      }))
    }));

    res.json({
      contacts: serializedContacts,
      total: contacts.length
    });
  } catch (error) {
    console.error('Error fetching public contacts:', error);
    res.status(500).json({ error: 'Failed to fetch public contacts' });
  }
});

// Get contacts with pagination and search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string || '';
    const type = req.query.type as string || '';

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      // Normalize the search term if it looks like a phone number
      const normalizedSearch = normalizePhoneNumber(search);
      
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { phoneNumber: { contains: normalizedSearch } }
      ];
    }

    if (type && type !== 'ALL') {
      where.type = type;
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        include: {
          categories: {
            include: {
              category: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.contact.count({ where })
    ]);

    // Convert BigInt values to strings for JSON serialization
    const serializedContacts = contacts.map(contact => ({
      ...contact,
      id: contact.id.toString(),
      categories: contact.categories.map(cc => ({
        ...cc,
        id: cc.id.toString(),
        category: {
          ...cc.category,
          id: cc.category.id.toString()
        }
      }))
    }));

    res.json({
      contacts: serializedContacts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get a single contact by ID
router.get('/:id', async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        categories: {
          include: {
            category: true
          }
        },
        sentMessages: {
          take: 10,
          orderBy: { timestamp: 'desc' }
        },
        receivedMessages: {
          take: 10,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Convert BigInt values to strings for JSON serialization
    const serializedContact = {
      ...contact,
      id: contact.id.toString(),
      categories: contact.categories.map(cc => ({
        ...cc,
        id: cc.id.toString(),
        category: {
          ...cc.category,
          id: cc.category.id.toString()
        }
      })),
      sentMessages: contact.sentMessages.map(msg => ({
        ...msg,
        id: msg.id.toString()
      })),
      receivedMessages: contact.receivedMessages.map(msg => ({
        ...msg,
        id: msg.id.toString()
      }))
    };

    res.json(serializedContact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

export default router;