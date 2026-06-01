import { type JudgeInput } from './judge.service.js';

export const JUDGE_QUEUE_NAME = 'judge-submissions';

export type JudgeQueueDriver = 'redis' | 'inline';

export type SubmissionJudgeJobData = {
  kind: 'submission';
  submissionId: string;
};

export type SampleJudgeJobData = {
  kind: 'sample';
  input: JudgeInput;
};

export type JudgeJobData = SubmissionJudgeJobData | SampleJudgeJobData;

export type JudgeJobContext = {
  jobId: string;
  attempt: number;
};

export type EnqueuedJudgeJob = {
  jobId: string;
  driver: JudgeQueueDriver;
};

export type JudgeQueueStats = {
  driver: JudgeQueueDriver;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  concurrency: number;
};
