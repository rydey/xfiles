import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixToMessagesWithoutReceiver() {
  console.log('🔍 Starting to fix TO messages without receiver numbers...');
  
  try {
    // Find all TO messages that don't have a receiver
    const toMessagesWithoutReceiver = await prisma.message.findMany({
      where: {
        direction: 'TO',
        receiverId: null
      },
      include: {
        sender: true
      },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`📱 Found ${toMessagesWithoutReceiver.length} TO messages without receiver`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const message of toMessagesWithoutReceiver) {
      try {
        // Find the previous message to get the sender
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
          // Update the TO message to have the previous message's sender as receiver
          await prisma.message.update({
            where: { id: message.id },
            data: {
              receiverId: previousMessage.sender.id
            }
          });

          console.log(`✅ Fixed message ${message.id}: TO ${previousMessage.sender.phoneNumber} (${previousMessage.sender.name || 'No name'})`);
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

    console.log('\n🎉 TO MESSAGE FIX COMPLETE:');
    console.log(`✅ Fixed: ${fixedCount} messages`);
    console.log(`⚠️  Skipped: ${skippedCount} messages`);
    console.log(`📊 Total processed: ${toMessagesWithoutReceiver.length} messages`);

    // Show some examples of what was fixed
    if (fixedCount > 0) {
      console.log('\n📋 Examples of fixed messages:');
      const examples = await prisma.message.findMany({
        where: {
          direction: 'TO',
          receiverId: {
            not: null
          }
        },
        include: {
          receiver: true
        },
        orderBy: { timestamp: 'desc' },
        take: 5
      });

      examples.forEach(msg => {
        console.log(`  • Message to ${msg.receiver?.phoneNumber} (${msg.receiver?.name || 'No name'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error in fixToMessagesWithoutReceiver:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixToMessagesWithoutReceiver();
