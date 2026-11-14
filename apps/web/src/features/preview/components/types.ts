import { CompletePaper } from '@/lib/sample-papers';

export interface PublicationPreviewProps {
  paper: CompletePaper;
}

export interface JournalHeaderProps {
  paper: CompletePaper;
}

export interface JournalSidebarProps {
  paper: CompletePaper;
}

export interface JournalAbstractBoxProps {
  paper: CompletePaper;
}

export interface JournalSectionRendererProps {
  paper: CompletePaper;
  isTwoColumn: boolean;
}
