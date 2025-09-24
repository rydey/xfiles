import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ParsedMessage {
  messageType: 'SMS' | 'CALL' | 'INSTANT' | 'CALENDAR';
  direction: 'FROM' | 'TO' | 'UNKNOWN';
  senderNumber?: string;
  senderName?: string;
  receiverNumber?: string;
  receiverName?: string;
  content?: string;
  timestamp: Date;
  attachment?: string;
  location?: string;
}

class LogImporter {
  private lastContactId: number | null = null;
  private contactCache = new Map<string, number>();

  async importLogFile(filePath: string) {
    console.log(`🚀 Starting import of ${filePath}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    let currentRecord: string[] = [];
    let recordType: string | null = null;

    for await (const line of rl) {
      lineNumber++;
      
      // Skip empty lines
      if (!line.trim()) continue;

      // Detect record type
      if (line.startsWith('SMS') || line.startsWith('Call Log') || 
          line.startsWith('Calendar') || line.startsWith('Instant')) {
        
        // Process previous record if exists
        if (currentRecord.length > 0 && recordType) {
          await this.processRecord(currentRecord, recordType);
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
      await this.processRecord(currentRecord, recordType);
    }

    console.log(`✅ Import completed. Processed ${lineNumber} lines.`);
  }

  private detectRecordType(line: string): string {
    if (line.startsWith('SMS')) return 'SMS';
    if (line.startsWith('Call Log')) return 'CALL';
    if (line.startsWith('Calendar')) return 'CALENDAR';
    if (line.startsWith('Instant')) return 'INSTANT';
    return 'UNKNOWN';
  }

  private async processRecord(lines: string[], recordType: string) {
    try {
      const parsed = this.parseRecord(lines, recordType);
      if (parsed) {
        await this.insertMessage(parsed, lines.join('\n'));
      }
    } catch (error) {
      console.error(`❌ Error processing record:`, error);
      console.error(`Record:`, lines.join('\n'));
    }
  }

  private parseRecord(lines: string[], recordType: string): ParsedMessage | null {
    const fullText = lines.join('\n');
    
    switch (recordType) {
      case 'SMS':
        return this.parseSMS(fullText);
      case 'CALL':
        return this.parseCall(fullText);
      case 'CALENDAR':
        return this.parseCalendar(fullText);
      case 'INSTANT':
        return this.parseInstant(fullText);
      default:
        return null;
    }
  }

  private parseSMS(text: string): ParsedMessage | null {
    // SMS From 25/12/2024 From: +9607777472 Ahmed Hassan
    // Hey, how are you?
    const smsMatch = text.match(/SMS\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*?)\n\s*(.*)/s);
    
    if (!smsMatch) return null;

    const [, direction, dateStr, number, name, content] = smsMatch;
    const timestamp = this.parseDate(dateStr);
    
    return {
      messageType: 'SMS',
      direction: direction.toUpperCase() as 'FROM' | 'TO',
      senderNumber: direction === 'From' ? number : undefined,
      senderName: direction === 'From' ? name?.trim() : undefined,
      receiverNumber: direction === 'To' ? number : undefined,
      receiverName: direction === 'To' ? name?.trim() : undefined,
      content: content?.trim(),
      timestamp
    };
  }

  private parseCall(text: string): ParsedMessage | null {
    // Call Log From 25/12/2024 From: +9607777472 Ahmed Hassan
    const callMatch = text.match(/Call Log\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*)/);
    
    if (!callMatch) return null;

    const [, direction, dateStr, number, name] = callMatch;
    const timestamp = this.parseDate(dateStr);
    
    return {
      messageType: 'CALL',
      direction: direction.toUpperCase() as 'FROM' | 'TO',
      senderNumber: direction === 'From' ? number : undefined,
      senderName: direction === 'From' ? name?.trim() : undefined,
      receiverNumber: direction === 'To' ? number : undefined,
      receiverName: direction === 'To' ? name?.trim() : undefined,
      content: 'Call',
      timestamp
    };
  }

  private parseCalendar(text: string): ParsedMessage | null {
    // Calendar 25/12/2024 10:00 AM - Meeting with John
    const calendarMatch = text.match(/Calendar\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}\s+[AP]M)\s*-\s*(.*)/);
    
    if (!calendarMatch) return null;

    const [, dateStr, timeStr, content] = calendarMatch;
    const timestamp = this.parseDateTime(dateStr, timeStr);
    
    return {
      messageType: 'CALENDAR',
      direction: 'UNKNOWN',
      content: content?.trim(),
      timestamp
    };
  }

  private parseInstant(text: string): ParsedMessage | null {
    // Instant From 25/12/2024 From: +9607777472 Ahmed Hassan
    // Hey, how are you?
    const instantMatch = text.match(/Instant\s+(From|To)\s+(\d{2}\/\d{2}\/\d{4})\s+(?:From|To):\s*([^\s]+)?\s*(.*?)\n\s*(.*)/s);
    
    if (!instantMatch) return null;

    const [, direction, dateStr, number, name, content] = instantMatch;
    const timestamp = this.parseDate(dateStr);
    
    return {
      messageType: 'INSTANT',
      direction: direction.toUpperCase() as 'FROM' | 'TO',
      senderNumber: direction === 'From' ? number : undefined,
      senderName: direction === 'From' ? name?.trim() : undefined,
      receiverNumber: direction === 'To' ? number : undefined,
      receiverName: direction === 'To' ? name?.trim() : undefined,
      content: content?.trim(),
      timestamp
    };
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
    }

    // Cache the result
    this.contactCache.set(phoneNumber, contact.id);
    this.lastContactId = contact.id;
    
    return contact.id;
  }

  private async insertMessage(parsed: ParsedMessage, rawLine: string) {
    try {
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
          rawLine
        }
      });

      console.log(`✅ Imported ${parsed.messageType} message from ${parsed.senderNumber || 'unknown'}`);
    } catch (error) {
      console.error(`❌ Error inserting message:`, error);
      console.error(`Parsed data:`, parsed);
    }
  }
}

// Main execution
async function main() {
  const logFilePath = process.argv[2];
  
  if (!logFilePath) {
    console.error('❌ Please provide log file path');
    console.error('Usage: npm run import-log <path-to-log.txt>');
    process.exit(1);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ File not found: ${logFilePath}`);
    process.exit(1);
  }

  const importer = new LogImporter();
  
  try {
    await importer.importLogFile(logFilePath);
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

export { LogImporter };
