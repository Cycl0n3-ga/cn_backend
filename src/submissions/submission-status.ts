export enum SubmissionStatus {
  PENDING = 'PENDING',
  COMPILING = 'COMPILING',
  RUNNING = 'RUNNING',
  ACCEPTED = 'ACCEPTED',
  WRONG_ANSWER = 'WRONG_ANSWER',
  TLE = 'TLE',
  MLE = 'MLE',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  COMPILE_ERROR = 'COMPILE_ERROR',
}

export const TERMINAL_SUBMISSION_STATUSES = [
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.WRONG_ANSWER,
  SubmissionStatus.TLE,
  SubmissionStatus.MLE,
  SubmissionStatus.RUNTIME_ERROR,
  SubmissionStatus.COMPILE_ERROR,
] as const;

export function isTerminalSubmissionStatus(status: string) {
  return TERMINAL_SUBMISSION_STATUSES.includes(
    status as (typeof TERMINAL_SUBMISSION_STATUSES)[number],
  );
}
