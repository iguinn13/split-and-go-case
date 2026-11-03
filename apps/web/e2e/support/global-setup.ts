import { apiUrl, compose, externalStack, webUrl } from './stack';

async function waitFor(url: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let last = 'no response';

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url);

            if (response.ok) return;

            last = `HTTP ${response.status}`;
        } catch (error) {
            last = error instanceof Error ? error.message : String(error);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timed out waiting for ${url} (${last})`);
}

export default async function globalSetup(): Promise<void> {
    if (!externalStack) compose(['up', '-d', '--build', '--wait']);

    await waitFor(`${apiUrl}/health`, 120_000);
    await waitFor(`${webUrl}/login`, 120_000);
}
