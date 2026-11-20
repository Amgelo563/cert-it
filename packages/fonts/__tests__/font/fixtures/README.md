# Font fixtures

Real fonts cut down with fontTools to printable ASCII plus `é`, so the tests know exactly which characters each one has.

| File             | Made from                                                     | License               |
| ---------------- | ------------------------------------------------------------- | --------------------- |
| `variable.ttf`   | Inter, latin, weight axis (from `@fontsource-variable/inter`) | `LICENSE_INTER`       |
| `basic.ttf`      | the same font, fixed at weight 400                            | `LICENSE_INTER`       |
| `basic.woff2`    | `basic.ttf`, saved as WOFF2                                   | `LICENSE_INTER`       |
| `collection.ttc` | the same font at weights 400 and 700, in one file             | `LICENSE_INTER`       |
| `basic.otf`      | Inconsolata, with CFF outlines (from `bwip-js`)               | `LICENSE.INCONSOLATA` |

Both fonts are under the SIL Open Font License 1.1, which allows changing and redistributing them.
