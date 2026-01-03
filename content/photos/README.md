CMS photo covers

Editors: use the CMS collection "Photos — Years Index (covers)" to set year cover images.

- Open the "Photos — Years Index (covers)" entry in Netlify CMS.
- For each year, upload a cover image using the field labeled "Cover Image" (JSON key: `cover`).
- The CMS will store the public path in `content/photos/index.json` as `/uploads/photos/covers/<filename>`.
- Do NOT manually type or hardcode `/uploads/...` paths in `index.json` — always upload through the CMS.

Notes for maintainers:
- The collection writes files to `content/photos/index.json` and stores media in `uploads/photos/covers` (public ` /uploads/photos/covers`).
- Frontend will prefer the `cover` key and fall back to `thumbnail` if present.
- If you need to migrate existing cover files in a different folder, upload them via the CMS to ensure paths are correct.
