import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ParsedRecord {
  id: number;
  type: 'SMS Messages' | 'Instant Messages';
  direction?: 'From' | 'To';
  timestamp: Date;
  phoneNumber?: string;
  name?: string;
  content?: string;
  attachment?: string;
  location?: string;
  deleted: boolean;
  rawLine: string;
}

interface ImportStats {
  totalLines: number;
  processedRecords: number;
  createdContacts: number;
  createdMessages: number;
  errors: number;
  skippedLines: number;
}

class MultilineLogParser {
  private contactCache = new Map<string, number>();
  private stats: ImportStats = {
    totalLines: 0,
    processedRecords: 0,
    createdContacts: 0,
    createdMessages: 0,
    errors: 0,
    skippedLines: 0
  };

  async parseLogFile(filePath: string, options: {
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

    let batch: ParsedRecord[] = [];
    let currentRecord: string[] = [];
    let isHeader = true;
    let recordId = 0;

    for await (const line of rl) {
      this.stats.totalLines++;
      
      // Skip empty lines
      if (!line.trim()) {
        this.stats.skippedLines++;
        continue;
      }

      // Skip header lines
      if (isHeader) {
        if (line.includes('Type') && line.includes('Direction')) {
          isHeader = false;
        }
        this.stats.skippedLines++;
        continue;
      }

      // Skip separator lines
      if (line.includes('---') || line.match(/^\s*$/)) {
        this.stats.skippedLines++;
        continue;
      }

      // Check if this is a new record (starts with a number)
      const isNewRecord = /^\s*\d+\s+/.test(line);
      
      if (isNewRecord && currentRecord.length > 0) {
        // Process previous record
        const parsed = this.parseMultilineRecord(currentRecord, recordId);
        if (parsed) {
          batch.push(parsed);
          this.stats.processedRecords++;
          
          // Process batch when it reaches batchSize
          if (batch.length >= batchSize) {
            await this.processBatch(batch, { dryRun, skipDuplicates });
            batch = [];
          }
        }
        currentRecord = [];
        recordId++;
      }
      
      currentRecord.push(line);
    }

    // Process last record
    if (currentRecord.length > 0) {
      const parsed = this.parseMultilineRecord(currentRecord, recordId);
      if (parsed) {
        batch.push(parsed);
        this.stats.processedRecords++;
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await this.processBatch(batch, { dryRun, skipDuplicates });
    }

    this.printStats();
  }

  private parseMultilineRecord(lines: string[], recordId: number): ParsedRecord | null {
    try {
      const fullText = lines.join('\n');
      
      // Extract the main line (first line with the record number)
      const mainLine = lines[0];
      
      // Parse the main line
      const mainMatch = mainLine.match(/^\s*(\d+)\s+(\w+(?:\s+\w+)?)\s+(\w+)?\s+(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+(Yes|No)?\s*$/);
      
      if (!mainMatch) {
        return null;
      }

      const [, id, type, direction, date, rest, deleted] = mainMatch;
      
      // Extract phone number and name from the rest of the line
      const { phoneNumber, name } = this.extractPhoneAndName(rest);
      
      // Extract content from all lines (description might be on continuation lines)
      const content = this.extractContent(lines);
      
      // Parse timestamp
      const timestamp = this.parseTimestamp(date, lines);
      
      // Only process SMS and Instant messages
      if (type.toLowerCase() !== 'sms' && type.toLowerCase() !== 'instant') {
        return null;
      }

      // Map type to our enum
      const messageType = this.mapMessageType(type);
      const messageDirection = this.mapDirection(direction);

      return {
        id: parseInt(id),
        type: messageType,
        direction: messageDirection,
        timestamp,
        phoneNumber,
        name,
        content,
        deleted: deleted === 'Yes',
        rawLine: fullText
      };
    } catch (error) {
      console.error(`❌ Error parsing record:`, error);
      return null;
    }
  }

  private extractPhoneAndName(text: string): { phoneNumber?: string; name?: string } {
    if (!text) return {};

    // Look for phone numbers (various formats)
    const phonePatterns = [
      /(\+?\d{7,15})/,  // Standard phone numbers
      /(\d{7,15})/      // Numbers without country code
    ];

    for (const pattern of phonePatterns) {
      const match = text.match(pattern);
      if (match) {
        const phoneNumber = match[1];
        const name = text.replace(phoneNumber, '').trim();
        return {
          phoneNumber,
          name: name || undefined
        };
      }
    }

    // If no phone number found, treat the whole text as name
    return { name: text.trim() || undefined };
  }

  private extractContent(lines: string[]): string | undefined {
    // Look for content in the lines
    // Content is usually in the description column or continuation lines
    const contentLines = lines.filter(line => {
      // Skip the main record line
      if (/^\s*\d+\s+/.test(line)) return false;
      // Skip timestamp lines
      if (/\d{2}:\d{2}:\d{2}\(UTC\+0\)/.test(line)) return false;
      // Skip empty lines
      if (!line.trim()) return false;
      return true;
    });

    if (contentLines.length > 0) {
      return contentLines.join(' ').trim();
    }

    return undefined;
  }

  private parseTimestamp(dateStr: string, lines: string[]): Date {
    // Look for time in the lines
    let timeStr = '';
    for (const line of lines) {
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})\(UTC\+0\)/);
      if (timeMatch) {
        timeStr = timeMatch[1];
        break;
      }
    }

    const [day, month, year] = dateStr.split('/');
    
    if (timeStr) {
      const [hours, minutes, seconds] = timeStr.split(':');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                     parseInt(hours), parseInt(minutes), parseInt(seconds));
    } else {
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  private mapMessageType(type: string): 'SMS Messages' | 'Instant Messages' {
    switch (type.toLowerCase()) {
      case 'sms messages': return 'SMS Messages';
      case 'instant messages': return 'Instant Messages';
      default: return 'SMS Messages';
    }
  }

  private mapDirection(direction: string | undefined): 'From' | 'To' | undefined {
    if (!direction) return undefined;
    return direction === 'From' ? 'From' : direction === 'To' ? 'To' : undefined;
  }

  private async processBatch(records: ParsedRecord[], options: { dryRun: boolean; skipDuplicates: boolean }) {
    if (options.dryRun) {
      console.log(`📝 DRY RUN: Would process ${records.length} records`);
      records.slice(0, 5).forEach(record => {
        console.log(`   - ${record.type} from ${record.phoneNumber || 'unknown'} at ${record.timestamp.toISOString()}`);
      });
      if (records.length > 5) {
        console.log(`   ... and ${records.length - 5} more records`);
      }
      return;
    }

    for (const record of records) {
      try {
        await this.insertRecord(record, options.skipDuplicates);
      } catch (error) {
        console.error(`❌ Error inserting record:`, error);
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
    
    return contact.id;
  }

  private async insertRecord(record: ParsedRecord, skipDuplicates: boolean) {
    // Check for duplicates if requested
    if (skipDuplicates) {
      const existing = await prisma.message.findFirst({
        where: {
          messageType: this.mapToMessageType(record.type),
          direction: this.mapToDirection(record.direction),
          timestamp: record.timestamp,
          content: record.content
        }
      });
      
      if (existing) {
        console.log(`⏭️  Skipping duplicate record`);
        return;
      }
    }

    let senderId: number | null = null;
    let receiverId: number | null = null;

    // Handle sender/receiver based on direction
    if (record.phoneNumber) {
      const contactId = await this.getOrCreateContact(record.phoneNumber, record.name);
      
      if (record.direction === 'From') {
        senderId = contactId;
      } else if (record.direction === 'To') {
        receiverId = contactId;
      } else {
        // If no direction specified, assume it's a sender
        senderId = contactId;
      }
    }

    // Create message
    await prisma.message.create({
      data: {
        messageType: this.mapToMessageType(record.type),
        direction: this.mapToDirection(record.direction),
        senderId,
        receiverId,
        timestamp: record.timestamp,
        content: record.content,
        attachment: record.attachment,
        location: record.location,
        rawLine: record.rawLine
      }
    });

    this.stats.createdMessages++;
    console.log(`✅ Imported ${record.type} from ${record.phoneNumber || 'unknown'}`);
  }

  private mapToMessageType(type: string): 'SMS' | 'INSTANT' {
    switch (type) {
      case 'SMS Messages': return 'SMS';
      case 'Instant Messages': return 'INSTANT';
      default: return 'SMS';
    }
  }

  private mapToDirection(direction?: string): 'FROM' | 'TO' | 'UNKNOWN' {
    switch (direction) {
      case 'From': return 'FROM';
      case 'To': return 'TO';
      default: return 'UNKNOWN';
    }
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
    console.error('Usage: npm run parse-multiline-log <path-to-log.txt> [--dry-run] [--no-skip-duplicates] [--batch-size=100]');
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

  const parser = new MultilineLogParser();
  
  try {
    await parser.parseLogFile(logFilePath, options);
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

export { MultilineLogParser };
