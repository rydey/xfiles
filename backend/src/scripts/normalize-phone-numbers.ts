import { PrismaClient } from '@prisma/client';
import { normalizePhoneNumber, isSameContact } from '../utils/phoneUtils';

const prisma = new PrismaClient();

async function normalizePhoneNumbers() {
  console.log('🔍 Starting phone number normalization...');
  
  try {
    // Get all contacts
    const contacts = await prisma.contact.findMany({
      select: {
        id: true,
        phoneNumber: true,
        name: true
      }
    });

    console.log(`📱 Found ${contacts.length} contacts to process`);

    let updatedCount = 0;
    let duplicateCount = 0;
    const duplicates: { [key: string]: number[] } = {};

    // Group contacts by normalized phone number to find duplicates
    for (const contact of contacts) {
      const normalized = normalizePhoneNumber(contact.phoneNumber);
      
      if (normalized !== contact.phoneNumber) {
        // This contact needs normalization
        if (!duplicates[normalized]) {
          duplicates[normalized] = [];
        }
        duplicates[normalized].push(contact.id);
      }
    }

    // Handle duplicates by merging them
    for (const [normalizedPhone, contactIds] of Object.entries(duplicates)) {
      if (contactIds.length > 1) {
        console.log(`🔄 Found ${contactIds.length} contacts with same number: ${normalizedPhone}`);
        
        // Keep the first contact, merge others into it
        const [keepId, ...mergeIds] = contactIds;
        
        for (const mergeId of mergeIds) {
          // Update all messages from the duplicate contact to point to the main contact
          await prisma.message.updateMany({
            where: { senderId: mergeId },
            data: { senderId: keepId }
          });
          
          await prisma.message.updateMany({
            where: { receiverId: mergeId },
            data: { receiverId: keepId }
          });
          
          // Delete the duplicate contact
          await prisma.contact.delete({
            where: { id: mergeId }
          });
          
          console.log(`✅ Merged contact ${mergeId} into ${keepId}`);
          duplicateCount++;
        }
        
        // Update the main contact's phone number
        await prisma.contact.update({
          where: { id: keepId },
          data: { phoneNumber: normalizedPhone }
        });
        
        updatedCount++;
      } else if (contactIds.length === 1) {
        // Single contact, just normalize the phone number
        const contact = await prisma.contact.findUnique({
          where: { id: contactIds[0] }
        });
        
        if (contact && contact.phoneNumber !== normalizedPhone) {
          // Check if the normalized phone already exists
          const existingContact = await prisma.contact.findUnique({
            where: { phoneNumber: normalizedPhone }
          });
          
          if (existingContact) {
            // Merge with existing contact
            await prisma.message.updateMany({
              where: { senderId: contactIds[0] },
              data: { senderId: existingContact.id }
            });
            
            await prisma.message.updateMany({
              where: { receiverId: contactIds[0] },
              data: { receiverId: existingContact.id }
            });
            
            await prisma.contact.delete({
              where: { id: contactIds[0] }
            });
            
            console.log(`✅ Merged contact ${contactIds[0]} into existing ${existingContact.id}`);
            duplicateCount++;
          } else {
            // Safe to update
            await prisma.contact.update({
              where: { id: contactIds[0] },
              data: { phoneNumber: normalizedPhone }
            });
            
            updatedCount++;
          }
        }
      }
    }

    console.log('\n🎉 PHONE NUMBER NORMALIZATION COMPLETE:');
    console.log(`✅ Updated: ${updatedCount} contacts`);
    console.log(`🔄 Merged: ${duplicateCount} duplicate contacts`);
    console.log(`📱 Total processed: ${contacts.length} contacts`);

  } catch (error) {
    console.error('❌ Error in normalizePhoneNumbers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the normalization
normalizePhoneNumbers();
