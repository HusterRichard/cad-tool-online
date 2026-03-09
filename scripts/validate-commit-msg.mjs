import fs from 'node:fs';
import path from 'node:path';

const commitMsgPath = process.argv[2];

if (!commitMsgPath) {
  console.error('Missing commit message file path.');
  process.exit(1);
}

const allowedTypes = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci'];
const allowedTypePattern = allowedTypes.join('|');
const subjectPattern = new RegExp(
  `^(?<type>${allowedTypePattern}): (?:(?<taskId>[A-Z][A-Z0-9_-]*\\d+)\\s+)?(?<summary>.+)$`,
  'u',
);
const skipPrefixes = ['Merge ', 'Revert "', 'fixup!', 'squash!'];
const vagueSummaries = new Set(['一些优化', '若干修改', '一些修改']);

const raw = fs.readFileSync(path.resolve(commitMsgPath), 'utf8').replace(/\r\n/g, '\n');
const lines = raw.split('\n');

const subjectIndex = lines.findIndex((line) => {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith('#');
});

if (subjectIndex === -1) {
  console.error('Commit message is empty.');
  process.exit(1);
}

const subject = lines[subjectIndex].trim();

if (skipPrefixes.some((prefix) => subject.startsWith(prefix))) {
  process.exit(0);
}

const match = subject.match(subjectPattern);

if (!match?.groups) {
  printError([
    '提交标题不符合规范。',
    `要求格式：<type>: <task id><简要描述>`,
    `允许的 type：${allowedTypes.join(', ')}`,
    '示例：feat: T013 新增装配体导入校验',
  ]);
}

const summary = match.groups.summary.trim();

if (summary.length === 0 || vagueSummaries.has(summary)) {
  printError([
    '提交标题描述过于空泛。',
    '请直接写清楚这次提交“做了什么”，不要使用“一些优化”“若干修改”这类描述。',
  ]);
}

const nextMeaningfulIndex = lines.findIndex((line, index) => {
  if (index <= subjectIndex) {
    return false;
  }

  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith('#');
});

if (nextMeaningfulIndex !== -1 && lines[subjectIndex + 1]?.trim() !== '') {
  printError([
    '提交标题与正文之间必须保留一个空行。',
    '示例：',
    'feat: T013 新增装配体导入校验',
    '',
    '- 补充 STEP 装配体层级检查',
  ]);
}

process.exit(0);

function printError(linesToPrint) {
  console.error('Commit message validation failed.');
  for (const line of linesToPrint) {
    console.error(line);
  }
  process.exit(1);
}
