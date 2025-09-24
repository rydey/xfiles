import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all categories with contact counts (authenticated)
router.get('/public', authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            contacts: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Convert BigInt values to strings for JSON serialization
    const serializedCategories = categories.map(category => ({
      ...category,
      id: category.id.toString(),
      contactCount: category._count.contacts
    }));

    res.json({
      categories: serializedCategories,
      total: categories.length
    });
  } catch (error) {
    console.error('Error fetching public categories:', error);
    res.status(500).json({ error: 'Failed to fetch public categories' });
  }
});

// Create new category (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: { name: name.trim() }
    });

    res.json({
      ...category,
      id: category.id.toString(),
      contactCount: 0
    });
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
});

// Delete category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Delete the category (this will also delete related ContactCategory records due to onDelete: Cascade)
    await prisma.category.delete({
      where: { id: categoryId }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;