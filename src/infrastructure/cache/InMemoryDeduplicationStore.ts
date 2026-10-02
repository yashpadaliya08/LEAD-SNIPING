import { IDeduplicationStore } from "../../application/ports/IDeduplicationStore.js";

interface CacheEntry {
  expiresAt: number;
}

export class InMemoryDeduplicationStore implements IDeduplicationStore {
  private readonly store = new Map<string, CacheEntry>();

  constructor() {
    // Periodic garbage collection every 10 minutes
    setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
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

  public async markAsProcessed(id: string, ttlSeconds: number = 86400 * 2): Promise<void> {
    this.store.set(id, {
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(id);
      }
    }
  }
}
