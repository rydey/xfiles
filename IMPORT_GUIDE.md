# 📥 Log Import Guide

This guide explains how to import your messy log.txt data into the communication management system database.

## 🚀 Quick Start

### 1. Basic Import
```bash
cd backend
npm run import-log /path/to/your/log.txt
```

### 2. Advanced Import with Options
```bash
# Dry run (test without inserting data)
npm run import-advanced /path/to/your/log.txt --dry-run

# Skip duplicate detection
npm run import-advanced /path/to/your/log.txt --no-skip-duplicates

# Custom batch size
npm run import-advanced /path/to/your/log.txt --batch-size=50
```

## 📋 Supported Log Formats

### SMS Messages
```
SMS From 25/12/2024 From: +9607777472 Ahmed Hassan
Hey, how are you? Can we meet tomorrow?

SMS To 25/12/2024 To: +9607777472 Ahmed Hassan
Sure, what time works for you?
```

### Call Logs
```
Call Log From 25/12/2024 From: +9607777472 Ahmed Hassan

Call Log To 25/12/2024 To: +9607777472 Ahmed Hassan
```

### Calendar Events
```
Calendar 25/12/2024 10:00 AM - Meeting with John
Discuss project timeline and deliverables

Calendar 25/12/2024 2:00 PM - Team Standup
Daily progress review with development team
```

### Instant Messages
```
Instant From 25/12/2024 From: +9607777472 Ahmed Hassan
Thanks for the call earlier!

Instant To 25/12/2024 To: +9607777472 Ahmed Hassan
No problem, see you tomorrow!
```

## 🔧 Import Process

### Step 1: Parse Detection
The importer automatically detects record types by looking for:
- `SMS` - SMS messages
- `Call Log` - Phone calls
- `Calendar` - Calendar events
- `Instant` - Instant messages

### Step 2: Data Extraction
For each record, the importer extracts:
- **Message Type**: SMS, CALL, CALENDAR, INSTANT
- **Direction**: FROM, TO, UNKNOWN
- **Phone Numbers**: Sender and receiver numbers
- **Names**: Contact names when available
- **Content**: Message content or event description
- **Timestamp**: Parsed from date/time strings
- **Raw Line**: Original text for traceability

### Step 3: Contact Management
- **Auto-creation**: Contacts are created automatically when first encountered
- **Caching**: Phone numbers are cached to avoid duplicate lookups
- **Name updates**: If a contact exists but gets a name later, the name is updated
- **Last contact tracking**: Missing receiver numbers use the last known contact

### Step 4: Message Insertion
- **Batch processing**: Messages are processed in batches for performance
- **Duplicate detection**: Optional duplicate checking based on content and timestamp
- **Error handling**: Failed records are logged but don't stop the import

## 📊 Import Statistics

After each import, you'll see statistics like:
```
📊 Import Statistics:
   Total lines processed: 150
   Records processed: 45
   Contacts created: 12
   Messages created: 45
   Errors: 2
   Skipped lines: 8
   Success rate: 95.6%
```

## 🛠️ Advanced Features

### Dry Run Mode
Test your import without actually inserting data:
```bash
npm run import-advanced /path/to/log.txt --dry-run
```

### Duplicate Handling
By default, duplicates are skipped. To allow duplicates:
```bash
npm run import-advanced /path/to/log.txt --no-skip-duplicates
```

### Batch Size Control
Control memory usage with batch size:
```bash
npm run import-advanced /path/to/log.txt --batch-size=25
```

## 🔍 Data Quality Features

### Missing Data Handling
- **Empty "To:" numbers**: Uses last known contact as receiver
- **Missing names**: Contacts created with phone number only
- **Malformed dates**: Skips invalid records with error logging
- **Empty content**: Uses default content like "Call" or "SMS message"

### Error Recovery
- **Line-by-line processing**: One bad record doesn't stop the entire import
- **Detailed logging**: Each error includes the problematic line
- **Statistics tracking**: Monitor success rates and error patterns

## 📝 Pre-Import Checklist

Before running the import:

1. **Backup your database** (if you have existing data)
2. **Test with a small sample** first
3. **Check log file encoding** (should be UTF-8)
4. **Verify date formats** (DD/MM/YYYY expected)
5. **Review phone number formats** (should include country codes)

## 🚨 Common Issues & Solutions

### Issue: "No such file or directory"
**Solution**: Check the file path is correct and the file exists

### Issue: "Database connection failed"
**Solution**: Ensure PostgreSQL is running and the database exists

### Issue: "Invalid date format"
**Solution**: Check your log file uses DD/MM/YYYY format

### Issue: "Duplicate key error"
**Solution**: Use `--no-skip-duplicates` or clean existing data first

## 📈 Performance Tips

### Large Files
- Use smaller batch sizes (e.g., `--batch-size=25`)
- Monitor memory usage during import
- Consider splitting very large files

### Network Issues
- Import locally first, then sync to production
- Use database transactions for consistency

### Memory Management
- Close file handles properly
- Use streaming for large files
- Monitor Node.js memory usage

## 🔄 Post-Import Tasks

After successful import:

1. **Verify data quality** in the admin dashboard
2. **Create categories** for better organization
3. **Assign contacts to categories** as needed
4. **Review and correct** any parsing errors
5. **Set up regular backups** of your data

## 📞 Support

If you encounter issues:

1. **Check the logs** for specific error messages
2. **Test with sample data** to isolate problems
3. **Review the database** for partial imports
4. **Contact support** with error details and sample data

---

**Happy importing! 🎉**
