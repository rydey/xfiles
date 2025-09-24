import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPhoneOwnerMessages() {
  console.log('🔍 Starting to fix phone owner messages...');
  
  try {
    // Find messages that look like they were sent BY the phone owner
    // These are typically short responses, questions, or messages that don't make sense as incoming
    const phoneOwnerPatterns = [
      'ok', 'yes', 'no', 'thanks', 'thank you', 'sorry', 'hi', 'hello',
      'how are you', 'what', 'when', 'where', 'why', 'can you', 'will you',
      'please', 'pls', 'okay', 'sure', 'fine', 'good', 'bad', 'great',
      'meet', 'call', 'come', 'go', 'see', 'talk', 'speak'
    ];

    // Get all FROM messages that might be phone owner responses
    const potentialPhoneOwnerMessages = await prisma.message.findMany({
      where: {
        direction: 'FROM',
        content: {
          not: null
        }
      },
      include: {
        sender: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    console.log(`📱 Found ${potentialPhoneOwnerMessages.length} FROM messages to analyze`);

    let fixedCount = 0;
    let skippedCount = 0;
    let analyzedCount = 0;

    for (const message of potentialPhoneOwnerMessages) {
      analyzedCount++;
      
      // Skip if no content
      if (!message.content) {
        continue;
      }

      const content = message.content.toLowerCase();
      
      // Check if this looks like a phone owner response
      const isPhoneOwnerResponse = phoneOwnerPatterns.some(pattern => 
        content.includes(pattern)
      ) || 
      // Very short messages are likely responses
      message.content.length < 50 ||
      // Questions are likely from phone owner
      content.includes('?') ||
      // Common response patterns
      content.match(/^(ok|yes|no|thanks?|sorry|hi|hello)$/i);

      if (isPhoneOwnerResponse) {
        try {
          // Find the previous message to get who we should send TO
          const previousMessage = await prisma.message.findFirst({
            where: {
              timestamp: {
                lt: message.timestamp
              },
              senderId: {
                not: null
              }
            },
            orderBy: {
              timestamp: 'desc'
            },
            include: {
              sender: true
            }
          });

          if (previousMessage && previousMessage.sender) {
            // Update the message to be a 'TO' message
            await prisma.message.update({
              where: { id: message.id },
              data: {
                direction: 'TO',
                receiverId: previousMessage.sender.id,
                senderId: null
              }
            });

            console.log(`✅ Fixed message ${message.id}: "${message.content.substring(0, 50)}..." → TO ${previousMessage.sender.phoneNumber} (${previousMessage.sender.name || 'No name'})`);
            fixedCount++;
          } else {
            console.log(`⚠️  Skipped message ${message.id}: No previous sender found`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ Error fixing message ${message.id}:`, error);
          skippedCount++;
        }
      }

      // Progress indicator
      if (analyzedCount % 1000 === 0) {
        console.log(`📊 Analyzed ${analyzedCount}/${potentialPhoneOwnerMessages.length} messages...`);
      }
    }

    console.log('\n🎉 PHONE OWNER MESSAGE FIX COMPLETE:');
    console.log(`✅ Fixed: ${fixedCount} messages`);
    console.log(`⚠️  Skipped: ${skippedCount} messages`);
    console.log(`📊 Total analyzed: ${analyzedCount} messages`);

  } catch (error) {
    console.error('❌ Error in fixPhoneOwnerMessages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixPhoneOwnerMessages();
