# This is NOT a WordPress installation

This static site was rebuilt from scratch to replace the old WordPress
install at bloomingtonvelo.org. There is no WordPress here, no PHP, no
database — this folder exists purely as a compatibility shim.

`wp-content/uploads/` holds six legacy image files. They exist because at
least one roster bio on `/team/` was carried over **verbatim** from the old
WordPress content (by explicit instruction from the site owner) and that
bio's HTML embeds absolute URLs like
`https://bloomingtonvelo.org/wp-content/uploads/Blayne-Roeder-scaled.jpeg`.
Those URLs cannot be edited without violating the verbatim-bio rule, so the
files have to keep existing at these exact paths instead.

**Do not delete this folder.** Deleting it will break a club member's photo
on the team roster page.
