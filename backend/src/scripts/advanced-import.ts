import { PrismaClient, MessageType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ImportStats {
  totalLines: number;
  processedRecords: number;
  createdContacts: number;
  createdMessages: number;
  errors: number;
  skippedLines: number;
}

interface ParsedMessage {
  messageType: MessageType;
  direction: 'FROM' | 'TO' | 'UNKNOWN';
  senderNumber?: string;
  senderName?: string;
  receiverNumber?: string;
  receiverName?: string;
  content?: string;
  timestamp: Date;
  attachment?: string;
  location?: string;
  rawLine?: string;
}

class AdvancedLogImporter {
  private lastContactId: number | null = null;
  private contactCache = new Map<string, number>();
  private stats: ImportStats = {
    totalLines: 0,
    processedRecords: 0,
    createdContacts: 0,
    createdMessages: 0,
    errors: 0,
    skippedLines: 0
  };

  async importLogFile(filePath: string, options: {
    dryRun?: boolean;
    skipDuplicates?: boolean;
    batchSize?: number;
  } = {}) {
    const { dryRun = false, skipDuplicates = true, batchSize = 100 } = options;
    
    console.log(`🚀 Starting ${dryRun ? 'DRY RUN' : 'LIVE'} import of ${filePath}`);
    console.log(`📊 Options: skipDuplicates=${skipDuplicates}, batchSize=${batchSize}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let currentRecord: string[] = [];
    let recordType: string | null = null;
    let batch: ParsedMessage[] = [];

    for await (const line of rl) {
      this.stats.totalLines++;
      
      // Skip empty lines
      if (!line.trim()) {
        this.stats.skippedLines++;
        continue;
      }

      // Detect record type
      if (line.startsWith('SMS') || line.startsWith('Call Log') || 
          line.startsWith('Calendar') || line.startsWith('Instant')) {
        
        // Process previous record if exists
        if (currentRecord.length > 0 && recordType) {
          const parsed = await this.processRecord(currentRecord, recordType);
          if (parsed) {
            batch.push(parsed);
            
            // Process batch when it reaches batchSize
            if (batch.length >= batchSize) {
              await this.processBatch(batch, { dryRun, skipDuplicates });
              batch = [];
            }
          }
        }
        
        // Start new record
        currentRecord = [line];
        recordType = this.detectRecordType(line);
      } else {
        // Continue current record
        currentRecord.push(line);
      }
    }

    // Process last record
    if (currentRecord.length > 0 && recordType) {
      const parsed = await this.processRecord(currentRecord, recordType);
      if (parsed) {
        batch.push(parsed);
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await this.processBatch(batch, { dryRun, skipDuplicates });
    }

    this.printStats();
  }

  private detectRecordType(line: string): string {
    if (line.startsWith('SMS')) return 'SMS';
    if (line.startsWith('Call Log')) return 'CALL';
    if (line.startsWith('Calendar')) return 'CALENDAR';
    if (line.startsWith('Instant')) return 'INSTANT';
    return 'UNKNOWN';
  }

  private async processRecord(lines: string[], recordType: string): Promise<ParsedMessage | null> {
    try {
      const fullText = lines.join('\n');
      const parsed = this.parseRecord(fullText, recordType);
      
      if (parsed) {
        parsed.rawLine = fullText;
        this.stats.processedRecords++;
        return parsed;
      }
    } catch (error) {
      console.error(`❌ Error processing record:`, error);
      console.error(`Record:`, lines.join('\n'));
      this.stats.errors++;
    }
    
    return null;
  }

  private parseRecord(text: string, recordType: string): ParsedMessage | null {
    switch (recordType) {
      case 'SMS':
        return this.parseSMS(text);
      case 'CALL':
        return this.parseCall(text);
      case 'CALENDAR':
        return this.parseCalendar(text);
      case 'INSTANT':
        return this.parseInstant(text);
      default:
        return null;
    }
  }

  private parseSMS(text: string): ParsedMessage | null {
    // Enhanced SMS parsing with better regex
    const smsPatterns = [
      // Pattern 1: SMS From 25/12/2024 From: +9607777472 Ahmed Hassan
      /SMS\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*?)\n\s*(.*)/s,
      // Pattern 2: SMS From 25/12/2024 From: +9607777472
      /SMS\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)/,
      // Pattern 3: SMS From 25/12/2024 (no number)
      /SMS\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})/
    ];

    for (const pattern of smsPatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, direction, dateStr, number, name, content] = match;
        const timestamp = this.parseDate(dateStr);
        
        return {
          messageType: MessageType.SMS,
          direction: direction.toUpperCase() as 'FROM' | 'TO',
          senderNumber: direction === 'From' ? number : undefined,
          senderName: direction === 'From' ? name?.trim() : undefined,
          receiverNumber: direction === 'To' ? number : undefined,
          receiverName: direction === 'To' ? name?.trim() : undefined,
          content: content?.trim() || 'SMS message',
          timestamp
        };
      }
    }
    
    return null;
  }

  private parseCall(text: string): ParsedMessage | null {
    const callPatterns = [
      /Call Log\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*)/,
      /Call Log\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})/
    ];

    for (const pattern of callPatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, direction, dateStr, number, name] = match;
        const timestamp = this.parseDate(dateStr);
        
        return {
          messageType: MessageType.CALL,
          direction: direction.toUpperCase() as 'FROM' | 'TO',
          senderNumber: direction === 'From' ? number : undefined,
          senderName: direction === 'From' ? name?.trim() : undefined,
          receiverNumber: direction === 'To' ? number : undefined,
          receiverName: direction === 'To' ? name?.trim() : undefined,
          content: 'Call',
          timestamp
        };
      }
    }
    
    return null;
  }

  private parseCalendar(text: string): ParsedMessage | null {
    const calendarPatterns = [
      /Calendar\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)\s*-\s*(.*)/,
      /Calendar\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)/
    ];

    for (const pattern of calendarPatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, dateStr, timeStr, content] = match;
        const timestamp = timeStr ? this.parseDateTime(dateStr, timeStr) : this.parseDate(dateStr);
        
        return {
          messageType: MessageType.INSTANT, // Using INSTANT for calendar events
          direction: 'UNKNOWN',
          content: content?.trim(),
          timestamp
        };
      }
    }
    
    return null;
  }

  private parseInstant(text: string): ParsedMessage | null {
    const instantPatterns = [
      /Instant\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*?)\n\s*(.*)/s,
      /Instant\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)/,
      /Instant\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})/
    ];

    for (const pattern of instantPatterns) {
      const match = text.match(pattern);
      if (match) {
        const [, direction, dateStr, number, name, content] = match;
        const timestamp = this.parseDate(dateStr);
        
        return {
          messageType: MessageType.INSTANT,
          direction: direction.toUpperCase() as 'FROM' | 'TO',
          senderNumber: direction === 'From' ? number : undefined,
          senderName: direction === 'From' ? name?.trim() : undefined,
          receiverNumber: direction === 'To' ? number : undefined,
          receiverName: direction === 'To' ? name?.trim() : undefined,
          content: content?.trim() || 'Instant message',
          timestamp
        };
      }
    }
    
    return null;
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  private parseDateTime(dateStr: string, timeStr: string): Date {
    const [day, month, year] = dateStr.split('/');
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':');
    
    let hour24 = parseInt(hours);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes));
  }

  private async processBatch(messages: ParsedMessage[], options: { dryRun: boolean; skipDuplicates: boolean }) {
    if (options.dryRun) {
      console.log(`📝 DRY RUN: Would process ${messages.length} messages`);
      return;
    }

    for (const message of messages) {
      try {
        await this.insertMessage(message, options.skipDuplicates);
      } catch (error) {
        console.error(`❌ Error inserting message:`, error);
        this.stats.errors++;
      }
    }
  }

  private async getOrCreateContact(phoneNumber: string, name?: string): Promise<number> {
    // Check cache first
    if (this.contactCache.has(phoneNumber)) {
      return this.contactCache.get(phoneNumber)!;
    }

    // Check database
    let contact = await prisma.contact.findUnique({
      where: { phoneNumber }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          phoneNumber,
          name: name || null,
          type: 'INDIVIDUAL'
        }
      });
      this.stats.createdContacts++;
    }

    // Cache the result
    this.contactCache.set(phoneNumber, contact.id);
    this.lastContactId = contact.id;
    
    return contact.id;
  }

  private async insertMessage(parsed: ParsedMessage, skipDuplicates: boolean) {
    // Check for duplicates if requested
    if (skipDuplicates) {
      const existing = await prisma.message.findFirst({
        where: {
          messageType: parsed.messageType,
          direction: parsed.direction,
          timestamp: parsed.timestamp,
          content: parsed.content
        }
      });
      
      if (existing) {
        console.log(`⏭️  Skipping duplicate message`);
        return;
      }
    }

    let senderId: number | null = null;
    let receiverId: number | null = null;

    // Handle sender
    if (parsed.senderNumber) {
      senderId = await this.getOrCreateContact(parsed.senderNumber, parsed.senderName);
    }

    // Handle receiver
    if (parsed.receiverNumber) {
      receiverId = await this.getOrCreateContact(parsed.receiverNumber, parsed.receiverName);
    } else if (parsed.direction === 'TO' && this.lastContactId) {
      // Use last known contact as receiver if missing
      receiverId = this.lastContactId;
    }

    // Create message
    await prisma.message.create({
      data: {
        messageType: parsed.messageType,
        direction: parsed.direction,
        senderId,
        receiverId,
        timestamp: parsed.timestamp,
        content: parsed.content,
        attachment: parsed.attachment,
        location: parsed.location,
        rawLine: parsed.rawLine || null
      }
    });

    this.stats.createdMessages++;
    console.log(`✅ Imported ${parsed.messageType} message from ${parsed.senderNumber || 'unknown'}`);
  }

  private printStats() {
    console.log('\n📊 Import Statistics:');
    console.log(`   Total lines processed: ${this.stats.totalLines}`);
    console.log(`   Records processed: ${this.stats.processedRecords}`);
    console.log(`   Contacts created: ${this.stats.createdContacts}`);
    console.log(`   Messages created: ${this.stats.createdMessages}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Skipped lines: ${this.stats.skippedLines}`);
    console.log(`   Success rate: ${((this.stats.processedRecords - this.stats.errors) / this.stats.processedRecords * 100).toFixed(1)}%`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const logFilePath = args[0];
  
  if (!logFilePath) {
    console.error('❌ Please provide log file path');
    console.error('Usage: npm run import-advanced <path-to-log.txt> [--dry-run] [--no-skip-duplicates] [--batch-size=100]');
    process.exit(1);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ File not found: ${logFilePath}`);
    process.exit(1);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    skipDuplicates: !args.includes('--no-skip-duplicates'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100')
  };

  const importer = new AdvancedLogImporter();
  
  try {
    await importer.importLogFile(logFilePath, options);
    console.log('🎉 Import completed successfully!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { AdvancedLogImporter };
