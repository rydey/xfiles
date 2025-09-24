import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Search messages by content (authenticated)
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Find messages that contain the search term
    const matchingMessages = await prisma.message.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive'
        }
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

    if (matchingMessages.length === 0) {
      return res.json({
        messages: [],
        targetMessage: null,
        total: 0
      });
    }

    // Get the first matching message as target
    const targetMessage = matchingMessages[0];
    
    // Get 10 messages before and 10 messages after the target message
    const beforeMessages = await prisma.message.findMany({
      where: {
        timestamp: {
          lt: targetMessage.timestamp
        }
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
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const afterMessages = await prisma.message.findMany({
      where: {
        timestamp: {
          gt: targetMessage.timestamp
        }
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
      orderBy: { timestamp: 'asc' },
      take: 10
    });

    // Combine all messages in chronological order
    const allMessages = [
      ...beforeMessages.reverse(),
      targetMessage,
      ...afterMessages
    ];

    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = allMessages.map(message => ({
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

    const serializedTarget = {
      ...targetMessage,
      id: targetMessage.id.toString(),
      sender: targetMessage.sender ? {
        ...targetMessage.sender,
        id: targetMessage.sender.id.toString()
      } : null,
      receiver: targetMessage.receiver ? {
        ...targetMessage.receiver,
        id: targetMessage.receiver.id.toString()
      } : null
    };

    res.json({
      messages: serializedMessages,
      targetMessage: serializedTarget,
      total: allMessages.length
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Correct message sender/receiver (public endpoint for correction page)
router.put('/:id/correct', authenticateToken, async (req, res) => {
  try {
    const messageId = BigInt(req.params.id);
    const { senderId, receiverId, direction } = req.body;

    // Validate the message exists
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        senderId: senderId ? parseInt(senderId) : null,
        receiverId: receiverId ? parseInt(receiverId) : null,
        direction: direction || existingMessage.direction
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
      }
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedMessage = {
      ...updatedMessage,
      id: updatedMessage.id.toString(),
      sender: updatedMessage.sender ? {
        ...updatedMessage.sender,
        id: updatedMessage.sender.id.toString()
      } : null,
      receiver: updatedMessage.receiver ? {
        ...updatedMessage.receiver,
        id: updatedMessage.receiver.id.toString()
      } : null
    };

    res.json(serializedMessage);
  } catch (error) {
    console.error('Correct message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public endpoint for test page (no authentication required)
router.get('/public', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10000;
    
    const messages = await prisma.message.findMany({
      take: limit,
      include: {
        sender: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        },
        receiver: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'desc' }
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
      total: messages.length
    });
  } catch (error) {
    console.error('Public messages fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get messages with filtering and pagination
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('contactId').optional().isString(),
  query('type').optional().isIn(['SMS', 'CALL', 'EMAIL', 'WHATSAPP', 'OTHER']),
  query('direction').optional().isIn(['INCOMING', 'OUTGOING']),
  query('search').optional().isString(),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const contactId = req.query.contactId as string;
    const type = req.query.type as string;
    const direction = req.query.direction as string;
    const search = req.query.search as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (contactId) {
      where.OR = [
        { senderId: parseInt(contactId) },
        { receiverId: parseInt(contactId) }
      ];
    }

    if (type) {
      where.messageType = type;
    }

    if (direction) {
      where.direction = direction;
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            include: {
              categories: {
                include: {
                  category: true
                }
              }
            }
          },
          receiver: {
            include: {
              categories: {
                include: {
                  category: true
                }
              }
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.message.count({ where })
    ]);

    res.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single message
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        sender: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        },
        receiver: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create message (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('content').optional().isString(),
  body('messageType').isIn(['SMS', 'CALL', 'INSTANT', 'CALENDAR']),
  body('direction').isIn(['FROM', 'TO', 'UNKNOWN']),
  body('timestamp').isISO8601(),
  body('senderId').optional().isInt(),
  body('receiverId').optional().isInt(),
  body('attachment').optional().isString(),
  body('location').optional().isString(),
  body('rawLine').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      content, 
      messageType, 
      direction, 
      timestamp, 
      senderId, 
      receiverId, 
      attachment, 
      location, 
      rawLine 
    } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        messageType,
        direction,
        timestamp: new Date(timestamp),
        senderId: senderId ? parseInt(senderId) : null,
        receiverId: receiverId ? parseInt(receiverId) : null,
        attachment,
        location,
        rawLine
      },
      include: {
        sender: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        },
        receiver: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update message (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('content').optional().isString(),
  body('correctedType').optional().isString(),
  body('correctedReceiverId').optional().isInt(),
  body('attachment').optional().isString(),
  body('location').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, correctedType, correctedReceiverId, attachment, location } = req.body;

    const message = await prisma.message.update({
      where: { id: BigInt(req.params.id) },
      data: {
        ...(content !== undefined && { content }),
        ...(correctedType !== undefined && { correctedType }),
        ...(correctedReceiverId !== undefined && { correctedReceiverId: parseInt(correctedReceiverId) }),
        ...(attachment !== undefined && { attachment }),
        ...(location !== undefined && { location })
      },
      include: {
        sender: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        },
        receiver: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    res.json(message);
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.message.delete({
      where: { id: BigInt(req.params.id) }
    });

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search messages by content (public endpoint for correction page)
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Find messages that contain the search term
    const matchingMessages = await prisma.message.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive'
        }
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

    if (matchingMessages.length === 0) {
      return res.json({
        messages: [],
        targetMessage: null,
        total: 0
      });
    }

    // Get the first matching message as target
    const targetMessage = matchingMessages[0];
    
    // Get 10 messages before and 10 messages after the target message
    const beforeMessages = await prisma.message.findMany({
      where: {
        timestamp: {
          lt: targetMessage.timestamp
        }
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
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const afterMessages = await prisma.message.findMany({
      where: {
        timestamp: {
          gt: targetMessage.timestamp
        }
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
      orderBy: { timestamp: 'asc' },
      take: 10
    });

    // Combine all messages in chronological order
    const allMessages = [
      ...beforeMessages.reverse(),
      targetMessage,
      ...afterMessages
    ];

    // Convert BigInt values to strings for JSON serialization
    const serializedMessages = allMessages.map(message => ({
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

    const serializedTarget = {
      ...targetMessage,
      id: targetMessage.id.toString(),
      sender: targetMessage.sender ? {
        ...targetMessage.sender,
        id: targetMessage.sender.id.toString()
      } : null,
      receiver: targetMessage.receiver ? {
        ...targetMessage.receiver,
        id: targetMessage.receiver.id.toString()
      } : null
    };

    res.json({
      messages: serializedMessages,
      targetMessage: serializedTarget,
      total: allMessages.length
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Correct message sender/receiver (public endpoint for correction page)
router.put('/:id/correct', authenticateToken, async (req, res) => {
  try {
    const messageId = BigInt(req.params.id);
    const { senderId, receiverId, direction } = req.body;

    // Validate the message exists
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId }
    });

    if (!existingMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        senderId: senderId ? parseInt(senderId) : null,
        receiverId: receiverId ? parseInt(receiverId) : null,
        direction: direction || existingMessage.direction
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
      }
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedMessage = {
      ...updatedMessage,
      id: updatedMessage.id.toString(),
      sender: updatedMessage.sender ? {
        ...updatedMessage.sender,
        id: updatedMessage.sender.id.toString()
      } : null,
      receiver: updatedMessage.receiver ? {
        ...updatedMessage.receiver,
        id: updatedMessage.receiver.id.toString()
      } : null
    };

    res.json(serializedMessage);
  } catch (error) {
    console.error('Correct message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export messages for journalist
router.get('/export/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const { format = 'json' } = req.query;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: parseInt(contactId) },
          { receiverId: parseInt(contactId) }
        ]
      },
      include: {
        sender: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        },
        receiver: {
          include: {
            categories: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Timestamp,Type,Direction,Sender,Receiver,Content\n';
      const csvRows = messages.map(msg => 
        `"${msg.timestamp.toISOString()}","${msg.messageType}","${msg.direction}","${msg.sender?.name || msg.sender?.phoneNumber || ''}","${msg.receiver?.name || msg.receiver?.phoneNumber || ''}","${(msg.content || '').replace(/"/g, '""')}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="messages-${contactId}.csv"`);
      res.send(csvHeader + csvRows);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="messages-${contactId}.json"`);
      res.json(messages);
    }
  } catch (error) {
    console.error('Export messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
