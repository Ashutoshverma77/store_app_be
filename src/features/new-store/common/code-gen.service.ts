// src/common/services/counter.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter } from './entities/counter.schema';

@Injectable()
export class CounterService {
  constructor(
    @InjectModel(Counter.name, 'store')
    private readonly counterModel: Model<Counter>,
  ) {}

  private twoLettersFromGroup(group: number): string {
    // AA..ZZ only
    const max = 26 * 26 - 1;
    if (group < 0 || group > max) {
      throw new Error('Code series exhausted (beyond ZZ).');
    }
    const first = Math.floor(group / 26);
    const second = group % 26;
    return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
  }

  private format(prefix: string, seq: number): string {
    const group = Math.floor((seq - 1) / 999); // 0 => AA, 1 => AB ...
    const num = ((seq - 1) % 999) + 1; // 1..999
    const letters = this.twoLettersFromGroup(group);
    const num3 = String(num).padStart(3, '0');
    return `${prefix}-${letters}${num3}`; // RM-AA001
  }

  /** Atomic increment and return formatted code */
  async nextCode(
    key: string,
    prefix: string,
  ): Promise<{ seq: number; code: string }> {
    const doc = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const seq = doc.seq;
    return { seq, code: this.format(prefix, seq) };
  }

  /** Peek next code (no increment) for UI display */
  async peekNextCode(
    key: string,
    prefix: string,
  ): Promise<{ seqNext: number; code: string }> {
    const doc = await this.counterModel.findOne({ key }).lean();
    const seqNext = (doc?.seq ?? 0) + 1;
    return { seqNext, code: this.format(prefix, seqNext) };
  }
}
