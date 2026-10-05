# Production render verification for issue #13

Complete this once the implementation and `render-posts.yml` are on the default branch, before separately dispatching Pages. Local fixture tests cannot demonstrate hosted workflow permissions or push behavior.

1. Record the current remote `mirror-data` SHA as the input revision and note the latest capture and Pages runs. Avoid overlapping archive-writing runs during this verification.
2. Manually run **Render archive posts from snapshots** from the default branch. Record the successful run URL and resulting `mirror-data` output SHA. The workflow fetches archive history and uses an ordinary push; a failed push requires inspection and a fresh run, never a force-push.
3. Fetch the output history and review `git diff <input-sha> <output-sha> -- posts/`. Confirm the output is an ordinary descendant of the input and the only changes are derived posts. Confirm `git diff <input-sha> <output-sha> -- snapshots/` is empty and unrelated historical posts are preserved.
4. Check full ordered editorial bodies in the GPT-6.1 Sol, weekly releases — September 21, Usage metrics API review stages, and HydraFusion posts. Check source URL and exact fetch time against each saved JSON record, publication time against saved discovery metadata or article-associated `datePublished`, and established post filenames. The six frozen production fixture baselines remain the deterministic CI acceptance evidence.
5. Dispatch the render workflow again without an intervening capture. Record the second successful run URL and verify the archive SHA stays unchanged. Compare Actions runs to confirm that neither capture nor Pages was triggered by either render dispatch.
6. Record the run URLs, input/output SHAs, post diff, metadata checks, preservation checks, and unchanged rerun SHA in the issue. Once this evidence is complete, Pages can be dispatched separately.

The implementation does not merge itself or automatically dispatch production repair or publication.
