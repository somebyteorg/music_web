# music web

## Import release metadata while organizing uploads

On the **Uploads** page, open **Batch organize audio** and expand **Get album data from MusicBrainz** for a group. Search by album and optional artist, choose the exact release after checking its date, country, label, catalog number and track list, then apply the release metadata and credits. The preview includes the complete available track list, artist credits, recording IDs, lengths, ISRCs, media formats, barcode and genre tags.

Tracks are matched to the selected local audio by a unique title or reliable disc/track position. Exact recording IDs are searched first so an existing song can be reused; candidates remain visible for manual selection. New song records are created only for selected local audio files. Other tracks in the source release remain a comparison list and do not create audio-less records. Existing non-empty metadata and covers are preserved unless the user explicitly chooses to replace a cover.

The optional **Import and select front cover** action copies a selected Cover Art Archive image into the existing image library only after an explicit rights confirmation. Importing does not automatically replace an existing album cover, and the normal review and publish confirmation remains required. Artwork may be copyrighted; import it only when you have the right to use it. Metadata and artwork source links are shown in the dialog.

## Import metadata from domestic platform pages

In the same batch organizer, expand **Get data from a QQ Music, NetEase Cloud Music or Kugou public album page**. Paste an HTTPS album/share-page link and read the page, or expand the text area and paste the visible page text if the page is blocked, requires sign-in, is dynamically rendered, or has an incomplete track list. This reads only a user-supplied public page or user-supplied text; it does not use platform APIs, log in, bypass access controls, or download audio.

Review the available album artist, release date/year, label, catalog number, genre, country, disc/track counts, description, barcode, formats, cover preview and complete track list before applying. Fields with no matching EmoS catalog column (currently description, barcode, formats and the remote cover URL) remain preview-only. Platform identifiers are never treated as MusicBrainz IDs. The existing library candidate search and manual publish confirmation remain in place. Tracks not matched to selected local audio are display-only and never create audio-less songs. Cover artwork is preview-only: if you have permission to use it, select a local cover file through the existing upload controls; no remote cover is automatically downloaded or substituted.

## Login

The sign-in page supports the existing EMOS login link and a manual, one-time EMOS token entry. The token field is masked, sent only in a POST body through the current site's `/api/login` session flow, and cleared after the attempt; it is not stored in browser storage or placed in a URL. When the app is deployed at `https://music.emos.best/`, the frontend calls its same-origin `/api` backend.
