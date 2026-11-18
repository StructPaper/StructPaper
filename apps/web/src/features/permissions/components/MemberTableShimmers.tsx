'use client';

import React from 'react';
import { Shimmer } from '@/components/ui/Shimmer';

interface ShimmerRowsProps {
  rowCount?: number;
}

const widthByIndex = (index: number, widths: string[]) => widths[index % widths.length];

/**
 * Placeholder rows for the members table. They mirror the real row layout (avatar + name/email,
 * journal scope, status badge, version badge, role select) so nothing jumps when data arrives.
 * Rendered inside the table body, so the column headers stay put.
 */
export const UserRowsShimmer: React.FC<ShimmerRowsProps> = ({ rowCount = 6 }) => (
  <>
    {Array.from({ length: rowCount }, (_, index) => (
      <tr
        key={`user-row-shimmer-${index}`}
        data-testid="users-loading-row"
        role="status"
        aria-label="Đang tải danh sách thành viên"
      >
        <td className="py-4 px-6">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Shimmer className={`h-3.5 rounded-md ${widthByIndex(index, ['w-40', 'w-32', 'w-36'])}`} />
              <Shimmer className={`h-2.5 rounded-md ${widthByIndex(index, ['w-44', 'w-36', 'w-40'])}`} />
            </div>
          </div>
        </td>
        <td className="py-4 px-6">
          <Shimmer className={`h-3 rounded-md ${widthByIndex(index, ['w-36', 'w-28', 'w-32'])}`} />
        </td>
        <td className="py-4 px-6">
          <Shimmer className="h-6 w-20 rounded-full" />
        </td>
        <td className="py-4 px-6">
          <Shimmer className="h-5 w-10 rounded-full" />
        </td>
        <td className="py-4 px-6">
          <Shimmer className="h-9 w-44 rounded-xl" />
        </td>
      </tr>
    ))}
  </>
);

/** Placeholder rows for the pending-invitations table (same idea as UserRowsShimmer). */
export const InvitationRowsShimmer: React.FC<ShimmerRowsProps> = ({ rowCount = 4 }) => (
  <>
    {Array.from({ length: rowCount }, (_, index) => (
      <tr
        key={`invitation-row-shimmer-${index}`}
        data-testid="invitations-loading-row"
        role="status"
        aria-label="Đang tải danh sách lời mời"
      >
        <td className="py-4 px-6">
          <div className="flex items-center gap-3">
            <Shimmer className="w-10 h-10 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Shimmer className={`h-3.5 rounded-md ${widthByIndex(index, ['w-40', 'w-32', 'w-36'])}`} />
              <Shimmer className={`h-2.5 rounded-md ${widthByIndex(index, ['w-44', 'w-36', 'w-40'])}`} />
            </div>
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="space-y-1.5">
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className={`h-2.5 rounded-md ${widthByIndex(index, ['w-36', 'w-28', 'w-32'])}`} />
          </div>
        </td>
        <td className="py-4 px-6">
          <Shimmer className="h-6 w-24 rounded-full" />
        </td>
        <td className="py-4 px-6">
          <div className="space-y-1.5">
            <Shimmer className="h-2.5 w-28 rounded-md" />
            <Shimmer className="h-3 w-40 rounded-md" />
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center justify-end gap-2">
            <Shimmer className="h-8 w-44 rounded-xl" />
            <Shimmer className="h-8 w-24 rounded-xl" />
          </div>
        </td>
      </tr>
    ))}
  </>
);
