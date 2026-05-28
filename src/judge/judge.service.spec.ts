import { Test, TestingModule } from '@nestjs/testing';
import { JudgeService, JudgeInput } from './judge.service';
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/fake-workdir'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

const mockSpawn = jest.fn();
jest.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a fake child-process object that behaves like the one returned by
 * spawn().  `exitCode` 0 means the process succeeds; non-zero means it fails.
 */
function makeChildStub(
  exitCode: number,
  stdout = '',
  stderr = '',
  signal?: string,
) {
  const stdoutEmitter = new EventEmitter() as any;
  stdoutEmitter.setEncoding = jest.fn();

  const stderrEmitter = new EventEmitter() as any;
  stderrEmitter.setEncoding = jest.fn();

  const stdinStub = { end: jest.fn() };

  const child = new EventEmitter() as any;
  child.stdout = stdoutEmitter;
  child.stderr = stderrEmitter;
  child.stdin = stdinStub;
  child.kill = jest.fn();

  // Emit data + close asynchronously so the promise chain wires up first
  setImmediate(() => {
    if (stdout) stdoutEmitter.emit('data', stdout);
    if (stderr) stderrEmitter.emit('data', stderr);
    child.emit('close', exitCode, signal ?? null);
  });

  return child;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('JudgeService', () => {
  let service: JudgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JudgeService],
    }).compile();

    service = module.get<JudgeService>(JudgeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── run() — unsupported language ───────────────────────────────────────
  describe('run() with unsupported language', () => {
    it('should return INTERNAL_ERROR for java', async () => {
      const result = await service.run({
        language: 'java',
        code: '',
        input: '',
        expectedOutput: '',
      });

      expect(result.status).toBe('INTERNAL_ERROR');
    });

    it('should preserve expectedOutput in result', async () => {
      const result = await service.run({
        language: 'golang',
        code: '',
        input: '',
        expectedOutput: 'expected-value',
      });

      expect(result.expectedOutput).toBe('expected-value');
    });

    it('should return empty stdout/stderr for unsupported language', async () => {
      const result = await service.run({
        language: 'ruby',
        code: '',
        input: '',
        expectedOutput: '',
      });

      expect(result.stdout).toBe('');
      expect(result.executionTimeMs).toBe(0);
    });
  });

  describe('run() with supported languages', () => {
    it('should run python3 with the python image', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, 'hello\n', '') as any);

      const result = await service.run({
        language: 'python3',
        code: 'def solve(input): return "hello"',
        input: '',
        expectedOutput: 'hello',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(mockSpawn.mock.calls[0][1]).toContain('python:3.12-alpine');
    });

    it('should compile and run C++ with gcc image', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, '42', '') as any);

      const result = await service.run({
        language: 'cpp',
        code: 'int main() { return 0; }',
        input: '40 2',
        expectedOutput: '42',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(mockSpawn.mock.calls[0][1]).toContain('gcc:14');
      expect(mockSpawn.mock.calls[0][1]).toContain('g++ main.cpp -O2 -pipe -std=c++17 -o /tmp/main && /tmp/main');
    });

    it('should compile and run C with gcc image', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, '42', '') as any);

      const result = await service.run({
        language: 'c',
        code: 'int main() { return 0; }',
        input: '40 2',
        expectedOutput: '42',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(mockSpawn.mock.calls[0][1]).toContain('gcc main.c -O2 -pipe -o /tmp/main && /tmp/main');
    });
  });

  describe('run() with javascript', () => {
    it('should return ACCEPTED when stdout matches expectedOutput', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, 'hello\n', '') as any);

      const result = await service.run({
        language: 'javascript',
        code: 'module.exports = () => "hello";',
        input: '',
        expectedOutput: 'hello',
      });

      expect(result.status).toBe('ACCEPTED');
      expect(result.score).toBe(100);
    });

    it('should return WRONG_ANSWER when stdout does not match', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, 'wrong\n', '') as any);

      const result = await service.run({
        language: 'javascript',
        code: 'module.exports = () => "wrong";',
        input: '',
        expectedOutput: 'correct',
      });

      expect(result.status).toBe('WRONG_ANSWER');
      expect(result.score).toBe(0);
    });

    it('should return RUNTIME_ERROR on non-zero exit code', async () => {
      const child = makeChildStub(1, '', 'ReferenceError: x is not defined');
      mockSpawn.mockReturnValue(child as any);

      const result = await service.run({
        language: 'javascript',
        code: 'throw new Error("boom")',
        input: '',
        expectedOutput: '',
      });

      expect(result.status).toBe('RUNTIME_ERROR');
      expect(result.score).toBe(0);
    });

    it('should return TIME_LIMIT_EXCEEDED when process is killed via SIGTERM', async () => {
      const child = makeChildStub(null as any, '', '', 'SIGTERM');
      (child as any).kill = jest.fn();
      mockSpawn.mockReturnValue(child as any);

      const result = await service.run({
        language: 'javascript',
        code: 'while(true){}',
        input: '',
        expectedOutput: '',
      });

      expect(result.status).toBe('TIME_LIMIT_EXCEEDED');
      expect(result.score).toBe(0);
    });

    it('should return INTERNAL_ERROR when docker command is not found (ENOENT)', async () => {
      const spawnMock = mockSpawn.mockImplementation(() => {
          const child = new EventEmitter() as any;
          child.stdout = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
          child.stderr = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
          child.stdin = { end: jest.fn() };
          child.kill = jest.fn();
          setImmediate(() => {
            const err = Object.assign(new Error('spawn docker ENOENT'), {
              code: 'ENOENT',
            });
            child.emit('error', err);
          });
          return child;
        });

      const result = await service.run({
        language: 'javascript',
        code: '',
        input: '',
        expectedOutput: '',
      });

      expect(result.status).toBe('INTERNAL_ERROR');
      spawnMock.mockRestore();
    });

    it('should include stdout and stderr from docker in the result', async () => {
      mockSpawn.mockReturnValue(makeChildStub(0, 'output-value\n', 'some-warning') as any);

      const result = await service.run({
        language: 'javascript',
        code: '',
        input: '',
        expectedOutput: 'output-value',
      });

      expect(result.stdout).toContain('output-value');
      expect(result.stderr).toBe('some-warning');
    });

    it('should normalise trailing whitespace / CRLF for comparison', async () => {
      // Docker outputs "hello\r\n", expectedOutput is "hello"
      mockSpawn.mockReturnValue(makeChildStub(0, 'hello\r\n', '') as any);

      const result = await service.run({
        language: 'javascript',
        code: '',
        input: '',
        expectedOutput: 'hello',
      });

      expect(result.status).toBe('ACCEPTED');
    });

    it('should clean up the temp workdir even when docker fails', async () => {
      const rmSpy = jest.spyOn(fs, 'rm').mockResolvedValue(undefined);
      mockSpawn.mockReturnValue(makeChildStub(1, '', 'error') as any);

      await service.run({
        language: 'javascript',
        code: '',
        input: '',
        expectedOutput: '',
      });

      expect(rmSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/fake-workdir'),
        { recursive: true, force: true },
      );
    });

    it('should write both submission.js and runner.js to the workdir', async () => {
      const writeFileSpy = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      mockSpawn.mockReturnValue(makeChildStub(0, '', '') as any);

      await service.run({
        language: 'javascript',
        code: 'module.exports = () => "";',
        input: '',
        expectedOutput: '',
      });

      const paths = writeFileSpy.mock.calls.map((c) => c[0] as string);
      expect(paths.some((p) => p.endsWith('submission.js'))).toBe(true);
      expect(paths.some((p) => p.endsWith('runner.js'))).toBe(true);
    });

    it('should send the input string to docker stdin', async () => {
      const child = makeChildStub(0, 'result', '');
      mockSpawn.mockReturnValue(child as any);

      await service.run({
        language: 'javascript',
        code: '',
        input: 'my test input',
        expectedOutput: 'result',
      });

      expect(child.stdin.end).toHaveBeenCalledWith('my test input');
    });
  });
});
