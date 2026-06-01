import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContextStore = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  context: RequestContextStore,
  callback: () => T,
) {
  return storage.run(context, callback);
}

export function getRequestId() {
  return storage.getStore()?.requestId;
}
