/**
 * LyricsFloat - In-App Changelog Data & Renderer
 * Separated from index.html to keep the markup lean and maintainable.
 */

(function(root) {
  let changelogList = [];
  if (typeof require !== 'undefined') {
    try {
      changelogList = require('../data/changelog-data').CHANGELOG_DATA;
    } catch (e) {}
  }
  if ((!changelogList || changelogList.length === 0) && root && root.CHANGELOG_DATA) {
    changelogList = root.CHANGELOG_DATA;
  }
  const CHANGELOG_DATA = changelogList || [];

function renderChangelog(container) {
  if (!container) return;
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();

  CHANGELOG_DATA.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'changelog-group';

    // Group Header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    groupHeader.dataset.toggle = 'group';

    const groupTitleWrap = document.createElement('div');
    groupTitleWrap.style.display = 'flex';
    groupTitleWrap.style.alignItems = 'center';
    groupTitleWrap.style.gap = '6px';

    const groupArrow = document.createElement('span');
    groupArrow.className = 'group-arrow';
    groupArrow.textContent = group.isExpanded ? '▼' : '▶';

    const groupTitle = document.createElement('span');
    groupTitle.className = 'group-title';
    groupTitle.textContent = group.groupTitle;

    groupTitleWrap.appendChild(groupArrow);
    groupTitleWrap.appendChild(groupTitle);
    groupHeader.appendChild(groupTitleWrap);

    if (group.isLatest) {
      const groupBadge = document.createElement('span');
      groupBadge.className = 'group-badge';
      groupBadge.textContent = 'Latest';
      groupHeader.appendChild(groupBadge);
    }

    // Group Content
    const groupContent = document.createElement('div');
    groupContent.className = 'group-content';
    if (!group.isExpanded) {
      groupContent.style.display = 'none';
    }

    // Releases
    group.releases.forEach(release => {
      const releaseCard = document.createElement('div');
      releaseCard.className = 'release-card';

      // Release Header
      const releaseHeader = document.createElement('div');
      releaseHeader.className = 'release-header';
      releaseHeader.dataset.toggle = 'release';

      const releaseLeft = document.createElement('div');
      releaseLeft.style.display = 'flex';
      releaseLeft.style.alignItems = 'center';
      releaseLeft.style.gap = '6px';

      const releaseArrow = document.createElement('span');
      releaseArrow.className = 'release-arrow';
      releaseArrow.textContent = release.isExpanded ? '▼' : '▶';

      const releaseTag = document.createElement('span');
      releaseTag.className = 'release-tag';
      releaseTag.textContent = release.version;

      releaseLeft.appendChild(releaseArrow);
      releaseLeft.appendChild(releaseTag);

      if (release.isLatest) {
        const releaseBadge = document.createElement('span');
        releaseBadge.className = 'release-badge';
        releaseBadge.textContent = 'Latest';
        releaseLeft.appendChild(releaseBadge);
      }

      const releaseDate = document.createElement('span');
      releaseDate.className = 'release-date';
      releaseDate.textContent = release.date;

      releaseHeader.appendChild(releaseLeft);
      releaseHeader.appendChild(releaseDate);

      // Release Content
      const releaseContent = document.createElement('div');
      releaseContent.className = 'release-content';
      if (!release.isExpanded) {
        releaseContent.style.display = 'none';
      }

      // Sections
      release.sections.forEach(sec => {
        const secDiv = document.createElement('div');
        secDiv.className = 'changelog-sec';

        const tag = document.createElement('span');
        tag.className = `changelog-tag tag-${sec.type}`;
        tag.textContent = sec.title;
        secDiv.appendChild(tag);

        const ul = document.createElement('ul');
        sec.items.forEach(item => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${item.title}:</strong> ${item.desc}`;
          ul.appendChild(li);
        });
        secDiv.appendChild(ul);
        releaseContent.appendChild(secDiv);
      });

      releaseCard.appendChild(releaseHeader);
      releaseCard.appendChild(releaseContent);
      groupContent.appendChild(releaseCard);
    });

    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(groupContent);
    fragment.appendChild(groupDiv);
  });

  container.appendChild(fragment);

  // Setup click delegation for smooth accordion expand/collapse
  container.onclick = (e) => {
    const groupH = e.target.closest('.group-header[data-toggle="group"]');
    if (groupH) {
      const content = groupH.nextElementSibling;
      const arrow = groupH.querySelector('.group-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
      return;
    }

    const releaseH = e.target.closest('.release-header[data-toggle="release"]');
    if (releaseH) {
      const content = releaseH.nextElementSibling;
      const arrow = releaseH.querySelector('.release-arrow');
      if (content) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'flex' : 'none';
        if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
      }
      return;
    }
  };
}

// Auto-render if #changelog-body is present in DOM
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const body = document.getElementById('changelog-body');
      if (body) renderChangelog(body);
    });
  } else {
    const body = document.getElementById('changelog-body');
    if (body) renderChangelog(body);
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CHANGELOG_DATA, renderChangelog };
  }
  if (root) {
    root.CHANGELOG_DATA = CHANGELOG_DATA;
    root.renderChangelog = renderChangelog;
  }
})(typeof self !== 'undefined' ? self : this);
