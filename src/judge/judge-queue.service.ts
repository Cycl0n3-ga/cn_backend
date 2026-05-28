import { Injectable } from '@nestjs/common';
import { JudgeInput, JudgeResult, JudgeService } from './judge.service.js';

type QueueItem = {
  input: JudgeInput;
  onStart?: () => void | Promise<void>;
  resolve: (result: JudgeResult) => void;
  reject: (error: unknown) => void;
};

@Injectable()
export class JudgeQueueService {
  private readonly concurrency = this.getConcurrency();
  private readonly queue: QueueItem[] = [];
  private activeCount = 0;

  constructor(private readonly judgeService: JudgeService) {}

  enqueue(input: JudgeInput, onStart?: () => void | Promise<void>) {
    return new Promise<JudgeResult>((resolve, reject) => {
      this.queue.push({ input, onStart, resolve, reject });
      this.drain();
    });
  }

  getStats() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }

  private drain() {
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) return;

      this.activeCount += 1;
      void this.runItem(item);
    }
  }

  private async runItem(item: QueueItem) {
    try {
      await item.onStart?.();
      const result = await this.judgeService.run(item.input);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeCount -= 1;
      this.drain();
    }
  }

  private getConcurrency() {
    const parsed = Number(process.env.JUDGE_CONCURRENCY ?? 2);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return 2;
    }

    return parsed;
  }
}
