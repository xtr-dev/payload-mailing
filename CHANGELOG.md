# Changelog

Releases up to v0.6.0, and notes written before the switch to generated changelogs, are in [changelog/HISTORY.md](changelog/HISTORY.md).

## [0.7.1](https://github.com/xtr-dev/payload-mailing/compare/v0.7.0...v0.7.1) - 2026-11-26

### Fixes
- fill templateSlug for numeric template IDs ([#159](https://github.com/xtr-dev/payload-mailing/issues/159)) ([da06ab0](https://github.com/xtr-dev/payload-mailing/commit/da06ab0904f05c801042f11d798237684cd2b557))
- resolve dotted names in required template variables ([#161](https://github.com/xtr-dev/payload-mailing/issues/161)) ([cb45d65](https://github.com/xtr-dev/payload-mailing/commit/cb45d65f0dc9ca81a947968535af018d18204db1))
- render template variables in rich-text link URLs ([#160](https://github.com/xtr-dev/payload-mailing/issues/160)) ([9e0cbbd](https://github.com/xtr-dev/payload-mailing/commit/9e0cbbd210fb33b5270f5e8be3f35253b9fbedc4))
- run processImmediately jobs on non-default queues ([#158](https://github.com/xtr-dev/payload-mailing/issues/158)) ([eae040b](https://github.com/xtr-dev/payload-mailing/commit/eae040bb43ed152daaf0667ff0edebbcb0e77a47))

## [0.7.0] - 2026-11-25

### Features
- **templates:** perPart() gives a variable separate HTML and text values ([#149](https://github.com/xtr-dev/payload-mailing/issues/149)) ([75bf293](https://github.com/xtr-dev/payload-mailing/commit/75bf293eb95c33eea312d535ce1284e6d48da5d1))
- **filters:** locale, currency and timeZone options for formatDate/formatCurrency ([#150](https://github.com/xtr-dev/payload-mailing/issues/150)) ([5e7aab0](https://github.com/xtr-dev/payload-mailing/commit/5e7aab005024e3b4e2135ee06772510d197a431c))
- **templates:** add strictTemplates to fail on template errors instead of falling back ([#148](https://github.com/xtr-dev/payload-mailing/issues/148)) ([8572e85](https://github.com/xtr-dev/payload-mailing/commit/8572e858efbe5a2c18a79d43eea52e74e7347931))
- **filters:** locale, currency and timeZone options for formatDate/formatCurrency ([43d6dc5](https://github.com/xtr-dev/payload-mailing/commit/43d6dc506d2427a85b386651e0c8bfd96f62a658))
- **templates:** perPart() gives a variable separate HTML and text values ([a4ae44c](https://github.com/xtr-dev/payload-mailing/commit/a4ae44c733df91e27df8c2bf90b7b2577b541fde))
- **templates:** add strictTemplates to fail on template errors instead of falling back ([1215c00](https://github.com/xtr-dev/payload-mailing/commit/1215c00e1b5d21ab9eb0f2fea95b8512c537659b))

### Fixes
- **richtext:** read Payload 3 link fields, render autolinks, resolve internal links ([#147](https://github.com/xtr-dev/payload-mailing/issues/147)) ([5b71a2d](https://github.com/xtr-dev/payload-mailing/commit/5b71a2d139fea87a7cc2f8a010f7ad8e9c5bf6ac))
- **richtext:** keep Liquid tags verbatim when escaping text nodes ([#155](https://github.com/xtr-dev/payload-mailing/issues/155)) ([4b7fac7](https://github.com/xtr-dev/payload-mailing/commit/4b7fac79d662a3b7dfa6db06f10da5ebc0fcab7d))
- **preview:** check template access in the preview endpoint; export escapeHtml ([#153](https://github.com/xtr-dev/payload-mailing/issues/153)) ([5210651](https://github.com/xtr-dev/payload-mailing/commit/5210651fa38e8496b0a4745574a3d1ada1340305))
- **richtext:** engine-aware tag passthrough, escaped fallback on parse errors ([2beca2f](https://github.com/xtr-dev/payload-mailing/commit/2beca2ffe8411a96487f6b45ed487352b5182304))
- **richtext:** keep Liquid tags verbatim when escaping text nodes ([3a53bd8](https://github.com/xtr-dev/payload-mailing/commit/3a53bd8e32942a39d5482b9456e1e4efeb7ccc54))
- **richtext:** don't escape quotes in text nodes so quoted Liquid args parse ([df1cb3a](https://github.com/xtr-dev/payload-mailing/commit/df1cb3a1173c442347d200af49a5723073c6aa7c))
- **preview:** static export test, escape single quotes, handle throwing access ([c2dfc7b](https://github.com/xtr-dev/payload-mailing/commit/c2dfc7bf9736b2fc3ab93e067542936252f36ccb))
- **templates:** guard perPart resolution against cyclic variables ([6ec71a0](https://github.com/xtr-dev/payload-mailing/commit/6ec71a04aca02835aa2f28b23e8dc06e3edcc101))
- **templates:** strict mode also rejects unknown filters and missing engines ([c1d8588](https://github.com/xtr-dev/payload-mailing/commit/c1d858805186f9f216a52cf0b0cfaa1023dbc9b4))
- **filters:** validate locale/currency/timeZone at init, fall back on bad filter args ([415b7f5](https://github.com/xtr-dev/payload-mailing/commit/415b7f571df4d1f896480679a319e2588e8db221))
- **preview:** check template access in the preview endpoint; export escapeHtml ([2662cce](https://github.com/xtr-dev/payload-mailing/commit/2662cce7bf1ca20c554ea7693a83404c6ef04faa))
- **richtext:** read Payload 3 link fields, render autolinks, resolve internal links ([3923be9](https://github.com/xtr-dev/payload-mailing/commit/3923be9a92f8f669f91b1c3424ebe10f6aedbcda))
- **queue:** sort equal-priority emails oldest-first via Local API array ([b1f14e1](https://github.com/xtr-dev/payload-mailing/commit/b1f14e10e6b98c19eafb4bce413c0d8612996544))
- **scripts:** resolve package.json path instead of assuming it's relative ([13bccf0](https://github.com/xtr-dev/payload-mailing/commit/13bccf09348e41ef2191283063c61a5b0cbb0573))
- **docs:** tie README's PayloadCMS floor to package.json's peerDependency ([1b28a37](https://github.com/xtr-dev/payload-mailing/commit/1b28a3750acd90658ce79858d4cd1960bdb5cce9))
- **dev:** call seedUser in onInit so a dev user actually exists ([f9b3f4d](https://github.com/xtr-dev/payload-mailing/commit/f9b3f4d032882f3b4934da14f7e2b7cda3d43f41))
- **sendEmail:** honor per-send queue override ([e119bf0](https://github.com/xtr-dev/payload-mailing/commit/e119bf0949114a6bdab9482efc8c1210aad7ced9))
- **deps:** remove unused payload-automation peer ([162415a](https://github.com/xtr-dev/payload-mailing/commit/162415ad7de9545544ef222b6eced1912b4fb9c0))
- **queue:** process equal-priority emails FIFO ([b068358](https://github.com/xtr-dev/payload-mailing/commit/b068358c4584f73f3653cb79ad45894c975fa2de))
- **deps:** declare @payloadcms/richtext-lexical as a required peer dependency ([8150076](https://github.com/xtr-dev/payload-mailing/commit/8150076d250953e6f17d8d32adb81c8d694502ef))

### Other
- release through the shared workflow with xtr-dev/changelog ([#157](https://github.com/xtr-dev/payload-mailing/issues/157)) ([02efbc8](https://github.com/xtr-dev/payload-mailing/commit/02efbc825235110a8529dd8bd39cb0f2df9a6b42))
- document the per-send queue option ([#112](https://github.com/xtr-dev/payload-mailing/issues/112)) ([2ee4506](https://github.com/xtr-dev/payload-mailing/commit/2ee4506f2080cd220fb33b668deda79ca2e4a864))
- staff-only access in the README examples ([#156](https://github.com/xtr-dev/payload-mailing/issues/156)) ([93e2c9e](https://github.com/xtr-dev/payload-mailing/commit/93e2c9e628dd4262e7a675c3633da8758c1f17a2))
- staff-only access in the README examples ([98f2102](https://github.com/xtr-dev/payload-mailing/commit/98f21028c76d6ac17884deb8abb94b01e9a17980))
- **richtext:** an internal-link resolver returning javascript: still yields href="#" ([a34d6f7](https://github.com/xtr-dev/payload-mailing/commit/a34d6f7b719b11c3b6ee6ed423a250037c879082))
- gate CI and publish on test:int now that it actually runs ([79de840](https://github.com/xtr-dev/payload-mailing/commit/79de840ff4edf0c3d0d176ecd13caa286526a77e))
- **changelog:** note new richtext-lexical peerDependency under Unreleased ([0dafda5](https://github.com/xtr-dev/payload-mailing/commit/0dafda57223a91647292312a61d2ec436e17daf3))
- **int:** give test:int its own vitest config so dev/int.spec.ts actually runs ([9288440](https://github.com/xtr-dev/payload-mailing/commit/9288440dcae9823413180be2dba1b032c4861196))
