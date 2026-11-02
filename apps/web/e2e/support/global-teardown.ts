import { compose, externalStack } from './stack';

export default function globalTeardown(): void {
  if (externalStack || process.env.E2E_KEEP_STACK === '1') return;
  // Only the containers and volumes of the e2e compose project are removed.
  compose(['down', '-v', '--remove-orphans']);
}
