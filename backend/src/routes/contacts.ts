import express from 'express';
import { PrismaClient, ContactType, Prisma } from '@prisma/client';
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
    let categoriesUpdate: Prisma.ContactCategoryUpdateManyWithoutContactNestedInput | undefined = undefined;

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

// Merge two contacts (admin only)
router.post('/merge', authenticateToken, requireAdmin, async (req, res) => {
  const { sourceId, targetId } = req.body as { sourceId: number | string; targetId: number | string };

  const source = parseInt(sourceId as any);
  const target = parseInt(targetId as any);

  if (Number.isNaN(source) || Number.isNaN(target) || source === target) {
    return res.status(400).json({ error: 'Invalid source/target contact IDs' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [sourceContact, targetContact] = await Promise.all([
        tx.contact.findUnique({ where: { id: source }, include: { categories: true } }),
        tx.contact.findUnique({ where: { id: target }, include: { categories: true } }),
      ]);

      if (!sourceContact || !targetContact) {
        throw new Error('Source or target contact not found');
      }

      // 1) Reassign messages
      await Promise.all([
        tx.message.updateMany({ where: { senderId: source }, data: { senderId: target } }),
        tx.message.updateMany({ where: { receiverId: source }, data: { receiverId: target } }),
        tx.message.updateMany({ where: { correctedReceiverId: source }, data: { correctedReceiverId: target } }),
      ]);

      // 2) Move categories (add missing ones to target)
      const sourceCategoryIds = sourceContact.categories.map((cc) => cc.categoryId);
      if (sourceCategoryIds.length > 0) {
        // Determine which category links are missing on the target
        const targetCategoryIds = new Set(targetContact.categories.map((cc) => cc.categoryId));
        const toCreate = sourceCategoryIds.filter((id) => !targetCategoryIds.has(id));
        if (toCreate.length > 0) {
          await tx.contactCategory.createMany({
            data: toCreate.map((categoryId) => ({ contactId: target, categoryId })),
            skipDuplicates: true,
          });
        }
      }

      // 3) Delete source contact (cascade removes source contact_categories)
      await tx.contact.delete({ where: { id: source } });

      // Return updated target
      const updated = await tx.contact.findUnique({
        where: { id: target },
        include: {
          categories: { include: { category: true } },
          _count: { select: { sentMessages: true, receivedMessages: true } },
        },
      });

      return updated;
    });

    if (!result) return res.status(500).json({ error: 'Merge failed' });

    const serialized = {
      ...result,
      id: result.id.toString(),
      messageCount: (result._count.sentMessages || 0) + (result._count.receivedMessages || 0),
      categories: result.categories.map((cc) => ({ category: { ...cc.category, id: cc.category.id.toString() } })),
    } as any;

    return res.json({ contact: serialized });
  } catch (err: any) {
    console.error('Error merging contacts:', err);
    return res.status(500).json({ error: err.message || 'Failed to merge contacts' });
  }
});