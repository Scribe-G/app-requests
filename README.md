# App Requests

Members ask for a web app to be built from a product's address, follow the shared build queue, and browse the library of finished apps with install and source links.

Inspired by https://oss.new

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Request a build by pasting a product's address and see where it stands in the shared queue.
- Browse, search and filter the library of finished apps, and open one to install it or read its source.
- As an admin, move requests between queued, building, done and declined, and publish, edit, unpublish or delete library entries.

Left out: the automated building itself, one-click deploy and repository cloning (plain links instead), marketing pages, and accounts and sign-in, which your Gateway handles.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test`; the browser checks in `checks/` run against a packaged release
- Deploy: `pnpm run deploy`

No secrets or settings: the app uses one D1 database, which the deploy creates. Organization owners and admins curate; every member can request and browse.

## Limitations

- Nothing builds automatically: an admin moves requests along and publishes the finished app by hand.
- Install and source links are whatever the admin enters; the app doesn't check them.
- The deploy itself was not exercised here; only the local release checks ran.
