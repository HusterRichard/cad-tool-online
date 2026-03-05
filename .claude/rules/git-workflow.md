---
name: git-workflow
description: Git workflow rules for commit format, PR flow, branch strategy, and pre-commit checks.
---

# Git 宸ヤ綔娴佽鑼?

## Commit 娑堟伅鏍煎紡

鎺ㄨ崘浣跨敤 Conventional Commits 椋庢牸锛屼娇鐢ㄤ腑鏂囨潵鍐欐弿杩帮紝缁熶竴浣跨敤鑻辨枃鍐掑彿 `:`

```text
<type>: <task id><绠€瑕佹弿杩?

<绠€瑕佸彉鏇磋鏄?
- <鍙樻洿鐐?1>
- <鍙樻洿鐐?2>

<Footer>
Co-authored-by: <Name>
```

璇存槑锛?

- `task id` 鍙€夛紝渚嬪 `T013 `锛堟敞鎰忓悗闈㈡湁绌烘牸锛?
- 鏍囬寤鸿涓€鍙ヨ瘽璇存竻鈥滃仛浜嗕粈涔堚€濓紝閬垮厤鈥滀竴浜涗紭鍖栤€濃€滆嫢骞蹭慨鏀光€濊繖绫荤┖鎻忚堪
- 姝ｆ枃寤鸿鐢ㄨ鐐瑰垪鍑哄叧閿敼鍔ㄤ笌褰卞搷
- 鍏卞悓浣滆€呭缓璁娇鐢ㄦ爣鍑?trailer锛歚Co-authored-by: Name`

### 绫诲瀷璇存槑

| 绫诲瀷     | 璇存槑               |
| -------- | ------------------ |
| feat     | 鏂板姛鑳?            |
| fix      | Bug 淇           |
| refactor | 閲嶆瀯锛堜笉鏀瑰彉鍔熻兘锛?|
| docs     | 鏂囨。鏇存柊           |
| test     | 娴嬭瘯鐩稿叧           |
| chore    | 鏋勫缓/宸ュ叿鍙樻洿      |
| perf     | 鎬ц兘浼樺寲           |
| ci       | CI/CD 閰嶇疆         |

### 绀轰緥

```text
feat: T002 鏂板鑺傜偣杈?CRUD 鑳藉姏

- 鏀寔鑺傜偣/杈瑰垱寤恒€佹煡璇€佹洿鏂般€佸垹闄?
- 鏂板绫诲瀷绱㈠紩涓庣増鏈瓧娈垫煡璇?
```

```text
chore: 浼樺寲 Windows 寮€鍙戝伐鍏烽摼

- 鍒犻櫎 `.sh` 鑴氭湰锛岀粺涓€涓?Windows 寮€鍙戝叆鍙?
- 淇 `claude-progress.txt` 涓枃涔辩爜闂
- 涓?`update-progress` 澧炲姞 `-AutoPush` 鍙傛暟鏀寔鑷姩鎺ㄩ€?
- 鏇存柊鐩稿叧 Markdown 鏂囨。绀轰緥

Co-authored-by: XXX
```

## Pull Request 宸ヤ綔娴?

1. 鍒嗘瀽瀹屾暣鐨?commit 鍘嗗彶锛堜笉浠呮槸鏈€鏂?commit锛?
2. 浣跨敤 `git diff [base-branch]...HEAD` 鏌ョ湅鎵€鏈夊彉鏇?
3. 缂栧啓 PR 鎽樿锛屽寘鍚細
   - 鍙樻洿姒傝堪
   - 娴嬭瘯璁″垝
4. 鏂板垎鏀帹閫佹椂浣跨敤 `-u` 鏍囧織

## 鍒嗘敮绠＄悊

- `main`锛氫富鍒嗘敮锛岀ǔ瀹氱増鏈?
- `develop`锛氬紑鍙戝垎鏀?
- `feature/*`锛氬姛鑳藉垎鏀?
- `fix/*`锛氫慨澶嶅垎鏀?

## 鎻愪氦鍓嶆鏌?

- [ ] 浠ｇ爜宸茬紪璇戦€氳繃
- [ ] 鏃犺皟璇曚唬鐮佹畫鐣?
- [ ] Commit 娑堟伅绗﹀悎瑙勮寖
- [ ] 淇敼閫昏緫鍚庢鏌ユ槸鍚﹂渶瑕佸悓姝ユ洿鏂?`docs/` 涓嬬殑璁捐鏂囨。
