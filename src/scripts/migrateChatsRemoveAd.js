import mongoose from 'mongoose';
import logger from '../config/logger.js';

/**
 * Migration script: Remove ad field from Chat collection
 * - Drops old indexes that include 'ad'
 * - Removes ad field from all chats
 * - Creates new unique index on participants only
 * - Handles duplicate chats (keeps newest, deletes others)
 * 
 * Run this once manually or on server startup
 */
export const migrateChatsRemoveAd = async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('[MIGRATE] MongoDB connection not ready, skipping migration');
      return;
    }

    const collection = db.collection('chats');
    
    console.log('[MIGRATE] Starting chat migration: remove ad field...');

    // Step 1: Get all existing indexes
    const existingIndexes = await collection.indexes();
    console.log('[MIGRATE] Found', existingIndexes.length, 'indexes');

    // Step 2: Drop indexes that include 'ad' field
    const indexesToDrop = existingIndexes.filter((idx) => {
      if (!idx.key) return false;
      return 'ad' in idx.key;
    });

    for (const index of indexesToDrop) {
      try {
        await collection.dropIndex(index.name);
        console.log('[MIGRATE] Dropped index:', index.name);
      } catch (dropError) {
        if (dropError.code !== 27) { // 27 = IndexNotFound
          console.log('[MIGRATE] Error dropping index', index.name, ':', dropError.message);
        }
      }
    }

    // Step 3: Remove ad field from all chats
    const unsetResult = await collection.updateMany(
      {},
      { $unset: { ad: '' } }
    );
    console.log('[MIGRATE] Removed ad field from', unsetResult.modifiedCount, 'chats');

    // Step 4: Handle duplicate chats (same participants)
    // Find all chats grouped by participants
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: '$participants',
          chats: { $push: '$$ROOT' },
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]).toArray();

    let duplicatesDeleted = 0;
    for (const group of duplicates) {
      // Sort chats by updatedAt (newest first)
      const sortedChats = group.chats.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

      // Keep the newest chat, delete the rest
      const toKeep = sortedChats[0];
      const toDelete = sortedChats.slice(1);

      for (const chat of toDelete) {
        // Optionally: move lastMessage to the kept chat if it's newer
        if (chat.lastMessage && (!toKeep.lastMessage || 
            new Date(chat.updatedAt || 0) > new Date(toKeep.updatedAt || 0))) {
          await collection.updateOne(
            { _id: toKeep._id },
            { $set: { lastMessage: chat.lastMessage, updatedAt: chat.updatedAt || new Date() } }
          );
        }

        await collection.deleteOne({ _id: chat._id });
        duplicatesDeleted++;
      }
    }
    console.log('[MIGRATE] Deleted', duplicatesDeleted, 'duplicate chats');

    // Step 5: Create new unique index on participants only
    try {
      await collection.createIndex(
        { participants: 1 },
        { unique: true, name: 'participants_1_unique' }
      );
      console.log('[MIGRATE] Created unique index on participants');
    } catch (createError) {
      if (createError.code === 85) { // 85 = IndexOptionsConflict
        console.log('[MIGRATE] Unique index on participants already exists');
      } else {
        console.error('[MIGRATE] Error creating unique index:', createError.message);
      }
    }

    // Summary
    const finalCount = await collection.countDocuments();
    console.log('[MIGRATE] Migration complete!');
    console.log('[MIGRATE] Summary:');
    console.log('  - Removed ad field from', unsetResult.modifiedCount, 'chats');
    console.log('  - Deleted', duplicatesDeleted, 'duplicate chats');
    console.log('  - Total chats remaining:', finalCount);
    console.log('  - Unique index on participants created');

    logger.info('[MIGRATE] Chat migration completed successfully', {
      removedAdFrom: unsetResult.modifiedCount,
      duplicatesDeleted,
      totalChats: finalCount,
    });
  } catch (error) {
    console.error('[MIGRATE] Error during migration:', error.message);
    logger.error('[MIGRATE] Migration failed', {
      error: error.message,
      stack: error.stack,
    });
    // Don't crash server if migration fails
  }
};
