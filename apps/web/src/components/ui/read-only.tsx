'use client';

import React, { createContext, useContext } from 'react';

const ReadOnlyContext = createContext(false);

/** True inside a read-only area: shared controls (Select, DatePicker, ...) lock themselves. */
export const useReadOnly = (): boolean => useContext(ReadOnlyContext);

export const ReadOnlyProvider: React.FC<{ readOnly: boolean; children: React.ReactNode }> = ({ readOnly, children }) => (
  <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>
);
