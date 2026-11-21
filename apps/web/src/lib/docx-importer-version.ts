/**
 * Version of the Word importer (`docx-parser.ts` and the `docx-*.ts` files it uses).
 *
 * RAISE IT whenever a change to the importer can give a different result for the same .docx file (a heading rule, a table fix, a
 * new field...). It is stored with every Word file kept for a paper, so the paper's dialog can tell the author that the importer
 * has improved since that file was read, and offer to read it again ("Phân tích lại").
 */
export const IMPORTER_VERSION = 1;
