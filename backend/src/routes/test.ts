import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Public test endpoint - no authentication required
router.get('/data', async (req, res) => {
  try {
    // Fetch all data from all tables
    const [contacts, messages, categories, users] = await Promise.all([
      prisma.contact.findMany({
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
      }),
      prisma.message.findMany({
        include: {
          sender: true,
          receiver: true
        },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.category.findMany({
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = messages.map(message => ({
      ...message,
      id: message.id.toString()
    }));

    res.json({
      contacts,
      messages: serializedMessages,
      categories,
      users,
      summary: {
        totalContacts: contacts.length,
        totalMessages: messages.length,
        totalCategories: categories.length,
        totalUsers: users.length
      }
    });
  } catch (error) {
    console.error('Test data fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
