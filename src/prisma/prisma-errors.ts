type ErrorWithCode = {
  code: unknown;
};

export function hasPrismaErrorCode(
  error: unknown,
  code: string,
): error is ErrorWithCode {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
