import fs from "node:fs";
import path from "node:path";
import { IDeduplicationStore } from "../../application/ports/IDeduplicationStore.js";

interface CacheEntry {
  expiresAt: number;
}

export class PersistentDeduplicationStore implements IDeduplicationStore {
  private readonly store = new Map<string, CacheEntry>();
  private readonly filePath: string;

  constructor(storageDir: string = process.cwd()) {
    this.filePath = path.join(storageDir, ".lead_dedup_cache.json");
    this.loadFromDisk();

    // Periodic cleanup and disk sync every 5 minutes
    setInterval(() => this.cleanupAndFlush(), 5 * 60 * 1000).unref();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(raw) as Record<string, CacheEntry>;
        const now = Date.now();
        let loadedCount = 0;
        for (const [id, entry] of Object.entries(data)) {
          if (entry && entry.expiresAt > now) {
            this.store.set(id, entry);
            loadedCount++;
          }
        }
        if (loadedCount > 0) {
          console.log(`💾 [PersistentCache] Loaded ${loadedCount} previously processed lead IDs from disk.`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[PersistentCache] Notice: starting fresh cache (${message})`);
    }
  }

  private flushToDisk(): void {
    try {
      const obj: Record<string, CacheEntry> = {};
      const now = Date.now();
      for (const [id, entry] of this.store.entries()) {
        if (entry.expiresAt > now) {
          obj[id] = entry;
        }
      }
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[PersistentCache] Failed to write cache to disk: ${message}`);
    }
  }

  public async hasBeenProcessed(id: string): Promise<boolean> {
    const entry = this.store.get(id);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(id);
      return false;
    }

    return true;
  }

  public async markAsProcessed(id: string, ttlSeconds: number = 86400 * 7): Promise<void> {
    this.store.set(id, {
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    this.flushToDisk();
  }

  private cleanupAndFlush(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.flushToDisk();
    }
  }
}
