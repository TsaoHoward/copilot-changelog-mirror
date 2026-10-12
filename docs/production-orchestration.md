# Production orchestration and recovery

Production uses only the Node.js/TypeScript and Astro v2 chain. The former v1 commands, schemas and workflow entry points are retired; their source is retained under `legacy/v1/` and in ordinary application Git history.

- [Durable capture/render, exact handoffs, schedule and manual modes](v2-operations.md)
- [Pages identities, verified deployment baselines and retention recovery](v2-pages.md)
- [Checkpoint, fresh-target reset and coordinated activation](v2-cutover.md)
- [Local, hosted and scheduled acceptance evidence](v2-acceptance.md)

Force bypasses only identity equality. Expired successful baseline proof requires explicit retention-qualified re-establishment; force cannot repair evidence expiry. Render evidence renewal, fresh publish-only builds, and exact deployment-only retries remain distinct operations. Failures preserve durable successful archive inputs and the prior live site.
