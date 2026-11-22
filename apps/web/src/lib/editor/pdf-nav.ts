/**
 * A page of the PDF preview to show, asked from elsewhere in the editor (the overview page scrolls the preview to where the
 * block the author is in was printed). Whoever shows the PDF listens; nobody listening is not an error.
 */
type Listener = (page: number) => void;
const listeners = new Set<Listener>();

export function goToPdfPage(page: number): void {
  if (!Number.isFinite(page) || page < 1) return;
  listeners.forEach((l) => l(Math.floor(page)));
}

export function onGoToPdfPage(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
