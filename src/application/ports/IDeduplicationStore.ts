export interface IDeduplicationStore {
  hasBeenProcessed(id: string): Promise<boolean>;
  markAsProcessed(id: string, ttlSeconds?: number): Promise<void>;
}
