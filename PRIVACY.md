# Privacy policy for Nice Speed Dials

Last updated: October 18, 2026

Nice Speed Dials does not require an account and does not include analytics.

## Data stored by the extension

Speed dials and folders are saved as browser bookmarks. Your browser controls
how those bookmarks are stored and whether they sync to other signed-in devices.

The extension also stores your display settings, custom folder icons, and any
uploaded background image in local extension storage. Nice Speed Dials does not
send that information to a Nice Speed Dials server.

## Website icons

Chrome and Edge provide website icons through the browser. Firefox does not
provide the same feature, so the Firefox version sends the hostname of each
saved site to FaviconKit (`ico.faviconkit.net`) to retrieve its icon. It does
not send the full saved address, bookmark name, or folder name.

## External pages

The release-notes page embeds video overviews using YouTube's privacy-enhanced
domain (`www.youtube-nocookie.com`). Loading or playing these videos connects to
YouTube, which applies its own privacy policies. The extension supplies its
application identifier as the video request's referrer so YouTube can identify
the embedding app. Permission for this domain is used only to set that header
for the two release videos embedded by the extension.

The review and support buttons open the relevant browser store or Buy Me a
Coffee page only when you choose them. Those sites receive the information a
browser normally sends when opening a webpage and apply their own privacy
policies.

After Nice Speed Dials is uninstalled, the browser opens an optional feedback
survey hosted by Tally. The extension version is included in the survey URL.
Tally receives any answers only if you choose to submit the form.

## Data sharing and sale

Nice Speed Dials does not sell user data. The Firefox hostname request described
above is used only to retrieve website icons. No data is used for advertising,
credit decisions, or purposes unrelated to the extension.

## Retention and deletion

Removing the extension clears its local settings according to your browser's
normal uninstall behavior. Your speed-dial bookmarks remain in the browser. To
delete them, remove the `NICE_SPEED_DIALS_BOOKMARKS_[DO_NOT_DELETE]` folder from
the bookmark manager.

## Changes to this policy

This policy will be updated when the extension's data handling changes. The date
at the top shows the latest revision.

## Contact

For privacy questions, email `nsde@kruz.me` or open an issue in the
[project repository](https://github.com/kruzkasu223/nice-speed-dials-extension/issues).
