import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get chat log for a specific contact
router.get('/:contactId', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.contactId);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    // Get the contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get all messages for this contact (both sent and received)
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: contactId },
          { receiverId: contactId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            type: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            type: true
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = messages.map(message => ({
      ...message,
      id: message.id.toString(),
      sender: message.sender ? {
        ...message.sender,
        id: message.sender.id.toString()
      } : null,
      receiver: message.receiver ? {
        ...message.receiver,
        id: message.receiver.id.toString()
      } : null
    }));

    res.json({
      messages: serializedMessages,
      contact: {
        id: contact.id.toString(),
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        type: contact.type
      },
      total: messages.length
    });
  } catch (error) {
    console.error('Error fetching chat log:', error);
    res.status(500).json({ error: 'Failed to fetch chat log' });
  }
});

export default router;
