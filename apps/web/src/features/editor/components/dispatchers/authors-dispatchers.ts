import { CommandBus } from '@structpaper/editor-core';
import { Author, Affiliation, PaperMetadata } from '@/types/paper';

export function dispatchAddAuthor(
  bus: CommandBus | undefined,
  author: Author,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedAuthors = [...current.authors, author];
  if (bus) {
    try {
      bus.dispatch({
        type: 'author/add',
        payload: { author },
      });
    } catch (e) {
      console.warn('CommandBus author/add dispatch warning:', e);
    }
  }
  onChange({ ...current, authors: updatedAuthors });
}

export function dispatchUpdateAuthor(
  bus: CommandBus | undefined,
  authorId: string,
  updatedAuthor: Author,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedAuthors = current.authors.map((a) => (a.id === authorId ? updatedAuthor : a));
  let corresponding = current.corresponding;
  if (updatedAuthor.isCorresponding) {
    const primaryAff = current.affiliations.find((aff) =>
      (updatedAuthor.affiliationIds || []).includes(aff.id)
    ) || current.affiliations[0];
    corresponding = {
      name: updatedAuthor.name,
      email: updatedAuthor.email || 'tacgia@vnuhcm.edu.vn',
      affiliation: primaryAff?.name || '',
    };
  }

  if (bus) {
    try {
      bus.dispatch({
        type: 'author/update',
        payload: { authorId, updates: updatedAuthor },
      });
    } catch (e) {
      console.warn('CommandBus author/update dispatch warning:', e);
    }
  }
  onChange({ ...current, authors: updatedAuthors, corresponding });
}

export function dispatchRemoveAuthor(
  bus: CommandBus | undefined,
  authorId: string,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const filtered = current.authors.filter((a) => a.id !== authorId);
  let corresponding = current.corresponding;
  const removedAuthor = current.authors.find((a) => a.id === authorId);

  if (removedAuthor?.isCorresponding && filtered.length > 0) {
    filtered[0] = { ...filtered[0], isCorresponding: true };
    const primaryAff = current.affiliations.find((aff) =>
      (filtered[0].affiliationIds || []).includes(aff.id)
    ) || current.affiliations[0];
    corresponding = {
      name: filtered[0].name,
      email: filtered[0].email || 'tacgia@vnuhcm.edu.vn',
      affiliation: primaryAff?.name || '',
    };
  }

  if (bus) {
    try {
      bus.dispatch({
        type: 'author/remove',
        payload: { authorId },
      });
    } catch (e) {
      console.warn('CommandBus author/remove dispatch warning:', e);
    }
  }
  onChange({ ...current, authors: filtered, corresponding });
}

export function dispatchAddAffiliation(
  bus: CommandBus | undefined,
  affiliation: Affiliation,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedAffs = [...current.affiliations, affiliation];
  if (bus) {
    try {
      bus.dispatch({
        type: 'affiliation/add',
        payload: { affiliation },
      });
    } catch (e) {
      console.warn('CommandBus affiliation/add dispatch warning:', e);
    }
  }
  onChange({ ...current, affiliations: updatedAffs });
}

export function dispatchUpdateAffiliation(
  bus: CommandBus | undefined,
  affId: number,
  updatedAff: Affiliation,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedAffs = current.affiliations.map((a) => (a.id === affId ? updatedAff : a));
  let corresponding = current.corresponding;
  if (corresponding.affiliation === current.affiliations.find((a) => a.id === affId)?.name) {
    corresponding = { ...corresponding, affiliation: updatedAff.name };
  }

  if (bus) {
    try {
      bus.dispatch({
        type: 'affiliation/update',
        payload: { affiliationId: affId, updates: updatedAff },
      });
    } catch (e) {
      console.warn('CommandBus affiliation/update dispatch warning:', e);
    }
  }
  onChange({ ...current, affiliations: updatedAffs, corresponding });
}

export function dispatchRemoveAffiliation(
  bus: CommandBus | undefined,
  affId: number,
  onChange: (updated: PaperMetadata) => void,
  current: PaperMetadata
): void {
  const updatedAffs = current.affiliations.filter((a) => a.id !== affId);
  const oldIdToNewId = new Map<number, number>();
  const renumberedAffs = updatedAffs.map((item, i) => {
    const newId = i + 1;
    oldIdToNewId.set(item.id, newId);
    return { ...item, id: newId };
  });

  const updatedAuthors = current.authors.map((author) => {
    const currentIds = author.affiliationIds || [];
    const mappedIds = currentIds
      .filter((id) => id !== affId)
      .map((id) => oldIdToNewId.get(id))
      .filter((id): id is number => typeof id === 'number');

    return {
      ...author,
      affiliationIds: mappedIds.length > 0 ? mappedIds : renumberedAffs.length > 0 ? [1] : [],
    };
  });

  let corresponding = current.corresponding;
  if (renumberedAffs.length > 0) {
    if (!renumberedAffs.some((a) => a.name === corresponding.affiliation)) {
      corresponding = { ...corresponding, affiliation: renumberedAffs[0].name };
    }
  } else {
    corresponding = { ...corresponding, affiliation: '' };
  }

  if (bus) {
    try {
      bus.dispatch({
        type: 'affiliation/remove',
        payload: { affiliationId: affId },
      });
    } catch (e) {
      console.warn('CommandBus affiliation/remove dispatch warning:', e);
    }
  }
  onChange({
    ...current,
    affiliations: renumberedAffs,
    authors: updatedAuthors,
    corresponding,
  });
}
