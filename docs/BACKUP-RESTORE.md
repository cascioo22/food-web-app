# Food Webapp — Backup and Restore Guide

**Version:** 1.0.0  
**Date:** 2026-10-18  
**Platform:** Local development only (SQLite database)

---

## Overview

This guide covers backup and restore procedures for the Food Webapp project, focusing on:
1. **Database backups** (recipes, grocery lists, photos metadata)
2. **Photo file backups** (actual image files in uploads directory)
3. **Full project backups** (entire codebase + data)

---

## 1. Understanding What's Stored Where

### SQLite Database (`backend/food_webapp.db`)

The database stores:
- **Recipes:** ID, name, URL/manual entry, source attribution, instructions ordering, timestamps
- **Nutrition:** Per-serving and total nutrition values (optional per recipe)
- **Photos:** File paths, thumbnails, captions, dimensions, file sizes, recipe associations
- **Grocery Lists:** List names, item arrays (name + completion status), unique constraints

**Database Size:** Typically 10KB - 5MB depending on data volume

### Photo Files (`uploads/photos/`)

Actual image files stored here:
- Original uploaded photos
- Generated thumbnails
- Format: JPEG by default
- Size limit enforced at upload time

### Code Files (Git-tracked)

Application code and static assets are version-controlled and typically not part of backup unless custom modifications were made.

---

## 2. Backup Procedures

### 2.1 Quick Database Backup (Recommended Daily)

**Frequency:** Before each major change, or end of day

```bash
cd /opt/data/home/food-webapp-project

# Create timestamped backup
DATE=$(date +%Y%m%d_%H%M%S)
cp backend/food_webapp.db backend/food_webapp.db.backup.$DATE
```

**What this preserves:** All application data (recipes, lists, photos metadata)

---

### 2.2 Full Database + Photos Backup (Recommended Weekly)

**Frequency:** Once per week on Sunday evening

```bash
cd /opt/data/home/food-webapp-project

# Create backup directory
mkdir -p backups/$(date +%Y-%m)

# Backup database with timestamp
cp backend/food_webapp.db backups/"$(date +%Y-%m)"/food_webapp.db.backup.$(date +%Y%m%d_%H%M%S)

# Backup photos directory (if exists and has content)
if [ -d uploads/photos ]; then
    cp -r uploads/photos backups/"$(date +%Y-%m)"/photos-backup.$(date +%Y%m%d_%H%M%S)
fi

# Compress the backup folder (optional but recommended)
cd backups/"$(date +%Y-%m)"
tar czf food-webapp-backup-$(date +%Y%m%d).tar.gz \
    food_webapp.db.backup.* photos-backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null

# Clean up uncompressed files if compression succeeded
if [ -f "food-webapp-backup-$(date +%Y%m%d).tar.gz" ]; then
    rm food_webapp.db.backup.* photos-backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null
fi

cd ../..
```

**What this preserves:** Complete data state including images

---

### 2.3 Full Project Backup (Monthly or Before Major Changes)

**Frequency:** Monthly, before releasing new features, before system changes

```bash
cd /opt/data/home/food-webapp-project

# Create backup of entire project directory
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/data/backups/food-webapp

# Backup all data and code (excluding .venv and large files)
tar czf /opt/data/backups/food-webapp/food-webapp-full-backup-$DATE.tar.gz \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='*.pyc' \
    --exclude='uploads/photos/*' \  # Photos will be handled separately for speed
    --exclude='test_*.db' \  # Exclude test databases
    .

# Backup photos directory separately (can be large)
tar czf /opt/data/backups/food-webapp/photos-backup-$DATE.tar.gz uploads/photos

# Create manifest file
cat > /opt/data/backups/food-webapp/backup-manifest-$(date +%Y%m%d).txt << EOF
Backup Date: $DATE
Project Directory: /opt/data/home/food-webapp-project
Database Size: $(du -h backend/food_webapp.db | cut -f1)
Photos Size: $(du -sh uploads/photos 2>/dev/null | cut -f1 || echo "0")
Tarball Locations:
EOF

ls -lh /opt/data/backups/food-webapp/*.tar.gz >> /opt/data/backups/food-webapp/backup-manifest-$(date +%Y%m%d).txt

echo "" >> /opt/data/backups/food-webapp/backup-manifest-$(date +%Y%m%d).txt
echo "Latest backups:" >> /opt/data/backups/food-webapp/backup-manifest-$(date +%Y%m%d).txt
ls -lht /opt/data/backups/food-webapp/*.tar.gz | tail -5 >> /opt/data/backups/food-webapp/backup-manifest-$(date +%Y%m%d).txt

echo "Full project backup completed: food-webapp-full-backup-$DATE.tar.gz"
```

**What this preserves:** Everything (code, data, structure)

---

### 2.4 Incremental Database Backup (For Frequent Data Changes)

If you make frequent recipe updates and want minimal storage usage:

```bash
cd /opt/data/home/food-webapp-project

# Backup only database header + recent transactions (simplified approach)
sqlite3 backend/food_webapp.db "SELECT sqlite_version();" > backend/db-version.txt

# Full backup still recommended for critical points
cp backend/food_webapp.db backend/db-full-backup.$(date +%Y%m%d).db

# Optional: Export data to JSON for faster restore testing
sqlite3 -json backend/food_webapp.db \
    "SELECT * FROM recipes;" > backend/recipes-export-$(date +%Y%m%d).json

sqlite3 -json backend/food_webapp.db \
    "SELECT * FROM grocery_lists;" > backend/grocery-lists-export-$(date +%Y%m%d).json

sqlite3 -json backend/food_webapp.db \
    "SELECT * FROM photos;" > backend/photos-metadata-export-$(date +%Y%m%d).json
```

---

### 2.5 Backup to External Storage (Cross-Machine Safety)

**Frequency:** Same as full project backup + after major data entry

```bash
cd /opt/data/backups/food-webapp

# Copy latest tarballs to external USB or cloud sync folder
cp food-webapp-full-backup-$(date +%Y%m%d).tar.gz /media/USB_DRIVE/backup/

# Or copy to cloud-synced directory (Dropbox, Google Drive, etc.)
cp food-webapp-full-backup-$(date +%Y%m%d).tar.gz ~/Documents/Backups/food-webapp/

# Verify backup integrity on copy destination
cd /media/USB_DRIVE/backup/
tar tzf food-webapp-full-backup-*.tar.gz > /dev/null && echo "Backup verified OK"
```

---

## 3. Restore Procedures

### 3.1 Quick Database Restore (Recover After Accident)

**Use when:** You accidentally deleted data or made a bad change

```bash
cd /opt/data/home/food-webapp-project

# Stop backend server if running
pkill -f uvicorn

# Find latest backup
ls -lht backend/food_webapp.db.backup.* | head -1

# Restore from latest backup
LATEST_BACKUP=$(ls -t backend/food_webapp.db.backup.* 2>/dev/null | head -1)
cp $LATEST_BACKUP backend/food_webapp.db

# Restart backend
uvicorn app:app --host 0.0.0.0 --port 8000

echo "Database restored from: $LATEST_BACKUP"
```

---

### 3.2 Database + Photos Restore (Recent Full Backup)

**Use when:** You want to recover data from last week or so

```bash
cd /opt/data/home/food-webapp-project

# Stop backend server
pkill -f uvicorn

# Find latest backup folder for this month
LATEST_MONTH_BACKUP=$(ls -td backups/"$(date +%Y-%m)"/* 2>/dev/null | head -1)
BACKUP_DIR=$(dirname $LATEST_MONTH_BACKUP)
BACKUP_FILE=$(basename $LATEST_MONTH_BACKUP)

# Extract database
cp "$BACKUP_DIR/$BACKUP_FILE" /tmp/restore.tar.gz
tar xzf /tmp/restore.tar.gz -C backend food_webapp.db.backup.* 2>/dev/null || true

# Find latest database backup within that folder
DB_BACKUP=$(ls -t backups/"$(date +%Y-%m)"/food_webapp.db.backup.* 2>/dev/null | head -1)
cp $DB_BACKUP backend/food_webapp.db

# Restore photos if they exist in backup
if [ -d "$BACKUP_DIR/photos-backup" ]; then
    rm -rf uploads/photos  # Remove existing (will overwrite)
    cp -r "$BACKUP_DIR/photos-backup" uploads/photos
fi

# Restart backend server
uvicorn app:app --host 0.0.0.0 --port 8000

echo "Database and photos restored from: $BACKUP_DIR/$BACKUP_FILE"
```

---

### 3.3 Full Project Restore (Disaster Recovery)

**Use when:** System failure, disk corruption, or major version rollback

```bash
cd /opt/data/backups/food-webapp

# Find latest backup tarball
LATEST_BACKUP=$(ls -t food-webapp-full-backup-*.tar.gz 2>/dev/null | head -1)
echo "Restoring from: $LATEST_BACKUP"

# Create restore directory
mkdir -p /tmp/food-webapp-restore
cd /tmp/food-webapp-restore

# Extract backup
tar xzf ../$LATEST_BACKUP

# Restore to production location (backup existing first!)
BACKUP_DIR=/opt/data/home/food-webapp-project.backup.$(date +%Y%m%d_%H%M%S)
cp -r /opt/data/home/food-webapp-project $BACKUP_DIR 2>/dev/null || mkdir -p $BACKUP_DIR

# Backup photos separately (not in full tarball)
PHOTO_BACKUP=/opt/data/backups/food-webapp/photos-backup-$(date +%Y%m%d).tar.gz
if [ -f "$PHOTO_BACKUP" ]; then
    mkdir -p /opt/data/home/food-webapp-project/uploads/photos
    tar xzf $PHOTO_BACKUP -C /tmp/food-webapp-restore/uploads photos 2>/dev/null || true
fi

# Now replace with restored version
rm -rf /opt/data/home/food-webapp-project/*
cp -r /tmp/food-webapp-restore/. /opt/data/home/food-webapp-project/

# Verify database file exists
ls -lh /opt/data/home/food-webapp-project/backend/food_webapp.db

# Restart backend server to verify restore
cd /opt/data/home/food-webapp-project
source .venv/bin/activate 2>/dev/null || true
uvicorn app:app --host 0.0.0.0 --port 8000 &

sleep 3
curl -s http://localhost:8000/docs > /dev/null && echo "Restore successful! API is running." || echo "Warning: API may not be responding"

# Cleanup
cd /opt/data/backups/food-webapp
rm -rf /tmp/food-webapp-restore

echo "Full project restore completed successfully!"
```

---

### 3.4 Restore from JSON Exports (Selective Data Recovery)

**Use when:** You want to recover only specific data types without full project restore

```bash
cd /opt/data/home/food-webapp-project/backend

# Delete existing data selectively
sqlite3 food_webapp.db "DELETE FROM recipes;"
sqlite3 food_webapp.db "DELETE FROM grocery_lists;"
sqlite3 food_webapp.db "DELETE FROM photos;"

# Restore from JSON exports (if available)
for file in recipes-export-*.json grocery-lists-export-*.json photos-metadata-export-*.json; do
    if [ -f "$file" ]; then
        DATE=$(basename $file | sed 's/-export-\([0-9]*\).json/\1/')
        echo "Restoring $file (from $DATE)"
        
        # Insert JSON data back into database
        sqlite3 food_webapp.db ".mode json" ".import $file table_name" 2>/dev/null || {
            # Alternative: use Python for JSON import
            python3 << PYEOF
import json, sqlite3
conn = sqlite3.connect('food_webapp.db')
with open('$file', 'r') as f:
    data = json.load(f)
    
table = 'recipes' if '$file'.startswith('recipes') else ('grocery_lists' if '$file'.startswith('grocery') else 'photos')
if table == 'photos':
    # Photos need special handling (metadata only, photos in uploads folder)
    for photo in data:
        # Insert metadata...
        print(f"Restoring photo metadata: {photo['filename']}")
else:
    conn.executemany(f"INSERT INTO {table} VALUES (?,?,?,?,?,?)", [(row[i] for row in data)])
    
conn.commit()
conn.close()
print(f"Imported {len(data)} records into {table}")
PYEOF
        }
    fi
done

echo "Selective restore complete"
```

---

### 3.5 Restore Database from SQLite Backup Command Line

**Use when:** You have a `.sqlite` file from another system or backup tool

```bash
cd /opt/data/home/food-webapp-project/backend

# Stop backend server
pkill -f uvicorn

# Copy backup to production database (overwrites current data)
cp /path/to/external/backup.sqlite food_webapp.db

# Verify database integrity
sqlite3 food_webapp.db "PRAGMA integrity_check;"

# Check table structure is correct
sqlite3 food_webapp.db ".tables"

# Count records in each table
echo "Recipes: $(sqlite3 food_webapp.db 'SELECT COUNT(*) FROM recipes;')"
echo "Grocery Lists: $(sqlite3 food_webapp.db 'SELECT COUNT(*) FROM grocery_lists;')"
echo "Photos: $(sqlite3 food_webapp.db 'SELECT COUNT(*) FROM photos;')"

# Restart backend server
uvicorn app:app --host 0.0.0.0 --port 8000

echo "Database restored and verified"
```

---

## 4. Verification After Restore

### Always Verify Your Backup

```bash
cd /opt/data/home/food-webapp-project/backend

# Check database size (sanity check)
ls -lh food_webapp.db

# Verify SQLite integrity
sqlite3 food_webapp.db "PRAGMA integrity_check;"

# List all tables
sqlite3 food_webapp.db ".tables"

# Count records per table
echo "=== Record Counts ==="
sqlite3 food_webapp.db "SELECT 'recipes' as table_name, COUNT(*) as count FROM recipes UNION ALL SELECT 'nutrition', COUNT(*) FROM nutrition UNION ALL SELECT 'grocery_lists', COUNT(*) FROM grocery_lists UNION ALL SELECT 'photos', COUNT(*) FROM photos;"

# View sample data
echo ""
echo "=== Sample Recipe ==="
sqlite3 food_webapp.db "SELECT id, substr(name, 1, 50) || '...' as name, source FROM recipes LIMIT 1;"

# Test backend connectivity
cd ..
uvicorn app:app --host 0.0.0.0 --port 8000 &
sleep 3

curl -s http://localhost:8000/recipes | python3 -m json.tool || echo "API response received"

pkill -f uvicorn
```

### Test Frontend Access

```bash
# Open in browser (or use curl for quick check)
curl -s http://localhost:8000/frontend/index.html > /dev/null && echo "Frontend accessible at http://localhost:8000/frontend/index.html" || echo "Warning: Frontend may not be loading correctly"

# Check Swagger UI
curl -s http://localhost:8000/docs | grep -q "FastAPI" && echo "API documentation available at http://localhost:8000/docs" || echo "Warning: API docs not accessible"
```

---

## 5. Best Practices Summary

### Daily Checklist
- [ ] Database backup after major recipe additions/editing
- [ ] Verify latest backup is less than 24 hours old
- [ ] Test backend startup completes without errors

### Weekly Tasks
- [ ] Full backup including photos to dedicated backup folder
- [ ] Compress and organize backups chronologically
- [ ] Test restore of database file (in test environment if possible)
- [ ] Verify photo files are included in backups

### Monthly/Monthly-Critical Tasks
- [ ] Full project backup (code + data)
- [ ] External storage copy (USB drive, cloud sync folder)
- [ ] Document any custom modifications made to code
- [ ] Clean up old backups (keep last 3 months + last point-in-time before major changes)

### After Major Changes
- [ ] Create immediate backup before deploying new features
- [ ] Verify restore procedure works with new data structure
- [ ] Update this documentation if backup/restore methods changed

---

## 6. Common Issues and Solutions

### Issue: Backup file is corrupted when restoring

**Symptoms:** Database errors, SQLite integrity_check failure

**Solution:**
```bash
# Check backup integrity before restore
sqlite3 backend/food_webapp.db.backup.YYYYMMDD "PRAGMA integrity_check;"

# If corrupt, try to repair or use older backup
# Alternative: Use journal mode for atomic backups
# Add to app startup or run manually:
sqlite3 backend/food_webapp.db "PRAGMA journal_mode=WAL;"
```

---

### Issue: Restore fails because uploads/photos directory is missing

**Symptoms:** Photo files not appearing after restore

**Solution:**
```bash
# Check if photos were backed up
ls -la backups/*/photos-backup-* 2>/dev/null || echo "No photo backups found"

# If no photo backup, check if photos should be in full tarball extraction location
tar xzf /path/to/full-backup.tar.gz -C /tmp/restore 2>/dev/null && \
    ls -la /tmp/restore/uploads/photos/ 2>/dev/null || echo "Photos may not have been in tarball"

# If photos are missing and you only have metadata backup, create empty directory
mkdir -p uploads/photos
touch uploads/photos/.gitkeep  # Mark as empty but non-empty directory
```

---

### Issue: Database restore causes API errors

**Symptoms:** Backend starts but returns 500 errors or no data

**Possible causes and fixes:**

1. **Foreign key constraint violation** - Photo metadata references non-existent recipes
   ```sql
   sqlite3 food_webapp.db "PRAGMA foreign_keys=OFF; BEGIN; DELETE FROM photos WHERE recipe_id NOT IN (SELECT id FROM recipes); COMMIT;"
   ```

2. **Mismatched schema version** - Database structure changed between backups
   ```bash
   # Check current schema
   sqlite3 food_webapp.db ".schema" | grep "CREATE TABLE"
   
   # Compare with expected schema from backup file's .dbinfo if available
   ```

---

## 7. Backup Location Recommendations

### Production-Safe Setup

```bash
# Local primary backups (on your development machine)
/opt/data/backups/food-webapp/          # Main backup directory
backend/                               # Immediate database backups

# External storage (USB drive)
/media/USB_DRIVE/food-webapp-backup/    # Cross-machine recovery

# Cloud sync (Dropbox, Google Drive, etc.)
~/Documents/Backups/food-webapp/         # If synced to cloud

# Versioned backups within each location
YYYY-MM-DD_HHMMSS/                      # Date-based subdirectories
```

### Backup Retention Policy Example

```bash
#!/bin/bash
# cleanup-old-backups.sh - Run weekly

BACKUP_DIR="/opt/data/backups/food-webapp"

# Keep last 3 months of daily backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +90 -delete

# Keep last year's monthly backups (if organized by month)
find $BACKUP_DIR -type d -name "202X-XX" -mtime +365 -exec rm -rf {} \;

echo "Cleanup complete. Removed files older than 3 months."
```

---

## 8. Emergency Contact Information (For Reference Only)

If you lose all backups and need to recover:

1. **Check cloud storage** - Dropbox, Google Drive, OneDrive
2. **Check version control** - Git history for code-only restoration
3. **Contact your backup service provider** - If using managed backup solutions
4. **Rebuild from scratch** - Start fresh with recipe library and data entry

**Note:** This is a local-first application. All data must be backed up by you. No automated cloud backup exists for this project.

---

## Appendix A: Quick Reference Commands

### Backup (Quick)
```bash
cp backend/food_webapp.db backend/db-backup.$(date +%Y%m%d).db
```

### Restore (Quick)
```bash
cp backend/db-backup.TODAY backend/food_webapp.db
pkill -f uvicorn && uvicorn app:app --host 0.0.0.0 --port 8000
```

### Backup (Full + Photos)
```bash
tar czf backups/food-webapp-$(date +%Y%m%d).tar.gz \
    backend/food_webapp.db uploads/photos .gitignore README.md pyproject.toml
```

### Verify Backup
```bash
tar tzf /path/to/backup.tar.gz | head -10
cd /tmp && tar xzf /path/to/backup.tar.gz --to-command='sqlite3 food_webapp.db "PRAGMA integrity_check;"' 2>/dev/null || echo "Verify manually"
```

---

**Last Updated:** 2026-10-18  
**Maintained by:** Food Webapp Team
