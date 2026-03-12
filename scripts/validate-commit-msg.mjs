import fs from 'node:fs';
import path from 'node:path';

const commitMsgPath = process.argv[2];

if (!commitMsgPath) {
  console.error('Missing commit message file path.');
  process.exit(1);
}

const allowedTypes = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci'];
const workflowPath = '.claude/rules/git-workflow.md';
const subjectPattern = new RegExp(
  `^(?<type>${allowedTypes.join('|')}): (?<taskId>[A-Z][A-Z0-9_-]*\\d+) (?<summary>.+)$`,
  'u',
);
const skipPrefixes = ['Merge ', 'Revert "', 'fixup!', 'squash!'];
const vagueSummaries = new Set(['优化一些内容', '若干修改', '一些修改']);

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
    'Commit title does not match the required format.',
    `Rule source: ${workflowPath}`,
    'Required format: <type>: <task id> <summary>',
    `Allowed types: ${allowedTypes.join(', ')}`,
    'Task id is required. Use T000 when no real task id exists.',
    'Example: feat: T013 新增装配体导入校验'
  ]);
}

const taskId = match.groups.taskId.trim();
const summary = match.groups.summary.trim();

if (taskId.length === 0) {
  printError([
    'Task id is required in the commit title.',
    `Rule source: ${workflowPath}`,
    'Use T000 when there is no real task id.'
  ]);
}

if (summary.length === 0 || vagueSummaries.has(summary)) {
  printError([
    'Commit title summary is too vague.',
    `Rule source: ${workflowPath}`,
    'Describe exactly what changed instead of using generic summaries.'
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
    'Leave one blank line between the title and the body.',
    `Rule source: ${workflowPath}`,
    'Example:',
    'feat: T013 新增装配体导入校验',
    '',
    '- 补充 STEP 装配体层级检查'
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
