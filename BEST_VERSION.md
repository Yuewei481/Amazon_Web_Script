# Current Best Version

Saved at: 2026-05-30 12:27 Asia/Shanghai

Backup directory:

`backups/current-best-2026-05-30-1227`

Git commit:

`08d72b6`

Git tag:

`best-2026-05-30-current`

Why this version is marked best:

- Full visible-browser run completed successfully.
- Amazon login, ZIP setup, SellerSprite login, and Greeting Cards Best Sellers flow worked.
- Product title filtering for pop up variants worked before waiting for SellerSprite detail data.
- SellerSprite child monthly sales filtering worked.
- Image collection was fixed to use the left-side product thumbnail directory and keep up to six thumbnails per product.
- Amazon Best Seller lazy-loaded candidate collection was fixed so lower-ranked first-page items such as #31 and #35 are not skipped.
- Product image-area recovery was added before capture, so SellerSprite refreshes do not leave the scraper reading a half-loaded page with zero thumbnails.
- Cart cleanup now uses an active browser page if the original page was closed during tab switching.
- Exact duplicate image hashes are deduped across the whole run.
- Cart/checkout request protection was active, and cart cleanup completed.
- Latest output contained 13 qualified products and 83 saved images.
- The verified output includes `B0DSCMBNSS` and `B0FH4CB7CP`.

Latest verified output:

`outputs/pop-up-greeting-card-2026-05-30-1150/选品表格-pop-up-greeting-card-2026-05-30.xlsx`

Restore note:

If the user asks to return to the best/satisfactory version, restore the project code from git tag `best-2026-05-30-current` or from `backups/current-best-2026-05-30-1227`. Do not overwrite `.env` unless the user explicitly asks, because account credentials live there.
