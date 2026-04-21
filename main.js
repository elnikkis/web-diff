function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLineContent(text, wordDiffs, type) {
  if (!wordDiffs) return escapeHtml(text);
  return wordDiffs
    .filter(p => !((type === 'removed' && p.added) || (type === 'added' && p.removed)))
    .map(p => {
      if (type === 'removed' && p.removed) return `<span class="word-removed">${escapeHtml(p.value)}</span>`;
      if (type === 'added'   && p.added)   return `<span class="word-added">${escapeHtml(p.value)}</span>`;
      return escapeHtml(p.value);
    }).join('');
}

function buildRow(lineNumA, lineNumB, prefix, text, wordDiffs, type) {
  const numA = lineNumA != null ? lineNumA : '';
  const numB = lineNumB != null ? lineNumB : '';
  return `<tr class="${type}">
    <td class="line-num">${numA}</td>
    <td class="line-num">${numB}</td>
    <td class="line-prefix">${prefix}</td>
    <td class="line-content">${renderLineContent(text, wordDiffs, type)}</td>
  </tr>`;
}

function buildSplitRow(lineNumA, textA, wordDiffsA, typeA, lineNumB, textB, wordDiffsB, typeB) {
  const numA = lineNumA != null ? lineNumA : '';
  const numB = lineNumB != null ? lineNumB : '';
  const contentA = textA != null ? renderLineContent(textA, wordDiffsA, typeA) : '';
  const contentB = textB != null ? renderLineContent(textB, wordDiffsB, typeB) : '';
  const clsA = typeA || 'empty';
  const clsB = typeB || 'empty';
  return `<tr>
    <td class="line-num split-${clsA}">${numA}</td>
    <td class="line-content split-${clsA}">${contentA}</td>
    <td class="split-gutter"></td>
    <td class="line-num split-${clsB}">${numB}</td>
    <td class="line-content split-${clsB}">${contentB}</td>
  </tr>`;
}

document.getElementById('compareBtn').addEventListener('click', compare);
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('textA').value = '';
  document.getElementById('textB').value = '';
  document.getElementById('output').innerHTML = '';
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') compare();
});

const PARA = '\uE000';

function prepareForWordDiff(text) {
  return text
    .split(/\n{2,}/)
    .map(block => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(` ${PARA} `);
}

function tokenizeWordDiffs(diffs) {
  const allTokens = [];
  for (const part of diffs) {
    const type = part.removed ? 'removed' : part.added ? 'added' : 'unchanged';
    const tokens = part.value.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      allTokens.push({ token, type });
    }
  }
  return allTokens;
}

function renderWordTokens(allTokens, side) {
  let html = '<p>';
  let needSpace = false;
  let removedCount = 0, addedCount = 0;

  let i = 0;
  while (i < allTokens.length) {
    const { token, type } = allTokens[i];

    if (token === PARA) {
      html += '</p><p>';
      needSpace = false;
      i++;
      continue;
    }

    if (type === 'unchanged') {
      if (needSpace) html += ' ';
      html += escapeHtml(token);
      needSpace = true;
      i++;
      continue;
    }

    const removedTokens = [];
    const addedTokens = [];
    while (i < allTokens.length && allTokens[i].type !== 'unchanged') {
      const t = allTokens[i];
      if (t.token === PARA) break;
      if (t.type === 'removed') removedTokens.push(t.token);
      else addedTokens.push(t.token);
      i++;
    }

    if (side === 'left' || side === 'both') {
      for (let j = 0; j < removedTokens.length; j++) {
        if (needSpace) html += ' ';
        html += `<span class="word-removed">${escapeHtml(removedTokens[j])}</span>`;
        needSpace = true;
      }
    }
    if (side === 'right' || side === 'both') {
      for (let j = 0; j < addedTokens.length; j++) {
        if (needSpace) html += ' ';
        html += `<span class="word-added">${escapeHtml(addedTokens[j])}</span>`;
        needSpace = true;
      }
    }
    removedCount += removedTokens.length;
    addedCount += addedTokens.length;
  }
  html += '</p>';
  return { html, removedCount, addedCount };
}

function compareWords(textA, textB, output, view) {
  const diffs = Diff.diffWords(prepareForWordDiff(textA), prepareForWordDiff(textB));
  const allTokens = tokenizeWordDiffs(diffs);

  if (view === 'split') {
    const left = renderWordTokens(allTokens, 'left');
    const right = renderWordTokens(allTokens, 'right');

    if (left.removedCount === 0 && right.addedCount === 0) {
      output.innerHTML = '<div class="identical-msg">Texts are identical.</div>';
      return;
    }

    const summary = `<div class="diff-summary">${left.removedCount} word${left.removedCount !== 1 ? 's' : ''} removed &nbsp;·&nbsp; ${right.addedCount} word${right.addedCount !== 1 ? 's' : ''} added</div>`;
    output.innerHTML = summary +
      `<div class="word-diff-split">` +
        `<div class="word-diff-pane word-diff-pane-left">${left.html}</div>` +
        `<div class="word-diff-gutter"></div>` +
        `<div class="word-diff-pane word-diff-pane-right">${right.html}</div>` +
      `</div>`;
  } else {
    const result = renderWordTokens(allTokens, 'both');

    if (result.removedCount === 0 && result.addedCount === 0) {
      output.innerHTML = '<div class="identical-msg">Texts are identical.</div>';
      return;
    }

    const summary = `<div class="diff-summary">${result.removedCount} word${result.removedCount !== 1 ? 's' : ''} removed &nbsp;·&nbsp; ${result.addedCount} word${result.addedCount !== 1 ? 's' : ''} added</div>`;
    output.innerHTML = summary + `<div class="word-diff-output">${result.html}</div>`;
  }
}

function buildChunks(textA, textB) {
  const lineDiffs = Diff.diffLines(textA, textB);
  const chunks = [];
  for (const part of lineDiffs) {
    const rawLines = part.value.endsWith('\n')
      ? part.value.slice(0, -1).split('\n')
      : part.value.split('\n');
    const lines = rawLines[rawLines.length - 1] === '' && part.value.endsWith('\n')
      ? rawLines.slice(0, -1)
      : rawLines;

    if (part.removed) chunks.push({ type: 'removed', lines });
    else if (part.added) chunks.push({ type: 'added', lines });
    else chunks.push({ type: 'unchanged', lines });
  }
  return chunks;
}

function renderUnified(chunks) {
  let removedCount = 0, addedCount = 0;
  const rows = [];
  let counterA = 1, counterB = 1;

  let i = 0;
  while (i < chunks.length) {
    const chunk = chunks[i];

    if (chunk.type === 'removed' && i + 1 < chunks.length && chunks[i + 1].type === 'added') {
      const removedChunk = chunk;
      const addedChunk = chunks[i + 1];
      i += 2;

      const maxLen = Math.max(removedChunk.lines.length, addedChunk.lines.length);
      for (let j = 0; j < maxLen; j++) {
        if (j < removedChunk.lines.length) {
          const lineA = removedChunk.lines[j];
          const lineB = j < addedChunk.lines.length ? addedChunk.lines[j] : null;
          const wordDiffs = lineB != null ? Diff.diffWords(lineA, lineB) : null;
          rows.push(buildRow(counterA++, null, '−', lineA, wordDiffs, 'removed'));
          removedCount++;
        }
      }
      for (let j = 0; j < addedChunk.lines.length; j++) {
        const lineB = addedChunk.lines[j];
        const lineA = j < removedChunk.lines.length ? removedChunk.lines[j] : null;
        const wordDiffs = lineA != null ? Diff.diffWords(lineA, lineB) : null;
        rows.push(buildRow(null, counterB++, '+', lineB, wordDiffs, 'added'));
        addedCount++;
      }
    } else if (chunk.type === 'removed') {
      for (const line of chunk.lines) {
        rows.push(buildRow(counterA++, null, '−', line, null, 'removed'));
        removedCount++;
      }
      i++;
    } else if (chunk.type === 'added') {
      for (const line of chunk.lines) {
        rows.push(buildRow(null, counterB++, '+', line, null, 'added'));
        addedCount++;
      }
      i++;
    } else {
      for (const line of chunk.lines) {
        rows.push(buildRow(counterA++, counterB++, ' ', line, null, 'unchanged'));
      }
      i++;
    }
  }

  return { rows, removedCount, addedCount, tableClass: 'diff-table' };
}

function renderSplit(chunks) {
  let removedCount = 0, addedCount = 0;
  const rows = [];
  let counterA = 1, counterB = 1;

  let i = 0;
  while (i < chunks.length) {
    const chunk = chunks[i];

    if (chunk.type === 'removed' && i + 1 < chunks.length && chunks[i + 1].type === 'added') {
      const removedChunk = chunk;
      const addedChunk = chunks[i + 1];
      i += 2;

      const maxLen = Math.max(removedChunk.lines.length, addedChunk.lines.length);
      for (let j = 0; j < maxLen; j++) {
        const lineA = j < removedChunk.lines.length ? removedChunk.lines[j] : null;
        const lineB = j < addedChunk.lines.length ? addedChunk.lines[j] : null;
        const wordDiffs = (lineA != null && lineB != null) ? Diff.diffWords(lineA, lineB) : null;
        rows.push(buildSplitRow(
          lineA != null ? counterA++ : null, lineA, wordDiffs, lineA != null ? 'removed' : null,
          lineB != null ? counterB++ : null, lineB, wordDiffs, lineB != null ? 'added' : null
        ));
        if (lineA != null) removedCount++;
        if (lineB != null) addedCount++;
      }
    } else if (chunk.type === 'removed') {
      for (const line of chunk.lines) {
        rows.push(buildSplitRow(counterA++, line, null, 'removed', null, null, null, null));
        removedCount++;
      }
      i++;
    } else if (chunk.type === 'added') {
      for (const line of chunk.lines) {
        rows.push(buildSplitRow(null, null, null, null, counterB++, line, null, 'added'));
        addedCount++;
      }
      i++;
    } else {
      for (const line of chunk.lines) {
        rows.push(buildSplitRow(counterA++, line, null, 'unchanged', counterB++, line, null, 'unchanged'));
      }
      i++;
    }
  }

  return { rows, removedCount, addedCount, tableClass: 'diff-table diff-table-split' };
}

function compare() {
  const ignoreWS = document.getElementById('ignoreWhitespace').checked;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const view = document.querySelector('input[name="view"]:checked').value;
  let textA = document.getElementById('textA').value;
  let textB = document.getElementById('textB').value;

  if (ignoreWS) {
    textA = textA.split('\n').map(l => l.trim()).join('\n');
    textB = textB.split('\n').map(l => l.trim()).join('\n');
  }

  const output = document.getElementById('output');

  if (mode === 'word') {
    compareWords(textA, textB, output, view);
    return;
  }

  const chunks = buildChunks(textA, textB);
  const { rows, removedCount, addedCount, tableClass } =
    view === 'split' ? renderSplit(chunks) : renderUnified(chunks);

  if (removedCount === 0 && addedCount === 0) {
    output.innerHTML = '<div class="identical-msg">Texts are identical.</div>';
    return;
  }

  const summary = `<div class="diff-summary">${removedCount} line${removedCount !== 1 ? 's' : ''} removed &nbsp;·&nbsp; ${addedCount} line${addedCount !== 1 ? 's' : ''} added</div>`;
  output.innerHTML = summary + `<table class="${tableClass}"><tbody>${rows.join('')}</tbody></table>`;
}
