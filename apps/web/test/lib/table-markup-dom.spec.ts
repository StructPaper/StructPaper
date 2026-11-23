// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { htmlToMarkup, toHexColor } from '@/lib/table-markup-dom';
import { markupToHtml } from '@/lib/inline-markup';

const read = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return htmlToMarkup(el);
};

describe('the text of an edited cell, read back as the tagged string', () => {
  it('turns bold, italic and underline into tags and joins the neighbours', () => {
    expect(read('a <b>b</b><b>c</b> <i>d</i> <u>e</u>')).toBe('a <b>bc</b> <i>d</i> <u>e</u>');
    expect(read('<strong>x</strong><em>y</em>')).toBe('<b>x</b><i>y</i>');
  });

  it('reads colours given as rgb(), #rgb, a font colour or a style', () => {
    expect(toHexColor('rgb(255, 0, 0)')).toBe('#FF0000');
    expect(toHexColor('#0f0')).toBe('#00FF00');
    expect(toHexColor('#000000')).toBeUndefined();
    expect(read('<font color="#ff0000">r</font>')).toBe('<color=#FF0000>r</color>');
    expect(read('<span style="color: rgb(0, 128, 0)">g</span>')).toBe('<color=#008000>g</color>');
  });

  it('a raised citation number is read back as the citation with its brackets', () => {
    expect(read('FEV1<sup data-cite="1">18</sup> và <sup data-cite="1">3,4</sup>')).toBe('FEV1[18] và [3,4]');
  });

  it('a line break and the blocks of Enter are newlines, without a trailing one', () => {
    expect(read('một<br>hai')).toBe('một\nhai');
    expect(read('một<div>hai</div><div>ba</div>')).toBe('một\nhai\nba');
    expect(read('một<br>')).toBe('một');
  });

  it('says the same as what it was drawn from', () => {
    const text = 'a <b>đậm <i>và nghiêng</i></b> <u>gạch</u>\ndòng hai <color=#FF0000>đỏ</color>';
    expect(markupToHtml(read(markupToHtml(text)))).toBe(markupToHtml(text));
  });
});
