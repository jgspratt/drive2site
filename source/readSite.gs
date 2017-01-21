function readSiteTest() {
  var siteDomain = 'jgs.im';
  var siteName = 'jgs';
  var site = SitesApp.getSite(siteDomain, siteName);
  var siteHash = {};
  readSiteToHash(site, siteHash, null, '');
  Logger.log('hello thar');
  Logger.log('maxPathDepth: ' + getMaxPathDepth(siteHash));
  for (var key in siteHash) {
    if (siteHash.hasOwnProperty(key)) {
      Logger.log(key + " -> " + siteHash[key]['pageName']);
    }
  }
}

function readSiteToHash(site, siteHash, parent, parentPath) {
  // Reads the site into a site hashmap in the format
  // <url> : <pageName>, <pageTitle>,
  // Where <url> is in the format "/parent-page/child-page"
  // Pass in parent as null; it's for recursion
  // Pass in parentPath as ''; it's for recursion
  
  if (!parent) {
    // Root of site; gather pages at root of site
    var children = site.getChildren({
      type: SitesApp.PageType.WEB_PAGE,
      start: 0,
      max: 200,
      includeDrafts: false,
      includeDeleted: false,
    });
  } else {
    // Below root of site; gather children of parent page
    var children = parent.getChildren({
      type: SitesApp.PageType.WEB_PAGE,
      start: 0,
      max: 200,
      includeDrafts: false,
      includeDeleted: false,
    });
  }
  
  var childrenLength = children.length;
  
  if (childrenLength === 0) {
    // Base case; no children found
    return;
  }
  
  for (var i = 0; i < childrenLength; i++) {
    // Put each immediate child into siteHash, then recurse
    var child = children[i];
    var childName = child.getName();
    var childTitle = child.getTitle();
    var childLastUpdated = child.getLastUpdated();
    var childPath = parentPath + '/' + childName;
    logVerbose('Adding childUrl: ' + children[i].getUrl() + ' (parent of ' + parent + ') to the siteHash');
    siteHash[childPath] = {
      'pageName':childName,
      'pageTitle':childTitle,
      'pageLastUpdated':childLastUpdated,
    };
    readSiteToHash(site, siteHash, child, childPath);
  }
}

function getMaxPathDepth(siteHash) {
  var maxDepth = 0;  // A page at /tech, for example, is at depth 0.  A page at /tech/irc is at depth 1
  var thisDepth = 0;
  for (var path in siteHash) {  // The path is the key
    if (siteHash.hasOwnProperty(path)) {
      thisDepth = getPathDepth(path);
      if (thisDepth > maxDepth) {
        maxDepth = thisDepth;
      }
    }
  }
  return maxDepth;
}

function getPathDepth(path) {
  var depth = path.substr(1).split('/').length - 1;  // A page at /tech, for example, is at depth 0.  A page at /tech/irc is at depth 1
  //Logger.log('The depth of ' + path + ' is ' + depth);
  return depth;
}

function getPageFromPath(site, path) {
  // Pass in path in format /parent/child and get page object out
  path = path.substr(1) // Eliminate leading '/'
  var pathArray = path.split('/');
  var page = null;
  var pathArrayLength = pathArray.length;
  if (pathArray[0] === '') {
    // No URL given; return 'home' page
    page = site.getChildByName('home');
  } else if (pathArrayLength === 1) {
    // This is a top level page
    page = site.getChildByName(pathArray[0]);
  } else {
    // Not a top level page
    for (var i = 0; i < pathArrayLength; i++) {
      if (i === 0) {
        // At top level; must get the top level page first
        page = site.getChildByName(pathArray[i]);
      } else {
        // Below top level; child page is child of current page
        page = page.getChildByName(pathArray[i]);
      }
    }
  }
  return page;
}

function getPathFromPage(site, page) {
  var siteUrlLength = site.getUrl().length;
  var pagePath = page.getUrl().substr(siteUrlLength - 1);
  // The '- 1' is because the trailing slash is in the site url
  // E.g., https://sites.google.com/a/jgs.im/jgs/
  return pagePath;
}

