import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isIn(['ADMIN', 'JOURNALIST'])
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          role: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user (Admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('username').optional().isString().isLength({ min: 3 }),
  body('role').optional().isIn(['ADMIN', 'JOURNALIST'])
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, role } = req.body;

    // If updating username, check for duplicates
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          username,
          id: { not: parseInt(req.params.id) }
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this username already exists' });
      }
    }

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(username !== undefined && { username }),
        ...(role !== undefined && { role })
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Prevent admin from deleting themselves
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // You might want to add logic to prevent deleting the last admin
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });

    if (currentUser.role === 'ADMIN' && adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    await prisma.user.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
