import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import csv from 'csv-parser';
import { parse } from 'date-fns';

const prisma = new PrismaClient();

interface CSVRecord {
  id: string;
  type: string;
  direction: string;
  attachments: string;
  locations: string;
  timestamp: string;
  party: string;
  description: string;
  deleted: string;
  page_number: string;
  table_index: string;
  row_index: string;
}

interface ParsedMessage {
  id: string;
  messageType: 'SMS' | 'INSTANT';
  direction: 'FROM' | 'TO' | 'UNKNOWN';
  timestamp: Date;
  phoneNumber: string;
  contactName?: string;
  content: string;
  attachments?: string;
  locations?: string;
  deleted: boolean;
  rawData: CSVRecord;
}

function parseCSVRecord(record: CSVRecord): ParsedMessage | null {
  // Only process SMS Messages and Instant Messages
  if (record.type !== 'SMS Messages' && record.type !== 'Instant Messages') {
    return null;
  }

  // Skip if no content or if it's just a filename/location info
  if (!record.description || record.description.trim() === '') {
    return null;
  }

  // Skip attachment/location info rows
  if (record.description.includes('.jpg') || 
      record.description.includes('.png') || 
      record.description.includes('.pdf') ||
      record.description.includes('Location info:')) {
    return null;
  }

  // Skip empty rows
  if (!record.id || record.id.trim() === '') {
    return null;
  }

  // Parse timestamp
  let timestamp: Date;
  try {
    // Handle format: "05/06/2014 05:07:40(UTC+0)"
    const cleanTimestamp = record.timestamp.replace(/\(UTC\+0\)/, '');
    timestamp = parse(cleanTimestamp, 'dd/MM/yyyy HH:mm:ss', new Date());
  } catch (error) {
    console.warn(`⚠️  Invalid timestamp: ${record.timestamp}`);
    return null;
  }

  // Parse direction
  let direction: 'FROM' | 'TO' | 'UNKNOWN' = 'UNKNOWN';
  
  // First check the direction field
  if (record.direction === 'From') {
    direction = 'FROM';
  } else if (record.direction === 'To') {
    direction = 'TO';
  }
  
  // For Instant Messages, also check the party field for direction
  if (record.party) {
    if (record.party.startsWith('From:')) {
      direction = 'FROM';
    } else if (record.party.startsWith('To:')) {
      direction = 'TO';
    }
  }

  // Parse party (phone + name)
  let phoneNumber = '';
  let contactName: string | undefined;

  if (record.party) {
    // Handle formats like:
    // "From: +9607777472 Pension Hassan"
    // "To: 7777007 Ahmed Adeeb Abdul Gafoor"
    // "From: +9607772675"
    // "From:" (empty phone number)
    
    const partyMatch = record.party.match(/^(From|To):\s*(.+)$/);
    if (partyMatch) {
      const [, dir, partyInfo] = partyMatch;
      
      // Skip if party info is empty or just "From:"
      if (partyInfo.trim() === '') {
        return null;
      }
      
      // Extract phone number and name
      const phoneMatch = partyInfo.match(/^(\+?\d+)\s*(.*)$/);
      if (phoneMatch) {
        phoneNumber = phoneMatch[1];
        const namePart = phoneMatch[2].trim();
        if (namePart && namePart !== '') {
          contactName = namePart;
        }
      } else {
        // If no phone number found, skip this record
        return null;
      }
    } else {
      // Fallback: treat entire party as phone number
      phoneNumber = record.party;
    }
  } else {
    // No party information, skip
    return null;
  }

  // Determine message type
  const messageType: 'SMS' | 'INSTANT' = record.type === 'SMS Messages' ? 'SMS' : 'INSTANT';

  return {
    id: record.id,
    messageType,
    direction,
    timestamp,
    phoneNumber,
    contactName,
    content: record.description,
    attachments: record.attachments || undefined,
    locations: record.locations || undefined,
    deleted: record.deleted === 'Yes',
    rawData: record
  };
}

async function importCSVMessages(filePath: string, maxRecords?: number) {
  console.log(`🔍 CSV IMPORT: Starting import from ${filePath}`);
  
  const records: ParsedMessage[] = [];
  let processedCount = 0;
  let skippedCount = 0;

  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: CSVRecord) => {
        if (maxRecords && processedCount >= maxRecords) {
          return;
        }

        processedCount++;
        const parsed = parseCSVRecord(data);
        
        if (parsed) {
          records.push(parsed);
          console.log(`✅ Parsed ${parsed.messageType} ${parsed.direction} from ${parsed.phoneNumber}: ${parsed.content.substring(0, 50)}...`);
        } else {
          skippedCount++;
        }
      })
      .on('end', async () => {
        console.log(`\n📊 CSV PARSING COMPLETE:`);
        console.log(`   Records processed: ${processedCount}`);
        console.log(`   Messages parsed: ${records.length}`);
        console.log(`   Skipped: ${skippedCount}`);
        
        if (records.length === 0) {
          console.log('❌ No valid messages found');
          resolve();
          return;
        }

        // Import to database
        console.log(`\n💾 Importing ${records.length} messages to database...`);
        
        let importedCount = 0;
        let errorCount = 0;

        for (const message of records) {
          try {
            // Find or create contact
            let contact = await prisma.contact.findFirst({
              where: { phoneNumber: message.phoneNumber }
            });

            if (!contact) {
              // Determine if this is a group or individual contact
              let contactType: 'INDIVIDUAL' | 'GROUP' = 'INDIVIDUAL';
              
              // Check for group indicators
              if (message.contactName) {
                const groupIndicators = ['group', 'chat', 'broadcast', 'team', 'committee'];
                const nameLower = message.contactName.toLowerCase();
                if (groupIndicators.some(indicator => nameLower.includes(indicator))) {
                  contactType = 'GROUP';
                }
              }
              
              // Check phone number patterns for group indicators
              if (message.phoneNumber.includes('group') || 
                  message.phoneNumber.includes('chat') ||
                  message.phoneNumber.includes('broadcast')) {
                contactType = 'GROUP';
              }

              contact = await prisma.contact.create({
                data: {
                  phoneNumber: message.phoneNumber,
                  name: message.contactName || null,
                  type: contactType
                }
              });
              console.log(`👤 Created ${contactType.toLowerCase()} contact: ${contact.phoneNumber} (${contact.name || 'No name'})`);
            }

            // Create message
            await prisma.message.create({
              data: {
                messageType: message.messageType,
                direction: message.direction,
                content: message.content,
                timestamp: message.timestamp,
                sender: (message.direction === 'FROM' || message.direction === 'UNKNOWN') ? { connect: { id: contact.id } } : undefined,
                receiver: message.direction === 'TO' ? { connect: { id: contact.id } } : undefined,
                attachment: message.attachments,
                location: message.locations,
                deleted: message.deleted,
                rawLine: JSON.stringify(message.rawData)
              }
            });

            importedCount++;
            if (importedCount % 10 === 0) {
              console.log(`📈 Imported ${importedCount}/${records.length} messages...`);
            }

          } catch (error) {
            errorCount++;
            console.error(`❌ Error importing message ${message.id}:`, error);
          }
        }

        console.log(`\n🎉 CSV IMPORT COMPLETE:`);
        console.log(`   Messages imported: ${importedCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Success rate: ${((importedCount / records.length) * 100).toFixed(1)}%`);
        
        resolve();
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

async function main() {
  const filePath = process.argv[2];
  const maxRecords = process.argv[3] ? parseInt(process.argv[3]) : undefined;

  if (!filePath) {
    console.error('❌ Please provide CSV file path');
    console.log('Usage: npm run csv-import <file-path> [max-records]');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    await importCSVMessages(filePath, maxRecords);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
