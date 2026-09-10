# Stage → Prod CI/CD Workflow (Practice Project)

A minimal, no-cloud-required example of a real-world CI/CD promotion flow:
**push → automated check → deploy to staging → human approval → deploy to production.**

No AWS, Docker, or Kubernetes required — everything runs on GitHub Actions runners
and "deploys" are simulated with `echo`/`sed` so you can focus purely on the
**pipeline mechanics**, not infrastructure.

---

## 1. Project structure

```
Stage-Prod-workflow/
├── .github/
│   └── workflows/
│       ├── stage.yml      # runs on push to `stage`
│       └── main.yml       # runs on push to `main`
├── index.html             # the "app"
├── check.js               # simple automated check (stand-in for tests/QC)
└── README.md
```

---

## 2. The app

**`index.html`**
```html
<!DOCTYPE html>
<html>
<head><title>Demo App</title></head>
<body>
  <h1>Hello from ENVIRONMENT_NAME</h1>
</body>
</html>
```

**`check.js`** — acts as an automated QC gate. Fails the pipeline if the page
doesn't contain a valid `<h1>` tag (accepts attributes and any case):

```javascript
const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

if (!/<h1[\s>]/i.test(content)) {
  console.error('❌ Check failed: missing <h1> tag');
  process.exit(1);
}

console.log('✅ Check passed: index.html looks valid');
```

Run it locally anytime with:
```bash
node check.js
```

---

## 3. Branching model

- **`stage`** — where you push work-in-progress changes. Every push here
  triggers an automatic check + simulated deploy to a "staging" environment.
  No approval required — QC should always have the latest code to test.
- **`main`** — production. Only reachable by promoting `stage` through a
  Pull Request. Deployments here require explicit human approval.

Both branches live in **the same repository** — there is no separate repo per
environment. What differs is which branch triggers which workflow, and which
GitHub *environment* (with its own secrets/protection rules) the job targets.

---

## 4. Workflow files

### `.github/workflows/stage.yml`
```yaml
name: Stage - Check and Deploy

on:
  push:
    branches: [stage]

jobs:
  check-and-deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Run checks
        run: node check.js

      - name: "Deploy to staging (simulated)"
        run: |
          echo "🚀 Deploying commit ${{ github.sha }} to STAGING"
          echo "Staging URL would be: https://staging.example.com"
          sed 's/ENVIRONMENT_NAME/staging/' index.html > deployed.html
          cat deployed.html
```

### `.github/workflows/main.yml`
```yaml
name: Production - Check and Deploy

on:
  push:
    branches: [main]

jobs:
  check-and-deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Run checks
        run: node check.js

      - name: "Deploy to production (simulated)"
        run: |
          echo "🚀 Deploying commit ${{ github.sha }} to PRODUCTION"
          echo "Production URL would be: https://example.com"
          sed 's/ENVIRONMENT_NAME/production/' index.html > deployed.html
          cat deployed.html
```

The two files are almost identical on purpose — staging and production should
go through the *same process*, just isolated by branch, environment name, and
(in a real setup) separate secrets/infrastructure.

---

## 5. GitHub setup — exact steps

### 5.1 Create the environments
1. Repo → **Settings → Environments**
2. **New environment** → name it `staging` → no protection rules needed.
3. **New environment** → name it `production`.
4. Inside `production` → **Deployment branches and tags** → change from
   "No restriction" to **Selected branches and tags** → add `main` only.
   *(Never leave this as `stage` — that would let staging pushes reach prod.)*

### 5.2 Add required reviewers (the approval gate)
> ⚠️ **Note:** "Required reviewers" and "Wait timer" on environments are only
> available for **public repositories** on GitHub Free/Pro/Team plans.
> On private repos, these specific protection rules require **GitHub
> Enterprise**. Branch protection rules (PR approvals) are unaffected by this
> and work on private repos too.

1. Inside `production` → **Deployment protection rules → Required reviewers**
2. Add yourself and/or your QC lead as a reviewer.
3. Recommended: enable **Prevent self-review** — forces the approver to be
   someone *different* from whoever triggered the workflow (more realistic
   QC simulation). Requires adding a second GitHub account/collaborator to
   actually test.
4. Leave **Allow administrators to bypass configured protection rules**
   **unchecked** — otherwise admins can skip the gate entirely.

### 5.3 Add environment secrets (if using real infra later)
- `staging` environment → staging-scoped credentials
- `production` environment → separate, production-scoped credentials

This project's simulated version doesn't need any secrets.

### 5.4 Protect the `main` branch
1. **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`
3. Enable **Require a pull request before merging**
4. Set required approvals to `1` (or more)
5. Optionally enable **Require status checks to pass before merging**
6. Save

---

## 6. The full promotion flow

1. **Develop locally**, commit, push to `stage`.
2. `stage.yml` fires automatically:
   - Runs `check.js`
   - Simulated deploy to staging (no approval pause)
3. **QC/you review** the staging output.
4. Open a **Pull Request**: `stage → main`.
5. **Gate 1 — code review:** a reviewer approves the PR (branch protection
   requires this before the Merge button becomes clickable).
6. **Merge the PR.** This creates a push event on `main`.
7. `main.yml` triggers automatically — but pauses at the `environment:
   production` step, showing **"Waiting for review"** in the Actions tab.
8. **Gate 2 — deployment approval:** open the run → **Review pending
   deployments** → select `production` → **Approve and deploy**.
9. The job resumes: runs `check.js` again, then the simulated production
   deploy step executes.

Two independent checkpoints exist by design:
- **PR approval** gates *code entering `main`*.
- **Environment approval** gates *the actual deployment*, even if code is
  already merged.

---

## 7. Common pitfalls (from real testing)

| Symptom | Cause | Fix |
|---|---|---|
| Check fails with "missing `<h1>` tag" even though the tag exists | `check.js` used an exact string match (`<h1>`), which breaks on `<H1>` or `<h1 class="...">` | Use the regex version: `/<h1[\s>]/i` |
| "Required reviewers" section missing from environment settings | Repo is private on a non-Enterprise plan | Make the repo public, or rely on branch protection only |
| Production environment allowed deploys from `stage` | Deployment branch rule was set to `stage` instead of `main` | Settings → Environments → production → change branch rule to `main` |
| Merging a PR to `main` doesn't pause for approval | No required reviewers configured on the `production` environment, or admin bypass is enabled | Add required reviewers; uncheck "Allow administrators to bypass" |

---

## 8. Going from simulated → real deployment later

Nothing about the approval flow changes. Only the steps inside each
`Deploy to ... (simulated)` block change — e.g. replacing the `echo`/`sed`
lines with real commands like:

```yaml
- name: Build and push image
  run: |
    docker build -t $REGISTRY/$REPO:$TAG .
    docker push $REGISTRY/$REPO:$TAG

- name: Deploy
  run: kubectl set image deployment/app app=$REGISTRY/$REPO:$TAG -n production
```

The branching model, PR gate, and environment approval gate stay exactly
the same.
