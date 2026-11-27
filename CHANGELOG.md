# Changelog

Releases up to v0.6.0, and notes written before the switch to generated changelogs, are in [changelog/HISTORY.md](changelog/HISTORY.md).

## [0.8.0](https://github.com/xtr-dev/payload-mailing/compare/v0.7.1...v0.8.0) - 2026-11-27

### Features
- **send:** throw ImmediateProcessingError when an email was queued but the inline run failed ([#163](https://github.com/xtr-dev/payload-mailing/issues/163)) ([500169d](https://github.com/xtr-dev/payload-mailing/commit/500169d2d0e71c09c00403a5e9f55ac42a194e3f))

### Fixes
- **jobs:** ignore finished jobs when checking for an email's existing job ([#170](https://github.com/xtr-dev/payload-mailing/issues/170)) ([553bbf1](https://github.com/xtr-dev/payload-mailing/commit/553bbf1286fb6c138ad6b8d1af8cc5b0fdee94b4))
- **retry:** release emails left in processing by a crashed send ([#169](https://github.com/xtr-dev/payload-mailing/issues/169)) ([8d5e430](https://github.com/xtr-dev/payload-mailing/commit/8d5e430ed618c2d6a4306ab579f4a5689629ec41))
- **retry:** make retryFailedEmails find emails that used up their attempts ([#167](https://github.com/xtr-dev/payload-mailing/issues/167)) ([20bafc5](https://github.com/xtr-dev/payload-mailing/commit/20bafc5da7e15d538d0e5445d217614ee6660383))
- **retry:** retry failed sends automatically after retryDelay ([#166](https://github.com/xtr-dev/payload-mailing/issues/166)) ([50306af](https://github.com/xtr-dev/payload-mailing/commit/50306af077e7cd9013e2c669c9394c8c4588d5b6))
- **dev:** use the default initOrder in the demo config ([#125](https://github.com/xtr-dev/payload-mailing/issues/125)) ([d4e5312](https://github.com/xtr-dev/payload-mailing/commit/d4e5312759104dd1cf08eea947533a17507d979b))
- **logger:** cache the plugin logger per payload instance ([#124](https://github.com/xtr-dev/payload-mailing/issues/124)) ([709adbb](https://github.com/xtr-dev/payload-mailing/commit/709adbb9905f23e64da19415ba16f95b829f93c8))
- **dev:** name Liquid, not Handlebars, in the playground seed and types ([#118](https://github.com/xtr-dev/payload-mailing/issues/118)) ([ef0065e](https://github.com/xtr-dev/payload-mailing/commit/ef0065e12def883306f883068016ff397a9bdf60))
- **deps:** remove unused react-dom peer ([#113](https://github.com/xtr-dev/payload-mailing/issues/113)) ([039c008](https://github.com/xtr-dev/payload-mailing/commit/039c00833cd50902b16543c4f16d4a0c4a3d0658))
- **templates:** render mustache subject and text verbatim ([#110](https://github.com/xtr-dev/payload-mailing/issues/110)) ([9fdc0e6](https://github.com/xtr-dev/payload-mailing/commit/9fdc0e642ac6e2ffe48bac603dd5e95e3adeac87))
- **types:** accept string recipients in sendEmail's data option ([#108](https://github.com/xtr-dev/payload-mailing/issues/108)) ([256e845](https://github.com/xtr-dev/payload-mailing/commit/256e845a34340ca806610a38ba34eb529567cfbc))
- **recipients:** reject a to value that normalizes to no addresses ([#106](https://github.com/xtr-dev/payload-mailing/issues/106)) ([5ae0808](https://github.com/xtr-dev/payload-mailing/commit/5ae08088507d16e6086b5d0962f9a56ab14c64af))

### Other
- **deps:** remove the unused mongodb-memory-server devDependency ([#171](https://github.com/xtr-dev/payload-mailing/issues/171)) ([157892c](https://github.com/xtr-dev/payload-mailing/commit/157892c5dc2c612529d2177f53bc5803716c5cb6))
- **dev:** remove the broken dev:memory and dev:start scripts ([#168](https://github.com/xtr-dev/payload-mailing/issues/168)) ([9ef5280](https://github.com/xtr-dev/payload-mailing/commit/9ef52803ed17f760cf801aa5603c2a1d24ad8dfe))
- audit README and docs for accuracy and brevity ([#165](https://github.com/xtr-dev/payload-mailing/issues/165)) ([264fea7](https://github.com/xtr-dev/payload-mailing/commit/264fea7a8ef2369fbf401025daf9929516d8256d))
- bump dev dependencies to clear security advisories ([#164](https://github.com/xtr-dev/payload-mailing/issues/164)) ([8f81c1b](https://github.com/xtr-dev/payload-mailing/commit/8f81c1b33545a1752582afca74b9c3c5c9663034))
- **templates:** cover renderTemplate refusing an unknown slug ([#136](https://github.com/xtr-dev/payload-mailing/issues/136)) ([55f1059](https://github.com/xtr-dev/payload-mailing/commit/55f1059a893249641813e8532be7d36d93f49ece))
- **mailing:** pin defaultFrom resolution at the send boundary ([#135](https://github.com/xtr-dev/payload-mailing/issues/135)) ([55253a9](https://github.com/xtr-dev/payload-mailing/commit/55253a9a05716d24836a86c7024a5318f0ad7d6c))
- **email-processor:** cover the processor guards and dispatch order ([#162](https://github.com/xtr-dev/payload-mailing/issues/162)) ([5724383](https://github.com/xtr-dev/payload-mailing/commit/57243833b94451cb298b18235fe08f871c5e051a))
- **typecheck:** add a typecheck script and run it in CI ([#129](https://github.com/xtr-dev/payload-mailing/issues/129)) ([a309a97](https://github.com/xtr-dev/payload-mailing/commit/a309a97376859e7ee99f495d1443da08726d2620))
- **e2e:** add a playwright config that scopes test:e2e to the e2e spec ([#128](https://github.com/xtr-dev/payload-mailing/issues/128)) ([ea19022](https://github.com/xtr-dev/payload-mailing/commit/ea1902239a64e563d5987da1f6473cc7b9cf7b0d))
- **readme:** document the initOrder and richTextEditor options ([#127](https://github.com/xtr-dev/payload-mailing/issues/127)) ([5591f53](https://github.com/xtr-dev/payload-mailing/commit/5591f539c223b5e601f43a64f08bb02a26049ec4))
- **pnpm:** stop install from adopting an ancestor's workspace ([#126](https://github.com/xtr-dev/payload-mailing/issues/126)) ([c0ec5bd](https://github.com/xtr-dev/payload-mailing/commit/c0ec5bd34ddce783029190c0865b0f1a708a74f8))
- **plugin:** pin the adminPreview:false field and endpoint asymmetry ([#123](https://github.com/xtr-dev/payload-mailing/issues/123)) ([cb0c572](https://github.com/xtr-dev/payload-mailing/commit/cb0c5722ad6e3815c89615cfc35e429a6595a736))
- **plugin:** cover host collections that collide with plugin slugs ([#122](https://github.com/xtr-dev/payload-mailing/issues/122)) ([5bfcecd](https://github.com/xtr-dev/payload-mailing/commit/5bfcecde34381918d4de04e12443491b806651fd))
- **plugin:** cover onInit ordering for initOrder before and after ([#121](https://github.com/xtr-dev/payload-mailing/issues/121)) ([8db64e3](https://github.com/xtr-dev/payload-mailing/commit/8db64e3a3787a0ea6301c3e9ec087bd5563040ce))
- **plugin:** cover custom template slugs on the email relationship ([#120](https://github.com/xtr-dev/payload-mailing/issues/120)) ([68bf070](https://github.com/xtr-dev/payload-mailing/commit/68bf0705e69ae6db96b9a766fb41618953741c10))
- **exports:** pin default export aliases to their named references ([#119](https://github.com/xtr-dev/payload-mailing/issues/119)) ([51b54bd](https://github.com/xtr-dev/payload-mailing/commit/51b54bde490d8e2c517154d38a53d6169e62824c))
- name the real template engines in DEVELOPMENT.md ([#117](https://github.com/xtr-dev/payload-mailing/issues/117)) ([bf1128b](https://github.com/xtr-dev/payload-mailing/commit/bf1128b1a0adb9b1e7223c535c4021c09f7e9dfe))
- **send:** cover sendEmail's create contract and recipient input types ([#116](https://github.com/xtr-dev/payload-mailing/issues/116)) ([0a378a9](https://github.com/xtr-dev/payload-mailing/commit/0a378a9f87a43be27b445fcb7b5dc9d9342afc6c))
- **send:** cover sendEmail's immediate processing path ([#115](https://github.com/xtr-dev/payload-mailing/issues/115)) ([0c6be65](https://github.com/xtr-dev/payload-mailing/commit/0c6be656f033104989531c820c79af6f72af5185))
- **helpers:** cover display-name header-injection guards ([#114](https://github.com/xtr-dev/payload-mailing/issues/114)) ([cd8a428](https://github.com/xtr-dev/payload-mailing/commit/cd8a4280e8067c87ee714a174f7c02e3ee512234))
- **recipients:** cover address parsing and header-injection guards ([#111](https://github.com/xtr-dev/payload-mailing/issues/111)) ([4ff527f](https://github.com/xtr-dev/payload-mailing/commit/4ff527fb22e9722e8e57572e9cb8347617266deb))
- **helpers:** cover parseAndValidateEmails normalization and validation ([#109](https://github.com/xtr-dev/payload-mailing/issues/109)) ([1eef0e7](https://github.com/xtr-dev/payload-mailing/commit/1eef0e79b0601452e84149f576f5ef0e2430cf35))
- **mailing:** cover processEmailItem's claim, retry and send contract ([#107](https://github.com/xtr-dev/payload-mailing/issues/107)) ([7f78c43](https://github.com/xtr-dev/payload-mailing/commit/7f78c43c94b1ec05e4aadb98c3369bf2e0997c63))

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
