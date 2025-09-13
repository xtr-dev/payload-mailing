# Version Management Workflow

This repository uses automated version management with GitHub Actions. Version bumps are triggered based on which branch changes are merged to `main`.

## Available Branches

- `version/major` - For breaking changes (e.g., 1.0.0 → 2.0.0)
- `version/minor` - For new features (e.g., 1.0.0 → 1.1.0)
- `version/patch` - For bug fixes (e.g., 1.0.0 → 1.0.1)

## How to Use

### For Patch Releases (Bug Fixes)
1. Create a branch from `version/patch`:
   ```bash
   git checkout version/patch
   git pull origin version/patch
   git checkout -b fix/your-bug-fix
   # Make your changes
   git commit -m "fix: your bug fix description"
   git push origin fix/your-bug-fix
   ```

2. Create a PR targeting `version/patch`
3. Once approved, merge the PR to `version/patch`
4. Create a PR from `version/patch` to `main`
5. When merged to `main`, the workflow will:
   - Bump patch version (e.g., 1.0.0 → 1.0.1)
   - Run tests and build
   - Publish to NPM
   - Create a GitHub release

### For Minor Releases (New Features)
1. Create a branch from `version/minor`:
   ```bash
   git checkout version/minor
   git pull origin version/minor
   git checkout -b feature/your-feature
   # Make your changes
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

2. Create a PR targeting `version/minor`
3. Once approved, merge the PR to `version/minor`
4. Create a PR from `version/minor` to `main`
5. When merged to `main`, the workflow will:
   - Bump minor version (e.g., 1.0.0 → 1.1.0)
   - Run tests and build
   - Publish to NPM
   - Create a GitHub release

### For Major Releases (Breaking Changes)
1. Create a branch from `version/major`:
   ```bash
   git checkout version/major
   git pull origin version/major
   git checkout -b breaking/your-breaking-change
   # Make your changes
   git commit -m "feat!: your breaking change description"
   git push origin breaking/your-breaking-change
   ```

2. Create a PR targeting `version/major`
3. Once approved, merge the PR to `version/major`
4. Create a PR from `version/major` to `main`
5. When merged to `main`, the workflow will:
   - Bump major version (e.g., 1.0.0 → 2.0.0)
   - Run tests and build
   - Publish to NPM
   - Create a GitHub release

## Direct Push to Main
Direct pushes to `main` will trigger a patch version bump by default.

## Required Secrets

Make sure these secrets are configured in your GitHub repository:

- `NPM_TOKEN` - Your NPM authentication token for publishing
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## Workflow Features

- ✅ Automatic version bumping based on branch
- ✅ AI-generated changelog using Claude Code CLI
- ✅ Squashes all PR commits into single clean commit
- ✅ Runs tests before publishing
- ✅ Builds the package before publishing
- ✅ Creates git tags with changelog in tag message
- ✅ Publishes to NPM with public access
- ✅ Creates GitHub releases with formatted changelog
- ✅ Prevents publishing if tests fail

## Changelog Generation

The workflow automatically generates a standardized changelog for each release using Claude Code CLI. The changelog analyzes git commits since the last release and categorizes them into:

- 🚀 **Features** - New functionality
- 🐛 **Bug Fixes** - Bug fixes and corrections
- 🔧 **Improvements** - Code improvements and refactoring
- 📚 **Documentation** - Documentation updates
- ⚡ **Performance** - Performance optimizations

The generated changelog is included in:
- The single squashed release commit message
- The git tag message
- The GitHub release notes

## Git History Structure

The workflow creates an ultra-clean git history by squashing all commits from the PR into a single release commit:

**Before Squashing:**
```
abc123 feat: add email scheduling
def456 fix: validation bug
ghi789 docs: update readme
jkl012 test: add unit tests
```

**After Squashing:**
```
abc123 ✨ Minor Release

## Changes
### 🚀 Features
- Add email scheduling feature
### 🐛 Bug Fixes
- Fix validation error handling
### 📚 Documentation
- Update readme with new examples
```

This results in one meaningful commit per release with all changes summarized in the AI-generated changelog.

## Version Branch Maintenance

Keep version branches up to date by periodically merging from main:

```bash
git checkout version/patch
git merge main
git push origin version/patch

git checkout version/minor
git merge main
git push origin version/minor

git checkout version/major
git merge main
git push origin version/major
```

This ensures that all version branches have the latest changes from main before creating new features or fixes.