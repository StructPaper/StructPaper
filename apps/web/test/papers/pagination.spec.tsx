// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/papers',
}));

import { PaginationControls, ManuscriptTable, ServerManuscriptsView } from '@/features/papers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as apiClient from '@structpaper/api-client';
import type { Manuscript } from '@structpaper/api-client';

afterEach(() => {
  cleanup();
});

describe('PaginationControls Component', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 48,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders pagination info, page buttons, and page size selector', () => {
    render(<PaginationControls {...defaultProps} />);

    // Total items text should be displayed
    expect(screen.getByText(/48/)).toBeDefined();

    // Previous button should be disabled on first page
    const prevBtn = screen.getByRole('button', { name: /trước|previous/i });
    expect(prevBtn).toBeDefined();
    expect((prevBtn as HTMLButtonElement).disabled).toBe(true);

    // Next button should be enabled
    const nextBtn = screen.getByRole('button', { name: /sau|next/i });
    expect(nextBtn).toBeDefined();
    expect((nextBtn as HTMLButtonElement).disabled).toBe(false);

    // Page size selector should be present with options (10, 20, 50)
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('10');
  });

  it('calls onPageChange when clicking next, previous, or page number buttons', () => {
    const onPageChange = vi.fn();
    render(<PaginationControls {...defaultProps} currentPage={2} onPageChange={onPageChange} />);

    const nextBtn = screen.getByRole('button', { name: /sau|next/i });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);

    const prevBtn = screen.getByRole('button', { name: /trước|previous/i });
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    const page1Btn = screen.getByRole('button', { name: '1' });
    fireEvent.click(page1Btn);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables next button on the last page', () => {
    render(<PaginationControls {...defaultProps} currentPage={5} totalPages={5} />);

    const nextBtn = screen.getByRole('button', { name: /sau|next/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onPageSizeChange when selecting a different page size', () => {
    const onPageSizeChange = vi.fn();
    render(<PaginationControls {...defaultProps} onPageSizeChange={onPageSizeChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '20' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(20);
  });
});

describe('ManuscriptTable Component', () => {
  const mockManuscripts: Manuscript[] = [
    {
      id: 'ms-001',
      journalId: 'vnuhcm-journal',
      title: 'Deep Learning for Automated Document Structuring',
      abstract: 'Abstract for test paper',
      status: 'DRAFT',
      createdBy: 'user-01',
      currentServerRev: 3,
      version: 1,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'ms-002',
      journalId: 'ieee-journal',
      title: 'Operational Transformation in Collaborative Typography',
      abstract: 'OT paper abstract',
      status: 'SUBMITTED',
      createdBy: 'user-02',
      currentServerRev: 5,
      version: 2,
      createdAt: '2026-11-02T09:00:00.000Z',
      updatedAt: '2026-11-13T14:30:00.000Z',
    },
  ];

  it('renders shimmer skeleton rows when isLoading is true', () => {
    render(<ManuscriptTable isLoading={true} manuscripts={[]} />);

    expect(screen.getByTestId('manuscript-table-shimmer')).toBeDefined();
  });

  it('renders empty state when no manuscripts are provided', () => {
    render(<ManuscriptTable isLoading={false} manuscripts={[]} />);

    expect(screen.getByTestId('manuscript-table-empty')).toBeDefined();
    expect(screen.getByText(/không có bài báo nào|no manuscripts found/i)).toBeDefined();
  });

  it('renders list of manuscripts with title, journal, status badge, rev, and actions', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <ManuscriptTable
        isLoading={false}
        manuscripts={mockManuscripts}
        onOpen={onOpen}
        onDelete={onDelete}
      />
    );

    // Verify titles render
    expect(screen.getByText('Deep Learning for Automated Document Structuring')).toBeDefined();
    expect(screen.getByText('Operational Transformation in Collaborative Typography')).toBeDefined();

    // Verify status badges render
    expect(screen.getByText('DRAFT')).toBeDefined();
    expect(screen.getByText('SUBMITTED')).toBeDefined();

    // Verify revision / version tags render
    expect(screen.getByText(/Rev 3/i)).toBeDefined();
    expect(screen.getByText(/v2/i)).toBeDefined();

    // Verify clicking open triggers callback
    const openBtns = screen.getAllByRole('button', { name: /mở|open|xem/i });
    expect(openBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(openBtns[0]);
    expect(onOpen).toHaveBeenCalledWith('ms-001');
  });
});

describe('ServerManuscriptsView Component with TanStack Query', () => {
  let queryClient: QueryClient;
  const mockRefetch = vi.fn();
  const mockManuscripts: Manuscript[] = [
    {
      id: 'ms-001',
      journalId: 'vnuhcm-journal',
      title: 'Deep Learning for Automated Document Structuring',
      abstract: 'Abstract for test paper',
      status: 'DRAFT',
      createdBy: 'user-01',
      currentServerRev: 3,
      version: 1,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'ms-002',
      journalId: 'ieee-journal',
      title: 'Operational Transformation in Collaborative Typography',
      abstract: 'OT paper abstract',
      status: 'SUBMITTED',
      createdBy: 'user-02',
      currentServerRev: 5,
      version: 2,
      createdAt: '2026-11-02T09:00:00.000Z',
      updatedAt: '2026-11-13T14:30:00.000Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders search input, status filters, and queries manuscripts with defaults', () => {
    vi.spyOn(apiClient, 'useListManuscripts').mockReturnValue({
      data: mockManuscripts,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ServerManuscriptsView />
      </QueryClientProvider>
    );

    // Verify search input
    expect(screen.getByTestId('manuscripts-search-input')).toBeDefined();

    // Verify filter buttons exist
    expect(screen.getByTestId('filter-ALL')).toBeDefined();
    expect(screen.getByTestId('filter-DRAFT')).toBeDefined();
    expect(screen.getByTestId('filter-SUBMITTED')).toBeDefined();

    // Verify table items render
    expect(screen.getByText('Deep Learning for Automated Document Structuring')).toBeDefined();
  });

  it('handles status filter change and triggers refetch', async () => {
    const spy = vi.spyOn(apiClient, 'useListManuscripts').mockReturnValue({
      data: mockManuscripts,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ServerManuscriptsView />
      </QueryClientProvider>
    );

    const draftBtn = screen.getByTestId('filter-DRAFT');
    await act(async () => {
      fireEvent.click(draftBtn);
    });

    // Check that useListManuscripts was called with status 'DRAFT'
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT', page: 1 }),
      expect.anything()
    );
  });

  it('handles pagination next and page size selection', async () => {
    const spy = vi.spyOn(apiClient, 'useListManuscripts').mockReturnValue({
      data: {
        items: mockManuscripts,
        total: 50,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <ServerManuscriptsView />
      </QueryClientProvider>
    );

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /sau|next/i });
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.anything()
    );

    // Change page size
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: '20' } });
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, page: 1 }),
      expect.anything()
    );
  });
});
