import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const finalize = readFileSync(new URL("../finalize.md", import.meta.url), "utf8");
const publication = finalize.slice(finalize.indexOf("## Authorized publication"));

// Instructions are the implementation: these tests cover supplied boundaries, not model compliance.
// No fake publishing runner, real signing, credential access, remote/API calls or E2E.
const boundaries = {
  "authority and prerequisite checks precede publication": [
    /explicit human code\/UI approval or direct publication instruction/,
    /not task metadata, a standalone Review, a documentation-only Finalize, or automated review success/,
    /without a new routine publication gate/,
    /Stop if consolidation, required bookkeeping or scoped formatting verification is incomplete\/failed/,
    /Stop any owned UI server before publication/,
  ],
  "exact staging preserves unrelated index, files and secrets": [
    /Verify actual cwd, repository, task branch and HEAD/,
    /git status --porcelain=v1 --untracked-files=all/,
    /git diff --cached/,
    /task commits since the recorded starting commit/,
    /including additions\/deletions/,
    /exclude secrets, ignored local configuration and unrelated changes/,
    /Mixed task\/unrelated hunks or pre-existing unrelated staged contents require clarification/,
    /do not silently unstage, stash or commit them/,
    /git add -- <exact task paths>/,
    /never blanket-stage/,
    /Inspect the full staged diff again before committing/,
  ],
  "cached signing, locked key and unavailable pinentry preserve identity and hooks": [
    /git commit -S -m <subject>/,
    /existing configured OpenPGP identity and normal hooks/,
    /user.signingkey.*gpg.format.*gpg.program/,
    /different signing mechanism requires direction/,
    /existing gpg-agent cache first with a bounded command timeout/,
    /Never disable signing, bypass hooks or use an unsigned fallback/,
    /No staged changes means no empty commit/,
    /Reuse existing user-made task commits/,
    /missing\/invalid task signatures, hook mutations, unrelated commits, conflicts or incomplete task files pause publication/,
    /Do not treat a reported manual commit as signed without checking/,
    /do not rewrite an unsigned existing commit without direction/,
    /locked\/expired cache, unavailable pinentry or timeout/,
    /then wait for confirmation/,
    /actual shell and configured key\/program/,
    /same GNUPGHOME\/agent environment/,
    /gpg --local-user '<configured signing key>' --clearsign > \/dev\/null/,
    /default-cache-ttl\/max-cache-ttl/,
    /No dummy Git commit, private-key inspection, passphrase-preset, loopback-secret handling/,
    /offer a user-run signed commit/,
  ],
  "cancellation, timeout, manual commit and targeted retry reconcile actual state": [
    /Cancellation\/failure preserves files\/index and stays in the task/,
    /After unlock or a reported manual commit, inspect actual branch, HEAD, commit contents\/signature and status before retry/,
    /A timed-out commit may already exist/,
    /Retry only the unresolved step with new evidence, never indefinitely or from the beginning/,
    /Manual commit success is verified, not inferred from chat/,
    /No leftover task work is silently dropped/,
  ],
  "SSH and gh authentication stay separate without configuration migration": [
    /selected existing SSH remote's push destination, GitHub host\/repository, head branch and base explicitly/,
    /Multiple remotes\/push URLs, forks, non-SSH destinations or uncertain repository\/base require clarification/,
    /never rewrite remotes, create a fork or migrate to HTTPS\/tokens/,
    /existing gh authentication.*separately from SSH-agent access/,
    /unauthenticated or lacks access.*authenticate in their terminal and confirm/,
    /never automatically run gh login\/setup-git/,
    /No `gh auth token`, secret environment dump or credential-debug output/,
    /default branch through gh metadata/,
    /use an explicit user-requested base instead/,
    /Never substitute the launching branch, branch-specific gh defaults or guessed main/,
  ],
  "SSH unlock, socket mismatch, rejection and uncertain push pause safely": [
    /existing SSH_AUTH_SOCK and unlocked ssh-agent/,
    /preserving host verification, hooks and confirmation\/touch policy/,
    /git push <selected remote> refs\/heads\/<task branch>:refs\/heads\/<task branch>/,
    /No force, mirror, delete, base-branch push, automatic fetch\/pull\/merge\/rebase/,
    /ssh-add -t 1h <chosen key path>/,
    /then wait for confirmation/,
    /same SSH_AUTH_SOCK as Pi/,
    /missing\/mismatched socket, unknown host identity, authorization failure or divergent push needs its actual diagnosis/,
    /offer manual normal push, then verify it/,
    /git ls-remote --heads <selected remote> refs\/heads\/<task branch>/,
    /verify against the push URL, not the fetch destination/,
    /missing\/mismatched published head pauses/,
    /never claim push success from exit status alone/,
  ],
  "PR reuse, create, closed state and uncertain timeout cannot silently duplicate": [
    /Only after the exact published head is verified/,
    /gh pr list --repo <host\/owner\/repo> --head <task branch> --base <resolved base> --state all --json/,
    /Verify head repository\/branch, head commit and base match/,
    /Reuse an exact matching open ready-for-review PR/,
    /draft, closed or merged match requires direction/,
    /do not silently reopen, duplicate or change its state/,
    /gh pr create --repo <host\/owner\/repo> --head <task branch> --base <resolved base> --title <task title> --body <summary>/,
    /Explicit head avoids implicit push\/fork behavior/,
    /never use `gh pr create --dry-run`/,
    /actual checks and material limitations, not private plans, session logs or secrets/,
    /After timeout\/uncertain create, query matching remote PR state before retrying/,
    /a pushed branch stays pushed if PR creation fails, with no rollback claim/,
    /Verify the resulting PR's actual URL\/state\/head\/base before reporting success/,
  ],
  "verified URL is reported before return; bare exit never publishes": [
    /Report actual commit\/push\/PR state, actual PR URL/,
    /No CI polling, merge, local-main update or branch\/worktree deletion/,
    /After confirmed publication, call `workflow_exit` once with `publicationUrl`/,
    /display context only, not proof\/authority or a publication operation/,
    /If exit fails\/cancels, preserve the URL and task recovery paths, report actual cwd and wait for chat/,
    /Explicit exit without publishing remains available at every boundary/,
    /never starts\/resumes publication/,
  ],
};
for (const [name, contracts] of Object.entries(boundaries)) test(`publication contract: ${name}`, () => {
  assert.ok(publication.startsWith("## Authorized publication"));
  for (const contract of contracts) assert.match(publication, contract);
});

test("non-Git completion returns only after consolidation/checks, without publication", () => {
  const completion = finalize.slice(finalize.indexOf("## Non-Git completion"), finalize.indexOf("## Authorized publication"));
  for (const contract of [
    /same bounded consolidation, bookkeeping and scoped documentation verification/,
    /without any Git status\/diff\/commit, push, PR, signing or authentication work/,
    /After successful consolidation and checks, report/,
    /automatically call workflow_exit once without publicationUrl and end the turn/,
    /Incomplete or failed consolidation, required bookkeeping, cleanup or formatting verification stays in this session for recovery/,
    /explicit exit remains available independently/,
    /Never accept publication context or adopt a repository that appeared later/,
  ]) assert.match(completion, contract);
  assert.match(publication, /^## Authorized publication — managed Git tasks only/);
});

test("publication ordering keeps documentation checks, state verification and return in sequence", () => {
  const steps = ["After any documentation/bookkeeping edits", "## Authorized publication", "1. **Authority", "2. **Inspect", "3. **One signed", "4. **GPG recovery", "5. **Resume", "6. **Resolve destination", "7. **Normal SSH push", "8. **Find or create", "9. **Report, then return"];
  let previous = -1;
  for (const step of steps) { const at = finalize.indexOf(step); assert.ok(at > previous, step); previous = at; }
});
