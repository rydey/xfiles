import express from 'express';
import { PrismaClient, ContactType } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth';
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

// Update a contact (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { name, phoneNumber, type, categoryIds } = req.body as {
      name?: string | null;
      phoneNumber?: string;
      type?: 'INDIVIDUAL' | 'GROUP';
      categoryIds?: number[] | string[];
    };

    if (Number.isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    // Validate type
    let prismaType: ContactType | undefined;
    if (type) {
      if (type !== 'INDIVIDUAL' && type !== 'GROUP') {
        return res.status(400).json({ error: 'Invalid contact type' });
      }
      prismaType = type as ContactType;
    }

    // Prepare category connections
    let categoriesUpdate = undefined as
      | { deleteMany: any[]; create: { category: { connect: { id: number } } }[] }
      | undefined;

    if (Array.isArray(categoryIds)) {
      const ids = categoryIds.map((id) => parseInt(id as any)).filter((n) => !Number.isNaN(n));
      categoriesUpdate = {
        deleteMany: {},
        create: ids.map((id) => ({ category: { connect: { id } } })),
      };
    }

    // Normalize phone if provided
    let updatedPhone: string | undefined = undefined;
    if (phoneNumber) {
      updatedPhone = normalizePhoneNumber(phoneNumber);
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(updatedPhone !== undefined ? { phoneNumber: updatedPhone } : {}),
        ...(prismaType ? { type: prismaType } : {}),
        ...(categoriesUpdate ? { categories: categoriesUpdate } : {}),
      },
      include: {
        categories: { include: { category: true } },
        _count: { select: { sentMessages: true, receivedMessages: true } },
      },
    });

    const serialized = {
      ...updated,
      id: updated.id.toString(),
      messageCount: (updated._count.sentMessages || 0) + (updated._count.receivedMessages || 0),
      categories: updated.categories.map((cc) => ({
        category: { ...cc.category, id: cc.category.id.toString() },
      })),
    };

    return res.json({ contact: serialized });
  } catch (error: any) {
    console.error('Error updating contact:', error);
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    return res.status(500).json({ error: 'Failed to update contact' });
  }
});