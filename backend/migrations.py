"""Additive SQLite upgrades. Snapshot populated databases before changing schema."""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from sqlalchemy import inspect, text

ADDITIONS = {
    'grocery_lists': {'position': 'INTEGER NOT NULL DEFAULT 0', 'revision': 'INTEGER NOT NULL DEFAULT 0'},
    'grocery_items': {'position': 'INTEGER NOT NULL DEFAULT 0', 'version': 'INTEGER NOT NULL DEFAULT 0',
        'quantity': "TEXT NOT NULL DEFAULT ''", 'unit': "TEXT NOT NULL DEFAULT ''", 'category': "TEXT NOT NULL DEFAULT ''",
        'notes': "TEXT NOT NULL DEFAULT ''", 'deleted_at': 'TEXT'},
    'recipes': {**{f: "TEXT NOT NULL DEFAULT ''" for f in ('ingredients_text','steps_ordered','prep_time','servings','category','description','cook_time','notes')},
        'favorite': 'BOOLEAN NOT NULL DEFAULT 0', 'cover_photo_id': 'INTEGER', 'last_cooked_at': 'TEXT'},
}

def migrate(engine, metadata):
    existing_tables = set(inspect(engine).get_table_names())
    missing = {table: {key: ddl for key, ddl in columns.items() if key not in {c['name'] for c in inspect(engine).get_columns(table)}}
               for table, columns in ADDITIONS.items() if table in existing_tables}
    needs_migration = any(missing.values()) or bool(existing_tables and set(metadata.tables) - existing_tables)
    if needs_migration and engine.dialect.name != 'sqlite':
        raise RuntimeError('This migration supports SQLite only; apply the documented additive columns before startup.')
    database = engine.url.database
    if needs_migration and database and database != ':memory:' and Path(database).exists():
        target = Path(database + '.before-refinement-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.bak')
        with sqlite3.connect(database) as source, sqlite3.connect(target) as backup:
            source.backup(backup)
        target.chmod(0o600)
    with engine.begin() as connection:
        for table, columns in missing.items():
            for key, ddl in columns.items():
                connection.execute(text(f'ALTER TABLE {table} ADD COLUMN {key} {ddl}'))
            if 'position' in columns:
                # Existing identity order becomes the initial manual order, per list for items.
                group = ' AND previous.list_id = current.list_id' if table == 'grocery_items' else ''
                connection.execute(text(f'UPDATE {table} AS current SET position = (SELECT COUNT(*) FROM {table} AS previous WHERE previous.id < current.id{group})'))
    metadata.create_all(engine)
    if engine.dialect.name == 'sqlite':
        with engine.begin() as connection:
            for table in ('recipes', 'nutrition', 'photos', 'grocery_lists', 'grocery_items', 'ingredients'):
                connection.execute(text(f"INSERT OR IGNORE INTO record_sequences (name, value) SELECT :name, COALESCE(MAX(id), 0) FROM {table}"), {'name': table})
