/**
 * Normalizes HTML pasted from Microsoft Word or Excel.
 * Cleans out proprietary MSO styles and XML comments while preserving
 * vital scientific formatting: italic (e.g. H. pylori), bold, subscript (e.g. FEV1), and superscript.
 */
export function cleanWordPasteHtml(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // 1. Remove HTML comments (frequent in Word clipboard payloads)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '');

  // 2. Remove <style>, <xml>, <meta>, <link>, and <title> blocks
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<xml[\s\S]*?<\/xml>/gi, '');
  cleaned = cleaned.replace(/<meta[\s\S]*?>/gi, '');
  cleaned = cleaned.replace(/<link[\s\S]*?>/gi, '');
  cleaned = cleaned.replace(/<title[\s\S]*?<\/title>/gi, '');

  // 3. Remove Office XML namespaces like <o:p>, <w:WordDocument>, etc.
  cleaned = cleaned.replace(/<\/?\w+:[^>]*>/gi, '');

  // 4. Transform Word/MSO inline styling into semantic tags:
  // Convert subscript spans (e.g., vertical-align: sub)
  cleaned = cleaned.replace(
    /<span[^>]*style="[^"]*vertical-align:\s*sub[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    '<sub>$1</sub>'
  );
  cleaned = cleaned.replace(
    /<span[^>]*style='[^']*vertical-align:\s*sub[^']*'[^>]*>([\s\S]*?)<\/span>/gi,
    '<sub>$1</sub>'
  );

  // Convert superscript spans (e.g., vertical-align: super)
  cleaned = cleaned.replace(
    /<span[^>]*style="[^"]*vertical-align:\s*super[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    '<sup>$1</sup>'
  );
  cleaned = cleaned.replace(
    /<span[^>]*style='[^']*vertical-align:\s*super[^']*'[^>]*>([\s\S]*?)<\/span>/gi,
    '<sup>$1</sup>'
  );

  // Convert italic spans (font-style: italic or mso-bidi-font-style: italic)
  cleaned = cleaned.replace(
    /<span[^>]*style="[^"]*(?:font-style:\s*italic|mso-bidi-font-style:\s*italic)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    '<em>$1</em>'
  );
  cleaned = cleaned.replace(
    /<span[^>]*style='[^']*(?:font-style:\s*italic|mso-bidi-font-style:\s*italic)[^']*'[^>]*>([\s\S]*?)<\/span>/gi,
    '<em>$1</em>'
  );

  // Convert bold spans (font-weight: bold or 700+)
  cleaned = cleaned.replace(
    /<span[^>]*style="[^"]*(?:font-weight:\s*(?:bold|[7-9]00)|mso-bidi-font-weight:\s*bold)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    '<strong>$1</strong>'
  );
  cleaned = cleaned.replace(
    /<span[^>]*style='[^']*(?:font-weight:\s*(?:bold|[7-9]00)|mso-bidi-font-weight:\s*bold)[^']*'[^>]*>([\s\S]*?)<\/span>/gi,
    '<strong>$1</strong>'
  );

  // 5. Clean attributes from tags (strip MSO classes, style, lang, etc.)
  // Preserve semantic tags: p, br, strong, b, em, i, sub, sup, a
  cleaned = cleaned.replace(/<p\b[^>]*>/gi, '<p>');
  cleaned = cleaned.replace(/<div\b[^>]*>/gi, '<p>');
  cleaned = cleaned.replace(/<\/div>/gi, '</p>');

  // Strip empty spans or remaining spans without semantic attributes
  cleaned = cleaned.replace(/<span\b[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');

  // Strip excessive whitespace/newlines between tags
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
