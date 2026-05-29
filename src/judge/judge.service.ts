import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 5000;

type SupportedLanguage = 'javascript' | 'python' | 'c' | 'cpp';

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

type DockerRunOptions = {
  image: string;
  command: string[];
  input: string;
  workdir: string;
};

@Injectable()
export class JudgeService {
  async run(input: JudgeInput): Promise<JudgeResult> {
    const language = this.normalizeLanguage(input.language);
    if (!language) {
      return {
        status: 'INTERNAL_ERROR',
        stdout: '',
        stderr: `Unsupported language: ${input.language}`,
        expectedOutput: input.expectedOutput,
        score: 0,
        executionTimeMs: 0,
      };
    }

    return this.runInSandbox({ ...input, language });
  }

  private async runInSandbox(
    input: JudgeInput & { language: SupportedLanguage },
  ): Promise<JudgeResult> {
    const startedAt = Date.now();
    const workdir = await mkdtemp(join(tmpdir(), 'code-judge-'));

    try {
      const options = await this.prepareRunOptions(input, workdir);
      const { stdout, stderr } = await this.runDocker(options);
      const executionTimeMs = Date.now() - startedAt;
      const accepted =
        this.normalizeOutput(stdout) ===
        this.normalizeOutput(input.expectedOutput);

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

  private async prepareRunOptions(
    input: JudgeInput & { language: SupportedLanguage },
    workdir: string,
  ): Promise<DockerRunOptions> {
    if (input.language === 'javascript') {
      await writeFile(join(workdir, 'submission.js'), input.code, 'utf-8');
      await writeFile(
        join(workdir, 'runner.js'),
        this.buildJavaScriptRunner(),
        'utf-8',
      );
      return {
        image: 'node:22-alpine',
        command: ['node', 'runner.js'],
        input: input.input,
        workdir,
      };
    }

    if (input.language === 'python') {
      await writeFile(join(workdir, 'submission.py'), input.code, 'utf-8');
      await writeFile(
        join(workdir, 'runner.py'),
        this.buildPythonRunner(),
        'utf-8',
      );
      return {
        image: 'python:3.12-alpine',
        command: ['python', 'runner.py'],
        input: input.input,
        workdir,
      };
    }

    if (input.language === 'c') {
      await writeFile(join(workdir, 'main.c'), input.code, 'utf-8');
      return {
        image: 'gcc:14',
        command: [
          'sh',
          '-lc',
          'gcc main.c -O2 -pipe -o /tmp/main && /tmp/main',
        ],
        input: input.input,
        workdir,
      };
    }

    await writeFile(join(workdir, 'main.cpp'), input.code, 'utf-8');
    return {
      image: 'gcc:14',
      command: [
        'sh',
        '-lc',
        'g++ main.cpp -O2 -pipe -std=c++17 -o /tmp/main && /tmp/main',
      ],
      input: input.input,
      workdir,
    };
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

  private buildPythonRunner() {
    return `
import importlib.util
import sys

spec = importlib.util.spec_from_file_location("submission", "/workspace/submission.py")
submission = importlib.util.module_from_spec(spec)
spec.loader.exec_module(submission)

if not hasattr(submission, "solve"):
    raise RuntimeError("Python submissions must define solve(input: str).")

input_text = sys.stdin.read()
output = submission.solve(input_text)
if output is not None:
    sys.stdout.write(str(output))
`.trimStart();
  }

  private normalizeLanguage(language: string): SupportedLanguage | null {
    const normalized = language.trim().toLowerCase();
    if (normalized === 'js' || normalized === 'javascript') return 'javascript';
    if (
      normalized === 'py' ||
      normalized === 'python' ||
      normalized === 'python3'
    ) {
      return 'python';
    }
    if (normalized === 'c') return 'c';
    if (normalized === 'cpp' || normalized === 'c++') return 'cpp';
    return null;
  }

  private normalizeOutput(value: string) {
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
      message.includes('docker: command not found') ||
      message.includes('Cannot find image')
    ) {
      return 'INTERNAL_ERROR';
    }

    return 'RUNTIME_ERROR';
  }

  private runDocker(options: DockerRunOptions) {
    return new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn(
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
            '--security-opt',
            'no-new-privileges',
            '--read-only',
            '--tmpfs',
            '/tmp:rw,nosuid,size=64m',
            '-e',
            'TMPDIR=/tmp',
            '-v',
            `${options.workdir}:/workspace:ro`,
            '-w',
            '/workspace',
            options.image,
            ...options.command,
          ],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );

        let stdout = '';
        let stderr = '';
        let outputTooLarge = false;
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
        }, TIMEOUT_MS);

        child.stdout.setEncoding('utf-8');
        child.stderr.setEncoding('utf-8');
        child.stdout.on('data', (chunk: string) => {
          stdout += chunk;
          if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
            outputTooLarge = true;
            child.kill('SIGTERM');
          }
        });
        child.stderr.on('data', (chunk: string) => {
          stderr += chunk;
          if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) {
            outputTooLarge = true;
            child.kill('SIGTERM');
          }
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
            Object.assign(
              new Error(
                outputTooLarge
                  ? 'Judge output exceeded 1 MB.'
                  : stderr || `Judge process exited with ${code}`,
              ),
              {
                stdout,
                stderr,
                signal,
                killed: signal === 'SIGTERM',
              },
            ),
          );
        });

        child.stdin.end(options.input);
      },
    );
  }
}
