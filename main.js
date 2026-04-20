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

function compareWords(textA, textB, output) {
  const diffs = Diff.diffWords(prepareForWordDiff(textA), prepareForWordDiff(textB));

  // Tokenize each diff part, preserving its type
  const allTokens = [];
  for (const part of diffs) {
    const type = part.removed ? 'removed' : part.added ? 'added' : 'unchanged';
    const tokens = part.value.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      allTokens.push({ token, type });
    }
  }

  let removedCount = 0, addedCount = 0;
  let html = '<div class="word-diff-output"><p>';
  let needSpace = false;

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

    // Collect consecutive changed tokens (no unchanged in between)
    const removedTokens = [];
    const addedTokens = [];
    while (i < allTokens.length && allTokens[i].type !== 'unchanged') {
      const t = allTokens[i];
      if (t.token === PARA) break;
      if (t.type === 'removed') removedTokens.push(t.token);
      else addedTokens.push(t.token);
      i++;
    }

    // Render grouped: all removed first, then all added
    for (let j = 0; j < removedTokens.length; j++) {
      if (needSpace) html += ' ';
      html += `<span class="word-removed">${escapeHtml(removedTokens[j])}</span>`;
      needSpace = true;
    }
    for (let j = 0; j < addedTokens.length; j++) {
      if (needSpace) html += ' ';
      html += `<span class="word-added">${escapeHtml(addedTokens[j])}</span>`;
      needSpace = true;
    }
    removedCount += removedTokens.length;
    addedCount += addedTokens.length;
  }
  html += '</p></div>';

  if (removedCount === 0 && addedCount === 0) {
    output.innerHTML = '<div class="identical-msg">Texts are identical.</div>';
    return;
  }

  const summary = `<div class="diff-summary">${removedCount} word${removedCount !== 1 ? 's' : ''} removed &nbsp;·&nbsp; ${addedCount} word${addedCount !== 1 ? 's' : ''} added</div>`;
  output.innerHTML = summary + html;
}

function compare() {
  const ignoreWS = document.getElementById('ignoreWhitespace').checked;
  const mode = document.querySelector('input[name="mode"]:checked').value;
  let textA = document.getElementById('textA').value;
  let textB = document.getElementById('textB').value;

  if (ignoreWS) {
    textA = textA.split('\n').map(l => l.trim()).join('\n');
    textB = textB.split('\n').map(l => l.trim()).join('\n');
  }

  const output = document.getElementById('output');

  if (mode === 'word') {
    compareWords(textA, textB, output);
    return;
  }

  const lineDiffs = Diff.diffLines(textA, textB);

  // Collect flat list of chunks: {type, lines[]}
  // Then pair consecutive removed+added for word diff
  const chunks = [];
  for (const part of lineDiffs) {
    const rawLines = part.value.endsWith('\n')
      ? part.value.slice(0, -1).split('\n')
      : part.value.split('\n');
    // Remove trailing empty string caused by trailing newline
    const lines = rawLines[rawLines.length - 1] === '' && part.value.endsWith('\n')
      ? rawLines.slice(0, -1)
      : rawLines;

    if (part.removed) chunks.push({ type: 'removed', lines });
    else if (part.added) chunks.push({ type: 'added', lines });
    else chunks.push({ type: 'unchanged', lines });
  }

  let removedCount = 0, addedCount = 0;
  const rows = [];
  let counterA = 1, counterB = 1;

  let i = 0;
  while (i < chunks.length) {
    const chunk = chunks[i];

    if (chunk.type === 'removed' && i + 1 < chunks.length && chunks[i + 1].type === 'added') {
      // Pair for word-level diff
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

  if (removedCount === 0 && addedCount === 0) {
    output.innerHTML = '<div class="identical-msg">Texts are identical.</div>';
    return;
  }

  const summary = `<div class="diff-summary">${removedCount} line${removedCount !== 1 ? 's' : ''} removed &nbsp;·&nbsp; ${addedCount} line${addedCount !== 1 ? 's' : ''} added</div>`;
  output.innerHTML = summary + `<table class="diff-table"><tbody>${rows.join('')}</tbody></table>`;
}
