import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type JudgeInput = {
  language: string;
  code: string;
  input: string;
  expectedOutput: string;
};

export type JudgeResult = {
  status:
    | 'ACCEPTED'
    | 'WRONG_ANSWER'
    | 'RUNTIME_ERROR'
    | 'TIME_LIMIT_EXCEEDED'
    | 'INTERNAL_ERROR';
  stdout: string;
  stderr: string;
  expectedOutput: string;
  score: number;
  executionTimeMs: number;
};

@Injectable()
export class JudgeService {
  async run(input: JudgeInput): Promise<JudgeResult> {
    if (input.language !== 'javascript') {
      return {
        status: 'INTERNAL_ERROR',
        stdout: '',
        stderr: `Unsupported language: ${input.language}`,
        expectedOutput: input.expectedOutput,
        score: 0,
        executionTimeMs: 0,
      };
    }

    return this.runJavaScript(input);
  }

  private async runJavaScript(input: JudgeInput): Promise<JudgeResult> {
    const startedAt = Date.now();
    const workdir = await mkdtemp(join(tmpdir(), 'code-judge-'));

    try {
      await writeFile(join(workdir, 'submission.js'), input.code, 'utf-8');
      await writeFile(join(workdir, 'runner.js'), this.buildJavaScriptRunner(), 'utf-8');

      const { stdout, stderr } = await this.runDocker(
        'docker',
        [
          'run',
          '--rm',
          '-i',
          '--network',
          'none',
          '--cpus',
          '0.5',
          '--memory',
          '128m',
          '--pids-limit',
          '64',
          '--read-only',
          '--tmpfs',
          '/tmp:rw,noexec,nosuid,size=16m',
          '-v',
          `${workdir}:/workspace:ro`,
          '-w',
          '/workspace',
          'node:22-alpine',
          'node',
          'runner.js',
        ],
        input.input,
      );

      const executionTimeMs = Date.now() - startedAt;
      const accepted = this.normalize(stdout) === this.normalize(input.expectedOutput);

      return {
        status: accepted ? 'ACCEPTED' : 'WRONG_ANSWER',
        stdout,
        stderr,
        expectedOutput: input.expectedOutput,
        score: accepted ? 100 : 0,
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startedAt;
      const err = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };

      return {
        status: this.mapExecutionError(err),
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message,
        expectedOutput: input.expectedOutput,
        score: 0,
        executionTimeMs,
      };
    } finally {
      await rm(workdir, { recursive: true, force: true });
    }
  }

  private buildJavaScriptRunner() {
    return `
const fs = require('node:fs');
const submission = require('./submission.js');

async function main() {
  const input = fs.readFileSync(0, 'utf-8');
  const solve = typeof submission === 'function' ? submission : submission.solve;

  if (typeof solve !== 'function') {
    throw new Error('JavaScript submissions must export a solve(input) function.');
  }

  const output = await solve(input);
  if (output !== undefined) {
    process.stdout.write(String(output));
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
`.trimStart();
  }

  private normalize(value: string) {
    return value.trim().replace(/\r\n/g, '\n');
  }

  private mapExecutionError(
    error: NodeJS.ErrnoException & {
      stderr?: string;
      killed?: boolean;
      signal?: string;
    },
  ): JudgeResult['status'] {
    if (error.killed || error.signal === 'SIGTERM') {
      return 'TIME_LIMIT_EXCEEDED';
    }

    const message = `${error.message}\n${error.stderr ?? ''}`;
    if (
      error.code === 'ENOENT' ||
      message.includes('Cannot connect to the Docker daemon') ||
      message.includes('docker: command not found')
    ) {
      return 'INTERNAL_ERROR';
    }

    return 'RUNTIME_ERROR';
  }

  private runDocker(command: string, args: string[], input: string) {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
      }, 5000);

      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(Object.assign(error, { stdout, stderr }));
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }

        reject(
          Object.assign(new Error(stderr || `Judge process exited with ${code}`), {
            stdout,
            stderr,
            signal,
            killed: signal === 'SIGTERM',
          }),
        );
      });

      child.stdin.end(input);
    });
  }
}
