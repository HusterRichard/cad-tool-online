import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  console.error('Please run this script from the repository root.');
  process.exit(1);
}

execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

execFileSync('git', ['config', '--local', 'commit.template', '.gitmessage.txt'], {
  cwd: repoRoot,
  stdio: 'inherit',
});

console.log('Git commit rules installed.');
console.log('Configured core.hooksPath=.githooks');
console.log('Configured commit.template=.gitmessage.txt');
console.log('Commit workflow source=.claude/rules/git-workflow.md');
