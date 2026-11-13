/**
 * Mock request handler for StructPaper API client.
 * Simulates API responses in development or offline/mock mode.
 */

export interface MockResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export async function handleMockRequest(
  url: string,
  method: string = 'GET',
  data?: any,
  params?: any,
): Promise<any> {
  const cleanUrl = (url || '').split('?')[0];
  const normalizedMethod = (method || 'GET').toUpperCase();

  // Simulated latency
  await new Promise((resolve) => setTimeout(resolve, 20));

  // Health
  if (cleanUrl.endsWith('/health')) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 100,
      database: { status: 'ok' },
    };
  }

  // Auth
  if (cleanUrl.includes('/auth/login')) {
    return {
      accessToken: 'mock-access-token-123',
      refreshToken: 'mock-refresh-token-456',
      expiresIn: 3600,
      tokenType: 'Bearer',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: data?.email || 'author@structpaper.org',
        displayName: 'Mock Author',
        status: 'ACTIVE',
      },
    };
  }

  if (cleanUrl.includes('/auth/refresh')) {
    return {
      accessToken: 'mock-refreshed-access-token-789',
      refreshToken: 'mock-refreshed-refresh-token-012',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  if (cleanUrl.includes('/auth/me')) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'author@structpaper.org',
      displayName: 'Mock Author',
      permissionsVersion: 1,
      status: 'ACTIVE',
    };
  }

  if (cleanUrl.includes('/auth/logout')) {
    return { success: true };
  }

  if (cleanUrl.includes('/auth/activate')) {
    return { success: true, message: 'Account successfully activated' };
  }

  if (cleanUrl.includes('/auth/reset-password')) {
    return { success: true, message: 'Password reset successful' };
  }

  if (cleanUrl.includes('/auth/invite')) {
    return { success: true, id: '00000000-0000-0000-0000-000000000002', email: data?.email };
  }

  // Access
  if (cleanUrl.includes('/access/roles') || cleanUrl.endsWith('/roles')) {
    if (normalizedMethod === 'POST' && cleanUrl.includes('/assign')) {
      return { success: true, permissionsVersion: 2 };
    }
    if (normalizedMethod === 'POST' && cleanUrl.includes('/revoke')) {
      return { success: true, permissionsVersion: 2 };
    }
    return [
      { id: '00000000-0000-0000-0000-000000000011', name: 'SuperAdmin', isSystem: true },
      { id: '00000000-0000-0000-0000-000000000012', name: 'Author', isSystem: true },
      { id: '00000000-0000-0000-0000-000000000013', name: 'Editor', isSystem: true },
    ];
  }

  if (cleanUrl.includes('/access/permissions') || cleanUrl.endsWith('/permissions')) {
    return [
      { id: '00000000-0000-0000-0000-000000000021', action: 'manage', subject: 'all' },
      { id: '00000000-0000-0000-0000-000000000022', action: 'read', subject: 'Manuscript' },
      { id: '00000000-0000-0000-0000-000000000023', action: 'update', subject: 'Manuscript' },
    ];
  }

  // Manuscripts
  if (cleanUrl.includes('/manuscripts')) {
    if (cleanUrl.includes('/sync/submit-ops') || cleanUrl.includes('/sync/patches')) {
      return {
        serverRev: (data?.baseServerRev || 0) + 1,
        ops: [],
      };
    }

    if (cleanUrl.includes('/sync/stream')) {
      return { success: true };
    }

    if (cleanUrl.includes('/members')) {
      if (normalizedMethod === 'POST') {
        return { success: true, userId: data?.userId, role: data?.role || 'COAUTHOR' };
      }
      return [
        {
          manuscriptId: '00000000-0000-0000-0000-000000000099',
          userId: '00000000-0000-0000-0000-000000000001',
          role: 'OWNER',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    const singleManuscriptMatch = cleanUrl.match(/\/manuscripts\/([a-zA-Z0-9-]+)$/);
    if (singleManuscriptMatch && normalizedMethod === 'GET') {
      const id = singleManuscriptMatch[1];
      return {
        id,
        journalId: '00000000-0000-0000-0000-000000000050',
        title: 'Mock Research Manuscript',
        abstract: 'This is a mock manuscript for testing and development.',
        status: 'DRAFT',
        createdBy: '00000000-0000-0000-0000-000000000001',
        currentServerRev: 1,
        version: 1,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (normalizedMethod === 'POST') {
      return {
        id: '00000000-0000-0000-0000-000000000099',
        journalId: data?.journalId || '00000000-0000-0000-0000-000000000050',
        title: data?.title || 'Untitled Manuscript',
        abstract: data?.abstract || null,
        status: 'DRAFT',
        createdBy: '00000000-0000-0000-0000-000000000001',
        currentServerRev: 0,
        version: 1,
        metadata: data?.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (normalizedMethod === 'PATCH' || normalizedMethod === 'PUT') {
      return {
        id: '00000000-0000-0000-0000-000000000099',
        journalId: '00000000-0000-0000-0000-000000000050',
        title: data?.title || 'Updated Manuscript',
        abstract: data?.abstract || null,
        status: data?.status || 'DRAFT',
        createdBy: '00000000-0000-0000-0000-000000000001',
        currentServerRev: 1,
        version: 2,
        metadata: data?.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (normalizedMethod === 'DELETE') {
      return { success: true };
    }

    // Default list
    return [
      {
        id: '00000000-0000-0000-0000-000000000099',
        journalId: '00000000-0000-0000-0000-000000000050',
        title: 'Mock Research Manuscript',
        abstract: 'This is a mock manuscript for testing and development.',
        status: 'DRAFT',
        createdBy: '00000000-0000-0000-0000-000000000001',
        currentServerRev: 1,
        version: 1,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  // Assets
  if (cleanUrl.includes('/assets/upload-intent')) {
    return {
      uploadUrl: 'http://localhost:9000/structpaper-assets/mock-upload-key',
      storageKey: 'mock-storage-key-123',
      expiresIn: 900,
    };
  }

  if (cleanUrl.includes('/assets/upload-complete')) {
    return {
      id: '00000000-0000-0000-0000-000000000088',
      storageKey: data?.storageKey || 'mock-storage-key-123',
      checksum: data?.checksum || 'mock-checksum',
      filename: data?.filename || 'sample.pdf',
      fileSize: data?.fileSize || 1024,
      mimeType: data?.mimeType || 'application/pdf',
      createdAt: new Date().toISOString(),
    };
  }

  return { success: true };
}
