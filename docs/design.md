# Design notes
Direction: familiar, dense commerce layout (clear like Amazon, no Amazon assets). White surfaces, charcoal text, gray borders, one accent.
Tokens (public/css/styles.css, `:root`): --bg #fff, --tx #1f2328, --mu #59636e, --bd #d0d7de, --sf #f6f8fa, --ac #0b6b8a. Dark-mode values are in the `prefers-color-scheme` block.
Rules: 44px minimum touch targets, visible 3px focus ring, square product-image areas with fallback text, 15px body text.
Components: product card, score box, feedback post (`.rv`), comparison table (sticky first column), Like button (`.like`, SVG heart + visible Like/Liked text, aria-pressed), My Likes item (`.lk`), Likes tray.
Like colour: --lk (muted red), used only for the filled heart and liked border. Heart pop animation is disabled under prefers-reduced-motion.
To change the accent colour, edit --ac (and its dark value) only.
