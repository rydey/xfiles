import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ParsedMessage {
  id: number;
  type: 'SMS' | 'INSTANT';
  direction: 'FROM' | 'TO' | 'UNKNOWN';
  timestamp: Date;
  phoneNumber?: string;
  name?: string;
  content: string;
  rawLines: string[];
}

interface DebugStats {
  totalLines: number;
  processedRecords: number;
  createdContacts: number;
  createdMessages: number;
  errors: number;
  skippedLines: number;
  debugMessages: string[];
}

class DebugLogParser {
  private contactCache = new Map<string, number>();
  private lastContactId: number | null = null;
  private stats: DebugStats = {
    totalLines: 0,
    processedRecords: 0,
    createdContacts: 0,
    createdMessages: 0,
    errors: 0,
    skippedLines: 0,
    debugMessages: []
  };

  async parseLogFile(filePath: string, maxMessages: number = 100) {
    console.log(`🔍 DEBUG: Starting parse of ${filePath} (max ${maxMessages} messages)`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let batch: ParsedMessage[] = [];
    let currentRecord: string[] = [];
    let isProcessingMessage = false;
    let recordId = 0;
    let messageCount = 0;

    for await (const line of rl) {
      this.stats.totalLines++;
      
      // Stop if we've reached the max messages
      if (messageCount >= maxMessages) {
        console.log(`🛑 DEBUG: Reached max messages limit (${maxMessages})`);
        break;
      }
      
      // Skip empty lines
      if (!line.trim()) {
        this.stats.skippedLines++;
        continue;
      }

      // Check if this is a new message start (ID + type + date pattern)
      const isNewMessage = this.isMessageStart(line);
      
      if (isNewMessage && currentRecord.length > 0) {
        // Process previous message
        const parsed = this.parseMessageRecord(currentRecord, recordId);
        if (parsed) {
          batch.push(parsed);
          this.stats.processedRecords++;
          messageCount++;
          
          // Process batch when it reaches 10
          if (batch.length >= 10) {
            await this.processBatch(batch);
            batch = [];
          }
        }
        currentRecord = [];
        recordId++;
      }
      
      // Start new message or continue current one
      if (isNewMessage) {
        isProcessingMessage = true;
        currentRecord = [line];
        this.stats.debugMessages.push(`🆕 NEW MESSAGE: ${line.substring(0, 100)}...`);
      } else if (isProcessingMessage) {
        // This is a continuation line
        currentRecord.push(line);
        this.stats.debugMessages.push(`📝 CONTINUATION: ${line.substring(0, 100)}...`);
      } else {
        // Skip lines that don't belong to any message
        this.stats.skippedLines++;
        this.stats.debugMessages.push(`⏭️  SKIPPED: ${line.substring(0, 100)}...`);
      }
    }

    // Process last message
    if (currentRecord.length > 0 && messageCount < maxMessages) {
      const parsed = this.parseMessageRecord(currentRecord, recordId);
      if (parsed) {
        batch.push(parsed);
        this.stats.processedRecords++;
        messageCount++;
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await this.processBatch(batch);
    }

    this.printDebugStats();
  }

  private isMessageStart(line: string): boolean {
    // Pattern: ID + type + direction + date
    // Examples: "43 SMS From 05/06/2014" or "76 Instant 05/06/2014"
    const messageStartPattern = /^\s*(\d+)\s+(SMS|Instant)\s+(From|To)?\s+(\d{2}\/\d{2}\/\d{4})/;
    const isMatch = messageStartPattern.test(line);
    
    if (isMatch) {
      this.stats.debugMessages.push(`✅ MATCH: ${line.substring(0, 100)}...`);
    } else {
      this.stats.debugMessages.push(`❌ NO MATCH: ${line.substring(0, 100)}...`);
    }
    
    return isMatch;
  }

  private parseMessageRecord(lines: string[], recordId: number): ParsedMessage | null {
    try {
      if (lines.length === 0) return null;

      const startLine = lines[0];
      this.stats.debugMessages.push(`🔍 PARSING RECORD ${recordId}: ${startLine.substring(0, 100)}...`);
      
      // Parse the start line: ID + type + direction + date + rest
      const startMatch = startLine.match(/^\s*(\d+)\s+(SMS|Instant)\s+(From|To)?\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);
      
      if (!startMatch) {
        this.stats.debugMessages.push(`⚠️  Could not parse start line: ${startLine}`);
        return null;
      }

      const [, id, type, direction, dateStr, rest] = startMatch;
      this.stats.debugMessages.push(`📊 PARSED: ID=${id}, Type=${type}, Direction=${direction}, Date=${dateStr}`);
      
      // Only process SMS and Instant messages
      if (type !== 'SMS' && type !== 'Instant') {
        this.stats.debugMessages.push(`⏭️  Skipping non-SMS/Instant: ${type}`);
        return null;
      }

      // Extract phone number and name from the rest of the start line
      const { phoneNumber, name, contentStart } = this.extractPhoneAndName(rest);
      this.stats.debugMessages.push(`📞 PHONE: ${phoneNumber}, NAME: ${name}, CONTENT_START: ${contentStart}`);
      
      // Find the time from the continuation line (Messages line)
      let timeStr = '';
      let contentLines: string[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for time pattern in Messages line
        const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})\(UTC\+0\)/);
        if (timeMatch) {
          timeStr = timeMatch[1];
          this.stats.debugMessages.push(`⏰ TIME FOUND: ${timeStr}`);
        }
        
        // Collect content from all lines (excluding the start line)
        if (i === 1) {
          // First continuation line - extract content after time
          const contentMatch = line.replace(/\d{2}:\d{2}:\d{2}\(UTC\+0\)/, '').trim();
          if (contentMatch) {
            contentLines.push(contentMatch);
            this.stats.debugMessages.push(`📝 CONTENT LINE 1: ${contentMatch}`);
          }
        } else {
          // Wrapped lines - add as content
          const trimmedLine = line.trim();
          if (trimmedLine) {
            contentLines.push(trimmedLine);
            this.stats.debugMessages.push(`📝 CONTENT LINE ${i}: ${trimmedLine}`);
          }
        }
      }

      // Combine all content
      const allContent = [contentStart, ...contentLines].filter(Boolean).join(' ');
      this.stats.debugMessages.push(`📄 FINAL CONTENT: ${allContent.substring(0, 200)}...`);
      
      // Parse timestamp
      const timestamp = this.parseTimestamp(dateStr, timeStr);
      this.stats.debugMessages.push(`📅 TIMESTAMP: ${timestamp.toISOString()}`);
      
      // Determine direction
      const messageDirection = this.determineDirection(direction, phoneNumber);
      this.stats.debugMessages.push(`🧭 DIRECTION: ${messageDirection}`);

      return {
        id: parseInt(id),
        type: type === 'SMS' ? 'SMS' : 'INSTANT',
        direction: messageDirection,
        timestamp,
        phoneNumber,
        name,
        content: allContent || 'No content',
        rawLines: lines
      };
    } catch (error) {
      console.error(`❌ Error parsing message record:`, error);
      this.stats.errors++;
      return null;
    }
  }

  private extractPhoneAndName(text: string): { phoneNumber?: string; name?: string; contentStart: string } {
    if (!text) return { contentStart: '' };

    // Look for From: or To: pattern
    const fromMatch = text.match(/From:\s*([^\s]+)(?:\s+(.*))?/);
    const toMatch = text.match(/To:\s*([^\s]+)(?:\s+(.*))?/);
    
    if (fromMatch) {
      const phoneNumber = fromMatch[1];
      const name = fromMatch[2]?.trim();
      const contentStart = text.replace(/From:\s*[^\s]+(?:\s+.*)?/, '').trim();
      return { phoneNumber, name, contentStart };
    }
    
    if (toMatch) {
      const phoneNumber = toMatch[1];
      const name = toMatch[2]?.trim();
      const contentStart = text.replace(/To:\s*[^\s]+(?:\s+.*)?/, '').trim();
      return { phoneNumber, name, contentStart };
    }
    
    // No From/To found, treat as content
    return { contentStart: text.trim() };
  }

  private determineDirection(direction: string | undefined, phoneNumber?: string): 'FROM' | 'TO' | 'UNKNOWN' {
    if (direction === 'From') return 'FROM';
    if (direction === 'To') return 'TO';
    
    // If no direction specified but has phone number, assume it's FROM
    if (phoneNumber) return 'FROM';
    
    return 'UNKNOWN';
  }

  private parseTimestamp(dateStr: string, timeStr: string): Date {
    const [day, month, year] = dateStr.split('/');
    
    if (timeStr) {
      const [hours, minutes, seconds] = timeStr.split(':');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                     parseInt(hours), parseInt(minutes), parseInt(seconds));
    } else {
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }

  private async processBatch(messages: ParsedMessage[]) {
    console.log(`🔄 Processing batch of ${messages.length} messages`);
    
    for (const message of messages) {
      try {
        await this.insertMessage(message);
        console.log(`✅ Imported ${message.type} ${message.direction} from ${message.phoneNumber || 'unknown'}: ${message.content.substring(0, 50)}...`);
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

  private async insertMessage(parsed: ParsedMessage) {
    let senderId: number | null = null;
    let receiverId: number | null = null;

    // Handle sender/receiver based on direction
    if (parsed.phoneNumber) {
      const contactId = await this.getOrCreateContact(parsed.phoneNumber, parsed.name);
      
      if (parsed.direction === 'FROM') {
        senderId = contactId;
      } else if (parsed.direction === 'TO') {
        receiverId = contactId;
      } else {
        // Unknown direction - assume sender
        senderId = contactId;
      }
    } else if (parsed.direction === 'TO' && this.lastContactId) {
      // Missing receiver number - use last known contact
      receiverId = this.lastContactId;
    }

    // Create message
    await prisma.message.create({
      data: {
        messageType: parsed.type,
        direction: parsed.direction,
        senderId,
        receiverId,
        timestamp: parsed.timestamp,
        content: parsed.content,
        rawLine: parsed.rawLines.join('\n')
      }
    });

    this.stats.createdMessages++;
  }

  private printDebugStats() {
    console.log('\n🔍 DEBUG STATISTICS:');
    console.log(`   Total lines processed: ${this.stats.totalLines}`);
    console.log(`   Records processed: ${this.stats.processedRecords}`);
    console.log(`   Contacts created: ${this.stats.createdContacts}`);
    console.log(`   Messages created: ${this.stats.createdMessages}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Skipped lines: ${this.stats.skippedLines}`);
    console.log(`   Success rate: ${((this.stats.processedRecords - this.stats.errors) / this.stats.processedRecords * 100).toFixed(1)}%`);
    
    console.log('\n🔍 DEBUG MESSAGES (last 20):');
    this.stats.debugMessages.slice(-20).forEach(msg => console.log(`   ${msg}`));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const logFilePath = args[0];
  const maxMessages = parseInt(args[1]) || 100;
  
  if (!logFilePath) {
    console.error('❌ Please provide log file path');
    console.error('Usage: npm run debug-parse-log <path-to-log.txt> [max-messages]');
    process.exit(1);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ File not found: ${logFilePath}`);
    process.exit(1);
  }

  const parser = new DebugLogParser();
  
  try {
    await parser.parseLogFile(logFilePath, maxMessages);
    console.log('🎉 Debug import completed!');
  } catch (error) {
    console.error('❌ Debug import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { DebugLogParser };

