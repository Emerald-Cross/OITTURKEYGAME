import { mkdir, readFile, writeFile, rename, open } from 'node:fs/promises';
import { join } from 'node:path';
// Only completed rounds are durable. Active rounds deliberately abort on server restart.
// Every save uses an atomic rename; scoring and display never await these operations.
export class ScoreStore {
  constructor(directory, { write = writeFile } = {}) {
    this.directory = directory; this.path = join(directory, 'scores.json'); this.rounds = [];
    this.write = write; this.pending = Promise.resolve(); this.status = 'saved'; this.error = null;
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8'));
      if (!Array.isArray(parsed) || parsed.some(r => !r.roundId || !Array.isArray(r.players))) throw Error('Invalid score file');
      this.rounds = parsed;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Fail clearly at startup if configured storage cannot be written.
    const probe = await open(join(this.directory, '.writable'), 'a'); await probe.close();
    return this;
  }
  add(round) {
    if (!this.rounds.some(r => r.roundId === round.roundId)) this.rounds.push(structuredClone(round));
    return this.save();
  }
  save() {
    this.status = 'saving'; this.error = null;
    const json = JSON.stringify(this.rounds, null, 2);
    this.pending = this.pending.catch(() => {}).then(async () => {
      await this.write(this.path + '.tmp', json, 'utf8'); await rename(this.path + '.tmp', this.path);
    });
    return this.pending.then(() => { this.status = 'saved'; this.error = null; }, error => {
      this.status = 'error'; this.error = error.message; throw error;
    });
  }
  board(ruleset) {
    return this.rounds.filter(r => !ruleset || r.ruleset === ruleset).flatMap(r => r.players.map(p => ({ ...p, mode: r.mode, roundId: r.roundId, endedAt: r.endedAt })))
      .sort((a, b) => b.score - a.score || a.endedAt.localeCompare(b.endedAt)).slice(0, 50);
  }
}
