# Stitch trusted publishing notes

This package is set up for npm trusted publishing from GitHub Actions, matching the other public adapter CLIs.

## Expected repository assets

- `.github/workflows/ci.yml`
- `.github/workflows/publish.yml`

## npm trusted publisher setup

In npm, configure a Trusted Publisher for the GitHub repository that will own this package.

Expected settings:

- provider: GitHub Actions
- repository owner: `danielgwilson`
- repository name: `stitch-design-cli`
- workflow filename: `publish.yml`
- package name: `stitch-design-cli`
- registry: npm public registry

## Release flow

Bootstrap:

1. create the GitHub repo
2. add `repository`, `homepage`, and `bugs` metadata to `package.json`
3. do a one-time manual npm publish so the package page exists
4. add the trusted publisher on npm

After bootstrap:

1. bump version
2. push commit
3. push tag `vX.Y.Z`
4. let GitHub Actions publish

## Notes

- Do not publish until docs are scrubbed for real project ids, URLs, and screenshots.
- The live smoke-test project created during local validation should not be copied into public docs or examples.
