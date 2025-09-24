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

// Rename category (admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name } = req.body as { name?: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const updated = await prisma.category.update({ where: { id: categoryId }, data: { name: name.trim() } });
    return res.json({ id: updated.id.toString(), name: updated.name });
  } catch (error: any) {
    console.error('Error renaming category:', error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Category name already exists' });
    return res.status(500).json({ error: 'Failed to rename category' });
  }
});

// Get contacts in a category (authenticated)
router.get('/:id/contacts', authenticateToken, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);

    const links = await prisma.contactCategory.findMany({
      where: { categoryId },
      include: {
        contact: {
          include: {
            _count: { select: { sentMessages: true, receivedMessages: true } }
          }
        }
      },
      orderBy: { contactId: 'asc' }
    });

    const contacts = links.map(l => ({
      id: l.contact.id.toString(),
      name: l.contact.name,
      phoneNumber: l.contact.phoneNumber,
      type: l.contact.type,
      messageCount: (l.contact._count.sentMessages || 0) + (l.contact._count.receivedMessages || 0)
    }));

    return res.json({ contacts, total: contacts.length });
  } catch (error) {
    console.error('Error fetching category contacts:', error);
    return res.status(500).json({ error: 'Failed to fetch category contacts' });
  }
});

// Add a contact to category (admin only)
router.post('/:id/contacts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { contactId } = req.body as { contactId?: number | string };
    const cId = parseInt((contactId as any) ?? 'NaN');
    if (Number.isNaN(cId)) return res.status(400).json({ error: 'Invalid contactId' });

    await prisma.contactCategory.create({ data: { categoryId, contactId: cId } });
    return res.json({ ok: true });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(200).json({ ok: true }); // already linked
    console.error('Error adding contact to category:', error);
    return res.status(500).json({ error: 'Failed to add contact to category' });
  }
});

// Bulk add contacts to category (admin only)
router.post('/:id/contacts/bulk', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { contactIds } = req.body as { contactIds?: Array<number | string> };
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds array required' });
    }
    const ids = contactIds
      .map((v) => parseInt(v as any))
      .filter((n) => !Number.isNaN(n));

    if (ids.length === 0) return res.json({ added: 0 });

    await prisma.contactCategory.createMany({
      data: ids.map((contactId) => ({ categoryId, contactId })),
      skipDuplicates: true,
    });

    return res.json({ added: ids.length });
  } catch (error) {
    console.error('Error bulk adding contacts to category:', error);
    return res.status(500).json({ error: 'Failed to add contacts to category' });
  }
});

// Remove a contact from category (admin only)
router.delete('/:id/contacts/:contactId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const contactId = parseInt(req.params.contactId);
    await prisma.contactCategory.delete({ where: { contactId_categoryId: { contactId, categoryId } } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error removing contact from category:', error);
    return res.status(500).json({ error: 'Failed to remove contact from category' });
  }
});