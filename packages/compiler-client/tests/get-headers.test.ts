import { describe, it, expect, vi } from 'vitest';
import { RemoteCompiler } from '../src/remote/remote-compiler';
import { LocalNextCompilerAdapter } from '../src/adapters/local-next-compiler';

const pdfResponse = () =>
  new Response(new Uint8Array(Buffer.from('%PDF-1.4\n%%EOF')), {
    status: 200,
    headers: { 'content-type': 'application/pdf', 'x-compiler-engine': 'Tectonic' },
  });

const request = { tex: '\documentclass{article}\begin{document}x\end{document}' } as any;

describe('getHeaders option (Authorization for the protected compile endpoint)', () => {
  it('RemoteCompiler sends the resolved headers on every request, resolving them per call', async () => {
    const fetchFn = vi.fn(async () => pdfResponse());
    let n = 0;
    const getHeaders = vi.fn(async () => ({ Authorization: `Bearer token-${++n}` }));
    const compiler = new RemoteCompiler({ fetchFn: fetchFn as any, getHeaders });

    await compiler.compile(request);
    await compiler.compile(request);

    const sent = (i: number) => (fetchFn.mock.calls[i] as any)[1].headers;
    expect(sent(0)).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer token-1' });
    expect(sent(1).Authorization).toBe('Bearer token-2'); // fresh token each time (refresh-friendly)
  });

  it('RemoteCompiler without getHeaders sends no Authorization header (unchanged behaviour)', async () => {
    const fetchFn = vi.fn(async () => pdfResponse());
    await new RemoteCompiler({ fetchFn: fetchFn as any }).compile(request);

    expect((fetchFn.mock.calls[0] as any)[1].headers.Authorization).toBeUndefined();
  });

  it('LocalNextCompilerAdapter sends the resolved headers too', async () => {
    const fetchFn = vi.fn(async () => pdfResponse());
    const adapter = new LocalNextCompilerAdapter({
      fetchFn: fetchFn as any,
      getHeaders: () => ({ Authorization: 'Bearer abc' }),
    });

    await adapter.compile(request);

    expect((fetchFn.mock.calls[0] as any)[1].headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc',
    });
  });
});
