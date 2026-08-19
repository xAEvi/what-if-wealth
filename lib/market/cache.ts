type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Cache en memoria con TTL, para que las respuestas de Yahoo sobrevivan los
 * 429 sin golpear la API en cada request del usuario.
 */
export class TtlCache<T> {
  private entries = new Map<string, CacheEntry<T>>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
